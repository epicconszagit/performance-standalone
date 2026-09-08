import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { ClipboardList, Plus, X, Download, Trash2, Search, Upload, CheckCircle2, FileText } from "lucide-react";
import { MeetingMinutes as MeetingMinutesEntity, Meeting } from "@/api/entities";
import { UploadFile } from "@/api/integrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, logAudit } from "@/lib/performance";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export default function MeetingMinutes() {
  const { employee, role, performer } = useOutletContext();
  const { toast } = useToast();
  const [minutes, setMinutes] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ meeting_id: "", content: "", file_url: "", file_name: "", status: "Draft" });

  const isSecretary = role === "Secretary";
  const isAdmin = ["Super Administrator", "Administrator", "Director of Operations"].includes(role);
  const canManage = isSecretary || isAdmin;

  const loadData = async () => {
    try {
      const [mins, mts] = await Promise.all([
        MeetingMinutesEntity.list("-uploaded_date", 300),
        Meeting.list("-date", 200),
      ]);
      setMinutes(mins || []);
      setMeetings(mts || []);
    } catch (e) {
      toast({ title: "Error", description: "Failed to load meeting minutes", variant: "destructive" });
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
      toast({ title: "Uploaded", description: "Document attached" });
    } catch (err) {
      toast({ title: "Error", description: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.meeting_id) {
      toast({ title: "Error", description: "Please select a meeting", variant: "destructive" });
      return;
    }
    if (!form.file_url) {
      toast({ title: "Error", description: "Please attach the minutes document", variant: "destructive" });
      return;
    }
    const meeting = meetings.find((m) => m.id === form.meeting_id);
    const now = new Date().toISOString();
    const trail = [{ action: "Uploaded", by_name: performer.name, timestamp: now }];
    try {
      const created = await MeetingMinutesEntity.create({
        meeting_id: form.meeting_id,
        meeting_title: meeting?.title || "",
        content: form.content,
        file_url: form.file_url,
        file_name: form.file_name,
        status: canManage ? form.status : "Draft",
        uploaded_by_id: performer.id,
        uploaded_by_name: performer.name,
        uploaded_date: now,
        last_edited_by_id: performer.id,
        last_edited_by_name: performer.name,
        last_edited_date: now,
        version: 1,
        audit_trail: trail,
      });
      await logAudit("Uploaded Minutes", "MeetingMinutes", created.id, meeting?.title || "", performer, "Document upload");
      toast({ title: "Submitted", description: "Meeting minutes uploaded" });
      setForm({ meeting_id: "", content: "", file_url: "", file_name: "", status: "Draft" });
      setShowForm(false);
      loadData();
    } catch (err) {
      toast({ title: "Error", description: "Failed to upload minutes", variant: "destructive" });
    }
  };

  const handleApprove = async (mn) => {
    const now = new Date().toISOString();
    try {
      await MeetingMinutesEntity.update(mn.id, {
        status: "Approved",
        approved_by_id: performer.id,
        approved_by_name: performer.name,
        approved_date: now,
        last_edited_by_id: performer.id,
        last_edited_by_name: performer.name,
        last_edited_date: now,
        audit_trail: [...(mn.audit_trail || []), { action: "Approved", by_name: performer.name, timestamp: now }],
      });
      await logAudit("Approved Minutes", "MeetingMinutes", mn.id, mn.meeting_title, performer, "");
      toast({ title: "Approved", description: "Minutes approved" });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to approve minutes", variant: "destructive" });
    }
  };

  const handleDelete = async (mn) => {
    if (!confirm(`Delete minutes for "${mn.meeting_title}"?`)) return;
    try {
      await MeetingMinutesEntity.delete(mn.id);
      await logAudit("Deleted Minutes", "MeetingMinutes", mn.id, mn.meeting_title, performer, "");
      toast({ title: "Deleted", description: "Minutes deleted" });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete minutes", variant: "destructive" });
    }
  };

  const filtered = minutes.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (m.meeting_title || "").toLowerCase().includes(q) ||
      (m.content || "").toLowerCase().includes(q) ||
      (m.file_name || "").toLowerCase().includes(q) ||
      (m.uploaded_by_name || "").toLowerCase().includes(q);
  });

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900">Meeting Minutes</h1>
          <p className="text-sm text-slate-500 mt-1">Upload, view and download meeting minutes as documents</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-slate-800 hover:bg-slate-900">
          <Plus className="w-4 h-4 mr-1" /> Upload Minutes
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search minutes..." className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">{search ? "No minutes match your search" : "No meeting minutes uploaded yet"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((m) => (
            <div key={m.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-heading font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="truncate">{m.meeting_title || "Untitled Meeting"}</span>
                  </h3>
                  {m.file_name && (
                    <p className="text-xs text-slate-400 mt-1 truncate">{m.file_name}</p>
                  )}
                </div>
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold border shrink-0",
                  m.status === "Approved" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-amber-100 text-amber-700 border-amber-200")}>
                  {m.status}
                </span>
              </div>
              {m.content && (
                <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap line-clamp-3">{m.content}</p>
              )}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-400">
                  {m.uploaded_by_name || "Unknown"} • {formatDate(m.uploaded_date)}
                </p>
                <div className="flex items-center gap-1">
                  {m.file_url && (
                    <a href={m.file_url} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600" title="Download">
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                  {canManage && m.status !== "Approved" && (
                    <button onClick={() => handleApprove(m)} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600" title="Approve">
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                  {(isAdmin || m.uploaded_by_id === performer.id) && (
                    <button onClick={() => handleDelete(m)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Minutes Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold text-slate-900">Upload Meeting Minutes</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Meeting *</Label>
                <Select value={form.meeting_id} onValueChange={(v) => setForm({ ...form, meeting_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select a meeting" /></SelectTrigger>
                  <SelectContent>
                    {meetings.map((m) => <SelectItem key={m.id} value={m.id}>{m.title} — {formatDate(m.date)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Minutes Document *</Label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 hover:text-slate-800 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 w-full">
                  <Upload className="w-4 h-4" /> {form.file_name || "Attach document (PDF, Word, etc.)"}
                  <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>
                {uploading && <p className="text-xs text-slate-400 mt-1">Uploading...</p>}
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={4} placeholder="Summary or key points from the meeting..." />
              </div>
              {canManage && (
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Approved">Approved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 bg-slate-800 hover:bg-slate-900">Upload Minutes</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}