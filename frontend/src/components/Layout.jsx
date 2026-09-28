import React, { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, CheckSquare, CalendarDays,
  Megaphone, TrendingUp, BarChart3, Bell, FileText, Settings as SettingsIcon,
  LogOut, Menu, X, Shield, ClipboardList, ListTodo, Landmark
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Notification as NotificationEntity,
  Task,
  Announcement,
  Report,
  Meeting,
  MeetingMinutes as MeetingMinutesEntity
} from "@/api/entities";
import { listPendingUsers } from "@/api/pendingUsers";
import { useAuth } from "@/lib/AuthContext";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Image } from "@/components/ui/image";
import { isExecutiveSuperAdminOrCEO } from "@/lib/performance";

const UNREAD_POLL_INTERVAL_MS = 20000;

// Mirrors the role groupings used elsewhere (Tasks.jsx, pending_users.py) -
// who can approve pending accounts vs. who can approve submitted tasks.
const CAN_APPROVE_ACCOUNTS_ROLES = ["Super Administrator", "Administrator", "Director of Operations", "Chief Executive Officer"];
const CAN_APPROVE_TASKS_ROLES = ["Super Administrator", "Administrator", "Director of Operations", "Department Manager", "Chief Executive Officer"];

const LOGO_URL = "https://media.base44.com/images/public/6a5df9c009518866564e2bed/28390cb4e_image.png";

const ALL_ROLES = [
  "Super Administrator", "Chief Executive Officer", "Administrator", "Secretary", "Department Manager",
  "Supervisor", "Staff Member", "Director of Operations"
];

// Settings is visible to anyone who can reach at least one tab inside it
// (Departments/Staff for Directors and Department Managers too, Branding and
// Audit Log admin-only) - Settings.jsx itself filters which tabs each role
// actually sees.
const SETTINGS_ROLES = ["Super Administrator", "Chief Executive Officer", "Administrator", "Director of Operations", "Department Manager"];

const NAV_ITEMS = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard, roles: ALL_ROLES },
  { label: "Tasks", path: "/tasks", icon: CheckSquare, roles: ALL_ROLES },
  { label: "To-Do List", path: "/todos", icon: ListTodo, roles: ALL_ROLES },
  { label: "Meetings", path: "/meetings", icon: CalendarDays, roles: ALL_ROLES },
  { label: "Meeting Minutes", path: "/minutes", icon: ClipboardList, roles: ALL_ROLES },
  { label: "Announcements", path: "/announcements", icon: Megaphone, roles: ALL_ROLES },
  { label: "Performance", path: "/performance", icon: TrendingUp, roles: ALL_ROLES },
  { label: "Reports", path: "/reports", icon: FileText, roles: ALL_ROLES },
  { label: "Director Dashboard", path: "/director", icon: BarChart3, roles: ["Director of Operations", "Super Administrator", "Administrator", "Department Manager", "Chief Executive Officer"] },
  { label: "Executive Dept Tracker", path: "/departmental-performance", icon: Landmark, roles: ["Super Administrator", "Chief Executive Officer"] },
  { label: "Notifications", path: "/notifications", icon: Bell, roles: ALL_ROLES },
  { label: "Settings", path: "/settings", icon: SettingsIcon, roles: SETTINGS_ROLES },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-1 min-w-0">
      <div className="w-10 h-10 rounded-full overflow-hidden bg-white shrink-0 ring-2 ring-amber-400/50 shadow">
        <Image src={LOGO_URL} alt="EPIC TASK PERFORMANCE TRACKING SYSTEM" fittingType="fit" className="w-full h-full" />
      </div>
      <div className="leading-tight min-w-0">
        <p className="font-heading font-bold text-white text-xs tracking-wider uppercase">EPIC</p>
        <p className="text-[9.5px] text-amber-400 font-semibold tracking-tight uppercase leading-tight mt-0.5">
          TASK PERFORMANCE TRACKING SYSTEM
        </p>
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, employee, role, loading, performer } = useCurrentUser();
  const { logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [tasksAttentionCount, setTasksAttentionCount] = useState(0);
  const [reportsAttentionCount, setReportsAttentionCount] = useState(0);
  const [announcementsAttentionCount, setAnnouncementsAttentionCount] = useState(0);
  const [meetingsAttentionCount, setMeetingsAttentionCount] = useState(0);
  const [minutesAttentionCount, setMinutesAttentionCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  const canApproveAccounts = CAN_APPROVE_ACCOUNTS_ROLES.includes(role);
  const canApproveTasks = CAN_APPROVE_TASKS_ROLES.includes(role);

  useEffect(() => {
    setSidebarOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  // Reset or clear badge when viewing that section
  useEffect(() => {
    if (!user) return;
    const path = location.pathname;
    const nowStr = new Date().toISOString();
    if (path === "/announcements") {
      try { localStorage.setItem(`last_seen_announcements_${user.id}`, nowStr); } catch (e) { }
      setAnnouncementsAttentionCount(0);
    } else if (path === "/reports") {
      try { localStorage.setItem(`last_seen_reports_${user.id}`, nowStr); } catch (e) { }
      setReportsAttentionCount(0);
    } else if (path === "/meetings") {
      try { localStorage.setItem(`last_seen_meetings_${user.id}`, nowStr); } catch (e) { }
      setMeetingsAttentionCount(0);
    } else if (path === "/minutes") {
      try { localStorage.setItem(`last_seen_minutes_${user.id}`, nowStr); } catch (e) { }
      setMinutesAttentionCount(0);
    }
  }, [location.pathname, user]);

  useEffect(() => {
    if (!user) return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => { });
    }
    let mounted = true;
    let previousCount = null;

    const refreshAllCounts = async () => {
      if (!user || !mounted) return;

      // 1. Fetch unread notifications for current user
      let notifs = [];
      try {
        notifs = await NotificationEntity.filter({ user_id: user.id, read: false }) || [];
        if (!mounted) return;
        const count = notifs.length;
        if (previousCount !== null && count > previousCount && "Notification" in window && Notification.permission === "granted") {
          const latest = notifs[0] || {};
          try {
            const dn = new Notification(latest.title || "New notification", { body: latest.message || "" });
            if (latest.link) dn.onclick = () => { window.focus(); dn.close(); };
          } catch (e) { }
        }
        previousCount = count;
        setUnreadCount(count);
      } catch (e) { }

      // 2. Pending account approvals (admins only)
      if (canApproveAccounts) {
        try {
          const pending = await listPendingUsers();
          if (mounted) setPendingApprovalsCount(pending?.length || 0);
        } catch (e) { }
      }

      // 3. Tasks attention count
      let taskAttention = 0;
      try {
        const tasks = await Task.list("-created_date", 300);
        if (mounted) {
          if (canApproveTasks) {
            taskAttention = (tasks || []).filter((t) => !t.archived && !t.deleted && t.status === "Submitted").length;
          } else if (employee) {
            taskAttention = (tasks || []).filter(
              (t) => !t.archived && !t.deleted && (t.assigned_to_ids || []).includes(employee.id) && !(t.seen_by_ids || []).includes(employee.id)
            ).length;
          }
          const unreadTaskNotifs = notifs.filter(n =>
            (n.type && n.type.startsWith("task_")) ||
            n.type === "deadline_approaching" ||
            n.link?.startsWith("/tasks")
          ).length;
          setTasksAttentionCount(Math.max(taskAttention, unreadTaskNotifs));
        }
      } catch (e) { }

      // 4. Announcements attention count
      try {
        const unreadAnnNotifs = notifs.filter(n => n.type === "announcement" || n.link?.startsWith("/announcements")).length;
        let unseenAnns = 0;
        const lastSeenAnnStr = localStorage.getItem(`last_seen_announcements_${user.id}`);
        if (lastSeenAnnStr) {
          const lastSeenAnn = new Date(lastSeenAnnStr).getTime();
          const anns = await Announcement.list("-created_date", 25) || [];
          unseenAnns = anns.filter(a => {
            if (a.active === false) return false;
            if (a.created_by_id === user.id || a.created_by_id === employee?.id) return false;
            return new Date(a.created_date).getTime() > lastSeenAnn;
          }).length;
        }
        if (mounted) {
          setAnnouncementsAttentionCount(Math.max(unreadAnnNotifs, unseenAnns));
        }
      } catch (e) { }

      // 5. Reports attention count
      try {
        const unreadRepNotifs = notifs.filter(n =>
          ["report_received", "report_updated", "report_feedback"].includes(n.type) ||
          n.link?.startsWith("/reports")
        ).length;
        let unseenReps = 0;
        const lastSeenRepStr = localStorage.getItem(`last_seen_reports_${user.id}`);
        if (lastSeenRepStr) {
          const lastSeenRep = new Date(lastSeenRepStr).getTime();
          const reps = await Report.list("-submitted_date", 30) || [];
          const myId = employee?.id || user.id;
          const isLeadership = ["Super Administrator", "Administrator", "Director of Operations", "Chief Executive Officer"].includes(role) ||
            (employee?.position || "").toLowerCase().includes("chief executive officer") ||
            (user.email || "").toLowerCase() === "cmutovhe@epicnetworkgroup.com";

          unseenReps = reps.filter(r => {
            if (r.submitted_by_id === myId || r.created_by_id === user.id) return false;
            const rTime = new Date(r.submitted_date || r.created_date).getTime();
            if (rTime <= lastSeenRep) return false;
            const toIds = r.submitted_to_ids || [];
            if (toIds.includes(myId)) return true;
            if (!r.is_confidential && (isLeadership || (r.department_id && r.department_id === employee?.department_id))) return true;
            return false;
          }).length;
        }
        if (mounted) {
          setReportsAttentionCount(Math.max(unreadRepNotifs, unseenReps));
        }
      } catch (e) { }

      // 6. Meetings attention count
      try {
        const unreadMeetNotifs = notifs.filter(n =>
          ["meeting_scheduled", "action_item"].includes(n.type) ||
          n.link?.startsWith("/meetings")
        ).length;
        let unseenMeets = 0;
        const lastSeenMeetStr = localStorage.getItem(`last_seen_meetings_${user.id}`);
        if (lastSeenMeetStr) {
          const lastSeenMeet = new Date(lastSeenMeetStr).getTime();
          const meets = await Meeting.list("-created_date", 25) || [];
          const myId = employee?.id || user.id;
          unseenMeets = meets.filter(m => {
            if (m.created_by_id === user.id || m.created_by_id === myId) return false;
            if (new Date(m.created_date).getTime() <= lastSeenMeet) return false;
            const attIds = m.attendee_ids || [];
            return attIds.length === 0 || attIds.includes(myId);
          }).length;
        }
        if (mounted) {
          setMeetingsAttentionCount(Math.max(unreadMeetNotifs, unseenMeets));
        }
      } catch (e) { }

      // 7. Minutes attention count
      try {
        const unreadMinNotifs = notifs.filter(n =>
          n.type === "minutes_uploaded" ||
          n.link?.startsWith("/minutes")
        ).length;
        let unseenMins = 0;
        const lastSeenMinStr = localStorage.getItem(`last_seen_minutes_${user.id}`);
        if (lastSeenMinStr) {
          const lastSeenMin = new Date(lastSeenMinStr).getTime();
          const mins = await MeetingMinutesEntity.list("-uploaded_date", 20) || [];
          const myId = employee?.id || user.id;
          unseenMins = mins.filter(m => {
            if (m.uploaded_by_id === myId || m.created_by_id === user.id) return false;
            return new Date(m.uploaded_date || m.created_date).getTime() > lastSeenMin;
          }).length;
        }
        if (mounted) {
          setMinutesAttentionCount(Math.max(unreadMinNotifs, unseenMins));
        }
      } catch (e) { }
    };

    refreshAllCounts();
    const intervalId = setInterval(refreshAllCounts, UNREAD_POLL_INTERVAL_MS);

    // Listen for custom notification update events and window focus
    window.addEventListener("notifications-updated", refreshAllCounts);
    window.addEventListener("focus", refreshAllCounts);

    return () => {
      mounted = false;
      clearInterval(intervalId);
      window.removeEventListener("notifications-updated", refreshAllCounts);
      window.removeEventListener("focus", refreshAllCounts);
    };
  }, [user, employee, canApproveAccounts, canApproveTasks, role]);

  const isExecutive = isExecutiveSuperAdminOrCEO(user, employee, role);
  const visibleNav = NAV_ITEMS.filter((item) => {
    if (item.path === "/departmental-performance") {
      return isExecutive;
    }
    return item.roles.includes(role);
  });
  const NAV_BADGE_COUNTS = {
    "/notifications": location.pathname === "/notifications" ? 0 : unreadCount,
    "/settings": pendingApprovalsCount,
    "/tasks": tasksAttentionCount,
    "/reports": location.pathname === "/reports" ? 0 : reportsAttentionCount,
    "/announcements": location.pathname === "/announcements" ? 0 : announcementsAttentionCount,
    "/meetings": location.pathname === "/meetings" ? 0 : meetingsAttentionCount,
    "/minutes": location.pathname === "/minutes" ? 0 : minutesAttentionCount,
  };

  const handleLogout = () => {
    logout();
  };

  const initials = (employee?.full_name || user?.full_name || "U")
    .split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-[hsl(var(--sidebar-background))] flex flex-col shrink-0 transition-transform duration-300",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="h-16 flex items-center justify-between border-b border-[hsl(var(--sidebar-border))] px-4">
          <Logo />
          <button className="lg:hidden text-slate-400" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-thin py-4 px-3 space-y-0.5">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const badgeCount = NAV_BADGE_COUNTS[item.path] || 0;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive
                    ? "bg-[hsl(var(--sidebar-accent))] text-white shadow-sm"
                    : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]/50 hover:text-white"
                )}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                <span className="flex-1">{item.label}</span>
                {badgeCount > 0 && (
                  <span className="bg-amber-500 text-slate-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] inline-flex items-center justify-center leading-none shadow-xs">
                    {badgeCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-[hsl(var(--sidebar-border))] p-3">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
            <button
              onClick={() => navigate("/profile")}
              className="flex items-center gap-3 flex-1 min-w-0 rounded-lg hover:bg-white/10 -mx-1 px-1 py-0.5 transition-colors text-left"
              title="View profile"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-sm font-bold text-slate-900 shrink-0 overflow-hidden">
                {employee?.avatar_url ? (
                  <img src={employee.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{employee?.full_name || user?.full_name || "User"}</p>
                <p className="text-[10px] text-slate-400 truncate">{role}</p>
              </div>
            </button>
            <button onClick={handleLogout} className="text-slate-400 hover:text-white p-1.5 rounded hover:bg-white/10 shrink-0" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-20 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-slate-600" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
              <Shield className="w-3.5 h-3.5 text-amber-500" />
              <span className="font-semibold text-slate-800 tracking-wide uppercase text-[11px]">EPIC TASK PERFORMANCE TRACKING SYSTEM</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-400">Authorized Personnel Only</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/notifications")}
              className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-600"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{unreadCount}</span>
              )}
            </button>
            <div className="w-px h-6 bg-slate-200 mx-1" />
            <button
              onClick={() => navigate("/profile")}
              className="flex items-center gap-2 rounded-lg hover:bg-slate-100 px-1.5 py-1 -mx-1.5 transition-colors"
              title="View profile"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-xs font-bold text-white overflow-hidden shrink-0">
                {employee?.avatar_url ? (
                  <img src={employee.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : initials}
              </div>
              <div className="hidden sm:block leading-tight text-left">
                <p className="text-sm font-semibold text-slate-800">{employee?.full_name || user?.full_name || "User"}</p>
                <p className="text-[10px] text-slate-400">{role}</p>
              </div>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto">
          <Outlet context={{ user, employee, role, performer }} />
        </main>
      </div>
    </div>
  );
}