import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import {
  CalendarDays, Plus, Pencil, Trash2, X, Clock, MapPin, Users as UsersIcon,
  FileText, Upload, Download, ListChecks, ChevronRight, Search
} from "lucide-react";
import { Meeting, Employee, MeetingMinutes, ActionItem } from "@/api/entities";
import { UploadFile } from "@/api/integrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/Badges";
import { formatDate, formatDateTime, logAudit, createNotification } from "@/lib/performance";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export default function Meetings() {
  const { employee, role, performer, user } = useOutletContext();
  const { toast } = useToast();
  const [meetings, setMeetings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [minutes, setMinutes] = useState([]);
  const [actionItems, setActionItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: "", date: "", time: "", venue: "", agenda: "", resolutions: "", attendee_ids: [] });
  const [minutesForm, setMinutesForm] = useState({ content: "", file_url: "", file_name: "", status: "Draft" });
  const [newActionItem, setNewActionItem] = useState({ description: "", assigned_to_id: "", due_date: "" });
  const [uploading, setUploading] = useState(false);
  const [minutesSearch, setMinutesSearch] = useState("");

  const isSecretary = role === "Secretary";
  const isAdmin = ["Super Administrator", "Administrator", "Director of Operations"].includes(role);
  const canManage = isSecretary || isAdmin;

  const loadData = async () => {
    try {
      const [mts, emps, mins, ais] = await Promise.all([
        Meeting.list("-date", 200),
        Employee.list("-created_date", 300),
        MeetingMinutes.list("-uploaded_date", 300),
        ActionItem.list("-created_date", 300),
      ]);
      setMeetings(mts || []);
      setEmployees(emps || []);
      setMinutes(mins || []);
      setActionItems(ais || []);
    } catch (e) {
      toast({ title: "Error", description: "Failed to load meetings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: "", date: "", time: "", venue: "", agenda: "", resolutions: "", attendee_ids: [] });
    setShowForm(true);
  };

  const openEdit = (m) => {
    setEditing(m);
    setForm({ title: m.title || "", date: m.date || "", time: m.time || "", venue: m.venue || "", agenda: m.agenda || "", resolutions: m.resolutions || "", attendee_ids: m.attendee_ids || [] });
    setShowForm(true);
  };

  const toggleAttendee = (id) => {
    setForm((prev) => ({
      ...prev,
      attendee_ids: prev.attendee_ids.includes(id) ? prev.attendee_ids.filter((x) => x !== id) : [...prev.attendee_ids, id],
    }));
  };

  const handleMeetingSubmit = async (e) => {
    e.preventDefault();
    const names = form.attendee_ids.map((id) => employees.find((emp) => emp.id === id)?.full_name).filter(Boolean);
    const data = { ...form, attendee_names: names, created_by_id: performer.id, created_by_name: performer.name, status: "Scheduled" };
    try {
      if (editing) {
        await Meeting.update(editing.id, data);
        await logAudit("Edited Meeting", "Meeting", editing.id, data.title, performer, "");
        toast({ title: "Updated", description: "Meeting updated" });
      } else {
        const created = await Meeting.create(data);
        await logAudit("Created Meeting", "Meeting", created.id, data.title, performer, "Meeting scheduled");
        // Notify attendees
        for (const empId of form.attendee_ids) {
          const emp = employees.find((e) => e.id === empId);
          if (emp) await createNotification(emp.user_id || empId, empId, "Meeting Scheduled", `New meeting: "${data.title}" on ${formatDate(data.date)}`, "meeting_scheduled", created.id, "/meetings");
        }
        toast({ title: "Created", description: "Meeting scheduled" });
      }
      setShowForm(false);
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to save meeting", variant: "destructive" });
    }
  };

  const handleDelete = async (m) => {
    if (!confirm(`Delete meeting "${m.title}"?`)) return;
    try {
      await Meeting.delete(m.id);
      await logAudit("Deleted Meeting", "Meeting", m.id, m.title, performer, "");
      toast({ title: "Deleted", description: "Meeting deleted" });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete meeting", variant: "destructive" });
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await UploadFile({ file });
      setMinutesForm((prev) => ({ ...prev, file_url: res.file_url, file_name: file.name }));
      toast({ title: "Uploaded", description: "File attached" });
    } catch (err) {
      toast({ title: "Error", description: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveMinutes = async (meeting) => {
    const existing = minutes.find((m) => m.meeting_id === meeting.id);
    const trailEntry = { action: existing ? "Edited" : "Uploaded", by_name: performer.name, timestamp: new Date().toISOString() };
    const data = {
      meeting_id: meeting.id,
      meeting_title: meeting.title,
      content: minutesForm.content,
      file_url: minutesForm.file_url,
      file_name: minutesForm.file_name,
      status: minutesForm.status,
      uploaded_by_id: performer.id,
      uploaded_by_name: performer.name,
      uploaded_date: existing?.uploaded_date || new Date().toISOString(),
      last_edited_by_id: performer.id,
      last_edited_by_name: performer.name,
      last_edited_date: new Date().toISOString(),
      version: (existing?.version || 0) + 1,
      audit_trail: [...(existing?.audit_trail || []), trailEntry],
    };
    try {
      if (existing) {
        await MeetingMinutes.update(existing.id, data);
        await logAudit(minutesForm.status === "Approved" ? "Approved Minutes" : "Edited Minutes", "MeetingMinutes", existing.id, meeting.title, performer, `Status: ${minutesForm.status}`);
      } else {
        const created = await MeetingMinutes.create({ ...data, uploaded_date: new Date().toISOString() });
        await logAudit("Uploaded Minutes", "MeetingMinutes", created.id, meeting.title, performer, "");
      }
      toast({ title: "Saved", description: "Meeting minutes saved" });
      loadData();
      setShowDetail(null);
    } catch (e) {
      toast({ title: "Error", description: "Failed to save minutes", variant: "destructive" });
    }
  };

  const openMinutes = (meeting) => {
    const existing = minutes.find((m) => m.meeting_id === meeting.id);
    setMinutesForm({
      content: existing?.content || "",
      file_url: existing?.file_url || "",
      file_name: existing?.file_name || "",
      status: canManage ? (existing?.status || "Draft") : "Draft",
    });
    setShowDetail(meeting);
  };

  const addActionItem = async (meeting) => {
    if (!newActionItem.description || !newActionItem.assigned_to_id) {
      toast({ title: "Error", description: "Fill in description and assignee", variant: "destructive" });
      return;
    }
    const emp = employees.find((e) => e.id === newActionItem.assigned_to_id);
    try {
      const created = await ActionItem.create({
        meeting_id: meeting.id,
        meeting_title: meeting.title,
        description: newActionItem.description,
        assigned_to_id: newActionItem.assigned_to_id,
        assigned_to_name: emp?.full_name || "",
        status: "Pending",
        due_date: newActionItem.due_date,
        created_by_id: performer.id,
      });
      await logAudit("Created Action Item", "ActionItem", created.id, newActionItem.description, performer, `Assigned to ${emp?.full_name}`);
      if (emp) await createNotification(emp.user_id || emp.id, emp.id, "Action Item Assigned", `"${newActionItem.description}" from meeting: ${meeting.title}`, "action_item", created.id, "/meetings");
      setNewActionItem({ description: "", assigned_to_id: "", due_date: "" });
      toast({ title: "Added", description: "Action item created" });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to add action item", variant: "destructive" });
    }
  };

  const updateActionItem = async (ai, status) => {
    try {
      const updates = { status };
      if (status === "Completed") updates.completed_date = new Date().toISOString().split("T")[0];
      await ActionItem.update(ai.id, updates);
      await logAudit("Updated Action Item", "ActionItem", ai.id, ai.description, performer, `Status → ${status}`);
      toast({ title: "Updated", description: "Action item updated" });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to update action item", variant: "destructive" });
    }
  };

  const filteredMeetings = meetings.filter((m) => {
    if (!minutesSearch) return true;
    const q = minutesSearch.toLowerCase();
    const mn = minutes.find((mm) => mm.meeting_id === m.id);
    return (m.title || "").toLowerCase().includes(q) ||
      (m.agenda || "").toLowerCase().includes(q) ||
      (m.resolutions || "").toLowerCase().includes(q) ||
      (mn?.content || "").toLowerCase().includes(q) ||
      (mn?.file_name || "").toLowerCase().includes(q);
  });

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900">Meetings</h1>
          <p className="text-sm text-slate-500 mt-1">Schedule meetings, capture minutes, and track action items</p>
        </div>
        {canManage && (
          <Button onClick={openCreate} className="bg-slate-800 hover:bg-slate-900">
            <Plus className="w-4 h-4 mr-1" /> Schedule Meeting
          </Button>
        )}
      </div>

      {meetings.length > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={minutesSearch} onChange={(e) => setMinutesSearch(e.target.value)} placeholder="Search minutes, titles, agenda..." className="pl-9" />
        </div>
      )}

      {filteredMeetings.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">{minutesSearch ? "No meetings match your search" : "No meetings scheduled yet"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredMeetings.map((m) => {
            const meetingMinutes = minutes.find((mn) => mn.meeting_id === m.id);
            const meetingActions = actionItems.filter((ai) => ai.meeting_id === m.id);
            return (
              <div key={m.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-heading font-bold text-slate-900">{m.title}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {formatDate(m.date)}</span>
                      {m.time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {m.time}</span>}
                      {m.venue && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {m.venue}</span>}
                    </div>
                  </div>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold border shrink-0",
                    m.status === "Completed" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                      m.status === "Cancelled" ? "bg-red-100 text-red-700 border-red-200" : "bg-blue-100 text-blue-700 border-blue-200")}>
                    {m.status}
                  </span>
                </div>

                {m.attendee_names?.length > 0 && (
                  <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                    <UsersIcon className="w-3 h-3" /> {m.attendee_names.join(", ")}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                  {meetingMinutes ? (
                    <span className={cn("text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1",
                      meetingMinutes.status === "Approved" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
                      <FileText className="w-3 h-3" /> Minutes: {meetingMinutes.status}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 flex items-center gap-1"><FileText className="w-3 h-3" /> No minutes</span>
                  )}
                  {meetingActions.length > 0 && (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <ListChecks className="w-3 h-3" /> {meetingActions.filter((a) => a.status !== "Completed").length} action items
                    </span>
                  )}
                  <button onClick={() => openMinutes(m)} className="ml-auto text-xs font-medium text-amber-600 hover:text-amber-700 flex items-center gap-0.5">
                    Details <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                {canManage && (
                  <div className="flex gap-1 mt-2">
                    <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(m)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Meeting Form Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold text-slate-900">{editing ? "Edit Meeting" : "Schedule Meeting"}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleMeetingSubmit} className="space-y-4">
              <div><Label>Meeting Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Date *</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
                <div><Label>Time</Label><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
              </div>
              <div><Label>Venue</Label><Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="e.g. Boardroom A" /></div>
              <div><Label>Agenda</Label><Textarea value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} rows={3} /></div>
              <div><Label>Attendees</Label>
                <div className="border border-slate-200 rounded-lg p-3 max-h-32 overflow-y-auto space-y-1.5">
                  {employees.filter((e) => e.status === "active").map((emp) => (
                    <label key={emp.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded">
                      <input type="checkbox" checked={form.attendee_ids.includes(emp.id)} onChange={() => toggleAttendee(emp.id)} className="rounded" />
                      <span className="text-sm text-slate-700">{emp.full_name}</span>
                      <span className="text-xs text-slate-400">{emp.role}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 bg-slate-800 hover:bg-slate-900">{editing ? "Update" : "Schedule"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Meeting Detail / Minutes Dialog */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowDetail(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-heading font-bold text-slate-900">{showDetail.title}</h2>
                <p className="text-xs text-slate-400 mt-1">{formatDate(showDetail.date)} {showDetail.time && `at ${showDetail.time}`} {showDetail.venue && `• ${showDetail.venue}`}</p>
              </div>
              <button onClick={() => setShowDetail(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            {showDetail.agenda && (
              <div className="mb-4 p-3 rounded-lg bg-slate-50">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Agenda</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{showDetail.agenda}</p>
              </div>
            )}

            {showDetail.resolutions && (
              <div className="mb-4 p-3 rounded-lg bg-amber-50/50 border border-amber-100">
                <p className="text-xs font-semibold text-amber-700 uppercase mb-1">Resolutions</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{showDetail.resolutions}</p>
              </div>
            )}

            {/* Minutes section */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><FileText className="w-4 h-4" /> Meeting Minutes</h3>
                {minutes.find((m) => m.meeting_id === showDetail.id)?.file_url && (
                  <a href={minutes.find((m) => m.meeting_id === showDetail.id).file_url} target="_blank" rel="noreferrer"
                    className="text-xs font-medium text-amber-600 hover:text-amber-700 flex items-center gap-1">
                    <Download className="w-3 h-3" /> Download
                  </a>
                )}
              </div>
              <div className="space-y-3 p-3 border border-slate-200 rounded-lg">
                <div><Label>Minutes Content</Label><Textarea value={minutesForm.content} onChange={(e) => setMinutesForm({ ...minutesForm, content: e.target.value })} rows={4} placeholder="Type or paste meeting minutes here..." /></div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 hover:text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">
                    <Upload className="w-4 h-4" /> {minutesForm.file_name || "Upload file"}
                    <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                  </label>
                  {uploading && <span className="text-xs text-slate-400">Uploading...</span>}
                </div>
                <div className="flex items-center gap-3">
                  {canManage && (
                    <Select value={minutesForm.status} onValueChange={(v) => setMinutesForm({ ...minutesForm, status: v })}>
                      <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Draft">Draft</SelectItem>
                        <SelectItem value="Approved">Approved</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <Button onClick={() => handleSaveMinutes(showDetail)} className="bg-slate-800 hover:bg-slate-900 flex-1">
                    {canManage && minutesForm.status === "Approved" ? "Save & Approve" : "Save Minutes"}
                  </Button>
                </div>
                {minutes.find((m) => m.meeting_id === showDetail.id)?.audit_trail?.length > 0 && (
                  <div className="text-xs text-slate-400 space-y-0.5 pt-2 border-t border-slate-100">
                    <p className="font-semibold">Audit Trail:</p>
                    {minutes.find((m) => m.meeting_id === showDetail.id).audit_trail.map((entry, i) => (
                      <p key={i}>{entry.action} by {entry.by_name} — {formatDateTime(entry.timestamp)}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Action Items */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-2"><ListChecks className="w-4 h-4" /> Action Items</h3>
              <div className="space-y-2 mb-3">
                {actionItems.filter((ai) => ai.meeting_id === showDetail.id).map((ai) => (
                  <div key={ai.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-100">
                    <StatusBadge status={ai.status} />
                    <p className="text-sm text-slate-700 flex-1 min-w-0 truncate">{ai.description}</p>
                    <span className="text-xs text-slate-400 shrink-0">{ai.assigned_to_name}</span>
                    {canManage && ai.status !== "Completed" && (
                      <button onClick={() => updateActionItem(ai, "Completed")} className="text-xs text-emerald-600 hover:underline">Complete</button>
                    )}
                  </div>
                ))}
                {actionItems.filter((ai) => ai.meeting_id === showDetail.id).length === 0 && (
                  <p className="text-sm text-slate-400 italic">No action items</p>
                )}
              </div>
              {canManage && (
                <div className="flex flex-wrap gap-2 items-end p-3 border border-slate-200 rounded-lg">
                  <div className="flex-1 min-w-[150px]"><Input value={newActionItem.description} onChange={(e) => setNewActionItem({ ...newActionItem, description: e.target.value })} placeholder="Action item..." /></div>
                  <Select value={newActionItem.assigned_to_id} onValueChange={(v) => setNewActionItem({ ...newActionItem, assigned_to_id: v })}>
                    <SelectTrigger className="w-[150px]"><SelectValue placeholder="Assign to" /></SelectTrigger>
                    <SelectContent>{employees.filter((e) => e.status === "active").map((emp) => <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="date" value={newActionItem.due_date} onChange={(e) => setNewActionItem({ ...newActionItem, due_date: e.target.value })} className="w-[140px]" />
                  <Button onClick={() => addActionItem(showDetail)} size="sm" className="bg-slate-800 hover:bg-slate-900">Add</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}