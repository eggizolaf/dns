import { useState, useEffect } from "react";
import { api } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Edit, Layers, Copy } from "lucide-react";
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

export default function PresetsPage() {
  const [presets, setPresets] = useState([]);
  const [presetRecords, setPresetRecords] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  
  // Form states
  const [presetForm, setPresetForm] = useState({ name: "", description: "" });
  const [recordForm, setRecordForm] = useState({
    record_type: "A",
    name: "@",
    content: "",
    ttl: 3600,
    priority: null,
    proxied: false,
  });

  const fetchPresets = async () => {
    setLoading(true);
    try {
      const res = await api.get("/dns-presets");
      setPresets(res.data);
      
      // Fetch records for each preset
      const recordsData = {};
      for (const preset of res.data) {
        const recordsRes = await api.get(`/dns-presets/${preset.id}/records`);
        recordsData[preset.id] = recordsRes.data;
      }
      setPresetRecords(recordsData);
    } catch (error) {
      toast.error("Failed to load presets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPresets();
  }, []);

  const handleSavePreset = async () => {
    if (!presetForm.name) {
      toast.error("Preset name is required");
      return;
    }

    try {
      if (editingPreset) {
        await api.put(`/dns-presets/${editingPreset.id}`, presetForm);
        toast.success("Preset updated successfully");
      } else {
        await api.post("/dns-presets", presetForm);
        toast.success("Preset created successfully");
      }
      setPresetDialogOpen(false);
      setEditingPreset(null);
      setPresetForm({ name: "", description: "" });
      fetchPresets();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save preset");
    }
  };

  const handleDeletePreset = async (preset) => {
    if (!confirm(`Delete preset "${preset.name}"? This cannot be undone.`)) return;

    try {
      await api.delete(`/dns-presets/${preset.id}`);
      toast.success("Preset deleted successfully");
      fetchPresets();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete preset");
    }
  };

  const handleSaveRecord = async () => {
    if (!recordForm.name || !recordForm.content) {
      toast.error("Name and content are required");
      return;
    }

    try {
      const data = { ...recordForm };
      if (recordForm.record_type !== "MX") {
        delete data.priority;
      }

      if (editingRecord) {
        await api.put(`/dns-presets/${selectedPreset.id}/records/${editingRecord.id}`, data);
        toast.success("Record updated successfully");
      } else {
        await api.post(`/dns-presets/${selectedPreset.id}/records`, data);
        toast.success("Record added successfully");
      }
      setRecordDialogOpen(false);
      setEditingRecord(null);
      resetRecordForm();
      fetchPresets();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save record");
    }
  };

  const handleDeleteRecord = async (presetId, recordId) => {
    try {
      await api.delete(`/dns-presets/${presetId}/records/${recordId}`);
      toast.success("Record deleted successfully");
      fetchPresets();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete record");
    }
  };

  const openEditPreset = (preset) => {
    setEditingPreset(preset);
    setPresetForm({ name: preset.name, description: preset.description || "" });
    setPresetDialogOpen(true);
  };

  const openAddRecord = (preset) => {
    setSelectedPreset(preset);
    setEditingRecord(null);
    resetRecordForm();
    setRecordDialogOpen(true);
  };

  const openEditRecord = (preset, record) => {
    setSelectedPreset(preset);
    setEditingRecord(record);
    setRecordForm({
      record_type: record.record_type,
      name: record.name,
      content: record.content,
      ttl: record.ttl,
      priority: record.priority,
      proxied: record.proxied,
    });
    setRecordDialogOpen(true);
  };

  const resetRecordForm = () => {
    setRecordForm({
      record_type: "A",
      name: "@",
      content: "",
      ttl: 3600,
      priority: null,
      proxied: false,
    });
  };

  const handleDuplicatePreset = async (preset) => {
    try {
      // Create new preset
      const newPresetRes = await api.post("/dns-presets", {
        name: `${preset.name} (Copy)`,
        description: preset.description,
      });
      
      // Copy all records
      const records = presetRecords[preset.id] || [];
      for (const record of records) {
        await api.post(`/dns-presets/${newPresetRes.data.id}/records`, {
          record_type: record.record_type,
          name: record.name,
          content: record.content,
          ttl: record.ttl,
          priority: record.priority,
          proxied: record.proxied,
        });
      }
      
      toast.success("Preset duplicated successfully");
      fetchPresets();
    } catch (error) {
      toast.error("Failed to duplicate preset");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">DNS Presets</h1>
          <p className="text-muted-foreground mt-1">Create reusable DNS record templates</p>
        </div>
        <Button 
          onClick={() => { setEditingPreset(null); setPresetForm({ name: "", description: "" }); setPresetDialogOpen(true); }}
          data-testid="create-preset-btn"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Preset
        </Button>
      </div>

      {/* Presets List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : presets.length === 0 ? (
        <Card className="border">
          <CardContent className="p-12 text-center">
            <Layers className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" strokeWidth={1} />
            <h3 className="font-heading text-lg font-medium mb-1">No presets yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first DNS preset to quickly apply records to domains
            </p>
            <Button onClick={() => setPresetDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Preset
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-4">
          {presets.map((preset) => (
            <AccordionItem key={preset.id} value={preset.id} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-4 flex-1">
                  <Layers className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                  <div className="text-left">
                    <h3 className="font-heading font-medium">{preset.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {preset.records_count} records
                      {preset.description && ` • ${preset.description}`}
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-2 pb-4">
                  {/* Preset Actions */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Button size="sm" onClick={() => openAddRecord(preset)} data-testid={`add-record-${preset.id}`}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Record
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEditPreset(preset)}>
                      <Edit className="h-4 w-4 mr-1" />
                      Edit Preset
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDuplicatePreset(preset)}>
                      <Copy className="h-4 w-4 mr-1" />
                      Duplicate
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeletePreset(preset)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>

                  {/* Records Table */}
                  {(presetRecords[preset.id] || []).length === 0 ? (
                    <div className="text-center py-8 bg-muted/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">No records in this preset</p>
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
                        {(presetRecords[preset.id] || []).map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>
                              <RecordTypeBadge type={record.record_type} />
                            </TableCell>
                            <TableCell className="font-mono text-sm">{record.name}</TableCell>
                            <TableCell className="font-mono text-sm max-w-[200px] truncate">
                              {record.priority && <span className="text-muted-foreground mr-1">{record.priority}</span>}
                              {record.content}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {record.ttl === 1 ? "Auto" : record.ttl}
                            </TableCell>
                            <TableCell>
                              <Badge variant={record.proxied ? "default" : "secondary"}>
                                {record.proxied ? "Yes" : "No"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => openEditRecord(preset, record)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteRecord(preset.id, record.id)}
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
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Preset Dialog */}
      <Dialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingPreset ? "Edit Preset" : "Create Preset"}
            </DialogTitle>
            <DialogDescription>
              {editingPreset ? "Update the preset details" : "Create a new DNS preset template"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Preset Name *</Label>
              <Input
                placeholder="e.g., Basic Web Hosting"
                value={presetForm.name}
                onChange={(e) => setPresetForm({ ...presetForm, name: e.target.value })}
                data-testid="preset-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe what this preset is for..."
                value={presetForm.description}
                onChange={(e) => setPresetForm({ ...presetForm, description: e.target.value })}
                data-testid="preset-description-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPresetDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePreset} data-testid="save-preset-btn">
              {editingPreset ? "Update Preset" : "Create Preset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Dialog */}
      <Dialog open={recordDialogOpen} onOpenChange={(open) => { setRecordDialogOpen(open); if (!open) { setEditingRecord(null); resetRecordForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingRecord ? "Edit Record" : "Add Record"}
            </DialogTitle>
            <DialogDescription>
              {editingRecord ? "Update the DNS record" : `Add a new record to ${selectedPreset?.name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Record Type</Label>
              <Select
                value={recordForm.record_type}
                onValueChange={(val) => setRecordForm({ ...recordForm, record_type: val })}
              >
                <SelectTrigger>
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
                placeholder="@ for root, * for wildcard, or subdomain"
                value={recordForm.name}
                onChange={(e) => setRecordForm({ ...recordForm, name: e.target.value })}
                data-testid="preset-record-name"
              />
              <p className="text-xs text-muted-foreground">Use @ for root domain, * for wildcard</p>
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Input
                placeholder="Record value"
                value={recordForm.content}
                onChange={(e) => setRecordForm({ ...recordForm, content: e.target.value })}
                data-testid="preset-record-content"
              />
            </div>
            {recordForm.record_type === "MX" && (
              <div className="space-y-2">
                <Label>Priority</Label>
                <Input
                  type="number"
                  placeholder="10"
                  value={recordForm.priority || ""}
                  onChange={(e) => setRecordForm({ ...recordForm, priority: parseInt(e.target.value) || null })}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>TTL</Label>
              <Select
                value={recordForm.ttl.toString()}
                onValueChange={(val) => setRecordForm({ ...recordForm, ttl: parseInt(val) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Auto</SelectItem>
                  <SelectItem value="300">5 minutes</SelectItem>
                  <SelectItem value="3600">1 hour</SelectItem>
                  <SelectItem value="86400">1 day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {["A", "AAAA", "CNAME"].includes(recordForm.record_type) && (
              <div className="flex items-center justify-between">
                <Label>Cloudflare Proxy</Label>
                <Switch
                  checked={recordForm.proxied}
                  onCheckedChange={(val) => setRecordForm({ ...recordForm, proxied: val })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRecord} data-testid="save-preset-record-btn">
              {editingRecord ? "Update Record" : "Add Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
