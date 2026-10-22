import React, { useState, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import {
  CheckSquare, Clock, AlertTriangle, TrendingUp, CalendarDays,
  Megaphone, ArrowRight, Users, Building2, Award, Cake, User
} from "lucide-react";
import { Task, Employee, Department, Announcement } from "@/api/entities";
import StatCard from "@/components/StatCard";
import { StatusBadge } from "@/components/Badges";
import {
  isOverdue,
  calculatePerformance,
  formatDate,
  formatDateTime,
  daysUntil,
  getClassificationColor,
  getTaskScope,
} from "@/lib/performance";
import { checkDeadlineReminders } from "@/lib/deadlineReminders";
import { getUpcomingBirthdays } from "@/lib/birthdayReminders";
import { cn } from "@/lib/utils";

export default function Home() {
  const { user, employee, role, performer } = useOutletContext();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dashboardScope, setDashboardScope] = useState("mine");

  const isAdmin = ["Super Administrator", "Administrator", "Director of Operations"].includes(role);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const allTasks = ((await Task.list("-created_date", 300)) || []).filter((t) => !t.deleted);
        const allEmps = await Employee.list("-created_date", 200);
        const allDepts = await Department.list("-created_date", 100);
        const anns = await Announcement.list("-created_date", 5);

        if (!mounted) return;
        setTasks(allTasks || []);
        setEmployees(allEmps || []);
        setDepartments(allDepts || []);
        setAnnouncements(anns || []);
      } catch (e) {
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [employee]);

  const canRunReminders = ["Super Administrator", "Administrator", "Director of Operations", "Department Manager", "Secretary"].includes(role);
  useEffect(() => {
    if (!canRunReminders) return;
    checkDeadlineReminders().catch(() => { });
  }, [canRunReminders]);

  const upcomingBirthdays = getUpcomingBirthdays(employees, 30);

  // Group tasks by scope
  const myTasks = (tasks || []).filter((t) => getTaskScope(t, employee, user, employees) === "mine");
  const deptTasks = (tasks || []).filter((t) => getTaskScope(t, employee, user, employees) === "department");
  const otherTasks = (tasks || []).filter((t) => getTaskScope(t, employee, user, employees) === "other");
  const companyTasks = tasks || [];

  const scopedTasks =
    dashboardScope === "mine"
      ? myTasks
      : dashboardScope === "department"
      ? deptTasks
      : companyTasks;

  const perf = calculatePerformance(scopedTasks);
  const pending = scopedTasks.filter((t) => t.status === "Pending" || t.status === "In Progress");
  const overdue = scopedTasks.filter((t) => isOverdue(t));
  const completed = scopedTasks.filter((t) => t.status === "Completed");
  const upcoming = scopedTasks
    .filter((t) => !t.archived && t.status !== "Completed" && t.status !== "Archived" && t.deadline)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 5);

  const recentTasks = [...scopedTasks]
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .slice(0, 6);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const scopeLabel =
    dashboardScope === "mine"
      ? "My Tasks"
      : dashboardScope === "department"
      ? "Department Tasks"
      : "Company-Wide";

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 sm:p-6 lg:p-8 text-white relative overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl pointer-events-none" />
        <div className="relative">
          <p className="text-amber-400 text-xs sm:text-sm font-semibold uppercase tracking-wider">
            {role}
          </p>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mt-1 font-heading">
            Welcome back, {employee?.full_name || user?.full_name || "User"}
          </h1>
          <p className="text-slate-400 mt-1.5 sm:mt-2 text-xs sm:text-sm max-w-xl">
            Track your tasks, department activities, and overall company operations in real time.
          </p>
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 mt-4">
            <button
              onClick={() => navigate(`/tasks?scope=${dashboardScope === "company" ? "all" : dashboardScope}`)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-4 py-2 rounded-lg text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 shadow-xs"
            >
              <CheckSquare className="w-4 h-4" /> View Tasks
            </button>
            {isAdmin && (
              <button
                onClick={() => navigate("/performance")}
                className="bg-white/10 hover:bg-white/20 text-white font-medium px-4 py-2 rounded-lg text-xs sm:text-sm transition-colors flex items-center justify-center gap-2"
              >
                <TrendingUp className="w-4 h-4" /> Performance Reports
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scope Selector Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 shadow-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-hidden">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 hidden sm:inline">View:</span>
          <div className="bg-slate-100 p-1 rounded-lg flex items-center gap-1 overflow-x-auto no-scrollbar w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setDashboardScope("mine")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all shrink-0 whitespace-nowrap",
                dashboardScope === "mine"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
              )}
            >
              <User className="w-3.5 h-3.5" />
              <span>My Tasks ({myTasks.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setDashboardScope("department")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all shrink-0 whitespace-nowrap",
                dashboardScope === "department"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
              )}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Department ({deptTasks.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setDashboardScope("company")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all shrink-0 whitespace-nowrap",
                dashboardScope === "company"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
              )}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Company-Wide ({companyTasks.length})</span>
            </button>
          </div>
        </div>

        <button
          onClick={() => navigate(`/tasks?scope=${dashboardScope === "company" ? "all" : dashboardScope}`)}
          className="text-xs font-medium text-amber-700 hover:text-amber-800 flex items-center justify-center gap-1 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-200 transition-colors shrink-0 self-stretch sm:self-auto"
        >
          Manage {scopeLabel} <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={CheckSquare}
          label={
            dashboardScope === "mine"
              ? "My Assigned Tasks"
              : dashboardScope === "department"
              ? "Department Tasks"
              : "Company Tasks"
          }
          value={perf.assigned}
          accent="navy"
        />
        <StatCard icon={Clock} label="Pending / In Progress" value={perf.pending} accent="blue" />
        <StatCard icon={AlertTriangle} label="Overdue" value={perf.overdue} accent="red" />
        <StatCard icon={TrendingUp} label="Completed" value={perf.completed} accent="emerald" />
      </div>

      {/* Upcoming birthdays */}
      {upcomingBirthdays.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Cake className="w-4 h-4 text-amber-500" />
            <h2 className="font-heading font-bold text-lg text-slate-900">Upcoming Birthdays</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {upcomingBirthdays.map(({ employee: emp, daysUntil: d }) => (
              <div
                key={emp.id}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg border",
                  d === 0 ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-100"
                )}
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-xs font-bold text-slate-900 overflow-hidden shrink-0">
                  {emp.avatar_url ? (
                    <img src={emp.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (emp.full_name?.[0] || "?")}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{emp.full_name}</p>
                  <p className="text-[10px] text-slate-400">{d === 0 ? "🎂 Today!" : d === 1 ? "Tomorrow" : `In ${d} days`}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent tasks */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="font-heading font-bold text-lg text-slate-900">Recent Tasks</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{scopeLabel}</span>
            </div>
            <button
              onClick={() => navigate(`/tasks?scope=${dashboardScope === "company" ? "all" : dashboardScope}`)}
              className="text-xs font-medium text-amber-600 hover:text-amber-700 flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {recentTasks.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No tasks in this view</p>
          ) : (
            <div className="space-y-2">
              {recentTasks.map((task) => {
                const scope = getTaskScope(task, employee, user, employees);
                return (
                  <div
                    key={task.id}
                    onClick={() => navigate(`/tasks?task_id=${task.id}`)}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-800 truncate">{task.title}</p>
                        {scope === "mine" ? (
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            Mine
                          </span>
                        ) : scope === "department" ? (
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                            Dept
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            Other
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {task.assigned_to_names?.[0] || "Unassigned"}
                        {task.assigned_to_names?.length > 1 && ` +${task.assigned_to_names.length - 1}`}
                        {task.deadline && ` • Due ${formatDateTime(task.deadline)}`}
                      </p>
                    </div>
                    <StatusBadge status={isOverdue(task) ? "Overdue" : task.status} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming deadlines */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-amber-500" />
              <h2 className="font-heading font-bold text-lg text-slate-900">Upcoming Deadlines</h2>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{scopeLabel}</span>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No upcoming deadlines in this view</p>
          ) : (
            <div className="space-y-3">
              {upcoming.map((task) => {
                const days = daysUntil(task.deadline);
                return (
                  <div
                    key={task.id}
                    onClick={() => navigate(`/tasks?task_id=${task.id}`)}
                    className="flex items-start gap-3 p-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0 text-xs font-bold",
                      days < 0 ? "bg-red-50 text-red-600" : days <= 2 ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-600"
                    )}>
                      <span className="text-[9px] uppercase">{days < 0 ? "Over" : `${days}d`}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{task.title}</p>
                      <p className="text-xs text-slate-400">{formatDateTime(task.deadline)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance summary */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <h2 className="font-heading font-bold text-lg text-slate-900">Performance</h2>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{scopeLabel}</span>
          </div>
          <div className="text-center py-4">
            <div className="relative inline-flex items-center justify-center">
              <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor"
                  className={cn(
                    perf.score >= 80 ? "text-emerald-500" :
                      perf.score >= 70 ? "text-blue-500" :
                        perf.score >= 60 ? "text-amber-500" : "text-red-500"
                  )}
                  strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 52}`}
                  strokeDashoffset={`${2 * Math.PI * 52 * (1 - perf.score / 100)}`}
                />
              </svg>
              <div className="absolute text-center">
                <p className="text-3xl font-bold text-slate-900">{perf.score}</p>
                <p className="text-[10px] text-slate-400 uppercase">out of 100</p>
              </div>
            </div>
            <span className={cn("inline-block mt-3 px-3 py-1 rounded-full text-xs font-semibold border", getClassificationColor(perf.classification))}>
              {perf.classification}
            </span>
            <p className="text-xs text-slate-400 mt-2">Productivity: {perf.productivity}%</p>
          </div>
        </div>

        {/* Announcements */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Megaphone className="w-4 h-4 text-amber-500" />
            <h2 className="font-heading font-bold text-lg text-slate-900">Announcements</h2>
          </div>
          {announcements.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No announcements</p>
          ) : (
            <div className="space-y-3">
              {announcements.map((ann) => (
                <div key={ann.id} className={cn(
                  "p-4 rounded-lg border",
                  ann.pinned ? "border-amber-200 bg-amber-50/50" : "border-slate-100 bg-slate-50/50"
                )}>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-800">{ann.title}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-medium shrink-0">{ann.category}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{ann.content}</p>
                  <p className="text-[10px] text-slate-400 mt-2">{ann.created_by_name} • {formatDate(ann.created_date)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Admin overview */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-amber-500" />
              <h2 className="font-heading font-bold text-lg text-slate-900">Departments Overview</h2>
            </div>
            {departments.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">No departments yet</p>
            ) : (
              <div className="space-y-2">
                {departments.slice(0, 5).map((dept) => {
                  const count = employees.filter((e) =>
                    (e.department_id === dept.id ||
                     (Array.isArray(e.department_ids) && e.department_ids.includes(dept.id)) ||
                     (dept.manager_id && dept.manager_id === e.id)
                    ) && e.status === "active"
                  ).length;
                  return (
                    <div key={dept.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: dept.color || "#1e3a5f" }}>
                        {dept.name?.[0] || "D"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{dept.name}</p>
                        <p className="text-xs text-slate-400">{dept.manager_name || "No manager"}</p>
                      </div>
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{count} staff</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-amber-500" />
              <h2 className="font-heading font-bold text-lg text-slate-900">Staff Summary</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-slate-50">
                <p className="text-2xl font-bold text-slate-900">{employees.filter((e) => e.status === "active").length}</p>
                <p className="text-xs text-slate-400">Active Staff</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50">
                <p className="text-2xl font-bold text-slate-900">{departments.length}</p>
                <p className="text-xs text-slate-400">Departments</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50">
                <p className="text-2xl font-bold text-emerald-600">{perf.completed}</p>
                <p className="text-xs text-slate-400">Tasks Completed</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50">
                <p className="text-2xl font-bold text-red-500">{perf.overdue}</p>
                <p className="text-xs text-slate-400">Overdue Tasks</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}