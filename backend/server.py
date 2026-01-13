from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import hashlib
import secrets
import aiohttp
from passlib.context import CryptContext

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Session store (in-memory for simplicity, in production use Redis)
sessions = {}

# Create the main app
app = FastAPI(title="DNS Manager API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserBase(BaseModel):
    username: str

class UserCreate(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    username: str
    created_at: str

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    session_token: str
    user: UserResponse

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class CloudflareAccountCreate(BaseModel):
    name: str
    email: str
    api_key: str
    account_id: Optional[str] = None

class CloudflareAccountResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    email: str
    account_id: Optional[str] = None
    created_at: str

class CloudflareAccountUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    api_key: Optional[str] = None
    account_id: Optional[str] = None

class DomainCreate(BaseModel):
    name: str
    cloudflare_account_id: str
    cloudflare_zone_id: Optional[str] = None
    registration_date: Optional[str] = None
    client_whatsapp: Optional[str] = None
    domain_provider: Optional[str] = None
    preset_id: Optional[str] = None

class DomainUpdate(BaseModel):
    name: Optional[str] = None
    registration_date: Optional[str] = None
    client_whatsapp: Optional[str] = None
    domain_provider: Optional[str] = None
    preset_id: Optional[str] = None

class DomainResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    cloudflare_account_id: str
    cloudflare_zone_id: Optional[str] = None
    registration_date: Optional[str] = None
    client_whatsapp: Optional[str] = None
    domain_provider: Optional[str] = None
    preset_id: Optional[str] = None
    records_count: int = 0
    domain_status: str = "active"
    created_at: str

class DNSRecordCreate(BaseModel):
    record_type: str  # A, AAAA, CNAME, MX, TXT, NS, SRV
    name: str
    content: str
    ttl: int = 3600
    priority: Optional[int] = None  # For MX records
    proxied: bool = False

class DNSRecordUpdate(BaseModel):
    record_type: Optional[str] = None
    name: Optional[str] = None
    content: Optional[str] = None
    ttl: Optional[int] = None
    priority: Optional[int] = None
    proxied: Optional[bool] = None

class DNSRecordResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    domain_id: str
    cloudflare_record_id: Optional[str] = None
    record_type: str
    name: str
    content: str
    ttl: int
    priority: Optional[int] = None
    proxied: bool
    created_at: str

class DNSPresetCreate(BaseModel):
    name: str
    description: Optional[str] = None

class DNSPresetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class DNSPresetResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    description: Optional[str] = None
    records_count: int = 0
    created_at: str

class DNSPresetRecordCreate(BaseModel):
    record_type: str
    name: str  # Use @ for root, * for wildcard
    content: str
    ttl: int = 3600
    priority: Optional[int] = None
    proxied: bool = False

class DNSPresetRecordResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    preset_id: str
    record_type: str
    name: str
    content: str
    ttl: int
    priority: Optional[int] = None
    proxied: bool

class ActivityLogResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    action: str
    entity_type: str
    entity_id: str
    entity_name: Optional[str] = None
    details: Optional[str] = None
    user_id: str
    created_at: str

class CloudflareZoneResponse(BaseModel):
    id: str
    name: str
    status: str
    name_servers: List[str] = []

# ==================== HELPERS ====================

def generate_session_token():
    return secrets.token_urlsafe(32)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

async def get_current_user(request: Request):
    session_token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not session_token or session_token not in sessions:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return sessions[session_token]

async def log_activity(user_id: str, action: str, entity_type: str, entity_id: str, entity_name: str = None, details: str = None):
    log = {
        "id": str(uuid.uuid4()),
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "entity_name": entity_name,
        "details": details,
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.activity_logs.insert_one(log)

# ==================== CLOUDFLARE SERVICE ====================

class CloudflareService:
    def __init__(self, email: str, api_key: str):
        self.email = email
        self.api_key = api_key
        self.base_url = "https://api.cloudflare.com/client/v4"
        
        # Detect if using API Token (starts with specific pattern) or Global API Key
        # API Tokens are typically longer and may start with certain characters
        if len(api_key) > 40 and not "@" in email:
            # Likely an API Token - use Bearer auth
            self.headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            self.auth_type = "token"
        else:
            # Global API Key - use X-Auth headers
            self.headers = {
                "X-Auth-Email": email,
                "X-Auth-Key": api_key,
                "Content-Type": "application/json"
            }
            self.auth_type = "global"
    
    async def verify_token(self) -> dict:
        """Verify the API credentials and return account info"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/user/tokens/verify",
                    headers=self.headers
                ) as resp:
                    data = await resp.json()
                    if resp.status == 200 and data.get("success"):
                        return {"success": True, "message": "API credentials are valid"}
                    else:
                        errors = data.get("errors", [])
                        error_msg = errors[0].get("message") if errors else "Unknown error"
                        return {"success": False, "message": error_msg}
        except Exception as e:
            return {"success": False, "message": str(e)}
    
    async def get_zones(self) -> tuple:
        """Returns (zones_list, error_message)"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/zones",
                    headers=self.headers,
                    params={"per_page": 50}
                ) as resp:
                    data = await resp.json()
                    logger.info(f"Cloudflare zones response status: {resp.status}")
                    
                    if resp.status == 200 and data.get("success"):
                        zones = data.get("result", [])
                        return zones, None
                    else:
                        errors = data.get("errors", [])
                        if errors:
                            error_msg = errors[0].get("message", "Unknown error")
                        else:
                            error_msg = f"HTTP {resp.status}: Failed to fetch zones"
                        logger.error(f"Cloudflare API error: {error_msg}")
                        return [], error_msg
        except Exception as e:
            logger.error(f"Error fetching zones: {str(e)}")
            return [], str(e)
    
    async def get_zone_by_name(self, domain_name: str) -> Optional[dict]:
        zones, error = await self.get_zones()
        if error:
            return None
        for zone in zones:
            if zone.get("name") == domain_name:
                return zone
        return None
    
    async def get_dns_records(self, zone_id: str) -> List[dict]:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.base_url}/zones/{zone_id}/dns_records",
                headers=self.headers,
                params={"per_page": 100}
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("result", [])
                return []
    
    async def create_dns_record(self, zone_id: str, record: dict) -> Optional[dict]:
        payload = {
            "type": record["record_type"],
            "name": record["name"],
            "content": record["content"],
            "ttl": record.get("ttl", 3600),
            "proxied": record.get("proxied", False)
        }
        if record.get("priority") is not None:
            payload["priority"] = record["priority"]
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/zones/{zone_id}/dns_records",
                headers=self.headers,
                json=payload
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("result")
                else:
                    error = await resp.text()
                    logger.error(f"Failed to create DNS record: {error}")
                    return None
    
    async def update_dns_record(self, zone_id: str, record_id: str, record: dict) -> Optional[dict]:
        payload = {
            "type": record["record_type"],
            "name": record["name"],
            "content": record["content"],
            "ttl": record.get("ttl", 3600),
            "proxied": record.get("proxied", False)
        }
        if record.get("priority") is not None:
            payload["priority"] = record["priority"]
        
        async with aiohttp.ClientSession() as session:
            async with session.patch(
                f"{self.base_url}/zones/{zone_id}/dns_records/{record_id}",
                headers=self.headers,
                json=payload
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("result")
                return None
    
    async def delete_dns_record(self, zone_id: str, record_id: str) -> bool:
        async with aiohttp.ClientSession() as session:
            async with session.delete(
                f"{self.base_url}/zones/{zone_id}/dns_records/{record_id}",
                headers=self.headers
            ) as resp:
                return resp.status == 200
    
    async def toggle_proxy(self, zone_id: str, record_id: str, proxied: bool) -> Optional[dict]:
        async with aiohttp.ClientSession() as session:
            async with session.patch(
                f"{self.base_url}/zones/{zone_id}/dns_records/{record_id}",
                headers=self.headers,
                json={"proxied": proxied}
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("result")
                return None

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/login", response_model=LoginResponse)
async def login(data: LoginRequest):
    user = await db.users.find_one({"username": data.username}, {"_id": 0})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    session_token = generate_session_token()
    sessions[session_token] = {"id": user["id"], "username": user["username"]}
    
    return LoginResponse(
        session_token=session_token,
        user=UserResponse(
            id=user["id"],
            username=user["username"],
            created_at=user["created_at"]
        )
    )

@api_router.post("/auth/logout")
async def logout(user: dict = Depends(get_current_user), request: Request = None):
    session_token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if session_token in sessions:
        del sessions[session_token]
    return {"message": "Logged out successfully"}

@api_router.post("/auth/change-password")
async def change_password(data: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    db_user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    if not db_user or not verify_password(data.current_password, db_user["password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    new_hash = hash_password(data.new_password)
    await db.users.update_one({"id": user["id"]}, {"$set": {"password": new_hash}})
    
    await log_activity(user["id"], "change_password", "user", user["id"], user["username"])
    return {"message": "Password changed successfully"}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    db_user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(
        id=db_user["id"],
        username=db_user["username"],
        created_at=db_user["created_at"]
    )

# ==================== CLOUDFLARE ACCOUNTS ROUTES ====================

@api_router.get("/cloudflare-accounts", response_model=List[CloudflareAccountResponse])
async def list_cloudflare_accounts(user: dict = Depends(get_current_user)):
    accounts = await db.cloudflare_accounts.find({}, {"_id": 0, "api_key": 0}).to_list(100)
    return accounts

@api_router.post("/cloudflare-accounts", response_model=CloudflareAccountResponse)
async def create_cloudflare_account(data: CloudflareAccountCreate, user: dict = Depends(get_current_user)):
    account = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "email": data.email,
        "api_key": data.api_key,
        "account_id": data.account_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.cloudflare_accounts.insert_one(account)
    await log_activity(user["id"], "create", "cloudflare_account", account["id"], account["name"])
    
    return CloudflareAccountResponse(
        id=account["id"],
        name=account["name"],
        email=account["email"],
        account_id=account["account_id"],
        created_at=account["created_at"]
    )

@api_router.put("/cloudflare-accounts/{account_id}", response_model=CloudflareAccountResponse)
async def update_cloudflare_account(account_id: str, data: CloudflareAccountUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    await db.cloudflare_accounts.update_one({"id": account_id}, {"$set": update_data})
    account = await db.cloudflare_accounts.find_one({"id": account_id}, {"_id": 0, "api_key": 0})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    await log_activity(user["id"], "update", "cloudflare_account", account_id, account["name"])
    return account

@api_router.delete("/cloudflare-accounts/{account_id}")
async def delete_cloudflare_account(account_id: str, user: dict = Depends(get_current_user)):
    account = await db.cloudflare_accounts.find_one({"id": account_id}, {"_id": 0})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    await db.cloudflare_accounts.delete_one({"id": account_id})
    await log_activity(user["id"], "delete", "cloudflare_account", account_id, account["name"])
    return {"message": "Account deleted successfully"}

@api_router.get("/cloudflare-accounts/{account_id}/zones", response_model=List[CloudflareZoneResponse])
async def get_cloudflare_zones(account_id: str, user: dict = Depends(get_current_user)):
    account = await db.cloudflare_accounts.find_one({"id": account_id}, {"_id": 0})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    cf = CloudflareService(account["email"], account["api_key"])
    zones, error = await cf.get_zones()
    
    if error:
        raise HTTPException(status_code=400, detail=f"Cloudflare API error: {error}")
    
    return [
        CloudflareZoneResponse(
            id=z["id"],
            name=z["name"],
            status=z.get("status", "unknown"),
            name_servers=z.get("name_servers", [])
        )
        for z in zones
    ]

@api_router.post("/cloudflare-accounts/{account_id}/test-connection")
async def test_cloudflare_connection(account_id: str, user: dict = Depends(get_current_user)):
    """Test connection to Cloudflare API"""
    account = await db.cloudflare_accounts.find_one({"id": account_id}, {"_id": 0})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    cf = CloudflareService(account["email"], account["api_key"])
    
    # Try to fetch zones as a connection test
    zones, error = await cf.get_zones()
    
    if error:
        return {
            "success": False,
            "message": f"Connection failed: {error}",
            "zones_count": 0
        }
    
    return {
        "success": True,
        "message": f"Connection successful! Found {len(zones)} zones.",
        "zones_count": len(zones),
        "zones": [{"name": z["name"], "status": z.get("status")} for z in zones[:5]]  # Show first 5
    }

@api_router.post("/cloudflare-accounts/{account_id}/import-zones")
async def import_zones_from_cloudflare(account_id: str, user: dict = Depends(get_current_user)):
    """Import all zones from a Cloudflare account as domains"""
    account = await db.cloudflare_accounts.find_one({"id": account_id}, {"_id": 0})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    cf = CloudflareService(account["email"], account["api_key"])
    zones, error = await cf.get_zones()
    
    if error:
        raise HTTPException(status_code=400, detail=f"Cloudflare API error: {error}")
    
    if not zones:
        raise HTTPException(status_code=400, detail="No zones found in this Cloudflare account")
    
    imported = 0
    skipped = 0
    
    for zone in zones:
        # Check if domain already exists
        existing = await db.domains.find_one({"name": zone["name"]}, {"_id": 0})
        if existing:
            skipped += 1
            continue
        
        # Create new domain
        domain = {
            "id": str(uuid.uuid4()),
            "name": zone["name"],
            "cloudflare_account_id": account_id,
            "cloudflare_zone_id": zone["id"],
            "registration_date": None,
            "client_whatsapp": None,
            "domain_provider": None,
            "preset_id": None,
            "domain_status": "active",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.domains.insert_one(domain)
        imported += 1
        
        await log_activity(user["id"], "import", "domain", domain["id"], domain["name"], f"Imported from Cloudflare")
    
    await log_activity(user["id"], "import_zones", "cloudflare_account", account_id, account["name"], f"Imported {imported} zones, skipped {skipped}")
    
    return {
        "message": f"Import complete: {imported} domains imported, {skipped} skipped (already exist)",
        "imported": imported,
        "skipped": skipped,
        "total": len(zones)
    }

# ==================== DOMAINS ROUTES ====================

@api_router.get("/domains", response_model=List[DomainResponse])
async def list_domains(user: dict = Depends(get_current_user)):
    domains = await db.domains.find({}, {"_id": 0}).to_list(1000)
    
    # Get records count for each domain
    for domain in domains:
        count = await db.dns_records.count_documents({"domain_id": domain["id"]})
        domain["records_count"] = count
    
    return domains

@api_router.post("/domains", response_model=DomainResponse)
async def create_domain(data: DomainCreate, user: dict = Depends(get_current_user)):
    # Check if domain already exists
    existing = await db.domains.find_one({"name": data.name}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Domain already exists")
    
    # Get zone_id from Cloudflare if not provided
    zone_id = data.cloudflare_zone_id
    if not zone_id:
        account = await db.cloudflare_accounts.find_one({"id": data.cloudflare_account_id}, {"_id": 0})
        if account:
            cf = CloudflareService(account["email"], account["api_key"])
            zone = await cf.get_zone_by_name(data.name)
            if zone:
                zone_id = zone["id"]
    
    domain = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "cloudflare_account_id": data.cloudflare_account_id,
        "cloudflare_zone_id": zone_id,
        "registration_date": data.registration_date,
        "client_whatsapp": data.client_whatsapp,
        "domain_provider": data.domain_provider,
        "preset_id": data.preset_id,
        "domain_status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.domains.insert_one(domain)
    
    # Apply preset if provided
    if data.preset_id:
        await apply_preset_to_domain(domain["id"], data.preset_id, user)
    
    await log_activity(user["id"], "create", "domain", domain["id"], domain["name"])
    
    domain["records_count"] = 0
    return domain

@api_router.get("/domains/{domain_id}", response_model=DomainResponse)
async def get_domain(domain_id: str, user: dict = Depends(get_current_user)):
    domain = await db.domains.find_one({"id": domain_id}, {"_id": 0})
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    
    count = await db.dns_records.count_documents({"domain_id": domain_id})
    domain["records_count"] = count
    return domain

@api_router.put("/domains/{domain_id}", response_model=DomainResponse)
async def update_domain(domain_id: str, data: DomainUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    await db.domains.update_one({"id": domain_id}, {"$set": update_data})
    domain = await db.domains.find_one({"id": domain_id}, {"_id": 0})
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    
    count = await db.dns_records.count_documents({"domain_id": domain_id})
    domain["records_count"] = count
    
    await log_activity(user["id"], "update", "domain", domain_id, domain["name"])
    return domain

@api_router.delete("/domains/{domain_id}")
async def delete_domain(domain_id: str, user: dict = Depends(get_current_user)):
    domain = await db.domains.find_one({"id": domain_id}, {"_id": 0})
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    
    # Delete all DNS records
    await db.dns_records.delete_many({"domain_id": domain_id})
    await db.domains.delete_one({"id": domain_id})
    
    await log_activity(user["id"], "delete", "domain", domain_id, domain["name"])
    return {"message": "Domain deleted successfully"}

@api_router.post("/domains/{domain_id}/sync-from-cloudflare")
async def sync_domain_from_cloudflare(domain_id: str, user: dict = Depends(get_current_user)):
    domain = await db.domains.find_one({"id": domain_id}, {"_id": 0})
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    
    if not domain.get("cloudflare_zone_id"):
        raise HTTPException(status_code=400, detail="Domain not linked to Cloudflare zone")
    
    account = await db.cloudflare_accounts.find_one({"id": domain["cloudflare_account_id"]}, {"_id": 0})
    if not account:
        raise HTTPException(status_code=404, detail="Cloudflare account not found")
    
    cf = CloudflareService(account["email"], account["api_key"])
    records = await cf.get_dns_records(domain["cloudflare_zone_id"])
    
    # Delete existing local records
    await db.dns_records.delete_many({"domain_id": domain_id})
    
    # Insert new records from Cloudflare
    for r in records:
        record = {
            "id": str(uuid.uuid4()),
            "domain_id": domain_id,
            "cloudflare_record_id": r["id"],
            "record_type": r["type"],
            "name": r["name"],
            "content": r["content"],
            "ttl": r["ttl"],
            "priority": r.get("priority"),
            "proxied": r.get("proxied", False),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.dns_records.insert_one(record)
    
    await log_activity(user["id"], "sync_from_cloudflare", "domain", domain_id, domain["name"], f"Synced {len(records)} records")
    return {"message": f"Synced {len(records)} records from Cloudflare"}

@api_router.post("/domains/{domain_id}/push-to-cloudflare")
async def push_domain_to_cloudflare(domain_id: str, user: dict = Depends(get_current_user)):
    domain = await db.domains.find_one({"id": domain_id}, {"_id": 0})
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    
    if not domain.get("cloudflare_zone_id"):
        raise HTTPException(status_code=400, detail="Domain not linked to Cloudflare zone")
    
    account = await db.cloudflare_accounts.find_one({"id": domain["cloudflare_account_id"]}, {"_id": 0})
    if not account:
        raise HTTPException(status_code=404, detail="Cloudflare account not found")
    
    cf = CloudflareService(account["email"], account["api_key"])
    local_records = await db.dns_records.find({"domain_id": domain_id}, {"_id": 0}).to_list(1000)
    
    created = 0
    updated = 0
    
    for record in local_records:
        record_data = {
            "record_type": record["record_type"],
            "name": record["name"],
            "content": record["content"],
            "ttl": record["ttl"],
            "priority": record.get("priority"),
            "proxied": record.get("proxied", False)
        }
        
        if record.get("cloudflare_record_id"):
            # Update existing
            result = await cf.update_dns_record(domain["cloudflare_zone_id"], record["cloudflare_record_id"], record_data)
            if result:
                updated += 1
        else:
            # Create new
            result = await cf.create_dns_record(domain["cloudflare_zone_id"], record_data)
            if result:
                await db.dns_records.update_one(
                    {"id": record["id"]},
                    {"$set": {"cloudflare_record_id": result["id"]}}
                )
                created += 1
    
    await log_activity(user["id"], "push_to_cloudflare", "domain", domain_id, domain["name"], f"Created {created}, Updated {updated}")
    return {"message": f"Pushed to Cloudflare: {created} created, {updated} updated"}

@api_router.post("/domains/{domain_id}/apply-preset/{preset_id}")
async def apply_preset(domain_id: str, preset_id: str, user: dict = Depends(get_current_user)):
    return await apply_preset_to_domain(domain_id, preset_id, user)

async def apply_preset_to_domain(domain_id: str, preset_id: str, user: dict):
    domain = await db.domains.find_one({"id": domain_id}, {"_id": 0})
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    
    preset = await db.dns_presets.find_one({"id": preset_id}, {"_id": 0})
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    
    preset_records = await db.dns_preset_records.find({"preset_id": preset_id}, {"_id": 0}).to_list(1000)
    
    # Delete existing records
    await db.dns_records.delete_many({"domain_id": domain_id})
    
    # Create new records from preset
    for pr in preset_records:
        # Replace @ with domain name
        name = pr["name"]
        if name == "@":
            name = domain["name"]
        elif not name.endswith(domain["name"]):
            name = f"{name}.{domain['name']}"
        
        record = {
            "id": str(uuid.uuid4()),
            "domain_id": domain_id,
            "cloudflare_record_id": None,
            "record_type": pr["record_type"],
            "name": name,
            "content": pr["content"],
            "ttl": pr["ttl"],
            "priority": pr.get("priority"),
            "proxied": pr.get("proxied", False),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.dns_records.insert_one(record)
    
    # Update domain preset_id
    await db.domains.update_one({"id": domain_id}, {"$set": {"preset_id": preset_id}})
    
    await log_activity(user["id"], "apply_preset", "domain", domain_id, domain["name"], f"Applied preset: {preset['name']}")
    return {"message": f"Applied preset '{preset['name']}' with {len(preset_records)} records"}

# ==================== DNS RECORDS ROUTES ====================

@api_router.get("/domains/{domain_id}/dns-records", response_model=List[DNSRecordResponse])
async def list_dns_records(domain_id: str, user: dict = Depends(get_current_user)):
    records = await db.dns_records.find({"domain_id": domain_id}, {"_id": 0}).to_list(1000)
    return records

@api_router.post("/domains/{domain_id}/dns-records", response_model=DNSRecordResponse)
async def create_dns_record(domain_id: str, data: DNSRecordCreate, user: dict = Depends(get_current_user)):
    domain = await db.domains.find_one({"id": domain_id}, {"_id": 0})
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    
    record = {
        "id": str(uuid.uuid4()),
        "domain_id": domain_id,
        "cloudflare_record_id": None,
        "record_type": data.record_type,
        "name": data.name,
        "content": data.content,
        "ttl": data.ttl,
        "priority": data.priority,
        "proxied": data.proxied,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.dns_records.insert_one(record)
    
    await log_activity(user["id"], "create", "dns_record", record["id"], f"{data.record_type} {data.name}")
    return record

@api_router.put("/domains/{domain_id}/dns-records/{record_id}", response_model=DNSRecordResponse)
async def update_dns_record(domain_id: str, record_id: str, data: DNSRecordUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    await db.dns_records.update_one({"id": record_id, "domain_id": domain_id}, {"$set": update_data})
    record = await db.dns_records.find_one({"id": record_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    await log_activity(user["id"], "update", "dns_record", record_id, f"{record['record_type']} {record['name']}")
    return record

@api_router.delete("/domains/{domain_id}/dns-records/{record_id}")
async def delete_dns_record(domain_id: str, record_id: str, user: dict = Depends(get_current_user)):
    record = await db.dns_records.find_one({"id": record_id, "domain_id": domain_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    await db.dns_records.delete_one({"id": record_id})
    
    await log_activity(user["id"], "delete", "dns_record", record_id, f"{record['record_type']} {record['name']}")
    return {"message": "Record deleted successfully"}

@api_router.post("/domains/{domain_id}/dns-records/{record_id}/toggle-proxy")
async def toggle_dns_record_proxy(domain_id: str, record_id: str, user: dict = Depends(get_current_user)):
    record = await db.dns_records.find_one({"id": record_id, "domain_id": domain_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    # Only A, AAAA, CNAME can be proxied
    if record["record_type"] not in ["A", "AAAA", "CNAME"]:
        raise HTTPException(status_code=400, detail="Only A, AAAA, and CNAME records can be proxied")
    
    new_proxied = not record.get("proxied", False)
    await db.dns_records.update_one({"id": record_id}, {"$set": {"proxied": new_proxied}})
    
    # If linked to Cloudflare, update there too
    domain = await db.domains.find_one({"id": domain_id}, {"_id": 0})
    if domain and domain.get("cloudflare_zone_id") and record.get("cloudflare_record_id"):
        account = await db.cloudflare_accounts.find_one({"id": domain["cloudflare_account_id"]}, {"_id": 0})
        if account:
            cf = CloudflareService(account["email"], account["api_key"])
            await cf.toggle_proxy(domain["cloudflare_zone_id"], record["cloudflare_record_id"], new_proxied)
    
    await log_activity(user["id"], "toggle_proxy", "dns_record", record_id, f"{record['record_type']} {record['name']}", f"Proxied: {new_proxied}")
    return {"message": f"Proxy {'enabled' if new_proxied else 'disabled'}", "proxied": new_proxied}

# ==================== DNS PRESETS ROUTES ====================

@api_router.get("/dns-presets", response_model=List[DNSPresetResponse])
async def list_dns_presets(user: dict = Depends(get_current_user)):
    presets = await db.dns_presets.find({}, {"_id": 0}).to_list(100)
    
    for preset in presets:
        count = await db.dns_preset_records.count_documents({"preset_id": preset["id"]})
        preset["records_count"] = count
    
    return presets

@api_router.post("/dns-presets", response_model=DNSPresetResponse)
async def create_dns_preset(data: DNSPresetCreate, user: dict = Depends(get_current_user)):
    preset = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "description": data.description,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.dns_presets.insert_one(preset)
    
    await log_activity(user["id"], "create", "dns_preset", preset["id"], preset["name"])
    
    preset["records_count"] = 0
    return preset

@api_router.get("/dns-presets/{preset_id}", response_model=DNSPresetResponse)
async def get_dns_preset(preset_id: str, user: dict = Depends(get_current_user)):
    preset = await db.dns_presets.find_one({"id": preset_id}, {"_id": 0})
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    
    count = await db.dns_preset_records.count_documents({"preset_id": preset_id})
    preset["records_count"] = count
    return preset

@api_router.put("/dns-presets/{preset_id}", response_model=DNSPresetResponse)
async def update_dns_preset(preset_id: str, data: DNSPresetUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    await db.dns_presets.update_one({"id": preset_id}, {"$set": update_data})
    preset = await db.dns_presets.find_one({"id": preset_id}, {"_id": 0})
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    
    count = await db.dns_preset_records.count_documents({"preset_id": preset_id})
    preset["records_count"] = count
    
    await log_activity(user["id"], "update", "dns_preset", preset_id, preset["name"])
    return preset

@api_router.delete("/dns-presets/{preset_id}")
async def delete_dns_preset(preset_id: str, user: dict = Depends(get_current_user)):
    preset = await db.dns_presets.find_one({"id": preset_id}, {"_id": 0})
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    
    await db.dns_preset_records.delete_many({"preset_id": preset_id})
    await db.dns_presets.delete_one({"id": preset_id})
    
    await log_activity(user["id"], "delete", "dns_preset", preset_id, preset["name"])
    return {"message": "Preset deleted successfully"}

# ==================== DNS PRESET RECORDS ROUTES ====================

@api_router.get("/dns-presets/{preset_id}/records", response_model=List[DNSPresetRecordResponse])
async def list_preset_records(preset_id: str, user: dict = Depends(get_current_user)):
    records = await db.dns_preset_records.find({"preset_id": preset_id}, {"_id": 0}).to_list(1000)
    return records

@api_router.post("/dns-presets/{preset_id}/records", response_model=DNSPresetRecordResponse)
async def create_preset_record(preset_id: str, data: DNSPresetRecordCreate, user: dict = Depends(get_current_user)):
    preset = await db.dns_presets.find_one({"id": preset_id}, {"_id": 0})
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    
    record = {
        "id": str(uuid.uuid4()),
        "preset_id": preset_id,
        "record_type": data.record_type,
        "name": data.name,
        "content": data.content,
        "ttl": data.ttl,
        "priority": data.priority,
        "proxied": data.proxied
    }
    await db.dns_preset_records.insert_one(record)
    
    return record

@api_router.put("/dns-presets/{preset_id}/records/{record_id}", response_model=DNSPresetRecordResponse)
async def update_preset_record(preset_id: str, record_id: str, data: DNSPresetRecordCreate, user: dict = Depends(get_current_user)):
    update_data = data.model_dump()
    await db.dns_preset_records.update_one({"id": record_id, "preset_id": preset_id}, {"$set": update_data})
    record = await db.dns_preset_records.find_one({"id": record_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record

@api_router.delete("/dns-presets/{preset_id}/records/{record_id}")
async def delete_preset_record(preset_id: str, record_id: str, user: dict = Depends(get_current_user)):
    await db.dns_preset_records.delete_one({"id": record_id, "preset_id": preset_id})
    return {"message": "Record deleted successfully"}

# ==================== ACTIVITY LOGS ROUTES ====================

@api_router.get("/activity-logs", response_model=List[ActivityLogResponse])
async def list_activity_logs(limit: int = 50, user: dict = Depends(get_current_user)):
    logs = await db.activity_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return logs

# ==================== INIT DEFAULT USER ====================

@app.on_event("startup")
async def startup_db_client():
    # Create default admin user if not exists
    existing = await db.users.find_one({"username": "eggizf"}, {"_id": 0})
    if not existing:
        admin_user = {
            "id": str(uuid.uuid4()),
            "username": "eggizf",
            "password": hash_password("Bawang001.,"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_user)
        logger.info("Default admin user created")

@api_router.get("/")
async def root():
    return {"message": "DNS Manager API"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
