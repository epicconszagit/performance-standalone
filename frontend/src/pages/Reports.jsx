import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { FileText, Plus, X, Download, Trash2, Search, Upload } from "lucide-react";
import { Report } from "@/api/entities";
import { UploadFile } from "@/api/integrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatDate, logAudit } from "@/lib/performance";
import { useToast } from "@/components/ui/use-toast";

export default function Reports() {
  const { employee, role, performer } = useOutletContext();
  const { toast } = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ heading: "", description: "", file_url: "", file_name: "" });

  const isAdmin = ["Super Administrator", "Administrator", "Director of Operations"].includes(role);

  const loadData = async () => {
    try {
      const all = await Report.list("-submitted_date", 300);
      setReports(all || []);
    } catch (e) {
      toast({ title: "Error", description: "Failed to load reports", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await UploadFile({ file });
      setForm((prev) => ({ ...prev, file_url: res.file_url, file_name: file.name }));
      toast({ title: "Uploaded", description: "File attached" });
    } catch (err) {
      toast({ title: "Error", description: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const created = await Report.create({
        heading: form.heading,
        description: form.description,
        submitted_by_id: performer.id,
        submitted_by_name: performer.name,
        submitted_date: new Date().toISOString(),
        department_id: employee?.department_id || "",
        department_name: employee?.department_name || "",
        file_url: form.file_url,
        file_name: form.file_name,
      });
      await logAudit("Submitted Report", "Report", created.id, form.heading, performer, "");
      toast({ title: "Submitted", description: "Report submitted successfully" });
      setForm({ heading: "", description: "", file_url: "", file_name: "" });
      setShowForm(false);
      loadData();
    } catch (err) {
      toast({ title: "Error", description: "Failed to submit report", variant: "destructive" });
    }
  };

  const handleDelete = async (report) => {
    if (!confirm(`Delete report "${report.heading}"?`)) return;
    try {
      await Report.delete(report.id);
      await logAudit("Deleted Report", "Report", report.id, report.heading, performer, "");
      toast({ title: "Deleted", description: "Report deleted" });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete report", variant: "destructive" });
    }
  };

  const filtered = reports.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.heading || "").toLowerCase().includes(q) ||
      (r.description || "").toLowerCase().includes(q) ||
      (r.submitted_by_name || "").toLowerCase().includes(q);
  });

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Submit and view organizational reports</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-slate-800 hover:bg-slate-900">
          <Plus className="w-4 h-4 mr-1" /> Submit Report
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reports..." className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">{search ? "No reports match your search" : "No reports submitted yet"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-heading font-bold text-slate-900">{r.heading}</h3>
                  {r.department_name && (
                    <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                      {r.department_name}
                    </span>
                  )}
                </div>
                {r.file_url && (
                  <a href={r.file_url} target="_blank" rel="noreferrer"
                    className="text-xs font-medium text-amber-600 hover:text-amber-700 flex items-center gap-1 shrink-0">
                    <Download className="w-3.5 h-3.5" /> File
                  </a>
                )}
              </div>
              <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap line-clamp-4">{r.description}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-400">
                  {r.submitted_by_name || "Unknown"} • {formatDate(r.submitted_date)}
                </p>
                {(isAdmin || r.submitted_by_id === performer.id) && (
                  <button onClick={() => handleDelete(r)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Submit Report Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold text-slate-900">Submit a Report</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Heading *</Label>
                <Input value={form.heading} onChange={(e) => setForm({ ...form, heading: e.target.value })} required placeholder="Report heading" />
              </div>
              <div>
                <Label>Brief Description *</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required rows={5} placeholder="Briefly describe the report..." />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 hover:text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">
                  <Upload className="w-4 h-4" /> {form.file_name || "Attach file (optional)"}
                  <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>
                {uploading && <span className="text-xs text-slate-400">Uploading...</span>}
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 bg-slate-800 hover:bg-slate-900">Submit Report</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}