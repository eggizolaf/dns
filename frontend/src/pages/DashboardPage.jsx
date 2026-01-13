import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Plus, 
  Search, 
  Globe, 
  ExternalLink, 
  MoreVertical,
  Trash2,
  Edit,
  RefreshCw,
  Calendar,
  CloudDownload
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { format } from "date-fns";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [domains, setDomains] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [importing, setImporting] = useState(false);
  const [selectedAccountForImport, setSelectedAccountForImport] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    cloudflare_account_id: "",
    registration_date: "",
    client_whatsapp: "",
    domain_provider: "",
    preset_id: "",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [domainsRes, accountsRes, presetsRes] = await Promise.all([
        api.get("/domains"),
        api.get("/cloudflare-accounts"),
        api.get("/dns-presets"),
      ]);
      setDomains(domainsRes.data);
      setAccounts(accountsRes.data);
      setPresets(presetsRes.data);
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddDomain = async () => {
    if (!formData.name || !formData.cloudflare_account_id) {
      toast.error("Domain name and Cloudflare account are required");
      return;
    }

    try {
      const submitData = { ...formData };
      // Convert "none" to empty string for preset_id
      if (submitData.preset_id === "none") {
        submitData.preset_id = "";
      }
      
      await api.post("/domains", submitData);
      toast.success("Domain added successfully");
      setAddDialogOpen(false);
      setFormData({
        name: "",
        cloudflare_account_id: "",
        registration_date: "",
        client_whatsapp: "",
        domain_provider: "",
        preset_id: "",
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add domain");
    }
  };

  const handleUpdateDomain = async () => {
    if (!selectedDomain) return;

    try {
      await api.put(`/domains/${selectedDomain.id}`, {
        registration_date: formData.registration_date,
        client_whatsapp: formData.client_whatsapp,
        domain_provider: formData.domain_provider,
      });
      toast.success("Domain updated successfully");
      setEditDialogOpen(false);
      setSelectedDomain(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update domain");
    }
  };

  const handleDeleteDomain = async (domain) => {
    if (!confirm(`Are you sure you want to delete ${domain.name}?`)) return;

    try {
      await api.delete(`/domains/${domain.id}`);
      toast.success("Domain deleted successfully");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete domain");
    }
  };

  const handleSyncFromCloudflare = async (domain) => {
    try {
      const res = await api.post(`/domains/${domain.id}/sync-from-cloudflare`);
      toast.success(res.data.message);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to sync from Cloudflare");
    }
  };

  const openEditDialog = (domain) => {
    setSelectedDomain(domain);
    setFormData({
      ...formData,
      registration_date: domain.registration_date || "",
      client_whatsapp: domain.client_whatsapp || "",
      domain_provider: domain.domain_provider || "",
    });
    setEditDialogOpen(true);
  };

  const handleImportFromCloudflare = async () => {
    if (!selectedAccountForImport) {
      toast.error("Please select a Cloudflare account");
      return;
    }

    setImporting(true);
    try {
      const res = await api.post(`/cloudflare-accounts/${selectedAccountForImport}/import-zones`);
      toast.success(res.data.message);
      setImportDialogOpen(false);
      setSelectedAccountForImport("");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to import from Cloudflare");
    } finally {
      setImporting(false);
    }
  };

  const filteredDomains = domains.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage your domains and DNS records</p>
        </div>
        <div className="flex gap-2">
          {/* Import from Cloudflare Button */}
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="active:scale-95 transition-transform" data-testid="import-cloudflare-btn">
                <CloudDownload className="h-4 w-4 mr-2" />
                Sync from Cloudflare
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px]">
              <DialogHeader>
                <DialogTitle className="font-heading">Import Domains from Cloudflare</DialogTitle>
                <DialogDescription>
                  Import all domains (zones) from your Cloudflare account. Existing domains will be skipped.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Select Cloudflare Account</Label>
                  <Select
                    value={selectedAccountForImport}
                    onValueChange={setSelectedAccountForImport}
                  >
                    <SelectTrigger data-testid="import-account-select">
                      <SelectValue placeholder="Choose an account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {accounts.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No Cloudflare accounts found. <a href="/settings" className="text-accent underline">Add one in Settings</a>
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancel</Button>
                <Button 
                  onClick={handleImportFromCloudflare} 
                  disabled={importing || !selectedAccountForImport}
                  data-testid="import-cloudflare-submit"
                >
                  {importing ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Importing...
                    </span>
                  ) : (
                    <>
                      <CloudDownload className="h-4 w-4 mr-2" />
                      Import Domains
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Add Domain Button */}
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="active:scale-95 transition-transform" data-testid="add-domain-btn">
                <Plus className="h-4 w-4 mr-2" />
                Add Domain
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="font-heading">Add New Domain</DialogTitle>
              <DialogDescription>
                Add a domain to manage its DNS records
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="domain-name">Domain Name *</Label>
                <Input
                  id="domain-name"
                  placeholder="example.com"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  data-testid="add-domain-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cf-account">Cloudflare Account *</Label>
                <Select
                  value={formData.cloudflare_account_id}
                  onValueChange={(val) => setFormData({ ...formData, cloudflare_account_id: val })}
                >
                  <SelectTrigger data-testid="add-domain-account">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {accounts.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No Cloudflare accounts configured. <a href="/settings" className="text-accent underline">Add one in Settings</a>
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-date">Registration Date</Label>
                <Input
                  id="reg-date"
                  type="date"
                  value={formData.registration_date}
                  onChange={(e) => setFormData({ ...formData, registration_date: e.target.value })}
                  data-testid="add-domain-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">Client WhatsApp</Label>
                <Input
                  id="whatsapp"
                  placeholder="+62812345678"
                  value={formData.client_whatsapp}
                  onChange={(e) => setFormData({ ...formData, client_whatsapp: e.target.value })}
                  data-testid="add-domain-whatsapp"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider">Domain Provider</Label>
                <Input
                  id="provider"
                  placeholder="e.g., Namecheap, GoDaddy"
                  value={formData.domain_provider}
                  onChange={(e) => setFormData({ ...formData, domain_provider: e.target.value })}
                  data-testid="add-domain-provider"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preset">DNS Preset (Optional)</Label>
                <Select
                  value={formData.preset_id}
                  onValueChange={(val) => setFormData({ ...formData, preset_id: val })}
                >
                  <SelectTrigger data-testid="add-domain-preset">
                    <SelectValue placeholder="No preset" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No preset</SelectItem>
                    {presets.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>{preset.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddDomain} data-testid="add-domain-submit">Add Domain</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border hover:border-primary/50 transition-colors">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Total Domains</p>
                <p className="text-3xl font-heading font-bold mt-1">{domains.length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Globe className="h-6 w-6 text-primary" strokeWidth={1.5} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border hover:border-primary/50 transition-colors">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Total Records</p>
                <p className="text-3xl font-heading font-bold mt-1">
                  {domains.reduce((sum, d) => sum + (d.records_count || 0), 0)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-accent" strokeWidth={1.5} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border hover:border-primary/50 transition-colors">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">CF Accounts</p>
                <p className="text-3xl font-heading font-bold mt-1">{accounts.length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-orange-100 flex items-center justify-center">
                <ExternalLink className="h-6 w-6 text-orange-600" strokeWidth={1.5} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search domains..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          data-testid="search-domains"
        />
      </div>

      {/* Domains Table */}
      <Card className="border">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : filteredDomains.length === 0 ? (
            <div className="p-12 text-center">
              <Globe className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" strokeWidth={1} />
              <h3 className="font-heading text-lg font-medium mb-1">No domains found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery ? "Try a different search term" : "Add your first domain to get started"}
              </p>
              {!searchQuery && (
                <Button onClick={() => setAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Domain
                </Button>
              )}
            </div>
          ) : (
            <Table className="dns-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDomains.map((domain) => (
                  <TableRow key={domain.id}>
                    <TableCell>
                      <button
                        className="flex items-center gap-2 hover:text-accent transition-colors text-left"
                        onClick={() => navigate(`/domains/${domain.id}`)}
                        data-testid={`domain-row-${domain.name}`}
                      >
                        <Globe className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                        <span className="font-medium">{domain.name}</span>
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant={domain.domain_status === "active" ? "default" : "secondary"}>
                        {domain.domain_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{domain.records_count || 0}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {domain.domain_provider || "-"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {domain.client_whatsapp || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`domain-actions-${domain.name}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/domains/${domain.id}`)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit DNS
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(domain)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSyncFromCloudflare(domain)}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Sync from Cloudflare
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDeleteDomain(domain)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Domain Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Edit Domain Details</DialogTitle>
            <DialogDescription>
              Update information for {selectedDomain?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-reg-date">Registration Date</Label>
              <Input
                id="edit-reg-date"
                type="date"
                value={formData.registration_date}
                onChange={(e) => setFormData({ ...formData, registration_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-whatsapp">Client WhatsApp</Label>
              <Input
                id="edit-whatsapp"
                placeholder="+62812345678"
                value={formData.client_whatsapp}
                onChange={(e) => setFormData({ ...formData, client_whatsapp: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-provider">Domain Provider</Label>
              <Input
                id="edit-provider"
                placeholder="e.g., Namecheap, GoDaddy"
                value={formData.domain_provider}
                onChange={(e) => setFormData({ ...formData, domain_provider: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateDomain}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
