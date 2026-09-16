import React, { useState, useEffect, useMemo } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  User,
  Radio,
  ExternalLink,
  Inbox
} from "lucide-react";
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
  task_feedback: "💬",
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
  task_feedback: "Task Feedback",
};

export default function Notifications() {
  const { user, employee } = useOutletContext();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Simple filter for the main section: "all" or "unread"
  const [filterMode, setFilterMode] = useState("all");

  const loadNotifications = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const data = await Notification.list("-created_date", 200);
      setNotifications(data || []);
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to load notifications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [user, employee]);

  // Determine if a notification strictly belongs to this user/account
  const isMyNotification = (n) => {
    if (!user && !employee) return false;
    if (user && n.user_id === user.id) return true;
    if (employee && (n.employee_id === employee.id || n.user_id === employee.id)) return true;
    if (user && n.employee_id === user.id) return true;
    return false;
  };

  // Separate into My Notifications and Other Notifications
  const { myNotifications, otherNotifications } = useMemo(() => {
    const mine = [];
    const others = [];

    (notifications || []).forEach((n) => {
      if (isMyNotification(n)) {
        mine.push(n);
      } else {
        others.push(n);
      }
    });

    return { myNotifications: mine, otherNotifications: others };
  }, [notifications, user, employee]);

  // Main list filtered by status if selected
  const displayedMyNotifications = useMemo(() => {
    if (filterMode === "unread") {
      return myNotifications.filter((n) => !n.read);
    }
    return myNotifications;
  }, [myNotifications, filterMode]);

  const myUnreadCount = myNotifications.filter((n) => !n.read).length;
  const otherUnreadCount = otherNotifications.filter((n) => !n.read).length;

  const handleMarkRead = async (e, notif) => {
    e.stopPropagation();
    try {
      await Notification.update(notif.id, { read: true });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      );
    } catch (e) {
      toast({ title: "Error", description: "Could not mark as read", variant: "destructive" });
    }
  };

  const handleMarkAllMineRead = async () => {
    const unread = myNotifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    const unreadIds = new Set(unread.map((n) => n.id));
    setNotifications((prev) =>
      prev.map((n) => (unreadIds.has(n.id) ? { ...n, read: true } : n))
    );

    for (const n of unread) {
      try {
        await Notification.update(n.id, { read: true });
      } catch (e) { }
    }
    toast({ title: "Done", description: "All your notifications marked as read" });
  };

  const handleMarkAllOthersRead = async () => {
    const unread = otherNotifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    const unreadIds = new Set(unread.map((n) => n.id));
    setNotifications((prev) =>
      prev.map((n) => (unreadIds.has(n.id) ? { ...n, read: true } : n))
    );

    for (const n of unread) {
      try {
        await Notification.update(n.id, { read: true });
      } catch (e) { }
    }
    toast({ title: "Done", description: "Other notifications marked as read" });
  };

  const handleDelete = async (e, notif) => {
    e.stopPropagation();
    try {
      await Notification.delete(notif.id);
      setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
      toast({ title: "Deleted", description: "Notification removed" });
    } catch (e) {
      toast({ title: "Error", description: "Could not delete notification", variant: "destructive" });
    }
  };

  const handleClick = async (notif) => {
    if (!notif.read) {
      try {
        await Notification.update(notif.id, { read: true });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
        );
      } catch (e) { }
    }
    if (notif.link) {
      navigate(notif.link);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Loading notifications...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Top Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Notifications</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Your notifications appear as the main list. General system activity is listed on the side.
          </p>
        </div>

        {myUnreadCount > 0 && (
          <Button
            onClick={handleMarkAllMineRead}
            variant="outline"
            size="sm"
            className="text-amber-800 border-amber-200 hover:bg-amber-50"
          >
            <CheckCheck className="w-4 h-4 mr-1.5 text-amber-600" />
            Mark my notifications as read ({myUnreadCount})
          </Button>
        )}
      </div>

      {/* Main Content: Two sections (Main Notifications on Left, Other Notifications on the Side) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================================= */}
        {/* MAIN SECTION: MY NOTIFICATIONS (Directed to user account) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-4 bg-amber-50/50 border-b border-amber-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs">
                <User className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">My Notifications</h2>
                  {myUnreadCount > 0 ? (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">
                      {myUnreadCount} new
                    </span>
                  ) : (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {myNotifications.length}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">Directed specifically to your account</p>
              </div>
            </div>

            {/* Quick Filter: All vs Unread */}
            <div className="flex items-center bg-white/80 p-0.5 rounded-lg border border-amber-200/80 text-xs">
              <button
                onClick={() => setFilterMode("all")}
                className={cn(
                  "px-3 py-1 rounded-md font-medium transition-all",
                  filterMode === "all"
                    ? "bg-amber-500 text-white font-semibold shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                All ({myNotifications.length})
              </button>
              <button
                onClick={() => setFilterMode("unread")}
                className={cn(
                  "px-3 py-1 rounded-md font-medium transition-all",
                  filterMode === "unread"
                    ? "bg-amber-500 text-white font-semibold shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Unread ({myUnreadCount})
              </button>
            </div>
          </div>

          {/* List of My Notifications */}
          <div className="divide-y divide-slate-100">
            {displayedMyNotifications.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mb-3">
                  <Inbox className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  {filterMode === "unread" ? "No unread notifications" : "You have no notifications"}
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  {filterMode === "unread"
                    ? "You are completely caught up on all tasks and assignments directed to you."
                    : "When tasks are assigned to you or require your attention, they will appear here."}
                </p>
              </div>
            ) : (
              displayedMyNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  className={cn(
                    "p-4 transition-all group cursor-pointer flex items-start gap-3.5 border-l-4",
                    !notif.read
                      ? "border-l-amber-500 bg-amber-50/25 hover:bg-amber-50/40"
                      : "border-l-transparent hover:bg-slate-50/80"
                  )}
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-100/70 text-amber-900 flex items-center justify-center text-lg shrink-0">
                    {TYPE_ICONS[notif.type] || "🔔"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          "text-sm truncate",
                          !notif.read ? "font-bold text-slate-900" : "font-semibold text-slate-800"
                        )}
                      >
                        {notif.title}
                      </p>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Unread" />
                      )}
                    </div>

                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notif.message}</p>

                    <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-slate-400">
                      <span>{formatDateTime(notif.created_date)}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                        {TYPE_LABELS[notif.type] || notif.type}
                      </span>
                      {notif.link && (
                        <span className="text-amber-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                          View details <ExternalLink className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
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
              ))
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SIDE SECTION: OTHER NOTIFICATIONS (On the side, not main) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-4 bg-slate-50/70 rounded-xl border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="p-3.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-slate-500" />
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Other Notifications
                </h3>
                <p className="text-[11px] text-slate-500">General activity from other users</p>
              </div>
            </div>

            {otherUnreadCount > 0 && (
              <button
                onClick={handleMarkAllOthersRead}
                className="text-[11px] text-slate-600 hover:text-slate-900 font-medium px-2 py-1 rounded hover:bg-slate-200 transition-colors"
              >
                Mark read ({otherUnreadCount})
              </button>
            )}
          </div>

          {/* Side List */}
          <div className="divide-y divide-slate-200/60 max-h-[620px] overflow-y-auto">
            {otherNotifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No other notifications.
              </div>
            ) : (
              otherNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  className={cn(
                    "p-3 transition-colors cursor-pointer group flex items-start gap-2.5",
                    !notif.read ? "bg-white/80 hover:bg-white" : "hover:bg-slate-100/60"
                  )}
                >
                  <span className="text-sm shrink-0 mt-0.5">
                    {TYPE_ICONS[notif.type] || "•"}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-xs truncate",
                        !notif.read ? "font-bold text-slate-900" : "font-medium text-slate-700"
                      )}
                    >
                      {notif.title}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-snug">
                      {notif.message}
                    </p>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {formatDateTime(notif.created_date)}
                    </span>
                  </div>

                  <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!notif.read && (
                      <button
                        onClick={(e) => handleMarkRead(e, notif)}
                        className="p-1 text-slate-400 hover:text-emerald-600"
                        title="Mark as read"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDelete(e, notif)}
                      className="p-1 text-slate-400 hover:text-red-500"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}