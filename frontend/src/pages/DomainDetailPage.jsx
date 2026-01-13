import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Edit, 
  RefreshCw, 
  Upload,
  Cloud,
  CloudOff,
  Layers
} from "lucide-react";
import { toast } from "sonner";

const RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV"];

const RecordTypeBadge = ({ type }) => {
  const colors = {
    A: "bg-blue-100 text-blue-800",
    AAAA: "bg-purple-100 text-purple-800",
    CNAME: "bg-green-100 text-green-800",
    MX: "bg-orange-100 text-orange-800",
    TXT: "bg-gray-100 text-gray-800",
    NS: "bg-yellow-100 text-yellow-800",
    SRV: "bg-pink-100 text-pink-800",
  };
  
  return (
    <span className={`badge-type ${colors[type] || 'bg-gray-100 text-gray-800'}`}>
      {type}
    </span>
  );
};

export default function DomainDetailPage() {
  const { domainId } = useParams();
  const navigate = useNavigate();
  
  const [domain, setDomain] = useState(null);
  const [records, setRecords] = useState([]);
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pushing, setPushing] = useState(false);
  
  // Dialog states
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    record_type: "A",
    name: "",
    content: "",
    ttl: 3600,
    priority: null,
    proxied: false,
  });
  const [selectedPresetId, setSelectedPresetId] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [domainRes, recordsRes, presetsRes] = await Promise.all([
        api.get(`/domains/${domainId}`),
        api.get(`/domains/${domainId}/dns-records`),
        api.get("/dns-presets"),
      ]);
      setDomain(domainRes.data);
      setRecords(recordsRes.data);
      setPresets(presetsRes.data);
    } catch (error) {
      toast.error("Failed to load domain data");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainId]);

  const handleAddRecord = async () => {
    if (!formData.name || !formData.content) {
      toast.error("Name and content are required");
      return;
    }

    try {
      const data = { ...formData };
      if (formData.record_type !== "MX") {
        delete data.priority;
      }
      
      if (editingRecord) {
        await api.put(`/domains/${domainId}/dns-records/${editingRecord.id}`, data);
        toast.success("Record updated successfully");
      } else {
        await api.post(`/domains/${domainId}/dns-records`, data);
        toast.success("Record created successfully");
      }
      
      setRecordDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save record");
    }
  };

  const handleDeleteRecord = async (record) => {
    if (!confirm(`Delete ${record.record_type} record for ${record.name}?`)) return;

    try {
      await api.delete(`/domains/${domainId}/dns-records/${record.id}`);
      toast.success("Record deleted successfully");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete record");
    }
  };

  const handleToggleProxy = async (record) => {
    try {
      const res = await api.post(`/domains/${domainId}/dns-records/${record.id}/toggle-proxy`);
      toast.success(res.data.message);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to toggle proxy");
    }
  };

  const handleSyncFromCloudflare = async () => {
    setSyncing(true);
    try {
      const res = await api.post(`/domains/${domainId}/sync-from-cloudflare`);
      toast.success(res.data.message);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to sync from Cloudflare");
    } finally {
      setSyncing(false);
    }
  };

  const handlePushToCloudflare = async () => {
    setPushing(true);
    try {
      const res = await api.post(`/domains/${domainId}/push-to-cloudflare`);
      toast.success(res.data.message);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to push to Cloudflare");
    } finally {
      setPushing(false);
    }
  };

  const handleApplyPreset = async () => {
    if (!selectedPresetId) {
      toast.error("Please select a preset");
      return;
    }

    try {
      const res = await api.post(`/domains/${domainId}/apply-preset/${selectedPresetId}`);
      toast.success(res.data.message);
      setPresetDialogOpen(false);
      setSelectedPresetId("");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to apply preset");
    }
  };

  const openEditDialog = (record) => {
    setEditingRecord(record);
    setFormData({
      record_type: record.record_type,
      name: record.name,
      content: record.content,
      ttl: record.ttl,
      priority: record.priority,
      proxied: record.proxied,
    });
    setRecordDialogOpen(true);
  };

  const resetForm = () => {
    setEditingRecord(null);
    setFormData({
      record_type: "A",
      name: "",
      content: "",
      ttl: 3600,
      priority: null,
      proxied: false,
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!domain) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} data-testid="back-btn">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-heading text-3xl font-bold tracking-tight">{domain.name}</h1>
          <p className="text-muted-foreground mt-1">Manage DNS records for this domain</p>
        </div>
      </div>

      {/* Domain Info Card */}
      <Card className="border">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Status</p>
              <Badge variant={domain.domain_status === "active" ? "default" : "secondary"}>{domain.domain_status}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Records</p>
              <p className="font-mono font-medium">{records.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Provider</p>
              <p className="font-medium">{domain.domain_provider || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">WhatsApp</p>
              <p className="font-mono text-sm">{domain.client_whatsapp || "-"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions Bar */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => { resetForm(); setRecordDialogOpen(true); }} data-testid="add-record-btn">
          <Plus className="h-4 w-4 mr-2" />
          Add Record
        </Button>
        <Button variant="outline" onClick={() => setPresetDialogOpen(true)} data-testid="apply-preset-btn">
          <Layers className="h-4 w-4 mr-2" />
          Apply Preset
        </Button>
        <Button 
          variant="outline" 
          onClick={handleSyncFromCloudflare} 
          disabled={syncing}
          data-testid="sync-cloudflare-btn"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? "Syncing..." : "Sync from Cloudflare"}
        </Button>
        <Button 
          variant="outline" 
          onClick={handlePushToCloudflare} 
          disabled={pushing}
          data-testid="push-cloudflare-btn"
        >
          <Upload className={`h-4 w-4 mr-2`} />
          {pushing ? "Pushing..." : "Push to Cloudflare"}
        </Button>
      </div>

      {/* DNS Records Table */}
      <Card className="border">
        <CardHeader>
          <CardTitle className="font-heading">DNS Records</CardTitle>
          <CardDescription>Manage DNS records for {domain.name}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {records.length === 0 ? (
            <div className="p-12 text-center">
              <Cloud className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" strokeWidth={1} />
              <h3 className="font-heading text-lg font-medium mb-1">No DNS records</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add records manually or sync from Cloudflare
              </p>
              <div className="flex justify-center gap-2">
                <Button onClick={() => { resetForm(); setRecordDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Record
                </Button>
                <Button variant="outline" onClick={handleSyncFromCloudflare}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync from Cloudflare
                </Button>
              </div>
            </div>
          ) : (
            <Table className="dns-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>TTL</TableHead>
                  <TableHead>Proxy</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <RecordTypeBadge type={record.record_type} />
                    </TableCell>
                    <TableCell className="font-mono text-sm max-w-[200px] truncate">
                      {record.name}
                    </TableCell>
                    <TableCell className="font-mono text-sm max-w-[250px] truncate">
                      {record.priority && <span className="text-muted-foreground mr-1">{record.priority}</span>}
                      {record.content}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {record.ttl === 1 ? "Auto" : record.ttl}
                    </TableCell>
                    <TableCell>
                      {["A", "AAAA", "CNAME"].includes(record.record_type) ? (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={record.proxied}
                            onCheckedChange={() => handleToggleProxy(record)}
                            data-testid={`proxy-toggle-${record.id}`}
                          />
                          {record.proxied ? (
                            <Cloud className="h-4 w-4 text-orange-500" />
                          ) : (
                            <CloudOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => openEditDialog(record)}
                          data-testid={`edit-record-${record.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteRecord(record)}
                          data-testid={`delete-record-${record.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Record Dialog */}
      <Dialog open={recordDialogOpen} onOpenChange={(open) => { setRecordDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingRecord ? "Edit DNS Record" : "Add DNS Record"}
            </DialogTitle>
            <DialogDescription>
              {editingRecord ? "Update the DNS record" : "Create a new DNS record"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Record Type</Label>
              <Select
                value={formData.record_type}
                onValueChange={(val) => setFormData({ ...formData, record_type: val })}
              >
                <SelectTrigger data-testid="record-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECORD_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder={`e.g., @ or subdomain.${domain?.name || 'example.com'}`}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="record-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Input
                placeholder={
                  formData.record_type === "A" ? "192.168.1.1" :
                  formData.record_type === "AAAA" ? "2001:db8::1" :
                  formData.record_type === "CNAME" ? "target.example.com" :
                  formData.record_type === "MX" ? "mail.example.com" :
                  formData.record_type === "TXT" ? "v=spf1 include:_spf.google.com ~all" :
                  "Content"
                }
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                data-testid="record-content-input"
              />
            </div>
            {formData.record_type === "MX" && (
              <div className="space-y-2">
                <Label>Priority</Label>
                <Input
                  type="number"
                  placeholder="10"
                  value={formData.priority || ""}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || null })}
                  data-testid="record-priority-input"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>TTL (seconds)</Label>
              <Select
                value={formData.ttl.toString()}
                onValueChange={(val) => setFormData({ ...formData, ttl: parseInt(val) })}
              >
                <SelectTrigger data-testid="record-ttl-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Auto</SelectItem>
                  <SelectItem value="60">1 minute</SelectItem>
                  <SelectItem value="300">5 minutes</SelectItem>
                  <SelectItem value="600">10 minutes</SelectItem>
                  <SelectItem value="1800">30 minutes</SelectItem>
                  <SelectItem value="3600">1 hour</SelectItem>
                  <SelectItem value="7200">2 hours</SelectItem>
                  <SelectItem value="18000">5 hours</SelectItem>
                  <SelectItem value="43200">12 hours</SelectItem>
                  <SelectItem value="86400">1 day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {["A", "AAAA", "CNAME"].includes(formData.record_type) && (
              <div className="flex items-center justify-between">
                <div>
                  <Label>Cloudflare Proxy</Label>
                  <p className="text-xs text-muted-foreground">Enable Cloudflare CDN and DDoS protection</p>
                </div>
                <Switch
                  checked={formData.proxied}
                  onCheckedChange={(val) => setFormData({ ...formData, proxied: val })}
                  data-testid="record-proxied-switch"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRecordDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleAddRecord} data-testid="save-record-btn">
              {editingRecord ? "Update Record" : "Create Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Preset Dialog */}
      <Dialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Apply DNS Preset</DialogTitle>
            <DialogDescription>
              This will replace all existing DNS records with the preset records
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Select Preset</Label>
            <Select value={selectedPresetId} onValueChange={setSelectedPresetId}>
              <SelectTrigger data-testid="preset-select">
                <SelectValue placeholder="Choose a preset" />
              </SelectTrigger>
              <SelectContent>
                {presets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.name} ({preset.records_count} records)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {presets.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                No presets available. <a href="/presets" className="text-accent underline">Create one</a>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPresetDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleApplyPreset} disabled={!selectedPresetId} data-testid="apply-preset-submit">
              Apply Preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
