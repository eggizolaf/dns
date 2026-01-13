import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if already logged in
  if (user) {
    const from = location.state?.from?.pathname || "/dashboard";
    navigate(from, { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("Please enter username and password");
      return;
    }

    setLoading(true);
    try {
      await login(username, password);
      toast.success("Login successful");
      const from = location.state?.from?.pathname || "/dashboard";
      navigate(from, { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
              <Globe className="h-7 w-7 text-primary-foreground" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="font-heading font-bold text-2xl tracking-tight">DNS Manager</h1>
              <p className="text-sm text-muted-foreground">Cloudflare Integration</p>
            </div>
          </div>

          {/* Login Card */}
          <Card className="border shadow-sm">
            <CardHeader className="space-y-1">
              <CardTitle className="font-heading text-2xl">Welcome back</CardTitle>
              <CardDescription>Enter your credentials to access your account</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                    data-testid="login-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      data-testid="login-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full active:scale-95 transition-transform" 
                  disabled={loading}
                  data-testid="login-submit"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></span>
                      Signing in...
                    </span>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Manage your DNS records with ease
          </p>
        </div>
      </div>

      {/* Right Panel - Background Image */}
      <div 
        className="hidden lg:block flex-1 bg-cover bg-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1765046255517-412341954c4c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwYWJzdHJhY3QlMjBuZXR3b3JrJTIwd2hpdGUlMjBiYWNrZ3JvdW5kfGVufDB8fHx8MTc2ODI3MTY2MXww&ixlib=rb-4.1.0&q=85')`,
        }}
      >
        <div className="h-full w-full bg-gradient-to-br from-primary/5 to-transparent flex items-end p-12">
          <div className="max-w-md">
            <h2 className="font-heading text-3xl font-bold text-primary mb-3">
              Powerful DNS Management
            </h2>
            <p className="text-muted-foreground">
              Seamlessly manage your domains, DNS records, and Cloudflare integration all in one place.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
