import { useState, useEffect } from "react";
import { api } from "@/App";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Activity, Globe, Layers, Cloud, Key, User } from "lucide-react";
import { format, parseISO } from "date-fns";

const ActionBadge = ({ action }) => {
  const colors = {
    create: "bg-green-100 text-green-800",
    update: "bg-blue-100 text-blue-800",
    delete: "bg-red-100 text-red-800",
    sync_from_cloudflare: "bg-orange-100 text-orange-800",
    push_to_cloudflare: "bg-purple-100 text-purple-800",
    apply_preset: "bg-yellow-100 text-yellow-800",
    toggle_proxy: "bg-cyan-100 text-cyan-800",
    change_password: "bg-gray-100 text-gray-800",
  };
  
  const labels = {
    create: "Created",
    update: "Updated",
    delete: "Deleted",
    sync_from_cloudflare: "Synced from CF",
    push_to_cloudflare: "Pushed to CF",
    apply_preset: "Applied Preset",
    toggle_proxy: "Toggled Proxy",
    change_password: "Password Changed",
  };
  
  return (
    <span className={`badge-type ${colors[action] || 'bg-gray-100 text-gray-800'}`}>
      {labels[action] || action}
    </span>
  );
};

const EntityIcon = ({ type }) => {
  const icons = {
    domain: Globe,
    dns_record: Cloud,
    dns_preset: Layers,
    cloudflare_account: Key,
    user: User,
  };
  
  const Icon = icons[type] || Activity;
  return <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />;
};

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get("/activity-logs?limit=100");
      setLogs(res.data);
    } catch (error) {
      console.error("Failed to load activity logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const formatDate = (dateString) => {
    try {
      return format(parseISO(dateString), "MMM d, yyyy HH:mm");
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Activity Logs</h1>
        <p className="text-muted-foreground mt-1">Track all changes and actions in your DNS Manager</p>
      </div>

      {/* Logs Table */}
      <Card className="border">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center">
              <Activity className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" strokeWidth={1} />
              <h3 className="font-heading text-lg font-medium mb-1">No activity yet</h3>
              <p className="text-sm text-muted-foreground">
                Actions will be logged here as you use the DNS Manager
              </p>
            </div>
          ) : (
            <Table className="dns-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Entity</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <EntityIcon type={log.entity_type} />
                        <span className="capitalize text-sm">
                          {log.entity_type.replace(/_/g, " ")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ActionBadge action={log.action} />
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {log.entity_name || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[250px] truncate">
                      {log.details || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
