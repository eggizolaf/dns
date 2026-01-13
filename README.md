# DNS Manager

Aplikasi web untuk mengelola DNS records dengan integrasi Cloudflare.

## 🚀 Fitur

- ✅ Login admin dengan session-based authentication
- ✅ Multi-akun Cloudflare support
- ✅ Import domains dari Cloudflare
- ✅ Sync/Push DNS records ke Cloudflare
- ✅ DNS Presets untuk template records
- ✅ Activity logging
- ✅ Toggle Cloudflare proxy per record

## 📋 Tech Stack

- **Backend**: FastAPI (Python 3.11+)
- **Frontend**: React 18 + Tailwind CSS + Shadcn UI
- **Database**: MongoDB

## 🛠️ Instalasi

### Prerequisites

- Python 3.11+
- Node.js 18+
- MongoDB (local atau Atlas)
- Yarn package manager

### 1. Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/dns-manager.git
cd dns-manager
```

### 2. Setup Backend

```bash
cd backend

# Buat virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# atau
venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Setup environment variables
cp .env.example .env
# Edit .env dan isi MONGO_URL
```

### 3. Setup Frontend

```bash
cd frontend

# Install dependencies
yarn install

# Setup environment variables
cp .env.example .env
# Edit .env dan isi REACT_APP_BACKEND_URL
```

### 4. Jalankan Aplikasi

**Backend:**
```bash
cd backend
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**Frontend:**
```bash
cd frontend
yarn start
```

Aplikasi akan berjalan di:
- Frontend: http://localhost:3000
- Backend: http://localhost:8001

## ⚙️ Environment Variables

### Backend (.env)
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=dns_manager
CORS_ORIGINS=http://localhost:3000
```

### Frontend (.env)
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

## 🔐 Default Login

- **Username**: `eggizf`
- **Password**: `Bawang001.,`

⚠️ **Penting**: Segera ubah password setelah login pertama!

## 📁 Struktur Folder

```
dns-manager/
├── backend/
│   ├── server.py          # Main FastAPI application
│   ├── requirements.txt   # Python dependencies
│   └── .env               # Environment variables
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── App.js         # Main App
│   │   └── index.css      # Styles
│   ├── package.json       # Node dependencies
│   └── .env               # Environment variables
└── README.md
```

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |
| POST | /api/auth/change-password | Ubah password |
| GET | /api/domains | List semua domain |
| POST | /api/domains | Tambah domain baru |
| GET | /api/domains/{id}/dns-records | List DNS records |
| POST | /api/domains/{id}/sync-from-cloudflare | Sync dari CF |
| POST | /api/domains/{id}/push-to-cloudflare | Push ke CF |
| GET | /api/cloudflare-accounts | List CF accounts |
| POST | /api/cloudflare-accounts/{id}/import-zones | Import domains |
| GET | /api/dns-presets | List presets |
| GET | /api/activity-logs | List activity logs |

## 🚀 Deployment

### Deploy ke VPS

1. Setup MongoDB
2. Clone repo ke server
3. Setup environment variables
4. Gunakan PM2 atau systemd untuk backend
5. Build frontend: `yarn build`
6. Serve dengan Nginx

### Deploy ke Heroku/Railway/Render

1. Push ke GitHub
2. Connect repository
3. Set environment variables
4. Deploy

## 📝 License

MIT License

## 👤 Author

Built with ❤️ using Emergent AI
