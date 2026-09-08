import React, { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, CheckSquare, CalendarDays,
  Megaphone, TrendingUp, BarChart3, Bell, FileText, Settings as SettingsIcon,
  LogOut, Menu, X, Shield, ClipboardList
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Notification as NotificationEntity, Task } from "@/api/entities";
import { listPendingUsers } from "@/api/pendingUsers";
import { useAuth } from "@/lib/AuthContext";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Image } from "@/components/ui/image";

const UNREAD_POLL_INTERVAL_MS = 20000;

// Mirrors the role groupings used elsewhere (Tasks.jsx, pending_users.py) -
// who can approve pending accounts vs. who can approve submitted tasks.
const CAN_APPROVE_ACCOUNTS_ROLES = ["Super Administrator", "Administrator", "Director of Operations"];
const CAN_APPROVE_TASKS_ROLES = ["Super Administrator", "Administrator", "Director of Operations", "Department Manager"];

const LOGO_URL = "https://media.base44.com/images/public/6a5df9c009518866564e2bed/28390cb4e_image.png";

const ALL_ROLES = [
  "Super Administrator", "Administrator", "Secretary", "Department Manager",
  "Supervisor", "Staff Member", "Director of Operations"
];

// Settings is visible to anyone who can reach at least one tab inside it
// (Departments/Staff for Directors and Department Managers too, Branding and
// Audit Log admin-only) - Settings.jsx itself filters which tabs each role
// actually sees.
const SETTINGS_ROLES = ["Super Administrator", "Administrator", "Director of Operations", "Department Manager"];

const NAV_ITEMS = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard, roles: ALL_ROLES },
  { label: "Tasks", path: "/tasks", icon: CheckSquare, roles: ALL_ROLES },
  { label: "Meetings", path: "/meetings", icon: CalendarDays, roles: ALL_ROLES },
  { label: "Meeting Minutes", path: "/minutes", icon: ClipboardList, roles: ALL_ROLES },
  { label: "Announcements", path: "/announcements", icon: Megaphone, roles: ALL_ROLES },
  { label: "Performance", path: "/performance", icon: TrendingUp, roles: ALL_ROLES },
  { label: "Reports", path: "/reports", icon: FileText, roles: ALL_ROLES },
  { label: "Director Dashboard", path: "/director", icon: BarChart3, roles: ["Director of Operations", "Super Administrator", "Administrator", "Department Manager"] },
  { label: "Notifications", path: "/notifications", icon: Bell, roles: ALL_ROLES },
  { label: "Settings", path: "/settings", icon: SettingsIcon, roles: SETTINGS_ROLES },
];

function Logo() {
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="w-11 h-11 rounded-full overflow-hidden bg-white shrink-0 ring-2 ring-amber-400/50 shadow">
        <Image src={LOGO_URL} alt="EPIC International Consultants Group" fittingType="fit" className="w-full h-full" />
      </div>
      <div className="leading-tight">
        <p className="font-heading font-bold text-white text-sm tracking-wide">EPIC</p>
        <p className="text-[10px] text-slate-400 tracking-wider uppercase">Intl. Consultants Group</p>
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
  const location = useLocation();
  const navigate = useNavigate();

  const canApproveAccounts = CAN_APPROVE_ACCOUNTS_ROLES.includes(role);
  const canApproveTasks = CAN_APPROVE_TASKS_ROLES.includes(role);

  useEffect(() => {
    setSidebarOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => { });
    }
    let mounted = true;
    let previousCount = null;
    const refreshUnread = async () => {
      try {
        const notifs = await NotificationEntity.filter({ user_id: user.id, read: false });
        if (!mounted) return;
        const count = notifs?.length || 0;
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
    };
    refreshUnread();
    const intervalId = setInterval(refreshUnread, UNREAD_POLL_INTERVAL_MS);
    return () => { mounted = false; clearInterval(intervalId); };
  }, [user]);

  // Section-specific "needs attention" badges, same polling pattern as
  // notifications - pending account approvals (admins only) and tasks
  // either awaiting the viewer's approval or not yet seen by them.
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    const refreshAttentionCounts = async () => {
      if (canApproveAccounts) {
        try {
          const pending = await listPendingUsers();
          if (mounted) setPendingApprovalsCount(pending?.length || 0);
        } catch (e) { }
      }
      try {
        const tasks = await Task.list("-created_date", 300);
        if (!mounted) return;
        if (canApproveTasks) {
          setTasksAttentionCount((tasks || []).filter((t) => !t.archived && !t.deleted && t.status === "Submitted").length);
        } else if (employee) {
          setTasksAttentionCount(
            (tasks || []).filter(
              (t) => !t.archived && !t.deleted && (t.assigned_to_ids || []).includes(employee.id) && !(t.seen_by_ids || []).includes(employee.id)
            ).length
          );
        }
      } catch (e) { }
    };
    refreshAttentionCounts();
    const intervalId = setInterval(refreshAttentionCounts, UNREAD_POLL_INTERVAL_MS);
    return () => { mounted = false; clearInterval(intervalId); };
  }, [user, employee, canApproveAccounts, canApproveTasks]);

  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(role));
  const NAV_BADGE_COUNTS = {
    "/notifications": unreadCount,
    "/settings": pendingApprovalsCount,
    "/tasks": tasksAttentionCount,
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
                  <span className="bg-amber-500 text-slate-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badgeCount}</span>
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
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
              <Shield className="w-3.5 h-3.5 text-amber-500" />
              <span className="font-medium">Internal System</span>
              <span className="text-slate-300">•</span>
              <span>Authorized Personnel Only</span>
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