import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { BarChart3, TrendingUp, TrendingDown, Minus, Award, AlertTriangle, Building2, Users, CheckCircle2, Clock, FileText } from "lucide-react";
import { Task, Employee, Department } from "@/api/entities";
import StatCard from "@/components/StatCard";
import { calculatePerformance, getClassificationColor } from "@/lib/performance";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export default function DirectorDashboard() {
  const { performer } = useOutletContext();
  const { toast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [allTasks, emps, depts] = await Promise.all([
          Task.list("-created_date", 500),
          Employee.list("-created_date", 300),
          Department.list("-created_date", 100),
        ]);
        if (!mounted) return;
        setTasks((allTasks || []).filter((t) => !t.deleted));
        setEmployees(emps || []);
        setDepartments(depts || []);
      } catch (e) {
        toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const companyPerf = calculatePerformance(tasks);
  const activeEmployees = employees.filter((e) => e.status === "active");

  const allPerfs = activeEmployees.map((emp) => {
    const empTasks = tasks.filter((t) => (t.assigned_to_ids || []).includes(emp.id));
    return { employee: emp, perf: calculatePerformance(empTasks) };
  });

  const avgScore = allPerfs.length > 0 ? Math.round(allPerfs.reduce((s, p) => s + p.perf.score, 0) / allPerfs.length) : 0;
  const topPerformers = [...allPerfs].sort((a, b) => b.perf.score - a.perf.score).slice(0, 5);
  const needsAttention = [...allPerfs].filter((p) => p.perf.score < 60 && p.perf.assigned > 0).sort((a, b) => a.perf.score - b.perf.score);

  const deptPerfs = departments.map((dept) => {
    const deptEmps = activeEmployees.filter((e) => e.department_id === dept.id);
    const deptTasks = tasks.filter((t) => deptEmps.some((e) => (t.assigned_to_ids || []).includes(e.id)));
    return { dept, perf: calculatePerformance(deptTasks), empCount: deptEmps.length };
  }).sort((a, b) => b.perf.score - a.perf.score);

  const trend = avgScore >= 70 ? "Improving" : avgScore >= 50 ? "Stable" : "Declining";
  const TrendIcon = trend === "Improving" ? TrendingUp : trend === "Declining" ? TrendingDown : Minus;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 lg:p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-amber-500/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-amber-400 text-sm font-medium uppercase tracking-wider">
            <BarChart3 className="w-4 h-4" /> Director of Operations
          </div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold mt-2">Strategic Operations Dashboard</h1>
          <p className="text-slate-400 mt-2 text-sm max-w-2xl">Company-wide operational performance, department rankings, and strategic insights.</p>
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                <span className="text-2xl font-bold text-amber-400">{companyPerf.score}</span>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">Company Score</p>
                <p className="text-sm font-semibold">{companyPerf.classification}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                <span className="text-2xl font-bold text-emerald-400">{companyPerf.productivity}%</span>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">Productivity</p>
                <p className="text-sm font-semibold flex items-center gap-1">
                  <TrendIcon className="w-3.5 h-3.5" /> {trend}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={CheckCircle2} label="Total Tasks Assigned" value={companyPerf.assigned} accent="navy" />
        <StatCard icon={CheckCircle2} label="Tasks Completed" value={companyPerf.completed} accent="emerald" />
        <StatCard icon={Clock} label="Pending Tasks" value={companyPerf.pending} accent="blue" />
        <StatCard icon={AlertTriangle} label="Overdue Tasks" value={companyPerf.overdue} accent="red" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Active Staff" value={activeEmployees.length} accent="navy" />
        <StatCard icon={Building2} label="Departments" value={departments.length} accent="blue" />
        <StatCard icon={Award} label="Avg Employee Score" value={avgScore} accent="gold" />
        <StatCard icon={TrendingUp} label="On-Time Rate" value={`${companyPerf.onTimeRate}%`} accent="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department rankings */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-heading font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-500" /> Department Performance Rankings
          </h2>
          {deptPerfs.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No department data available</p>
          ) : (
            <div className="space-y-3">
              {deptPerfs.map((dp, i) => (
                <div key={dp.dept.id} className="flex items-center gap-3">
                  <span className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0",
                    i === 0 ? "bg-amber-500" : i === 1 ? "bg-slate-400" : i === 2 ? "bg-amber-700" : "bg-slate-300")}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-slate-800 truncate">{dp.dept.name}</p>
                      <span className="text-sm font-bold text-slate-900">{dp.perf.score}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full", dp.perf.score >= 80 ? "bg-emerald-500" : dp.perf.score >= 70 ? "bg-blue-500" : dp.perf.score >= 60 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${dp.perf.score}%` }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{dp.empCount} staff • {dp.perf.completed}/{dp.perf.assigned} tasks • {dp.perf.productivity}% productivity</p>
                  </div>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium border shrink-0", getClassificationColor(dp.perf.classification))}>{dp.perf.classification}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top performers */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-heading font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" /> Top Performing Employees
          </h2>
          {topPerformers.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No performance data</p>
          ) : (
            <div className="space-y-2">
              {topPerformers.map((p, i) => (
                <div key={p.employee.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50">
                  <span className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white", i === 0 ? "bg-amber-500" : i === 1 ? "bg-slate-400" : i === 2 ? "bg-amber-700" : "bg-slate-300")}>{i + 1}</span>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-xs font-bold text-white">
                    {p.employee.full_name?.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{p.employee.full_name}</p>
                    <p className="text-xs text-slate-400">{p.employee.department_name || p.employee.role}</p>
                  </div>
                  <span className="text-lg font-bold text-slate-900">{p.perf.score}</span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium border", getClassificationColor(p.perf.classification))}>{p.perf.classification}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Departments needing attention */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-heading font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" /> Departments Requiring Attention
        </h2>
        {needsAttention.length === 0 && deptPerfs.every((d) => d.perf.score >= 60) ? (
          <p className="text-sm text-emerald-600 py-4 text-center flex items-center justify-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> All departments are performing adequately
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {deptPerfs.filter((d) => d.perf.score < 60 && d.perf.assigned > 0).map((dp) => (
              <div key={dp.dept.id} className="p-4 rounded-lg border border-red-100 bg-red-50/30">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">{dp.dept.name}</p>
                  <span className="text-lg font-bold text-red-500">{dp.perf.score}</span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  <span>{dp.perf.overdue} overdue</span>
                  <span>•</span>
                  <span>{dp.perf.productivity}% productivity</span>
                </div>
              </div>
            ))}
            {needsAttention.slice(0, 3).map((p) => (
              <div key={p.employee.id} className="p-4 rounded-lg border border-amber-100 bg-amber-50/30">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">{p.employee.full_name}</p>
                  <span className="text-lg font-bold text-amber-600">{p.perf.score}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{p.employee.department_name || p.employee.role}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  <span>{p.perf.overdue} overdue</span>
                  <span>•</span>
                  <span>{p.perf.completed}/{p.perf.assigned} done</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Company performance summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-heading font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-500" /> Company Performance Summary
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Tasks Assigned", value: companyPerf.assigned },
            { label: "Tasks Completed", value: companyPerf.completed },
            { label: "On Time", value: companyPerf.onTime },
            { label: "Completed Late", value: companyPerf.late },
            { label: "Pending", value: companyPerf.pending },
            { label: "Overdue", value: companyPerf.overdue },
          ].map((m) => (
            <div key={m.label} className="p-3 rounded-lg bg-slate-50 text-center">
              <p className="text-2xl font-bold text-slate-900">{m.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}