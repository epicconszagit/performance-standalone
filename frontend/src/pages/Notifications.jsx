import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
import { Notification } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/performance";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

const TYPE_ICONS = {
  task_assigned: "📋",
  deadline_approaching: "⏰",
  task_overdue: "⚠️",
  meeting_scheduled: "📅",
  minutes_uploaded: "📄",
  performance_report: "📊",
  announcement: "📢",
  action_item: "✅",
  birthday: "🎂",
};

const TYPE_LABELS = {
  task_assigned: "Task Assigned",
  deadline_approaching: "Deadline Approaching",
  task_overdue: "Task Overdue",
  meeting_scheduled: "Meeting Scheduled",
  minutes_uploaded: "Minutes Uploaded",
  performance_report: "Performance Report",
  announcement: "Announcement",
  action_item: "Action Item",
  birthday: "Birthday",
};

export default function Notifications() {
  const { user } = useOutletContext();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const loadData = async () => {
    if (!user) { setLoading(false); return; }
    try {
      const data = await Notification.list("-created_date", 100);
      setNotifications(data || []);
    } catch (e) {
      toast({ title: "Error", description: "Failed to load notifications", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [user]);

  const handleMarkRead = async (notif) => {
    try {
      await Notification.update(notif.id, { read: true });
      loadData();
    } catch (e) { }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    for (const n of unread) {
      try { await Notification.update(n.id, { read: true }); } catch (e) { }
    }
    toast({ title: "Done", description: "All notifications marked as read" });
    loadData();
  };

  const handleDelete = async (notif) => {
    try {
      await Notification.delete(notif.id);
      loadData();
    } catch (e) { }
  };

  const filtered = filter === "unread" ? notifications.filter((n) => !n.read) : notifications;
  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <Button onClick={handleMarkAllRead} variant="outline" className="flex items-center gap-1">
            <CheckCheck className="w-4 h-4" /> Mark all read
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={() => setFilter("all")} className={cn("px-3 py-1.5 rounded-lg text-sm font-medium", filter === "all" ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-600")}>All</button>
        <button onClick={() => setFilter("unread")} className={cn("px-3 py-1.5 rounded-lg text-sm font-medium", filter === "unread" ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-600")}>Unread ({unreadCount})</button>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No notifications</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {filtered.map((notif) => (
            <div key={notif.id} className={cn("flex items-start gap-3 p-4 hover:bg-slate-50 transition-colors", !notif.read && "bg-amber-50/30")}>
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-base shrink-0">
                {TYPE_ICONS[notif.type] || "🔔"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800">{notif.title}</p>
                  {!notif.read && <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />}
                </div>
                <p className="text-sm text-slate-500 mt-0.5">{notif.message}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-400">{formatDateTime(notif.created_date)}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{TYPE_LABELS[notif.type] || notif.type}</span>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                {!notif.read && (
                  <button onClick={() => handleMarkRead(notif)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-emerald-600" title="Mark as read">
                    <Check className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => handleDelete(notif)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}