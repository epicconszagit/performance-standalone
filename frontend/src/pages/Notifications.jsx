import React, { useState, useEffect, useMemo } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  User,
  Users,
  Building2,
  ExternalLink,
  Sparkles,
  ShieldAlert,
  Globe,
  Inbox
} from "lucide-react";
import { Notification, Task, Employee, Department } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { formatDateTime, isAdministratorRole } from "@/lib/performance";
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
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Per-column status filters: "all" | "unread"
  const [myFilter, setMyFilter] = useState("all");
  const [otherFilter, setOtherFilter] = useState("all");

  // Right column scope: "outside" (not in user/dept) | "all" (full company feed)
  const [rightScope, setRightScope] = useState("outside");

  const loadData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const [notifsData, tasksData, empsData, deptsData] = await Promise.all([
        Notification.list("-created_date", 250),
        Task.list().catch(() => []),
        Employee.list().catch(() => []),
        Department.list().catch(() => []),
      ]);
      setNotifications(notifsData || []);
      setTasks(tasksData || []);
      setEmployees(empsData || []);
      setDepartments(deptsData || []);
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
    loadData();
  }, [user, employee]);

  // Build department and employee lookups
  const {
    myUserIds,
    myDeptIds,
    myDeptName,
    deptEmployeeIds,
    deptEmployeeNames,
    taskMap,
    isAdminUser,
  } = useMemo(() => {
    const ids = new Set([user?.id, employee?.id, employee?.user_id].filter(Boolean));
    const deptIds = new Set();
    if (employee?.department_id) deptIds.add(employee.department_id);
    if (Array.isArray(employee?.department_ids)) {
      employee.department_ids.forEach((d) => d && deptIds.add(d));
    }

    const deptMap = {};
    (departments || []).forEach((d) => {
      deptMap[d.id] = d.name;
    });

    const primaryDeptName = employee?.department_id
      ? deptMap[employee.department_id] || "Your Department"
      : "Your Department";

    const empDeptIds = new Set();
    const empDeptNames = new Set();

    (employees || []).forEach((e) => {
      const belongs =
        (e.department_id && deptIds.has(e.department_id)) ||
        (Array.isArray(e.department_ids) && e.department_ids.some((d) => deptIds.has(d)));
      if (belongs) {
        empDeptIds.add(e.id);
        if (e.full_name) empDeptNames.add(e.full_name.trim().toLowerCase());
      }
    });

    // Also add user's own full name
    if (user?.full_name) empDeptNames.add(user.full_name.trim().toLowerCase());
    if (employee?.full_name) empDeptNames.add(employee.full_name.trim().toLowerCase());

    const tMap = {};
    (tasks || []).forEach((t) => {
      tMap[t.id] = t;
    });

    const admin = isAdministratorRole(employee?.role || role || user?.role);

    return {
      myUserIds: ids,
      myDeptIds: deptIds,
      myDeptName: primaryDeptName,
      deptEmployeeIds: empDeptIds,
      deptEmployeeNames: empDeptNames,
      taskMap: tMap,
      isAdminUser: admin,
    };
  }, [user, employee, role, departments, employees, tasks]);

  // Determine if a notification strictly belongs to user or their department
  const classifyNotification = (notif) => {
    if (!user && !employee) return { belongsToUserOrDept: false, isDirectPersonal: false };

    // 1. Direct personal match by user_id or employee_id
    if (
      (notif.user_id && myUserIds.has(notif.user_id)) ||
      (notif.employee_id && myUserIds.has(notif.employee_id))
    ) {
      return { belongsToUserOrDept: true, isDirectPersonal: true };
    }

    // 2. Direct personal wording match
    const msg = (notif.message || "").toLowerCase();
    const title = (notif.title || "").toLowerCase();
    const myName = (employee?.full_name || user?.full_name || "").toLowerCase();

    if (
      msg.includes("you have been assigned") ||
      msg.includes("for your approval") ||
      (myName && (msg.includes(myName) || title.includes(myName)))
    ) {
      return { belongsToUserOrDept: true, isDirectPersonal: true };
    }

    // If user is a super admin / executive overseer with no specific department assigned,
    // their "For You" column is their direct personal assignments, and the right is the organization.
    if (isAdminUser && myDeptIds.size === 0) {
      return { belongsToUserOrDept: false, isDirectPersonal: false };
    }

    // 3. Department match via related task
    if (notif.related_id && taskMap[notif.related_id]) {
      const task = taskMap[notif.related_id];
      // Task belongs to user's department
      if (task.department_id && myDeptIds.has(task.department_id)) {
        return { belongsToUserOrDept: true, isDirectPersonal: false };
      }
      // Task assignees include user or someone from user's department
      const assignees = Array.isArray(task.assigned_to_ids) ? task.assigned_to_ids : [];
      if (assignees.some((aid) => myUserIds.has(aid) || deptEmployeeIds.has(aid))) {
        return { belongsToUserOrDept: true, isDirectPersonal: false };
      }
      // Task creator or assigner in user's department
      if (
        myUserIds.has(task.assigned_by_id) ||
        myUserIds.has(task.created_by_id) ||
        deptEmployeeIds.has(task.assigned_by_id)
      ) {
        return { belongsToUserOrDept: true, isDirectPersonal: false };
      }
    }

    // 4. Target employee belongs to user's department
    if (notif.employee_id && deptEmployeeIds.has(notif.employee_id)) {
      return { belongsToUserOrDept: true, isDirectPersonal: false };
    }

    // 5. Notification text mentions a department member's name
    // e.g. "Denzel Moyo started working on BUDGET STATEMENTS"
    if (deptEmployeeNames.size > 0) {
      for (const name of deptEmployeeNames) {
        if (name && (msg.includes(name) || title.includes(name))) {
          return { belongsToUserOrDept: true, isDirectPersonal: false };
        }
      }
    }

    // 6. Notification text mentions the department's name
    if (myDeptName && myDeptName !== "Your Department") {
      const deptNameLower = myDeptName.toLowerCase();
      if (msg.includes(deptNameLower) || title.includes(deptNameLower)) {
        return { belongsToUserOrDept: true, isDirectPersonal: false };
      }
    }

    return { belongsToUserOrDept: false, isDirectPersonal: false };
  };

  // Partition notifications
  const { forYouList, outsideList } = useMemo(() => {
    const mine = [];
    const outside = [];

    notifications.forEach((n) => {
      const { belongsToUserOrDept, isDirectPersonal } = classifyNotification(n);
      const enriched = { ...n, _isDirectPersonal: isDirectPersonal };
      if (belongsToUserOrDept) {
        mine.push(enriched);
      } else {
        outside.push(enriched);
      }
    });

    return { forYouList: mine, outsideList: outside };
  }, [notifications, myUserIds, myDeptIds, deptEmployeeIds, deptEmployeeNames, taskMap, isAdminUser]);

  // Filtered views for each column
  const filteredForYou = useMemo(() => {
    if (myFilter === "unread") return forYouList.filter((n) => !n.read);
    return forYouList;
  }, [forYouList, myFilter]);

  const filteredRight = useMemo(() => {
    const baseList = rightScope === "all" ? notifications : outsideList;
    if (otherFilter === "unread") return baseList.filter((n) => !n.read);
    return baseList;
  }, [notifications, outsideList, rightScope, otherFilter]);

  const forYouUnreadCount = forYouList.filter((n) => !n.read).length;
  const outsideUnreadCount = outsideList.filter((n) => !n.read).length;
  const totalUnreadCount = notifications.filter((n) => !n.read).length;

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

  const handleMarkColumnRead = async (columnType) => {
    const targets =
      columnType === "forYou"
        ? forYouList.filter((n) => !n.read)
        : columnType === "all"
          ? notifications.filter((n) => !n.read)
          : outsideList.filter((n) => !n.read);

    if (targets.length === 0) return;

    // Optimistic update
    const targetIds = new Set(targets.map((t) => t.id));
    setNotifications((prev) =>
      prev.map((n) => (targetIds.has(n.id) ? { ...n, read: true } : n))
    );

    for (const t of targets) {
      try {
        await Notification.update(t.id, { read: true });
      } catch (e) { }
    }

    toast({
      title: "Updated",
      description:
        columnType === "forYou"
          ? "All notifications for you & your department marked as read"
          : columnType === "all"
            ? "All system notifications marked as read"
            : "Other system notifications marked as read",
    });
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

  const handleClickNotification = async (notif) => {
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
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Top Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Notifications</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Separated side-by-side so you can easily spot your department notifications versus general company activity.
              </p>
            </div>
          </div>
        </div>

        {/* Global Summary & Global Mark Read */}
        <div className="flex flex-wrap items-center gap-2">
          {totalUnreadCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleMarkColumnRead("all")}
              className="text-slate-700 hover:text-slate-900 border-slate-300"
            >
              <CheckCheck className="w-4 h-4 mr-1.5 text-slate-500" />
              Mark Everything Read ({totalUnreadCount})
            </Button>
          ) : (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              All caught up
            </span>
          )}
        </div>
      </div>

      {/* Two Parts Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ========================================================================= */}
        {/* PART 1: FOR YOU & YOUR DEPARTMENT */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-xl border border-amber-200/80 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
          {/* Column Header */}
          <div className="p-4 bg-gradient-to-r from-amber-50/70 to-orange-50/40 border-b border-amber-200/70">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      {isAdminUser && myDeptIds.size === 0
                        ? "For You (Personal)"
                        : `For You & ${myDeptName}`}
                    </h2>
                    {forYouUnreadCount > 0 ? (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-xs">
                        {forYouUnreadCount} unread
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-600">
                        {forYouList.length} total
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-amber-900/80 mt-0.5">
                    Strictly related to you and {myDeptName}
                  </p>
                </div>
              </div>

              {/* Mark Dept Read */}
              {forYouUnreadCount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleMarkColumnRead("forYou")}
                  className="text-xs h-8 px-2.5 bg-white text-amber-900 border-amber-300 hover:bg-amber-100"
                >
                  <Check className="w-3.5 h-3.5 mr-1 text-amber-700" />
                  Mark Read
                </Button>
              )}
            </div>

            {/* Sub-filter tabs */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-amber-200/50">
              <button
                onClick={() => setMyFilter("all")}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-all",
                  myFilter === "all"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-white/80 text-slate-700 hover:bg-white"
                )}
              >
                All ({forYouList.length})
              </button>
              <button
                onClick={() => setMyFilter("unread")}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-all",
                  myFilter === "unread"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-white/80 text-slate-700 hover:bg-white"
                )}
              >
                Unread ({forYouUnreadCount})
              </button>
            </div>
          </div>

          {/* List Content */}
          <div className="p-3 divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[700px]">
            {filteredForYou.length === 0 ? (
              <div className="p-10 text-center flex flex-col items-center justify-center h-full">
                <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mb-3">
                  <Inbox className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  {myFilter === "unread"
                    ? "No unread notifications"
                    : "No personal or department notifications"}
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  {myFilter === "unread"
                    ? "You are all caught up with your personal tasks and department activity."
                    : "New tasks, updates, and notices strictly for you or your department will show here."}
                </p>
              </div>
            ) : (
              filteredForYou.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleClickNotification(notif)}
                  className={cn(
                    "flex items-start gap-3 p-3.5 rounded-lg transition-all group cursor-pointer border-l-4 my-1.5",
                    notif._isDirectPersonal
                      ? "border-l-amber-500 bg-amber-50/20 hover:bg-amber-50/40"
                      : "border-l-blue-500 bg-blue-50/15 hover:bg-blue-50/35",
                    !notif.read && (notif._isDirectPersonal ? "bg-amber-50/40" : "bg-blue-50/30")
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0",
                      notif._isDirectPersonal
                        ? "bg-amber-100 text-amber-800"
                        : "bg-blue-100 text-blue-800"
                    )}
                  >
                    {TYPE_ICONS[notif.type] || "🔔"}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p
                        className={cn(
                          "text-sm font-semibold truncate",
                          !notif.read ? "text-slate-900 font-bold" : "text-slate-800"
                        )}
                      >
                        {notif.title}
                      </p>

                      {/* Tag distinction */}
                      {notif._isDirectPersonal ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                          <User className="w-2.5 h-2.5 text-amber-600" /> For You
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 shrink-0">
                          <Building2 className="w-2.5 h-2.5 text-blue-600" /> {myDeptName}
                        </span>
                      )}

                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Unread" />
                      )}
                    </div>

                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notif.message}</p>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="text-[11px] text-slate-400">
                        {formatDateTime(notif.created_date)}
                      </span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                        {TYPE_LABELS[notif.type] || notif.type}
                      </span>
                      {notif.link && (
                        <span className="text-[11px] text-amber-700 font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
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
                        className="p-1.5 rounded-md hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors"
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDelete(e, notif)}
                      className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
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
        {/* PART 2: ALL OTHER / GENERAL SYSTEM NOTIFICATIONS */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
          {/* Column Header */}
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-700 text-white flex items-center justify-center shadow-xs">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      {rightScope === "outside"
                        ? "General & Other Activity"
                        : "All System Notifications"}
                    </h2>
                    {outsideUnreadCount > 0 ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800">
                        {outsideUnreadCount} unread
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        {outsideList.length} total
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {rightScope === "outside"
                      ? "Activity outside your department and system broadcasts"
                      : "Complete unfiltered feed across the entire organization"}
                  </p>
                </div>
              </div>

              {/* Mark General Read */}
              {outsideUnreadCount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleMarkColumnRead("outside")}
                  className="text-xs h-8 px-2.5 bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                >
                  <Check className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  Mark Read
                </Button>
              )}
            </div>

            {/* Sub-filter tabs and scope selector */}
            <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-200">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setOtherFilter("all")}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-medium transition-all",
                    otherFilter === "all"
                      ? "bg-slate-800 text-white shadow-xs"
                      : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                  )}
                >
                  All ({rightScope === "all" ? notifications.length : outsideList.length})
                </button>
                <button
                  onClick={() => setOtherFilter("unread")}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-medium transition-all",
                    otherFilter === "unread"
                      ? "bg-slate-800 text-white shadow-xs"
                      : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                  )}
                >
                  Unread ({rightScope === "all" ? totalUnreadCount : outsideUnreadCount})
                </button>
              </div>

              {/* Scope Switcher: Outside Dept vs All Feed */}
              <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-[11px]">
                <button
                  onClick={() => setRightScope("outside")}
                  className={cn(
                    "px-2 py-0.5 rounded-md font-medium transition-all",
                    rightScope === "outside"
                      ? "bg-white text-slate-900 shadow-xs font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Other Departments
                </button>
                <button
                  onClick={() => setRightScope("all")}
                  className={cn(
                    "px-2 py-0.5 rounded-md font-medium transition-all",
                    rightScope === "all"
                      ? "bg-white text-slate-900 shadow-xs font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  All System Feed
                </button>
              </div>
            </div>
          </div>

          {/* List Content */}
          <div className="p-3 divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[700px]">
            {filteredRight.length === 0 ? (
              <div className="p-10 text-center flex flex-col items-center justify-center h-full">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                  <Inbox className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  {otherFilter === "unread"
                    ? "No unread system notifications"
                    : "No notifications in this feed"}
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Activities happening in other departments and system-wide announcements will appear here.
                </p>
              </div>
            ) : (
              filteredRight.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleClickNotification(notif)}
                  className={cn(
                    "flex items-start gap-3 p-3.5 rounded-lg transition-all group cursor-pointer border-l-4 my-1.5",
                    "border-l-slate-300 hover:bg-slate-50",
                    !notif.read ? "bg-slate-50/80" : "bg-white"
                  )}
                >
                  {/* Icon */}
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0 bg-slate-100 text-slate-600">
                    {TYPE_ICONS[notif.type] || "🔔"}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p
                        className={cn(
                          "text-sm font-medium truncate",
                          !notif.read ? "text-slate-900 font-semibold" : "text-slate-700"
                        )}
                      >
                        {notif.title}
                      </p>

                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                        <Users className="w-2.5 h-2.5 text-slate-400" /> System Activity
                      </span>

                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" title="Unread" />
                      )}
                    </div>

                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notif.message}</p>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="text-[11px] text-slate-400">
                        {formatDateTime(notif.created_date)}
                      </span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                        {TYPE_LABELS[notif.type] || notif.type}
                      </span>
                      {notif.link && (
                        <span className="text-[11px] text-slate-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
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
                        className="p-1.5 rounded-md hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors"
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDelete(e, notif)}
                      className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
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
      </div>
    </div>
  );
}