import { useState, useEffect } from "react";
import { api, useAuth } from "@/App";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Edit, Cloud, Eye, EyeOff, RefreshCw, Key } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user, changePassword } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingAccount, setTestingAccount] = useState(null);
  
  // Form states
  const [accountForm, setAccountForm] = useState({
    name: "",
    email: "",
    api_key: "",
    account_id: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await api.get("/cloudflare-accounts");
      setAccounts(res.data);
    } catch (error) {
      toast.error("Failed to load accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleSaveAccount = async () => {
    if (!accountForm.name || !accountForm.email || !accountForm.api_key) {
      toast.error("Name, email, and API key are required");
      return;
    }

    try {
      if (editingAccount) {
        await api.put(`/cloudflare-accounts/${editingAccount.id}`, accountForm);
        toast.success("Account updated successfully");
      } else {
        await api.post("/cloudflare-accounts", accountForm);
        toast.success("Account added successfully");
      }
      setAccountDialogOpen(false);
      setEditingAccount(null);
      resetAccountForm();
      fetchAccounts();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save account");
    }
  };

  const handleDeleteAccount = async (account) => {
    if (!confirm(`Delete Cloudflare account "${account.name}"?`)) return;

    try {
      await api.delete(`/cloudflare-accounts/${account.id}`);
      toast.success("Account deleted successfully");
      fetchAccounts();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete account");
    }
  };

  const handleTestAccount = async (account) => {
    setTestingAccount(account.id);
    try {
      const res = await api.post(`/cloudflare-accounts/${account.id}/test-connection`);
      if (res.data.success) {
        toast.success(res.data.message);
        if (res.data.zones && res.data.zones.length > 0) {
          console.log("Found zones:", res.data.zones);
        }
      } else {
        toast.error(res.data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Connection failed. Check your credentials.");
    } finally {
      setTestingAccount(null);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.current_password || !passwordForm.new_password) {
      toast.error("All fields are required");
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error("New passwords do not match");
      return;
    }
    if (passwordForm.new_password.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }

    try {
      await changePassword(passwordForm.current_password, passwordForm.new_password);
      toast.success("Password changed successfully");
      setPasswordDialogOpen(false);
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to change password");
    }
  };

  const openEditAccount = (account) => {
    setEditingAccount(account);
    setAccountForm({
      name: account.name,
      email: account.email,
      api_key: "",
      account_id: account.account_id || "",
    });
    setAccountDialogOpen(true);
  };

  const resetAccountForm = () => {
    setAccountForm({
      name: "",
      email: "",
      api_key: "",
      account_id: "",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and Cloudflare integrations</p>
      </div>

      <Tabs defaultValue="cloudflare" className="space-y-6">
        <TabsList>
          <TabsTrigger value="cloudflare" data-testid="tab-cloudflare">Cloudflare Accounts</TabsTrigger>
          <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
        </TabsList>

        {/* Cloudflare Accounts Tab */}
        <TabsContent value="cloudflare" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="font-heading text-xl font-semibold">Cloudflare Accounts</h2>
              <p className="text-sm text-muted-foreground">Manage your Cloudflare API credentials</p>
            </div>
            <Button onClick={() => { setEditingAccount(null); resetAccountForm(); setAccountDialogOpen(true); }} data-testid="add-cf-account-btn">
              <Plus className="h-4 w-4 mr-2" />
              Add Account
            </Button>
          </div>

          <Card className="border">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))}
                </div>
              ) : accounts.length === 0 ? (
                <div className="p-12 text-center">
                  <Cloud className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" strokeWidth={1} />
                  <h3 className="font-heading text-lg font-medium mb-1">No Cloudflare accounts</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add your Cloudflare API credentials to get started
                  </p>
                  <Button onClick={() => setAccountDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Account
                  </Button>
                </div>
              ) : (
                <Table className="dns-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Account ID</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="font-medium">{account.name}</TableCell>
                        <TableCell className="text-muted-foreground">{account.email}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {account.account_id || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleTestAccount(account)}
                              disabled={testingAccount === account.id}
                              data-testid={`test-account-${account.id}`}
                            >
                              <RefreshCw className={`h-4 w-4 mr-1 ${testingAccount === account.id ? 'animate-spin' : ''}`} />
                              Test
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => openEditAccount(account)}
                              data-testid={`edit-account-${account.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeleteAccount(account)}
                              data-testid={`delete-account-${account.id}`}
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

          {/* Help Card */}
          <Card className="border bg-muted/30">
            <CardContent className="pt-6">
              <h3 className="font-heading font-medium mb-2">How to get Cloudflare API Key</h3>
              <p className="text-sm text-muted-foreground mb-3">
                You can use either <strong>Global API Key</strong> or <strong>API Token</strong>:
              </p>
              
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Option 1: Global API Key</p>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside ml-2">
                    <li>Go to <span className="font-mono text-xs bg-muted px-1 rounded">My Profile → API Tokens</span></li>
                    <li>Click <span className="font-mono text-xs bg-muted px-1 rounded">View</span> next to Global API Key</li>
                    <li>Enter your Cloudflare email and the API Key</li>
                  </ol>
                </div>
                
                <div>
                  <p className="text-sm font-medium">Option 2: API Token (Recommended)</p>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside ml-2">
                    <li>Go to <span className="font-mono text-xs bg-muted px-1 rounded">My Profile → API Tokens</span></li>
                    <li>Click <span className="font-mono text-xs bg-muted px-1 rounded">Create Token</span></li>
                    <li>Use <span className="font-mono text-xs bg-muted px-1 rounded">Edit zone DNS</span> template</li>
                    <li>Select permissions: Zone - DNS - Edit, Zone - Zone - Read</li>
                    <li>Enter any email and paste the token as API Key</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <Card className="border">
            <CardHeader>
              <CardTitle className="font-heading">Profile Information</CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">Username</Label>
                  <p className="font-medium mt-1">{user?.username}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">Role</Label>
                  <p className="font-medium mt-1">Administrator</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border">
            <CardHeader>
              <CardTitle className="font-heading">Security</CardTitle>
              <CardDescription>Manage your password</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setPasswordDialogOpen(true)} data-testid="change-password-btn">
                <Key className="h-4 w-4 mr-2" />
                Change Password
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Account Dialog */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingAccount ? "Edit Cloudflare Account" : "Add Cloudflare Account"}
            </DialogTitle>
            <DialogDescription>
              {editingAccount 
                ? "Update your Cloudflare credentials" 
                : "Enter your Cloudflare API credentials"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Account Name *</Label>
              <Input
                placeholder="e.g., My Main Account"
                value={accountForm.name}
                onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                data-testid="cf-account-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Cloudflare Email *</Label>
              <Input
                type="email"
                placeholder="your@email.com"
                value={accountForm.email}
                onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })}
                data-testid="cf-account-email"
              />
            </div>
            <div className="space-y-2">
              <Label>API Key *</Label>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  placeholder={editingAccount ? "Leave blank to keep current" : "Enter your API key"}
                  value={accountForm.api_key}
                  onChange={(e) => setAccountForm({ ...accountForm, api_key: e.target.value })}
                  data-testid="cf-account-apikey"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Account ID (Optional)</Label>
              <Input
                placeholder="Found in Cloudflare dashboard"
                value={accountForm.account_id}
                onChange={(e) => setAccountForm({ ...accountForm, account_id: e.target.value })}
                data-testid="cf-account-id"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveAccount} data-testid="save-cf-account-btn">
              {editingAccount ? "Update Account" : "Add Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Change Password</DialogTitle>
            <DialogDescription>Enter your current password and a new password</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Password</Label>
              <Input
                type="password"
                value={passwordForm.current_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                data-testid="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                data-testid="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={passwordForm.confirm_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                data-testid="confirm-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleChangePassword} data-testid="save-password-btn">
              Change Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
