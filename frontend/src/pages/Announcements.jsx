import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Megaphone, Plus, Pencil, Trash2, X, Upload, Pin, FileText } from "lucide-react";
import { Announcement } from "@/api/entities";
import { UploadFile } from "@/api/integrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, logAudit } from "@/lib/performance";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

const CATEGORIES = ["General", "Policy", "Event", "Urgent", "HR"];

export default function Announcements() {
  const { role, performer } = useOutletContext();
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", category: "General", file_url: "", file_name: "", pinned: false });

  const isAdmin = ["Super Administrator", "Administrator", "Director of Operations"].includes(role);

  const loadData = async () => {
    try {
      const data = await Announcement.list("-created_date", 100);
      setAnnouncements(data || []);
    } catch (e) {
      toast({ title: "Error", description: "Failed to load announcements", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: "", content: "", category: "General", file_url: "", file_name: "", pinned: false });
    setShowForm(true);
  };

  const openEdit = (ann) => {
    setEditing(ann);
    setForm({ title: ann.title || "", content: ann.content || "", category: ann.category || "General", file_url: ann.file_url || "", file_name: ann.file_name || "", pinned: ann.pinned || false });
    setShowForm(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await UploadFile({ file });
      setForm((prev) => ({ ...prev, file_url: res.file_url, file_name: file.name }));
    } catch (err) {
      toast({ title: "Error", description: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = { ...form, created_by_id: performer.id, created_by_name: performer.name, active: true };
    try {
      if (editing) {
        await Announcement.update(editing.id, data);
        await logAudit("Edited Announcement", "Announcement", editing.id, data.title, performer, "");
        toast({ title: "Updated", description: "Announcement updated" });
      } else {
        const created = await Announcement.create(data);
        await logAudit("Created Announcement", "Announcement", created.id, data.title, performer, "");
        toast({ title: "Posted", description: "Announcement posted" });
      }
      setShowForm(false);
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to save announcement", variant: "destructive" });
    }
  };

  const handleDelete = async (ann) => {
    if (!confirm(`Delete announcement "${ann.title}"?`)) return;
    try {
      await Announcement.delete(ann.id);
      await logAudit("Deleted Announcement", "Announcement", ann.id, ann.title, performer, "");
      toast({ title: "Deleted", description: "Announcement deleted" });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const sorted = [...announcements].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900">Announcements</h1>
          <p className="text-sm text-slate-500 mt-1">Company notices and updates</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="bg-slate-800 hover:bg-slate-900">
            <Plus className="w-4 h-4 mr-1" /> New Announcement
          </Button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No announcements yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((ann) => (
            <div key={ann.id} className={cn(
              "bg-white rounded-xl border p-5 transition-shadow hover:shadow-md",
              ann.pinned ? "border-amber-200 bg-amber-50/30" : "border-slate-200"
            )}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  {ann.pinned && <Pin className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />}
                  <div>
                    <h3 className="font-heading font-bold text-slate-900">{ann.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{ann.category}</span>
                      <span className="text-xs text-slate-400">by {ann.created_by_name} • {formatDate(ann.created_date)}</span>
                    </div>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(ann)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(ann)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
              <p className="text-sm text-slate-600 mt-3 whitespace-pre-wrap">{ann.content}</p>
              {ann.file_url && (
                <a href={ann.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 mt-3">
                  <FileText className="w-3.5 h-3.5" /> {ann.file_name || "View attachment"}
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold text-slate-900">{editing ? "Edit Announcement" : "New Announcement"}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Content *</Label><Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={5} required /></div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 hover:text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">
                  <Upload className="w-4 h-4" /> {form.file_name || "Attach file"}
                  <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                </label>
                {uploading && <span className="text-xs text-slate-400">Uploading...</span>}
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} className="rounded" />
                <span className="text-sm text-slate-600">Pin to top</span>
              </label>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 bg-slate-800 hover:bg-slate-900">{editing ? "Update" : "Post"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}