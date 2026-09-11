import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { TrendingUp, Award, Users, Building2, Download, FileText, BarChart3 } from "lucide-react";
import { Task, Employee, Department, PerformanceReport, Notification } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatCard from "@/components/StatCard";
import { RoleBadge } from "@/components/Badges";
import { calculatePerformance, getClassificationColor, formatDate } from "@/lib/performance";
import { exportPerformancePDF, exportCSV } from "@/lib/exportReport";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export default function Performance() {
  const { employee, role, performer } = useOutletContext();
  const { toast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [period, setPeriod] = useState("Monthly");

  const isAdmin = ["Super Administrator", "Administrator", "Director of Operations", "Department Manager"].includes(role);
  const scopedEmployees = (role === "Department Manager" && employee)
    ? employees.filter((e) => e.department_id === employee.department_id)
    : employees;

  const loadData = async () => {
    try {
      const [allTasks, emps, depts, reps] = await Promise.all([
        Task.list("-created_date", 500),
        Employee.list("-created_date", 300),
        Department.list("-created_date", 100),
        PerformanceReport.list("-generated_date", 200),
      ]);
      setTasks((allTasks || []).filter((t) => !t.deleted));
      setEmployees(emps || []);
      setDepartments(depts || []);
      setReports(reps || []);
      if (employee && !isAdmin) setSelectedEmployee(employee);
      else if (emps?.length > 0) setSelectedEmployee(emps[0]);
    } catch (e) {
      toast({ title: "Error", description: "Failed to load performance data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [employee]);

  const empTasks = selectedEmployee
    ? tasks.filter((t) => (t.assigned_to_ids || []).includes(selectedEmployee.id))
    : [];
  const perf = calculatePerformance(empTasks);

  const allPerfs = scopedEmployees.map((emp) => {
    const empTasks = tasks.filter((t) => (t.assigned_to_ids || []).includes(emp.id));
    return { employee: emp, perf: calculatePerformance(empTasks) };
  });

  const topPerformers = [...allPerfs].sort((a, b) => b.perf.score - a.perf.score).slice(0, 5);
  const needsAttention = [...allPerfs].filter((p) => p.perf.score < 60 && p.perf.assigned > 0).sort((a, b) => a.perf.score - b.perf.score);

  const companyPerf = calculatePerformance(tasks);

  const deptPerfs = departments.map((dept) => {
    const deptEmps = employees.filter((e) => e.department_id === dept.id);
    const deptTasks = tasks.filter((t) => deptEmps.some((e) => (t.assigned_to_ids || []).includes(e.id)));
    return { dept, perf: calculatePerformance(deptTasks), empCount: deptEmps.length };
  }).sort((a, b) => b.perf.score - a.perf.score);

  const generateReport = async () => {
    if (!selectedEmployee) return;
    const now = new Date();
    const label = `${period} - ${now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
    try {
      const data = {
        employee_id: selectedEmployee.id,
        employee_name: selectedEmployee.full_name,
        department_name: selectedEmployee.department_name || "",
        period_type: period,
        period_label: label,
        tasks_assigned: perf.assigned,
        tasks_completed: perf.completed,
        tasks_on_time: perf.onTime,
        tasks_late: perf.late,
        pending_tasks: perf.pending,
        overdue_tasks: perf.overdue,
        productivity_pct: perf.productivity,
        avg_completion_days: 0,
        score: perf.score,
        classification: perf.classification,
        trend: "Stable",
        generated_date: now.toISOString(),
      };
      const created = await PerformanceReport.create(data);
      // Notify employee
      if (selectedEmployee.user_id) {
        await Notification.create({
          user_id: selectedEmployee.user_id,
          employee_id: selectedEmployee.id,
          title: "Performance Report Available",
          message: `Your ${period} performance report is now available. Score: ${perf.score}/100 — ${perf.classification}`,
          type: "performance_report",
          read: false,
          related_id: created.id,
          link: "/performance",
        });
      }
      toast({ title: "Generated", description: `${period} report generated for ${selectedEmployee.full_name}` });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to generate report", variant: "destructive" });
    }
  };

  const handleExportPDF = () => {
    if (!selectedEmployee) return;
    const label = `${period} - ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
    exportPerformancePDF({ employee: selectedEmployee, perf, period, label });
  };

  const handleExportReportCSV = () => {
    if (!selectedEmployee) return;
    exportCSV(`Performance_${selectedEmployee.full_name.replace(/\s+/g, "_")}.csv`, [{
      name: selectedEmployee.full_name,
      department: selectedEmployee.department_name || "",
      period,
      score: perf.score,
      classification: perf.classification,
      productivity: `${perf.productivity}%`,
      on_time_rate: `${perf.onTimeRate}%`,
      assigned: perf.assigned,
      completed: perf.completed,
      on_time: perf.onTime,
      late: perf.late,
      pending: perf.pending,
      overdue: perf.overdue,
    }], [
      { label: "Employee", key: "name" }, { label: "Department", key: "department" },
      { label: "Period", key: "period" }, { label: "Score", key: "score" },
      { label: "Classification", key: "classification" }, { label: "Productivity", key: "productivity" },
      { label: "On-Time Rate", key: "on_time_rate" }, { label: "Assigned", key: "assigned" },
      { label: "Completed", key: "completed" }, { label: "On Time", key: "on_time" },
      { label: "Late", key: "late" }, { label: "Pending", key: "pending" },
      { label: "Overdue", key: "overdue" },
    ]);
  };

  const handleExportAllReportsCSV = () => {
    exportCSV("PerformanceReports.csv", reports.map((r) => ({
      name: r.employee_name,
      department: r.department_name || "",
      period: r.period_type,
      label: r.period_label || "",
      score: r.score,
      classification: r.classification,
      productivity: `${r.productivity_pct}%`,
      completed: r.tasks_completed,
      on_time: r.tasks_on_time,
      generated: r.generated_date ? new Date(r.generated_date).toLocaleDateString() : "",
    })), [
      { label: "Employee", key: "name" }, { label: "Department", key: "department" },
      { label: "Period Type", key: "period" }, { label: "Period Label", key: "label" },
      { label: "Score", key: "score" }, { label: "Classification", key: "classification" },
      { label: "Productivity", key: "productivity" }, { label: "Completed", key: "completed" },
      { label: "On Time", key: "on_time" }, { label: "Generated", key: "generated" },
    ]);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900">Performance Management</h1>
          <p className="text-sm text-slate-500 mt-1">Automatic performance evaluation and reporting</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Monthly">Monthly</SelectItem>
                <SelectItem value="Quarterly">Quarterly</SelectItem>
                <SelectItem value="Annual">Annual</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={generateReport} className="bg-slate-800 hover:bg-slate-900">
              <FileText className="w-4 h-4 mr-1" /> Generate Report
            </Button>
            <Button onClick={handleExportPDF} variant="outline" size="sm" disabled={!selectedEmployee}>
              <Download className="w-4 h-4 mr-1" /> PDF
            </Button>
            <Button onClick={handleExportReportCSV} variant="outline" size="sm" disabled={!selectedEmployee}>
              <Download className="w-4 h-4 mr-1" /> Excel
            </Button>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total Staff" value={employees.filter((e) => e.status === "active").length} accent="navy" />
          <StatCard icon={Building2} label="Departments" value={departments.length} accent="blue" />
          <StatCard icon={TrendingUp} label="Company Productivity" value={`${companyPerf.productivity}%`} accent="emerald" />
          <StatCard icon={Award} label="Avg Score" value={allPerfs.length > 0 ? Math.round(allPerfs.reduce((s, p) => s + p.perf.score, 0) / allPerfs.length) : 0} accent="gold" />
        </div>
      )}

      {/* Employee selector (admin) */}
      {isAdmin && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block">Select Employee</label>
          <Select value={selectedEmployee?.id || ""} onValueChange={(v) => setSelectedEmployee(employees.find((e) => e.id === v))}>
            <SelectTrigger className="w-full max-w-md"><SelectValue placeholder="Choose employee..." /></SelectTrigger>
            <SelectContent>
              {scopedEmployees.filter((e) => e.status === "active").map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>{emp.full_name} — {emp.department_name || emp.role}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Individual performance dashboard */}
      {selectedEmployee && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-lg font-bold text-white">
              {selectedEmployee.full_name?.split(" ").map((w) => w[0]).slice(0, 2).join("")}
            </div>
            <div className="flex-1">
              <h2 className="font-heading font-bold text-xl text-slate-900">{selectedEmployee.full_name}</h2>
              <p className="text-sm text-slate-500">{selectedEmployee.position || selectedEmployee.role} {selectedEmployee.department_name && `• ${selectedEmployee.department_name}`}</p>
            </div>
            <RoleBadge role={selectedEmployee.role} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Score gauge */}
            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl">
              <div className="relative inline-flex items-center justify-center">
                <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="#e2e8f0" strokeWidth="10" />
                  <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor"
                    className={cn(perf.score >= 80 ? "text-emerald-500" : perf.score >= 70 ? "text-blue-500" : perf.score >= 60 ? "text-amber-500" : "text-red-500")}
                    strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 52}`}
                    strokeDashoffset={`${2 * Math.PI * 52 * (1 - perf.score / 100)}`}
                  />
                </svg>
                <div className="absolute text-center">
                  <p className="text-4xl font-bold text-slate-900">{perf.score}</p>
                  <p className="text-xs text-slate-400 uppercase">/ 100</p>
                </div>
              </div>
              <span className={cn("mt-3 px-3 py-1 rounded-full text-sm font-semibold border", getClassificationColor(perf.classification))}>
                {perf.classification}
              </span>
            </div>

            {/* Metrics grid */}
            <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Tasks Assigned", value: perf.assigned, color: "text-slate-900" },
                { label: "Workload Weight", value: `${perf.assignedWeight || 0} pts`, color: "text-slate-700" },
                { label: "Completed", value: `${perf.completed} (${perf.completedWeight || 0} pts)`, color: "text-emerald-600" },
                { label: "On Time", value: perf.onTime, color: "text-blue-600" },
                { label: "Completed Late", value: perf.late, color: "text-orange-600" },
                { label: "Pending", value: perf.pending, color: "text-slate-600" },
                { label: "Overdue", value: perf.overdue, color: "text-red-500" },
                { label: "Productivity", value: `${perf.productivity}%`, color: "text-amber-600" },
                { label: "On-Time Rate", value: `${perf.onTimeRate}%`, color: "text-emerald-600" },
              ].map((m) => (
                <div key={m.label} className="p-3 rounded-lg bg-slate-50">
                  <p className={cn("text-2xl font-bold", m.color)}>{m.value}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Weighted Formula Breakdown */}
          <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Weighted Performance Formula Breakdown</h3>
                <p className="text-xs text-slate-500">
                  Tasks contribute to performance based on complexity weight: Low (1 pt), Medium (2 pts), High (3 pts), Urgent (5 pts).
                </p>
              </div>
              <div className="text-xs text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
                Total Workload: <strong className="text-slate-900">{perf.assignedWeight || 0} pts</strong> ({perf.completedWeight || 0} pts completed)
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700">1. Weighted Completion (50%)</span>
                  <span className="font-bold text-emerald-600">{perf.completionScore || 0} / 50 pts</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, ((perf.completionScore || 0) / 50) * 100)}%` }} />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Ratio of completed task weights vs total assigned weights.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700">2. Weighted Timeliness (30%)</span>
                  <span className="font-bold text-blue-600">{perf.onTimeScore || 0} / 30 pts</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, ((perf.onTimeScore || 0) / 30) * 100)}%` }} />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  On-time completion rate across high and standard impact tasks.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700">3. Productivity & Quality (20%)</span>
                  <span className="font-bold text-amber-600">{perf.productivityScore || 0} / 20 pts</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, ((perf.productivityScore || 0) / 20) * 100)}%` }} />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Overall output efficiency and quality execution rate.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Department rankings — visible to all staff */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-heading font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-amber-500" /> Department Rankings
        </h2>
        {deptPerfs.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No department data</p>
        ) : (
          <div className="space-y-2">
            {deptPerfs.map((dp, i) => (
              <div key={dp.dept.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
                <span className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0",
                  i === 0 ? "bg-amber-500" : i === 1 ? "bg-slate-400" : i === 2 ? "bg-amber-700" : "bg-slate-300")}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{dp.dept.name}</p>
                  <p className="text-xs text-slate-400">{dp.empCount} staff • {dp.perf.completed}/{dp.perf.assigned} tasks completed</p>
                </div>
                <div className="w-32 hidden sm:block">
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", dp.perf.score >= 80 ? "bg-emerald-500" : dp.perf.score >= 70 ? "bg-blue-500" : dp.perf.score >= 60 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${dp.perf.score}%` }} />
                  </div>
                </div>
                <span className={cn("text-sm font-bold", dp.perf.score >= 80 ? "text-emerald-600" : dp.perf.score >= 70 ? "text-blue-600" : dp.perf.score >= 60 ? "text-amber-600" : "text-red-500")}>{dp.perf.score}</span>
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium border", getClassificationColor(dp.perf.classification))}>{dp.perf.classification}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin-only analytics */}
      {isAdmin && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top performers */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="font-heading font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" /> Top Performers
              </h2>
              <div className="space-y-2">
                {topPerformers.map((p, i) => (
                  <div key={p.employee.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                    <span className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white", i === 0 ? "bg-amber-500" : i === 1 ? "bg-slate-400" : i === 2 ? "bg-amber-700" : "bg-slate-300")}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{p.employee.full_name}</p>
                      <p className="text-xs text-slate-400">{p.employee.department_name || p.employee.role}</p>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{p.perf.score}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium border", getClassificationColor(p.perf.classification))}>{p.perf.classification}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Needs attention */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="font-heading font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-red-500" /> Needs Improvement
              </h2>
              {needsAttention.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">All staff performing well</p>
              ) : (
                <div className="space-y-2">
                  {needsAttention.slice(0, 5).map((p) => (
                    <div key={p.employee.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{p.employee.full_name}</p>
                        <p className="text-xs text-slate-400">{p.perf.overdue} overdue • {p.perf.completed}/{p.perf.assigned} completed</p>
                      </div>
                      <span className="text-sm font-bold text-red-500">{p.perf.score}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium border bg-red-50 text-red-600 border-red-200">{p.perf.classification}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent reports */}
          {reports.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading font-bold text-lg text-slate-900">Generated Reports</h2>
                <Button onClick={handleExportAllReportsCSV} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-1" /> Export CSV
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase px-3 py-2">Employee</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase px-3 py-2">Period</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase px-3 py-2">Score</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase px-3 py-2">Classification</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase px-3 py-2 hidden sm:table-cell">Generated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reports.slice(0, 10).map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-sm text-slate-800">{r.employee_name}</td>
                        <td className="px-3 py-2 text-sm text-slate-500">{r.period_type}</td>
                        <td className="px-3 py-2 text-sm font-bold text-slate-900">{r.score}</td>
                        <td className="px-3 py-2"><span className={cn("text-xs px-2 py-0.5 rounded-full font-medium border", getClassificationColor(r.classification))}>{r.classification}</span></td>
                        <td className="px-3 py-2 text-xs text-slate-400 hidden sm:table-cell">{formatDate(r.generated_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}