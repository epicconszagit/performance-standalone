import React, { useState, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import {
  DollarSign, TrendingUp, TrendingDown, Target, Award,
  CheckCircle2, AlertTriangle, AlertCircle, Clock, Users,
  BarChart3, FileText, Download, Search, RefreshCw,
  Coins, Briefcase, ChevronRight, X, ArrowUpDown, Filter,
  PlusCircle, MinusCircle, History, Trash2, Edit3, Sparkles
} from "lucide-react";
import { ExecutivePerformance } from "@/api/entities";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isExecutiveSuperAdminOrCEO } from "@/lib/performance";
import { exportCSV } from "@/lib/exportReport";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

const REVENUE_CATEGORIES = [
  "Client Project",
  "Service Retainer",
  "Product / Software Sales",
  "Consulting & Advisory",
  "Commission & Fees",
  "Grant & Subcontract",
  "Other Inflow",
];

const EXPENSE_CATEGORIES = [
  "Software & Cloud Services",
  "Contractors & Freelancers",
  "Equipment & Hardware",
  "Advertising & Marketing",
  "Travel & Entertainment",
  "Office & Operational",
  "Other Outflow",
];

export default function DepartmentalPerformance() {
  const { user, employee, role } = useOutletContext();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isAuthorized = isExecutiveSuperAdminOrCEO(user, employee, role);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({ summary: null, departments: [] });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("revenue_desc");

  // Modals
  const [selectedDept, setSelectedDept] = useState(null); // Drilldown analytics
  const [ledgerDept, setLedgerDept] = useState(null); // Transaction Ledger
  const [targetDept, setTargetDept] = useState(null); // Set Target Modal
  const [targetAmount, setTargetAmount] = useState("");
  const [isSavingTarget, setIsSavingTarget] = useState(false);

  // Financial Entry Modal (Revenue / Expense)
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryType, setEntryType] = useState("revenue"); // "revenue" | "expense"
  const [entryDeptId, setEntryDeptId] = useState("");
  const [entryAmount, setEntryAmount] = useState("");
  const [entryTitle, setEntryTitle] = useState("");
  const [entryCategory, setEntryCategory] = useState("Client Project");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [entryNotes, setEntryNotes] = useState("");
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const [isDeletingRecordId, setIsDeletingRecordId] = useState(null);

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await ExecutivePerformance.getOverview();
      setData(res || { summary: null, departments: [] });
    } catch (err) {
      console.error("Failed to load departmental performance:", err);
      toast({
        title: "Error Loading Data",
        description: err?.response?.data?.error || err?.message || "Failed to load executive intelligence.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isAuthorized) {
      toast({
        title: "Access Restricted",
        description: "This strategic revenue and budget portal is restricted to the Super Administrator and Chief Executive Officer.",
        variant: "destructive",
      });
      navigate("/");
      return;
    }
    loadData();
  }, [isAuthorized]);

  const handleRefresh = () => {
    loadData(true);
  };

  // Quick Open Entry Modal for specific department & type
  const openLogEntry = (deptId = "", type = "revenue") => {
    setEntryDeptId(deptId || (data.departments?.[0]?.dept?.id || ""));
    setEntryType(type);
    setEntryCategory(type === "revenue" ? "Client Project" : "Software & Cloud Services");
    setEntryAmount("");
    setEntryTitle("");
    setEntryDate(new Date().toISOString().slice(0, 10));
    setEntryNotes("");
    setShowEntryModal(true);
  };

  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!entryDeptId) {
      toast({ title: "Validation Error", description: "Please select a department.", variant: "destructive" });
      return;
    }
    const val = parseFloat(entryAmount);
    if (isNaN(val) || val <= 0) {
      toast({ title: "Validation Error", description: "Please enter a valid dollar amount greater than 0.", variant: "destructive" });
      return;
    }
    if (!entryTitle.trim()) {
      toast({ title: "Validation Error", description: "Please enter a description / title for this entry.", variant: "destructive" });
      return;
    }

    setIsSavingEntry(true);
    try {
      await ExecutivePerformance.createFinancialRecord({
        department_id: entryDeptId,
        record_type: entryType,
        amount: val,
        title: entryTitle.trim(),
        category: entryCategory,
        transaction_date: entryDate,
        notes: entryNotes.trim(),
      });

      toast({
        title: entryType === "revenue" ? "Revenue Recorded" : "Expense Recorded",
        description: `Successfully added $${val.toLocaleString()} ${entryType} for the department.`,
      });

      setShowEntryModal(false);
      loadData();
    } catch (err) {
      toast({
        title: "Failed to record entry",
        description: err?.response?.data?.error || err?.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSavingEntry(false);
    }
  };

  const handleDeleteRecord = async (recordId) => {
    if (!window.confirm("Are you sure you want to remove this financial entry? This will update department totals immediately.")) {
      return;
    }
    setIsDeletingRecordId(recordId);
    try {
      await ExecutivePerformance.deleteFinancialRecord(recordId);
      toast({ title: "Entry Removed", description: "The transaction has been deleted and totals updated." });
      loadData();
      if (ledgerDept) {
        // Refresh ledger modal view
        setLedgerDept((prev) => ({
          ...prev,
          recent_records: (prev.recent_records || []).filter((r) => r.id !== recordId),
        }));
      }
    } catch (err) {
      toast({
        title: "Error Deleting Entry",
        description: err?.response?.data?.error || err?.message || "Could not delete entry.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingRecordId(null);
    }
  };

  const openSetTarget = (dept) => {
    setTargetDept(dept);
    setTargetAmount(dept.annual_budget_target ? String(dept.annual_budget_target) : "");
  };

  const handleSaveTarget = async (e) => {
    e.preventDefault();
    const val = parseFloat(targetAmount || 0);
    if (isNaN(val) || val < 0) {
      toast({ title: "Invalid Target", description: "Please enter a valid dollar amount.", variant: "destructive" });
      return;
    }

    setIsSavingTarget(true);
    try {
      await ExecutivePerformance.updateTarget(targetDept.dept.id, { annual_budget_target: val });
      toast({
        title: "Annual Target Updated",
        description: `Annual expected revenue target for ${targetDept.dept.name} set to $${val.toLocaleString()}.`,
      });
      setTargetDept(null);
      loadData();
    } catch (err) {
      toast({
        title: "Error Updating Target",
        description: err?.response?.data?.error || err?.message || "Could not update annual target.",
        variant: "destructive",
      });
    } finally {
      setIsSavingTarget(false);
    }
  };

  const handleExportCSV = () => {
    if (!data.departments || data.departments.length === 0) return;
    const rows = data.departments.map((d) => ({
      "Rank (Revenue)": d.rank_revenue,
      "Department": d.dept.name,
      "Code": d.dept.code || "",
      "Manager": d.dept.manager_name || "Unassigned",
      "Annual Target ($)": d.annual_budget_target,
      "Money Brought In (Revenue) ($)": d.total_revenue,
      "Operating Expenses ($)": d.total_expenses,
      "Net Contribution (Profit) ($)": d.net_contribution,
      "Target Progress %": d.target_progress_pct,
      "Profit Margin %": d.profit_margin_pct,
      "Tasks Assigned": d.tasks_count,
      "Tasks Completed": d.completed_tasks,
      "On Time %": d.on_time_rate,
      "Revenue Per Completed Task ($)": d.revenue_per_task,
      "Performance Tier": d.tier,
    }));
    exportCSV(rows, `Executive_Department_Revenue_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-600">Loading executive revenue & target intelligence...</p>
      </div>
    );
  }

  const { summary, departments } = data;

  // Filter & Sort
  const filteredDepts = (departments || []).filter((d) => {
    const q = searchQuery.toLowerCase();
    const nameMatch = d.dept.name?.toLowerCase().includes(q) || d.dept.code?.toLowerCase().includes(q) || d.dept.manager_name?.toLowerCase().includes(q);
    if (!nameMatch) return false;

    if (statusFilter === "exceeded" && d.target_progress_pct < 100) return false;
    if (statusFilter === "on_track" && (d.target_progress_pct < 75 || d.target_progress_pct >= 100)) return false;
    if (statusFilter === "lagging" && d.target_progress_pct >= 75) return false;

    return true;
  });

  const sortedDepts = [...filteredDepts].sort((a, b) => {
    if (sortBy === "revenue_desc") return b.total_revenue - a.total_revenue;
    if (sortBy === "revenue_asc") return a.total_revenue - b.total_revenue;
    if (sortBy === "profit_desc") return b.net_contribution - a.net_contribution;
    if (sortBy === "target_desc") return b.target_progress_pct - a.target_progress_pct;
    if (sortBy === "tasks_desc") return b.completed_tasks - a.completed_tasks;
    return a.dept.name.localeCompare(b.dept.name);
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Executive Command Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 lg:p-8 text-white relative overflow-hidden shadow-xl border border-slate-700/50">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full -translate-y-1/3 translate-x-1/4 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-heading font-extrabold text-white tracking-tight">
              Department Revenue & Annual Budget Tracker
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl mt-1.5 leading-relaxed">
              Real-time executive tracking of revenue brought in by each department, operating expenses, and annual budget target fulfillment linked to team task completion.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => openLogEntry("", "revenue")}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold h-9 gap-1.5 shadow-sm"
            >
              <PlusCircle className="w-4 h-4" /> Log Revenue
            </Button>
            <Button
              size="sm"
              onClick={() => openLogEntry("", "expense")}
              className="bg-rose-500 hover:bg-rose-600 text-white font-semibold h-9 gap-1.5 shadow-sm"
            >
              <MinusCircle className="w-4 h-4" /> Log Expense
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-9 gap-1.5"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-9 gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-9 gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" /> Print
            </Button>
          </div>
        </div>

        {/* Executive High-Level Corporate Totals Bar */}
        {summary && (
          <div className="mt-6 pt-6 border-t border-slate-700/60 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Money Brought In</p>
              <p className="text-xl lg:text-2xl font-black text-emerald-400 mt-0.5">
                ${Number(summary.total_revenue || 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Corporate Inflows (YTD)</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Expenses</p>
              <p className="text-xl lg:text-2xl font-black text-rose-400 mt-0.5">
                ${Number(summary.total_expenses || 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Operating Outflows</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Net Contribution</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={cn(
                  "text-xl lg:text-2xl font-black",
                  summary.net_contribution >= 0 ? "text-emerald-300" : "text-rose-400"
                )}>
                  {summary.net_contribution >= 0 ? "+" : ""}${Number(summary.net_contribution || 0).toLocaleString()}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Margin: {summary.overall_profit_margin_pct}%
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Annual Target Goal</p>
              <p className="text-xl lg:text-2xl font-black text-white mt-0.5">
                ${Number(summary.total_annual_target || 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-amber-300 font-semibold mt-0.5">
                {summary.overall_target_progress_pct}% Achieved
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Top Money Maker</p>
              <p className="text-sm font-bold text-amber-400 mt-1 truncate">
                {summary.top_earning_dept ? summary.top_earning_dept.dept.name : "No Data Yet"}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                {summary.top_earning_dept ? `$${Number(summary.top_earning_dept.total_revenue).toLocaleString()} generated` : "Start logging revenue"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Task Deliverables</p>
              <p className="text-xl lg:text-2xl font-bold text-white mt-0.5">
                {summary.total_tasks_completed} <span className="text-xs text-slate-400 font-normal">done</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Yield: ${Number(summary.avg_revenue_per_task || 0).toLocaleString()} / task
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Corporate Spotlight Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Top Revenue Producer */}
          {summary.top_earning_dept && (
            <div className="bg-white rounded-xl border border-emerald-200/80 p-5 shadow-sm flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                <Award className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    #1 Top Money Maker
                  </span>
                  <span className="text-xs text-slate-400">• Leaderboard Rank 1</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1 truncate">
                  {summary.top_earning_dept.dept.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Generated <strong className="text-emerald-700 font-bold">${Number(summary.top_earning_dept.total_revenue).toLocaleString()}</strong> towards their ${Number(summary.top_earning_dept.annual_budget_target).toLocaleString()} annual target ({summary.top_earning_dept.target_progress_pct}%).
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openLogEntry(summary.top_earning_dept.dept.id, "revenue")}
                    className="h-8 text-xs font-semibold text-emerald-700 border-emerald-300 hover:bg-emerald-50 gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Add Revenue
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedDept(summary.top_earning_dept)}
                    className="h-8 text-xs text-slate-600 hover:text-slate-900 gap-1"
                  >
                    View Analytics <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Highest Profit / Net Surplus */}
          {summary.top_profit_dept && (
            <div className="bg-white rounded-xl border border-indigo-200/80 p-5 shadow-sm flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                    Highest Net Profit
                  </span>
                  <span className="text-xs text-slate-400">• Fiscal Efficiency</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1 truncate">
                  {summary.top_profit_dept.dept.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Net surplus of <strong className="text-indigo-700 font-bold">${Number(summary.top_profit_dept.net_contribution).toLocaleString()}</strong> after ${Number(summary.top_profit_dept.total_expenses).toLocaleString()} in expenses ({summary.top_profit_dept.profit_margin_pct}% net margin).
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setLedgerDept(summary.top_profit_dept)}
                    className="h-8 text-xs font-semibold text-indigo-700 border-indigo-300 hover:bg-indigo-50 gap-1"
                  >
                    <History className="w-3.5 h-3.5" /> View Ledger ({summary.top_profit_dept.total_transactions_count})
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedDept(summary.top_profit_dept)}
                    className="h-8 text-xs text-slate-600 hover:text-slate-900 gap-1"
                  >
                    View Analytics <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter and Sorting Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search departments, managers, codes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Target Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-xs w-36">
              <SelectValue placeholder="Target Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="exceeded">Target Exceeded (≥100%)</SelectItem>
              <SelectItem value="on_track">On Track (75-99%)</SelectItem>
              <SelectItem value="lagging">Lagging (&lt;75%)</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort By Dropdown */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-9 text-xs w-48 font-medium">
              <ArrowUpDown className="w-3 h-3 mr-1 text-slate-400" />
              <SelectValue placeholder="Sort Leaderboard" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="revenue_desc">Rank: Most Money Brought In</SelectItem>
              <SelectItem value="profit_desc">Rank: Highest Net Profit</SelectItem>
              <SelectItem value="target_desc">Rank: Target Progress %</SelectItem>
              <SelectItem value="tasks_desc">Rank: Most Tasks Done</SelectItem>
              <SelectItem value="name_asc">Department Name (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Departments Leaderboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {sortedDepts.map((d) => {
          const isOverTarget = d.target_progress_pct >= 100;
          const isOnTrack = d.target_progress_pct >= 75 && !isOverTarget;
          const isProfitable = d.net_contribution >= 0;

          return (
            <div
              key={d.dept.id}
              className="bg-white rounded-xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden relative group"
            >
              {/* Color Accent Bar */}
              <div
                className="h-1.5 w-full"
                style={{ backgroundColor: d.dept.color || "#1e3a5f" }}
              />

              <div className="p-5 flex-1">
                {/* Header: Rank + Name + Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "text-[10.5px] font-black px-1.5 py-0.5 rounded",
                        d.rank_revenue === 1
                          ? "bg-amber-100 text-amber-900 border border-amber-300 font-extrabold"
                          : d.rank_revenue === 2
                          ? "bg-slate-200 text-slate-800 font-bold"
                          : d.rank_revenue === 3
                          ? "bg-amber-800/10 text-amber-900 font-bold"
                          : "bg-slate-100 text-slate-600 font-semibold"
                      )}>
                        #{d.rank_revenue} Earner
                      </span>
                      {d.dept.code && (
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {d.dept.code}
                        </span>
                      )}
                    </div>
                    <h3 className="font-heading font-bold text-slate-900 text-base mt-1 truncate">
                      {d.dept.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 truncate flex items-center gap-1">
                      <Users className="w-3 h-3 text-slate-400" />
                      <span>{d.dept.manager_name}</span>
                      <span className="text-slate-300">•</span>
                      <span>{d.staff_count} staff</span>
                    </p>
                  </div>

                  <span className={cn(
                    "text-[11px] font-bold px-2 py-0.5 rounded shrink-0",
                    isOverTarget ? "bg-emerald-100 text-emerald-800" :
                    isOnTrack ? "bg-amber-100 text-amber-800" :
                    "bg-slate-100 text-slate-700"
                  )}>
                    {d.target_status}
                  </span>
                </div>

                {/* Annual Budget Target Progress Bar */}
                <div className="mt-4 bg-slate-50 border border-slate-100 rounded-lg p-3">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-700 flex items-center gap-1">
                      <Target className="w-3.5 h-3.5 text-amber-600" /> Annual Target Progress
                    </span>
                    <span className="font-bold text-slate-900">
                      {d.target_progress_pct}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        isOverTarget ? "bg-emerald-500" : isOnTrack ? "bg-amber-500" : "bg-indigo-500"
                      )}
                      style={{ width: `${Math.min(100, Math.max(0, d.target_progress_pct))}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5">
                    <span>Brought In: <strong className="text-emerald-700 font-bold">${Number(d.total_revenue).toLocaleString()}</strong></span>
                    <span>Target: <strong className="text-slate-800 font-semibold">${Number(d.annual_budget_target).toLocaleString()}</strong></span>
                  </div>
                </div>

                {/* 3-Pillar Financial Summary: Inflows, Outflows, Net */}
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-emerald-50/70 border border-emerald-100 rounded-lg p-2">
                    <p className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wide">Inflow</p>
                    <p className="text-sm font-black text-emerald-700 mt-0.5">
                      ${Number(d.total_revenue).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-rose-50/70 border border-rose-100 rounded-lg p-2">
                    <p className="text-[10px] font-semibold text-rose-800 uppercase tracking-wide">Expenses</p>
                    <p className="text-sm font-black text-rose-700 mt-0.5">
                      ${Number(d.total_expenses).toLocaleString()}
                    </p>
                  </div>
                  <div className={cn(
                    "border rounded-lg p-2",
                    isProfitable ? "bg-indigo-50/70 border-indigo-100" : "bg-amber-50/70 border-amber-200"
                  )}>
                    <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Net Profit</p>
                    <p className={cn("text-sm font-black mt-0.5", isProfitable ? "text-indigo-700" : "text-amber-700")}>
                      {d.net_contribution >= 0 ? "+" : ""}${Number(d.net_contribution).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Task Work Output Connection */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span><strong>{d.completed_tasks}</strong> / {d.tasks_count} tasks done</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    Yield: <strong className="text-slate-800 font-semibold">${Number(d.revenue_per_task || 0).toLocaleString()}</strong> / task
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-3 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openLogEntry(d.dept.id, "revenue")}
                    className="h-7 px-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 border-emerald-200 gap-1"
                  >
                    <PlusCircle className="w-3 h-3" /> Inflow
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openLogEntry(d.dept.id, "expense")}
                    className="h-7 px-2 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 border-rose-200 gap-1"
                  >
                    <MinusCircle className="w-3 h-3" /> Expense
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setLedgerDept(d)}
                    className="h-7 px-2 text-[11px] font-medium text-slate-600 hover:text-slate-900 gap-1"
                  >
                    <History className="w-3 h-3 text-slate-400" /> Ledger ({d.total_transactions_count})
                  </Button>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openSetTarget(d)}
                    title="Set Annual Target"
                    className="h-7 px-1.5 text-slate-500 hover:text-slate-900"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedDept(d)}
                    title="Inspect Analytics"
                    className="h-7 px-1.5 text-slate-500 hover:text-slate-900"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {sortedDepts.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No departments match your search</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search keywords or clearing the status filters.
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: Log Revenue / Expense Entry                                      */}
      {/* ========================================================================= */}
      {showEntryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className={cn(
              "px-6 py-4 flex items-center justify-between text-white",
              entryType === "revenue"
                ? "bg-gradient-to-r from-emerald-800 to-emerald-950"
                : "bg-gradient-to-r from-rose-800 to-rose-950"
            )}>
              <div className="flex items-center gap-2">
                {entryType === "revenue" ? <PlusCircle className="w-5 h-5 text-emerald-400" /> : <MinusCircle className="w-5 h-5 text-rose-400" />}
                <div>
                  <h3 className="font-heading font-bold text-base">
                    {entryType === "revenue" ? "Log Money Brought In (Revenue)" : "Log Operating Expense"}
                  </h3>
                  <p className="text-xs text-white/80">Record transaction in the departmental financial ledger</p>
                </div>
              </div>
              <button onClick={() => setShowEntryModal(false)} className="text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="p-6 space-y-4">
              {/* Toggle Entry Type */}
              <div className="flex rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setEntryType("revenue");
                    setEntryCategory("Client Project");
                  }}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-bold rounded-md transition-all",
                    entryType === "revenue" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  + Money Brought In (Revenue)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEntryType("expense");
                    setEntryCategory("Software & Cloud Services");
                  }}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-bold rounded-md transition-all",
                    entryType === "expense" ? "bg-white text-rose-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  - Operating Expense
                </button>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Department</Label>
                <Select value={entryDeptId} onValueChange={setEntryDeptId}>
                  <SelectTrigger className="mt-1 text-xs"><SelectValue placeholder="Select Department" /></SelectTrigger>
                  <SelectContent>
                    {(data.departments || []).map((d) => (
                      <SelectItem key={d.dept.id} value={d.dept.id}>
                        {d.dept.name} (Target: ${Number(d.annual_budget_target || 0).toLocaleString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Amount ($ USD)</Label>
                  <div className="relative mt-1">
                    <Input
                      type="number"
                      step="0.01"
                      required
                      value={entryAmount}
                      onChange={(e) => setEntryAmount(e.target.value)}
                      placeholder="0.00"
                      className="pl-7 text-sm font-bold"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">$</span>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">Date</Label>
                  <Input
                    type="date"
                    required
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Description / Client / Deliverable</Label>
                <Input
                  type="text"
                  required
                  placeholder={entryType === "revenue" ? "e.g. Website Overhaul - Milestone 1" : "e.g. Monthly AWS Cloud Hosting"}
                  value={entryTitle}
                  onChange={(e) => setEntryTitle(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Category</Label>
                <Select value={entryCategory} onValueChange={setEntryCategory}>
                  <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(entryType === "revenue" ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES).map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Notes / Invoice Ref (Optional)</Label>
                <Textarea
                  placeholder="Reference number, client invoice, receipt notes..."
                  value={entryNotes}
                  onChange={(e) => setEntryNotes(e.target.value)}
                  className="mt-1 text-xs min-h-[60px]"
                />
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowEntryModal(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSavingEntry}
                  className={cn(
                    "font-bold text-white shadow-sm",
                    entryType === "revenue" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                  )}
                >
                  {isSavingEntry ? "Saving..." : entryType === "revenue" ? "Record Revenue Inflow" : "Record Expense Outflow"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: Set Annual Budget Target                                         */}
      {/* ========================================================================= */}
      {targetDept && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-400" />
                <h3 className="font-heading font-bold text-base">Set Annual Revenue Target</h3>
              </div>
              <button onClick={() => setTargetDept(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTarget} className="p-6 space-y-4">
              <div>
                <p className="text-xs text-slate-500 font-medium">Department</p>
                <p className="text-sm font-bold text-slate-900">{targetDept.dept.name}</p>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Annual Expected Revenue Target ($ USD)
                </Label>
                <p className="text-[11px] text-slate-500 mb-1.5">
                  Total revenue you expect this department to bring into the organisation by year-end.
                </p>
                <div className="relative">
                  <Input
                    type="number"
                    step="1"
                    required
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    placeholder="e.g. 10000"
                    className="pl-7 text-base font-bold"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-bold">$</span>
                </div>
              </div>

              <div className="pt-2 border-t flex items-center justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setTargetDept(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSavingTarget} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold">
                  {isSavingTarget ? "Saving..." : "Save Annual Target"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: Department Financial Ledger                                      */}
      {/* ========================================================================= */}
      {ledgerDept && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-amber-400" />
                  <h3 className="font-heading font-bold text-base">Financial Ledger: {ledgerDept.dept.name}</h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Target: ${Number(ledgerDept.annual_budget_target).toLocaleString()} | Brought In: ${Number(ledgerDept.total_revenue).toLocaleString()} | Net: ${Number(ledgerDept.net_contribution).toLocaleString()}
                </p>
              </div>
              <button onClick={() => setLedgerDept(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs font-semibold text-slate-600">
                Logged Transactions ({ledgerDept.recent_records?.length || 0})
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openLogEntry(ledgerDept.dept.id, "revenue")}
                  className="h-7 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 border-emerald-300 gap-1"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Log Revenue
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openLogEntry(ledgerDept.dept.id, "expense")}
                  className="h-7 text-xs font-semibold text-rose-700 hover:bg-rose-50 border-rose-300 gap-1"
                >
                  <MinusCircle className="w-3.5 h-3.5" /> Log Expense
                </Button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {(ledgerDept.recent_records || []).length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Coins className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-semibold text-slate-600">No transactions recorded yet for this department</p>
                  <p className="text-xs text-slate-400 mt-1">Use the buttons above to log revenue brought in or operating expenses.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {(ledgerDept.recent_records || []).map((r) => {
                    const isRev = r.record_type === "revenue";
                    return (
                      <div key={r.id} className="py-3 flex items-center justify-between gap-3 group">
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5",
                            isRev ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                          )}>
                            {isRev ? "+$" : "-$"}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{r.title}</p>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                              <span className="font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                                {r.category}
                              </span>
                              <span>•</span>
                              <span>{r.transaction_date || "N/A"}</span>
                              {r.notes && (
                                <>
                                  <span>•</span>
                                  <span className="italic text-slate-400 truncate max-w-xs">{r.notes}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className={cn(
                            "text-sm font-black",
                            isRev ? "text-emerald-700" : "text-rose-700"
                          )}>
                            {isRev ? "+" : "-"}${Number(r.amount).toLocaleString()}
                          </span>
                          <button
                            onClick={() => handleDeleteRecord(r.id)}
                            disabled={isDeletingRecordId === r.id}
                            title="Delete entry"
                            className="text-slate-300 hover:text-rose-600 p-1 transition-colors"
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

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <Button size="sm" onClick={() => setLedgerDept(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: Department Analytics Drilldown                                   */}
      {/* ========================================================================= */}
      {selectedDept && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-heading font-bold text-base">{selectedDept.dept.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manager: {selectedDept.dept.manager_name} • {selectedDept.staff_count} Active Staff
                </p>
              </div>
              <button onClick={() => setSelectedDept(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* Financial Progress Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-center">
                  <p className="text-[10.5px] font-semibold text-slate-500 uppercase">Annual Target</p>
                  <p className="text-base font-bold text-slate-900 mt-1">
                    ${Number(selectedDept.annual_budget_target).toLocaleString()}
                  </p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-3 text-center">
                  <p className="text-[10.5px] font-semibold text-emerald-800 uppercase">Money Brought In</p>
                  <p className="text-base font-bold text-emerald-700 mt-1">
                    ${Number(selectedDept.total_revenue).toLocaleString()}
                  </p>
                </div>
                <div className="bg-rose-50 border border-rose-200/80 rounded-xl p-3 text-center">
                  <p className="text-[10.5px] font-semibold text-rose-800 uppercase">Expenses</p>
                  <p className="text-base font-bold text-rose-700 mt-1">
                    ${Number(selectedDept.total_expenses).toLocaleString()}
                  </p>
                </div>
                <div className="bg-indigo-50 border border-indigo-200/80 rounded-xl p-3 text-center">
                  <p className="text-[10.5px] font-semibold text-indigo-800 uppercase">Net Contribution</p>
                  <p className="text-base font-bold text-indigo-700 mt-1">
                    {selectedDept.net_contribution >= 0 ? "+" : ""}${Number(selectedDept.net_contribution).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Work Output & Yield */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-amber-600" /> Operational Work Output & Yield
                </h4>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Deliverables Done</p>
                    <p className="text-lg font-bold text-slate-800 mt-0.5">{selectedDept.completed_tasks} / {selectedDept.tasks_count}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">On-Time SLA</p>
                    <p className="text-lg font-bold text-slate-800 mt-0.5">{selectedDept.on_time_rate}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Revenue Yield / Task</p>
                    <p className="text-lg font-bold text-emerald-700 mt-0.5">${Number(selectedDept.revenue_per_task || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Recent Ledger Entries */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Recent Financial Transactions ({selectedDept.total_transactions_count})
                  </h4>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setLedgerDept(selectedDept);
                      setSelectedDept(null);
                    }}
                    className="h-7 text-xs gap-1"
                  >
                    <History className="w-3 h-3" /> Full Ledger
                  </Button>
                </div>

                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                  {(selectedDept.recent_records || []).length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">No transaction records logged yet.</div>
                  ) : (
                    (selectedDept.recent_records || []).map((r) => (
                      <div key={r.id} className="p-3 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-slate-800">{r.title}</p>
                          <p className="text-[11px] text-slate-400">{r.category} • {r.transaction_date}</p>
                        </div>
                        <span className={cn(
                          "font-bold",
                          r.record_type === "revenue" ? "text-emerald-700" : "text-rose-700"
                        )}>
                          {r.record_type === "revenue" ? "+" : "-"}${Number(r.amount).toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <Button size="sm" onClick={() => setSelectedDept(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
