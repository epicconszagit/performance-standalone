import React, { useState, useEffect } from "react";
import { ScrollText, Search } from "lucide-react";
import { AuditLog as AuditLogEntity } from "@/api/entities";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime } from "@/lib/performance";
import { useToast } from "@/components/ui/use-toast";

export default function AuditLog() {
  const { toast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await AuditLogEntity.list("-timestamp", 500);
        if (mounted) setLogs(data || []);
      } catch (e) {
        toast({ title: "Error", description: "Failed to load audit log", variant: "destructive" });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const entityTypes = ["all", ...new Set(logs.map((l) => l.entity_type).filter(Boolean))];

  const filtered = logs.filter((log) => {
    const matchSearch = !search ||
      log.action?.toLowerCase().includes(search.toLowerCase()) ||
      log.entity_name?.toLowerCase().includes(search.toLowerCase()) ||
      log.performed_by_name?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || log.entity_type === filterType;
    return matchSearch && matchType;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-slate-900">Audit Trail</h1>
        <p className="text-sm text-slate-500 mt-1">Complete log of all system changes and actions</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by action, entity, or user..." className="pl-9" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            {entityTypes.map((t) => <SelectItem key={t} value={t}>{t === "all" ? "All Types" : t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Action</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Entity</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Performed By</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Details</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.slice(0, 100).map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-slate-800">{log.action}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{log.entity_type}</span>
                    {log.entity_name && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[150px]">{log.entity_name}</p>}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-sm text-slate-600">{log.performed_by_name}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-slate-400 max-w-[200px] truncate">{log.details || "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{formatDateTime(log.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-12 text-center">
            <ScrollText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No audit records found</p>
          </div>
        )}
      </div>
    </div>
  );
}