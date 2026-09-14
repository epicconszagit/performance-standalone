import React, { useState, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { Bell, Check, CheckCheck, Trash2, User, Users, ExternalLink, Sparkles } from "lucide-react";
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
  task_started: "▶️",
  task_seen: "👁️",
  task_submitted: "📤",
  task_approved: "🎉",
  task_rejected: "↩️",
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
  task_started: "Task Started",
  task_seen: "Task Seen",
  task_submitted: "Task Submitted",
  task_approved: "Task Approved",
  task_rejected: "Task Rejected",
};

export default function Notifications() {
  const { user, employee, role } = useOutletContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("mine"); // "mine" | "team" | "all"
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "unread"

  const isPersonalNotification = (notif) => {
    if (!user && !employee) return false;
    if (user && notif.user_id === user.id) return true;
    if (employee && (notif.employee_id === employee.id || notif.user_id === employee.id)) return true;
    if (user && notif.employee_id === user.id) return true;
    const msg = (notif.message || "").toLowerCase();
    if (msg.includes("you have been assigned") || msg.includes("for your approval")) {
      return true;
    }
    return false;
  };

  const loadData = async () => {
    if (!user) { setLoading(false); return; }
    try {
      const data = await Notification.list("-created_date", 150);
      setNotifications(data || []);
    } catch (e) {
      toast({ title: "Error", description: "Failed to load notifications", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [user, employee]);

  const handleMarkRead = async (e, notif) => {
    e.stopPropagation();
    try {
      await Notification.update(notif.id, { read: true });
      loadData();
    } catch (e) { }
  };

  const handleMarkAllRead = async () => {
    // If viewing personal tab, only mark personal unread as read
    const targetList = category === "mine"
      ? notifications.filter((n) => isPersonalNotification(n) && !n.read)
      : category === "team"
        ? notifications.filter((n) => !isPersonalNotification(n) && !n.read)
        : notifications.filter((n) => !n.read);

    for (const n of targetList) {
      try { await Notification.update(n.id, { read: true }); } catch (e) { }
    }
    toast({
      title: "Done",
      description: category === "mine" ? "All personal notifications marked as read" : "Notifications marked as read"
    });
    loadData();
  };

  const handleDelete = async (e, notif) => {
    e.stopPropagation();
    try {
      await Notification.delete(notif.id);
      loadData();
    } catch (e) { }
  };

  const handleClickNotification = async (notif) => {
    if (!notif.read) {
      try { await Notification.update(notif.id, { read: true }); } catch (e) { }
    }
    if (notif.link) {
      navigate(notif.link);
    }
  };

  const myNotifs = notifications.filter(isPersonalNotification);
  const teamNotifs = notifications.filter((n) => !isPersonalNotification(n));

  const myUnreadCount = myNotifs.filter((n) => !n.read).length;
  const teamUnreadCount = teamNotifs.filter((n) => !n.read).length;
  const totalUnreadCount = notifications.filter((n) => !n.read).length;

  // Filter based on selected tab category
  let currentList = category === "mine" ? myNotifs : category === "team" ? teamNotifs : notifications;

  // Filter by status (all vs unread)
  if (statusFilter === "unread") {
    currentList = currentList.filter((n) => !n.read);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900 flex items-center gap-2">
            Notifications
            {myUnreadCount > 0 && (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500 text-white">
                {myUnreadCount} for you
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {myUnreadCount > 0 ? (
              <span className="text-amber-700 font-medium font-heading">
                You have {myUnreadCount} unread personal {myUnreadCount === 1 ? "notification" : "notifications"}
              </span>
            ) : (
              <span className="text-emerald-600 font-medium">All personal notifications are caught up</span>
            )}
            {teamUnreadCount > 0 && ` • ${teamUnreadCount} team updates`}
          </p>
        </div>
        {totalUnreadCount > 0 && (
          <Button onClick={handleMarkAllRead} variant="outline" size="sm" className="flex items-center gap-1.5 self-start sm:self-auto">
            <CheckCheck className="w-4 h-4 text-emerald-600" />
            {category === "mine" ? "Mark For You Read" : "Mark All Read"}
          </Button>
        )}
      </div>

      {/* Primary Category Selector Tabs */}
      <div className="bg-slate-100 p-1 rounded-xl flex flex-wrap gap-1">
        <button
          onClick={() => setCategory("mine")}
          className={cn(
            "flex-1 min-w-[120px] py-2 px-3 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2",
            category === "mine"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          <User className={cn("w-4 h-4", category === "mine" ? "text-amber-600" : "text-slate-400")} />
          <span>For You</span>
          {myUnreadCount > 0 ? (
            <span className="text-[11px] px-1.5 py-0.2 rounded-full font-bold bg-amber-500 text-white">
              {myUnreadCount}
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 font-normal">({myNotifs.length})</span>
          )}
        </button>

        <button
          onClick={() => setCategory("team")}
          className={cn(
            "flex-1 min-w-[120px] py-2 px-3 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2",
            category === "team"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          <Users className={cn("w-4 h-4", category === "team" ? "text-blue-600" : "text-slate-400")} />
          <span>Team Activity</span>
          {teamUnreadCount > 0 ? (
            <span className="text-[11px] px-1.5 py-0.2 rounded-full font-bold bg-slate-300 text-slate-700">
              {teamUnreadCount}
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 font-normal">({teamNotifs.length})</span>
          )}
        </button>

        <button
          onClick={() => setCategory("all")}
          className={cn(
            "flex-1 min-w-[120px] py-2 px-3 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2",
            category === "all"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          <Bell className={cn("w-4 h-4", category === "all" ? "text-slate-700" : "text-slate-400")} />
          <span>All</span>
          <span className="text-[11px] text-slate-400 font-normal">({notifications.length})</span>
        </button>
      </div>

      {/* Sub-filters: Status (All vs Unread Only) */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setStatusFilter("all")}
          className={cn(
            "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
            statusFilter === "all" ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          )}
        >
          All Status
        </button>
        <button
          onClick={() => setStatusFilter("unread")}
          className={cn(
            "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
            statusFilter === "unread" ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          )}
        >
          Unread Only
        </button>
      </div>

      {/* Notifications List */}
      {currentList.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">
            {category === "mine"
              ? "No personal notifications"
              : category === "team"
                ? "No team activity notifications"
                : "No notifications found"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {statusFilter === "unread"
              ? "You have read all notifications in this section."
              : category === "mine"
                ? "You will see tasks assigned to you, meeting invites, and personal updates here."
                : "Team-wide notifications will appear here."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-sm">
          {currentList.map((notif) => {
            const isMine = isPersonalNotification(notif);
            return (
              <div
                key={notif.id}
                onClick={() => handleClickNotification(notif)}
                className={cn(
                  "flex items-start gap-3.5 p-4 transition-all group cursor-pointer",
                  isMine
                    ? "border-l-4 border-l-amber-500 bg-amber-50/15 hover:bg-amber-50/30"
                    : "border-l-4 border-l-slate-200 hover:bg-slate-50",
                  !notif.read && (isMine ? "bg-amber-50/35" : "bg-slate-50/80")
                )}
              >
                {/* Icon */}
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0",
                  isMine ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
                )}>
                  {TYPE_ICONS[notif.type] || "🔔"}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={cn("text-sm font-semibold truncate", !notif.read ? "text-slate-900 font-bold" : "text-slate-800")}>
                      {notif.title}
                    </p>

                    {/* Ownership badge */}
                    {isMine ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                        <User className="w-3 h-3 text-amber-600" /> For You
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                        <Users className="w-3 h-3 text-slate-400" /> Team Activity
                      </span>
                    )}

                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Unread" />
                    )}
                  </div>

                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">{notif.message}</p>

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-xs text-slate-400">{formatDateTime(notif.created_date)}</span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                      {TYPE_LABELS[notif.type] || notif.type}
                    </span>
                    {notif.link && (
                      <span className="text-xs text-amber-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                        Open <ExternalLink className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 ml-1">
                  {!notif.read && (
                    <button
                      onClick={(e) => handleMarkRead(e, notif)}
                      className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors"
                      title="Mark as read"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDelete(e, notif)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                    title="Delete notification"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}