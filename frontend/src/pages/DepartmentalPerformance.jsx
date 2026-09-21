import React, { useState, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import {
  Landmark, DollarSign, TrendingUp, TrendingDown, Target, Shield,
  Award, CheckCircle2, AlertTriangle, AlertCircle, Clock, Users,
  BarChart3, FileText, Download, SlidersHorizontal, Search, RefreshCw,
  Coins, Briefcase, ChevronRight, X, ExternalLink, ArrowUpDown, Filter, Sparkles
} from "lucide-react";
import { ExecutivePerformance, Task, Department } from "@/api/entities";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isExecutiveSuperAdminOrCEO } from "@/lib/performance";
import { exportCSV } from "@/lib/exportReport";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export default function DepartmentalPerformance() {
  const { user, employee, role, performer } = useOutletContext();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isAuthorized = isExecutiveSuperAdminOrCEO(user, employee, role);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({ summary: null, departments: [] });
  const [searchQuery, setSearchQuery] = useState("");
  const [archetypeFilter, setArchetypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("dpci_desc");

  // Drilldown Modal
  const [selectedDept, setSelectedDept] = useState(null);

  // Edit Budget Modal
  const [editingDept, setEditingDept] = useState(null);
  const [editForm, setEditForm] = useState({
    allocated_budget: "",
    actual_spend: "",
    budget_currency: "USD",
    fiscal_year: "2026",
    contribution_type: "Operational Support",
    revenue_generated: "",
    strategic_weight: 3,
    target_contribution_score: 85,
  });
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async (showToast = false) => {
    try {
      const res = await ExecutivePerformance.getOverview();
      setData(res || { summary: null, departments: [] });
      if (showToast) {
        toast({ title: "Refreshed", description: "Executive departmental performance updated." });
      }
    } catch (err) {
      toast({
        title: "Access Restricted or Error",
        description: err?.message || "Failed to load executive departmental metrics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isAuthorized && !loading) {
      toast({
        title: "Unauthorized Access",
        description: "This executive section is strictly restricted to Super Administrator and Chief Executive Officer.",
        variant: "destructive",
      });
      navigate("/");
      return;
    }
    loadData();
  }, [isAuthorized]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const openEditModal = (deptMetric) => {
    setEditingDept(deptMetric);
    setEditForm({
      allocated_budget: deptMetric.allocated_budget ?? 0,
      actual_spend: deptMetric.actual_spend ?? 0,
      budget_currency: deptMetric.budget_currency || "USD",
      fiscal_year: deptMetric.fiscal_year || "2026",
      contribution_type: deptMetric.contribution_type || "Operational Support",
      revenue_generated: deptMetric.revenue_generated ?? 0,
      strategic_weight: deptMetric.strategic_weight || 3,
      target_contribution_score: deptMetric.target_score || 85,
    });
  };

  const handleSaveBudget = async (e) => {
    e.preventDefault();
    if (!editingDept) return;
    setIsSaving(true);
    try {
      const payload = {
        allocated_budget: parseFloat(editForm.allocated_budget || 0),
        actual_spend: parseFloat(editForm.actual_spend || 0),
        budget_currency: editForm.budget_currency || "USD",
        fiscal_year: editForm.fiscal_year || "2026",
        contribution_type: editForm.contribution_type || "Operational Support",
        revenue_generated: parseFloat(editForm.revenue_generated || 0),
        strategic_weight: parseInt(editForm.strategic_weight || 3),
        target_contribution_score: parseFloat(editForm.target_contribution_score || 85),
      };

      await ExecutivePerformance.updateBudget(editingDept.dept.id, payload);
      toast({ title: "Updated", description: `Updated financial and contribution parameters for ${editingDept.dept.name}` });
      setEditingDept(null);
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err?.message || "Failed to update department parameters", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportCSV = () => {
    if (!data.departments || data.departments.length === 0) return;
    const rows = data.departments.map((d) => ({
      "Department": d.dept.name,
      "Code": d.dept.code || "",
      "Manager": d.dept.manager_name || "Unassigned",
      "Archetype": d.contribution_type,
      "Allocated Budget": d.allocated_budget,
      "Actual Spend": d.actual_spend,
      "Variance": d.budget_variance,
      "Utilization Rate %": d.utilization_rate,
      "Currency": d.budget_currency,
      "Fiscal Year": d.fiscal_year,
      "Tasks Assigned": d.tasks_count,
      "Tasks Completed": d.completed_tasks,
      "On Time %": d.on_time_rate,
      "Cost Per Completed Task": d.cost_per_completed_task,
      "Revenue Generated": d.revenue_generated,
      "Strategic Weight": d.strategic_weight,
      "Task Performance Score": d.task_performance_score,
      "Budget Health Score": d.budget_health_score,
      "Contribution Score": d.contribution_score,
      "Composite DPCI Score": d.dpci,
      "Performance Tier": d.tier,
    }));
    exportCSV(rows, `Executive_Departmental_Performance_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-600">Loading executive departmental intelligence...</p>
      </div>
    );
  }

  const { summary, departments } = data;

  // Filter & Sort departments
  const filteredDepts = (departments || []).filter((d) => {
    const q = searchQuery.toLowerCase();
    const nameMatch = d.dept.name?.toLowerCase().includes(q) || d.dept.code?.toLowerCase().includes(q) || d.dept.manager_name?.toLowerCase().includes(q);
    if (!nameMatch) return false;

    if (archetypeFilter !== "all" && d.contribution_type !== archetypeFilter) return false;
    if (statusFilter !== "all" && d.budget_status !== statusFilter) return false;
    return true;
  });

  filteredDepts.sort((a, b) => {
    if (sortBy === "dpci_desc") return b.dpci - a.dpci;
    if (sortBy === "dpci_asc") return a.dpci - b.dpci;
    if (sortBy === "budget_desc") return b.allocated_budget - a.allocated_budget;
    if (sortBy === "spend_desc") return b.actual_spend - a.actual_spend;
    if (sortBy === "utilization_desc") return b.utilization_rate - a.utilization_rate;
    if (sortBy === "tasks_desc") return b.completed_tasks - a.completed_tasks;
    if (sortBy === "name_asc") return a.dept.name.localeCompare(b.dept.name);
    return 0;
  });

  const currencySymbol = summary?.departments?.[0]?.budget_currency === "USD" ? "$" : summary?.departments?.[0]?.budget_currency === "EUR" ? "€" : "R";

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Executive Command Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 lg:p-8 text-white relative overflow-hidden shadow-xl border border-slate-700/50">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full -translate-y-1/3 translate-x-1/4 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-heading font-extrabold text-white tracking-tight">
              Departmental Performance & Capital Allocation
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl mt-1.5 leading-relaxed">
              Real-time executive tracking linking departmental budget utilization and contribution models to core operational task completion data.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-9 gap-1.5"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
              <span>Refresh Data</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-9 gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold h-9 gap-1.5 shadow-sm"
            >
              <FileText className="w-3.5 h-3.5" /> Print Brief
            </Button>
          </div>
        </div>

        {/* Quick Executive Stats Bar */}
        {summary && (
          <div className="mt-6 pt-6 border-t border-slate-700/60 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Allocated</p>
              <p className="text-lg lg:text-xl font-bold text-white mt-0.5">
                ${Number(summary.total_allocated_budget || 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Spend (YTD)</p>
              <p className="text-lg lg:text-xl font-bold text-amber-400 mt-0.5">
                ${Number(summary.total_actual_spend || 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Overall Utilization</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-lg lg:text-xl font-bold text-white">{summary.overall_utilization}%</span>
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded",
                  summary.overall_utilization > 100 ? "bg-rose-500/20 text-rose-300" : summary.overall_utilization > 85 ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"
                )}>
                  {summary.overall_utilization > 100 ? "Overrun" : summary.overall_utilization > 85 ? "High" : "Healthy"}
                </span>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Revenue / Value</p>
              <p className="text-lg lg:text-xl font-bold text-emerald-400 mt-0.5">
                ${Number(summary.total_revenue_generated || 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Task Output</p>
              <p className="text-lg lg:text-xl font-bold text-white mt-0.5">
                {summary.total_tasks_completed} / {summary.total_tasks_assigned}
                <span className="text-xs text-slate-400 font-normal ml-1">({summary.overall_completion_rate}%)</span>
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Corporate DPCI</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-lg lg:text-xl font-black text-amber-400">{summary.avg_dpci}</span>
                <span className="text-xs text-slate-400 font-medium">/ 100</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Strategic Callout Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {summary.top_contributor && (
            <div className="bg-white rounded-xl border border-emerald-200/80 p-5 shadow-sm flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                <Award className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                    Highest Organizational Impact
                  </span>
                  <span className="text-sm font-black text-emerald-700">
                    DPCI {summary.top_contributor.dpci}/100
                  </span>
                </div>
                <h3 className="font-heading font-bold text-slate-900 text-base mt-1">
                  {summary.top_contributor.dept.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {summary.top_contributor.completed_tasks} tasks delivered • {summary.top_contributor.on_time_rate}% on-time SLA • Budget utilization {summary.top_contributor.utilization_rate}%
                </p>
              </div>
            </div>
          )}

          {summary.fiscal_risk_dept && (
            <div className="bg-white rounded-xl border border-amber-200/80 p-5 shadow-sm flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
                    Fiscal & Capital Watchlist
                  </span>
                  <span className="text-sm font-bold text-amber-800">
                    {summary.fiscal_risk_dept.utilization_rate}% Utilized
                  </span>
                </div>
                <h3 className="font-heading font-bold text-slate-900 text-base mt-1">
                  {summary.fiscal_risk_dept.dept.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Spend: ${Number(summary.fiscal_risk_dept.actual_spend).toLocaleString()} vs Budget: ${Number(summary.fiscal_risk_dept.allocated_budget).toLocaleString()} (Variance: ${Number(summary.fiscal_risk_dept.budget_variance).toLocaleString()})
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by department name, code, or manager..."
              className="pl-9 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={archetypeFilter} onValueChange={setArchetypeFilter}>
              <SelectTrigger className="w-[180px] text-xs h-9">
                <SelectValue placeholder="Archetype" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Archetypes</SelectItem>
                <SelectItem value="Operational Support">Operational Support</SelectItem>
                <SelectItem value="Revenue Generating">Revenue Generating</SelectItem>
                <SelectItem value="Strategic Enabler">Strategic Enabler</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[170px] text-xs h-9">
                <SelectValue placeholder="Budget Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Budget Statuses</SelectItem>
                <SelectItem value="Optimal">Optimal</SelectItem>
                <SelectItem value="Under Budget">Under Budget</SelectItem>
                <SelectItem value="Near Capacity">Near Capacity</SelectItem>
                <SelectItem value="Budget Overrun">Budget Overrun</SelectItem>
                <SelectItem value="No Budget Configured">No Budget</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[190px] text-xs h-9">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dpci_desc">Highest DPCI Score</SelectItem>
                <SelectItem value="dpci_asc">Lowest DPCI Score</SelectItem>
                <SelectItem value="budget_desc">Highest Budget</SelectItem>
                <SelectItem value="spend_desc">Highest Spend</SelectItem>
                <SelectItem value="utilization_desc">Highest Utilization %</SelectItem>
                <SelectItem value="tasks_desc">Most Tasks Completed</SelectItem>
                <SelectItem value="name_asc">Department Name</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span>Showing {filteredDepts.length} of {departments?.length || 0} departments</span>
          <span>DPCI: Departmental Performance & Contribution Index (Task Output 50% + Fiscal Health 25% + Strategic Impact 25%)</span>
        </div>
      </div>

      {/* Department Matrix Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredDepts.map((d) => {
          const dept = d.dept;
          const isOverrun = d.budget_status === "Budget Overrun";
          const isOptimal = d.budget_status === "Optimal";
          const isNearCapacity = d.budget_status === "Near Capacity";

          return (
            <div
              key={dept.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Card Top */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-base shadow-sm shrink-0"
                      style={{ backgroundColor: dept.color || "#1e3a5f" }}
                    >
                      {dept.code || dept.name?.[0]?.toUpperCase() || "D"}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-heading font-bold text-slate-900 text-base truncate" title={dept.name}>
                        {dept.name}
                      </h3>
                      <p className="text-xs text-slate-500 truncate">
                        {dept.manager_name ? `Manager: ${dept.manager_name}` : "No manager assigned"} • {d.emp_count} {d.emp_count === 1 ? "member" : "members"}
                      </p>
                    </div>
                  </div>

                  {/* DPCI Badge */}
                  <div className="text-right shrink-0">
                    <div className="inline-flex items-center gap-1 font-black text-base text-slate-900 bg-slate-100 px-2.5 py-1 rounded-xl">
                      <span className="text-xs text-slate-400 font-bold">DPCI</span>
                      <span className={cn(
                        d.dpci >= 80 ? "text-emerald-700" : d.dpci >= 65 ? "text-blue-700" : d.dpci >= 50 ? "text-amber-700" : "text-rose-700"
                      )}>
                        {d.dpci}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Archetype & Status Pills */}
                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  <span className={cn(
                    "text-[11px] font-semibold px-2 py-0.5 rounded-md border",
                    d.contribution_type === "Revenue Generating"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200/70"
                      : d.contribution_type === "Strategic Enabler"
                      ? "bg-purple-50 text-purple-800 border-purple-200/70"
                      : "bg-blue-50 text-blue-800 border-blue-200/70"
                  )}>
                    {d.contribution_type}
                  </span>

                  <span className={cn(
                    "text-[11px] font-medium px-2 py-0.5 rounded-md border",
                    isOverrun
                      ? "bg-rose-50 text-rose-700 border-rose-200/70 font-semibold"
                      : isNearCapacity
                      ? "bg-amber-50 text-amber-800 border-amber-200/70"
                      : isOptimal
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200/70"
                      : "bg-slate-50 text-slate-600 border-slate-200"
                  )}>
                    {d.budget_status}
                  </span>

                  <span className="text-[11px] text-slate-500 ml-auto font-medium">
                    Tier: <span className="font-semibold text-slate-700">{d.tier.split(":")[0]}</span>
                  </span>
                </div>

                {/* Financial Progress & Utilization */}
                <div className="mt-4 p-3 rounded-xl bg-slate-50/80 border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Budget Capital</span>
                    <span className="font-bold text-slate-800">
                      ${Number(d.actual_spend).toLocaleString()} <span className="text-slate-400 font-normal">/ ${Number(d.allocated_budget).toLocaleString()}</span>
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        d.utilization_rate > 100
                          ? "bg-rose-500"
                          : d.utilization_rate > 85
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      )}
                      style={{ width: `${Math.min(100, d.utilization_rate)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Utilization: <strong className="text-slate-700">{d.utilization_rate}%</strong></span>
                    <span>
                      Variance: <strong className={cn(d.budget_variance < 0 ? "text-rose-600" : "text-emerald-600")}>
                        ${Number(d.budget_variance).toLocaleString()}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Operational Task Performance Linkage */}
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Tasks Done</p>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">
                      {d.completed_tasks} <span className="text-[11px] text-slate-400 font-normal">/ {d.tasks_count}</span>
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">On-Time SLA</p>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">
                      {d.on_time_rate}%
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Cost / Output</p>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">
                      {d.completed_tasks > 0 ? `$${Math.round(d.cost_per_completed_task).toLocaleString()}` : "—"}
                    </p>
                  </div>
                </div>

                {/* Archetype Specific Financial / Strategic Metric */}
                <div className="mt-3 text-xs flex items-center justify-between px-1">
                  {d.contribution_type === "Revenue Generating" ? (
                    <>
                      <span className="text-slate-500">Revenue Output:</span>
                      <span className="font-bold text-emerald-700">
                        ${Number(d.revenue_generated || 0).toLocaleString()} (ROI: {d.roi_pct}%)
                      </span>
                    </>
                  ) : d.contribution_type === "Strategic Enabler" ? (
                    <>
                      <span className="text-slate-500">Strategic Weight:</span>
                      <span className="font-bold text-purple-700">
                        Level {d.strategic_weight} of 5 ({d.strategic_weight >= 4 ? "Mission Critical" : "High Strategic"})
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-slate-500">Task Velocity Score:</span>
                      <span className="font-bold text-blue-700">{d.task_performance_score} / 100</span>
                    </>
                  )}
                </div>
              </div>

              {/* Card Actions */}
              <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedDept(d)}
                  className="flex-1 text-xs h-8 border-slate-200 hover:bg-slate-100 text-slate-700"
                >
                  Inspect Analytics
                </Button>
                <Button
                  size="sm"
                  onClick={() => openEditModal(d)}
                  className="flex-1 text-xs h-8 bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                >
                  Adjust Budget
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Drill-Down Inspection Modal */}
      {selectedDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedDept(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-sm shrink-0"
                  style={{ backgroundColor: selectedDept.dept.color || "#1e3a5f" }}
                >
                  {selectedDept.dept.code || "D"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-heading font-bold text-slate-900">{selectedDept.dept.name}</h2>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {selectedDept.contribution_type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Executive Performance Deep Dive • Manager: {selectedDept.dept.manager_name || "None"}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedDept(null)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Score breakdown banner */}
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-xl p-4 text-white flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-400 font-bold uppercase tracking-wider">Composite Performance Index</p>
                  <h3 className="text-3xl font-black mt-1">{selectedDept.dpci} <span className="text-sm font-normal text-slate-400">/ 100</span></h3>
                  <p className="text-xs text-slate-300 mt-0.5">{selectedDept.tier}</p>
                </div>
                <div className="text-right space-y-1 text-xs">
                  <p className="text-slate-300">Task Output (50%): <strong className="text-white">{selectedDept.task_performance_score}</strong></p>
                  <p className="text-slate-300">Budget Health (25%): <strong className="text-white">{selectedDept.budget_health_score}</strong></p>
                  <p className="text-slate-300">Strategic Contribution (25%): <strong className="text-white">{selectedDept.contribution_score}</strong></p>
                </div>
              </div>

              {/* Capital & Financial Allocation */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <Landmark className="w-4 h-4 text-amber-600" /> Capital & Budget Tracking ({selectedDept.fiscal_year})
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[11px] text-slate-500">Allocated Budget</p>
                    <p className="text-base font-bold text-slate-900 mt-0.5">${Number(selectedDept.allocated_budget).toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[11px] text-slate-500">Actual Spend (YTD)</p>
                    <p className="text-base font-bold text-slate-900 mt-0.5">${Number(selectedDept.actual_spend).toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[11px] text-slate-500">Variance</p>
                    <p className={cn("text-base font-bold mt-0.5", selectedDept.budget_variance < 0 ? "text-rose-600" : "text-emerald-600")}>
                      ${Number(selectedDept.budget_variance).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[11px] text-slate-500">Utilization Rate</p>
                    <p className="text-base font-bold text-slate-900 mt-0.5">{selectedDept.utilization_rate}%</p>
                  </div>
                </div>
              </div>

              {/* Task Completion Velocity */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Task Output & Delivery Velocity
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[11px] text-slate-500">Total Assigned</p>
                    <p className="text-base font-bold text-slate-900 mt-0.5">{selectedDept.tasks_count} tasks</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[11px] text-slate-500">Completed</p>
                    <p className="text-base font-bold text-emerald-700 mt-0.5">{selectedDept.completed_tasks} tasks</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[11px] text-slate-500">Delivered On-Time</p>
                    <p className="text-base font-bold text-slate-900 mt-0.5">{selectedDept.on_time_tasks} ({selectedDept.on_time_rate}%)</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[11px] text-slate-500">Overdue / Late</p>
                    <p className="text-base font-bold text-rose-600 mt-0.5">{selectedDept.overdue_tasks + selectedDept.late_tasks}</p>
                  </div>
                </div>
              </div>

              {/* Unit Cost Efficiency Analysis */}
              <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/70 flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-amber-900 uppercase">Operational Unit Output Cost</h5>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Calculated as actual departmental spend divided by completed tasks delivered.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-amber-950">
                    {selectedDept.completed_tasks > 0 ? `$${Math.round(selectedDept.cost_per_completed_task).toLocaleString()}` : "N/A"}
                  </p>
                  <p className="text-[10px] text-amber-800 font-semibold">per completed deliverable</p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => setSelectedDept(null)}>
                Close
              </Button>
              <Button size="sm" onClick={() => { const d = selectedDept; setSelectedDept(null); openEditModal(d); }} className="bg-slate-900 text-white font-semibold">
                Adjust Financials & Targets
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Budget & Targets Modal */}
      {editingDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setEditingDept(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-lg font-heading font-bold text-slate-900">Adjust Department Parameters</h2>
                <p className="text-xs text-slate-500 mt-0.5">{editingDept.dept.name}</p>
              </div>
              <button onClick={() => setEditingDept(null)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Allocated Budget ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.allocated_budget}
                    onChange={(e) => setEditForm({ ...editForm, allocated_budget: e.target.value })}
                    className="mt-1 text-sm font-semibold"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Actual Spend (YTD) ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.actual_spend}
                    onChange={(e) => setEditForm({ ...editForm, actual_spend: e.target.value })}
                    className="mt-1 text-sm font-semibold"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Currency</Label>
                  <Select value={editForm.budget_currency} onValueChange={(v) => setEditForm({ ...editForm, budget_currency: v })}>
                    <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="ZAR">ZAR (R)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Fiscal Cycle Year</Label>
                  <Input
                    value={editForm.fiscal_year}
                    onChange={(e) => setEditForm({ ...editForm, fiscal_year: e.target.value })}
                    className="mt-1 text-xs"
                    placeholder="2026"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Contribution Archetype</Label>
                <Select value={editForm.contribution_type} onValueChange={(v) => setEditForm({ ...editForm, contribution_type: v })}>
                  <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Operational Support">Operational Support (Cost Center / Execution Engine)</SelectItem>
                    <SelectItem value="Revenue Generating">Revenue Generating (Profit Center / Commercial Engine)</SelectItem>
                    <SelectItem value="Strategic Enabler">Strategic Enabler (Governance / Growth / Research)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editForm.contribution_type === "Revenue Generating" ? (
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Revenue Generated (YTD)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.revenue_generated}
                    onChange={(e) => setEditForm({ ...editForm, revenue_generated: e.target.value })}
                    className="mt-1 text-sm font-semibold"
                    placeholder="0.00"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Strategic Priority Weight (1-5)</Label>
                    <Select value={String(editForm.strategic_weight)} onValueChange={(v) => setEditForm({ ...editForm, strategic_weight: parseInt(v) })}>
                      <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 - Baseline Support</SelectItem>
                        <SelectItem value="2">2 - Standard Operations</SelectItem>
                        <SelectItem value="3">3 - High Strategic Value</SelectItem>
                        <SelectItem value="4">4 - Mission Critical</SelectItem>
                        <SelectItem value="5">5 - Enterprise Essential</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Target Score Benchmark (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={editForm.target_contribution_score}
                      onChange={(e) => setEditForm({ ...editForm, target_contribution_score: e.target.value })}
                      className="mt-1 text-xs"
                      placeholder="85"
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingDept(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSaving} className="bg-slate-900 hover:bg-slate-800 text-white font-semibold">
                  {isSaving ? "Saving..." : "Save Parameters"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
