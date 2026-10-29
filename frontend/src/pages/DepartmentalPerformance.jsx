import React, { useState, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import {
  DollarSign, TrendingUp, TrendingDown, Target, Award,
  CheckCircle2, AlertTriangle, AlertCircle, Clock, Users,
  BarChart3, FileText, Download, Search, RefreshCw,
  Coins, Briefcase, ChevronRight, X, ArrowUpDown, Filter,
  PlusCircle, MinusCircle, History, Trash2, Edit3, Sparkles,
  Upload, Landmark, PieChart, Layers, Wallet, ArrowRight, Check
} from "lucide-react";
import { ExecutivePerformance } from "@/api/entities";
import { UploadFile } from "@/api/integrations";
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
  "Payroll & Staff Costs",
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
  const [data, setData] = useState({ company_budget: null, summary: null, departments: [] });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("budget_desc");

  // Modals
  const [selectedDept, setSelectedDept] = useState(null); // Drilldown analytics
  const [ledgerDept, setLedgerDept] = useState(null); // Transaction Ledger

  // Overall Company Budget Modal (Set / Edit / Upload)
  const [showCompanyBudgetModal, setShowCompanyBudgetModal] = useState(false);
  const [cbTitle, setCbTitle] = useState("FY 2026 Master Corporate Budget");
  const [cbFiscalYear, setCbFiscalYear] = useState("2026");
  const [cbTotalBudget, setCbTotalBudget] = useState("");
  const [cbNotes, setCbNotes] = useState("");
  const [cbFileUrl, setCbFileUrl] = useState("");
  const [cbFileName, setCbFileName] = useState("");
  const [isUploadingBudgetFile, setIsUploadingBudgetFile] = useState(false);
  const [parsedCsvAllocations, setParsedCsvAllocations] = useState([]);
  const [isSavingCompanyBudget, setIsSavingCompanyBudget] = useState(false);

  // Extract Departmental Budgets Modal (Bulk Allocation from Initial Company Budget)
  const [showExtractModal, setShowExtractModal] = useState(false);
  const [extractOverallBudget, setExtractOverallBudget] = useState(0);
  const [deptAllocations, setDeptAllocations] = useState({}); // { [deptId]: { allocated_budget: "", annual_budget_target: "" } }
  const [isSavingExtractions, setIsSavingExtractions] = useState(false);

  // Single Department Budget / Target Edit Modal
  const [budgetDept, setBudgetDept] = useState(null);
  const [singleAllocatedBudget, setSingleAllocatedBudget] = useState("");
  const [singleAllocatedPct, setSingleAllocatedPct] = useState("");
  const [singleRevenueTarget, setSingleRevenueTarget] = useState("");
  const [isSavingSingleBudget, setIsSavingSingleBudget] = useState(false);

  // Financial Entry Modal (Expense / Revenue)
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryType, setEntryType] = useState("expense"); // "expense" | "revenue"
  const [entryDeptId, setEntryDeptId] = useState("");
  const [entryAmount, setEntryAmount] = useState("");
  const [entryTitle, setEntryTitle] = useState("");
  const [entryCategory, setEntryCategory] = useState("Software & Cloud Services");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [entryNotes, setEntryNotes] = useState("");
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const [isDeletingRecordId, setIsDeletingRecordId] = useState(null);

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await ExecutivePerformance.getOverview();
      setData(res || { company_budget: null, summary: null, departments: [] });
    } catch (err) {
      console.error("Failed to load departmental budget tracker:", err);
      toast({
        title: "Error Loading Data",
        description: err?.response?.data?.error || err?.message || "Failed to load executive budget intelligence.",
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
        description: "This strategic corporate budget and department tracker is restricted to the Chief Executive Officer and Super Administrator.",
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

  // ============================================================================
  // 1. OVERALL COMPANY BUDGET (SET / EDIT / UPLOAD)
  // ============================================================================
  const openCompanyBudgetModal = () => {
    const cb = data.company_budget || {};
    setCbTitle(cb.title || "FY 2026 Master Corporate Budget");
    setCbFiscalYear(cb.fiscal_year || "2026");
    setCbTotalBudget(cb.total_budget && cb.total_budget > 0 ? String(cb.total_budget) : "");
    setCbNotes(cb.notes || "");
    setCbFileUrl(cb.budget_file_url || "");
    setCbFileName(cb.budget_file_name || "");
    setParsedCsvAllocations([]);
    setShowCompanyBudgetModal(true);
  };

  // Parse CSV if user uploads a CSV budget file to auto-extract overall budget & department budgets
  const parseBudgetCsvText = (csvText) => {
    try {
      const lines = csvText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length < 2) return;

      const splitRow = (row) => {
        const result = [];
        let cur = "";
        let inQuotes = false;
        for (let i = 0; i < row.length; i++) {
          const ch = row[i];
          if (ch === '"') {
            inQuotes = !inQuotes;
          } else if (ch === "," && !inQuotes) {
            result.push(cur.trim());
            cur = "";
          } else {
            cur += ch;
          }
        }
        result.push(cur.trim());
        return result;
      };

      const headers = splitRow(lines[0]).map((h) => h.toLowerCase());
      const deptIdx = headers.findIndex((h) => h.includes("department") || h.includes("dept") || h === "name");
      const budgetIdx = headers.findIndex((h) => h.includes("extracted") || h.includes("allocated") || h.includes("budget") || h.includes("amount"));
      const targetIdx = headers.findIndex((h) => h.includes("target") || h.includes("revenue"));

      let detectedOverall = 0;
      const detectedAllocations = [];
      const existingDepts = data.departments || [];

      for (let i = 1; i < lines.length; i++) {
        const cols = splitRow(lines[i]);
        const rawName = (cols[deptIdx >= 0 ? deptIdx : 0] || "").trim();
        const rawBudget = (cols[budgetIdx >= 0 ? budgetIdx : 1] || "").replace(/[^0-9.-]/g, "");
        const rawTarget = targetIdx >= 0 ? (cols[targetIdx] || "").replace(/[^0-9.-]/g, "") : "";

        if (!rawName) continue;
        const numBudget = parseFloat(rawBudget);
        const numTarget = parseFloat(rawTarget);

        if (
          rawName.toLowerCase().includes("overall") ||
          rawName.toLowerCase().includes("company") ||
          rawName.toLowerCase().includes("total budget") ||
          rawName.toLowerCase().includes("master budget")
        ) {
          if (!isNaN(numBudget) && numBudget > 0) {
            detectedOverall = numBudget;
          }
          continue;
        }

        const matchedDept = existingDepts.find(
          (d) =>
            d.dept.name.toLowerCase() === rawName.toLowerCase() ||
            (d.dept.code && d.dept.code.toLowerCase() === rawName.toLowerCase())
        );

        if (matchedDept && !isNaN(numBudget) && numBudget >= 0) {
          detectedAllocations.push({
            department_id: matchedDept.dept.id,
            department_name: matchedDept.dept.name,
            allocated_budget: numBudget,
            annual_budget_target: !isNaN(numTarget) && numTarget >= 0 ? numTarget : matchedDept.annual_budget_target,
          });
        }
      }

      if (detectedOverall > 0) {
        setCbTotalBudget(String(detectedOverall));
      } else if (detectedAllocations.length > 0 && (!cbTotalBudget || Number(cbTotalBudget) === 0)) {
        const sumExtracted = detectedAllocations.reduce((s, a) => s + a.allocated_budget, 0);
        if (sumExtracted > 0) setCbTotalBudget(String(sumExtracted));
      }

      if (detectedAllocations.length > 0) {
        setParsedCsvAllocations(detectedAllocations);
        toast({
          title: "Budget CSV Parsed",
          description: `Detected ${detectedAllocations.length} department budget allocation(s) from the uploaded file.`,
        });
      }
    } catch (e) {
      console.warn("CSV parse notice:", e);
    }
  };

  const handleUploadBudgetFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // If CSV, read client-side to auto-extract values as convenience
    if (file.name.toLowerCase().endsWith(".csv")) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          parseBudgetCsvText(String(evt.target.result));
        }
      };
      reader.readAsText(file);
    }

    setIsUploadingBudgetFile(true);
    try {
      const uploaded = await UploadFile({ file });
      setCbFileUrl(uploaded.file_url);
      setCbFileName(uploaded.file_name);
      toast({
        title: "Budget Document Uploaded",
        description: `${uploaded.file_name} attached to the Overall Company Budget.`,
      });
    } catch (err) {
      toast({
        title: "Upload Failed",
        description: err?.message || "Could not upload the budget file.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingBudgetFile(false);
      e.target.value = "";
    }
  };

  const handleDownloadBudgetTemplate = () => {
    const overallVal = data.summary?.overall_company_budget || 500000;
    const rows = [
      {
        "Department": "OVERALL COMPANY BUDGET",
        "Code": "MASTER",
        "Extracted Department Budget ($)": overallVal,
        "Annual Revenue Target ($)": data.summary?.total_annual_target || 0,
      },
      ...(data.departments || []).map((d) => ({
        "Department": d.dept.name,
        "Code": d.dept.code || "",
        "Extracted Department Budget ($)": d.allocated_budget || 0,
        "Annual Revenue Target ($)": d.annual_budget_target || 0,
      })),
    ];
    exportCSV(rows, `Company_Budget_Allocation_Template_${cbFiscalYear || "2026"}.csv`);
  };

  const handleSaveCompanyBudget = async (e, openExtractAfter = false) => {
    if (e) e.preventDefault();
    const val = parseFloat(cbTotalBudget);
    if (isNaN(val) || val < 0) {
      toast({
        title: "Invalid Budget Amount",
        description: "Please enter a valid dollar amount for the Overall Company Budget.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingCompanyBudget(true);
    try {
      const payload = {
        title: cbTitle.trim() || `FY ${cbFiscalYear} Master Corporate Budget`,
        fiscal_year: cbFiscalYear.trim() || "2026",
        total_budget: val,
        currency: "USD",
        notes: cbNotes.trim(),
        budget_file_url: cbFileUrl,
        budget_file_name: cbFileName,
      };
      if (parsedCsvAllocations.length > 0) {
        payload.allocations = parsedCsvAllocations;
      }

      await ExecutivePerformance.saveCompanyBudget(payload);
      toast({
        title: "Overall Company Budget Saved",
        description: `Company master budget set to $${val.toLocaleString()}${
          parsedCsvAllocations.length > 0 ? ` with ${parsedCsvAllocations.length} departmental budgets extracted.` : "."
        }`,
      });
      setShowCompanyBudgetModal(false);
      await loadData();

      if (openExtractAfter) {
        openExtractBudgetsModal(val);
      }
    } catch (err) {
      toast({
        title: "Failed to Save Overall Budget",
        description: err?.response?.data?.error || err?.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSavingCompanyBudget(false);
    }
  };

  // ============================================================================
  // 2. EXTRACT DEPARTMENTAL BUDGETS FROM OVERALL INITIAL BUDGET
  // ============================================================================
  const openExtractBudgetsModal = (overrideOverall = null) => {
    const currentOverall =
      overrideOverall !== null
        ? Number(overrideOverall)
        : Number(data.summary?.overall_company_budget || 0);
    setExtractOverallBudget(currentOverall);

    const map = {};
    (data.departments || []).forEach((d) => {
      map[d.dept.id] = {
        allocated_budget: d.allocated_budget > 0 ? String(d.allocated_budget) : "0",
        annual_budget_target: d.annual_budget_target > 0 ? String(d.annual_budget_target) : "0",
      };
    });
    setDeptAllocations(map);
    setShowExtractModal(true);
  };

  const handleExtractAmountChange = (deptId, dollarValue) => {
    setDeptAllocations((prev) => ({
      ...prev,
      [deptId]: {
        ...(prev[deptId] || {}),
        allocated_budget: dollarValue,
      },
    }));
  };

  const handleExtractPctChange = (deptId, pctValue) => {
    const pct = parseFloat(pctValue);
    const overall = Number(extractOverallBudget) || 0;
    const computedDollar = !isNaN(pct) && overall > 0 ? Math.round((pct / 100) * overall * 100) / 100 : 0;
    setDeptAllocations((prev) => ({
      ...prev,
      [deptId]: {
        ...(prev[deptId] || {}),
        allocated_budget: String(computedDollar),
      },
    }));
  };

  const handleDistributeEqually = () => {
    const depts = data.departments || [];
    const overall = Number(extractOverallBudget) || 0;
    if (depts.length === 0 || overall <= 0) {
      toast({
        title: "Set Overall Budget First",
        description: "Please enter a positive Overall Company Budget above before distributing.",
        variant: "destructive",
      });
      return;
    }
    const perDept = Math.floor((overall / depts.length) * 100) / 100;
    const next = {};
    depts.forEach((d, idx) => {
      // Give rounding remainder to first department so sum matches 100%
      const amt = idx === 0 ? Math.round((overall - perDept * (depts.length - 1)) * 100) / 100 : perDept;
      next[d.dept.id] = {
        allocated_budget: String(amt),
        annual_budget_target: deptAllocations[d.dept.id]?.annual_budget_target || String(d.annual_budget_target || 0),
      };
    });
    setDeptAllocations(next);
  };

  const handleDistributeByStaff = () => {
    const depts = data.departments || [];
    const overall = Number(extractOverallBudget) || 0;
    if (depts.length === 0 || overall <= 0) {
      toast({
        title: "Set Overall Budget First",
        description: "Please enter a positive Overall Company Budget above before distributing.",
        variant: "destructive",
      });
      return;
    }
    const totalStaff = depts.reduce((sum, d) => sum + Math.max(1, d.staff_count || 1), 0);
    const next = {};
    let runningTotal = 0;
    depts.forEach((d, idx) => {
      const weight = Math.max(1, d.staff_count || 1);
      const amt =
        idx === depts.length - 1
          ? Math.max(0, Math.round((overall - runningTotal) * 100) / 100)
          : Math.round(((overall * weight) / totalStaff) * 100) / 100;
      runningTotal += amt;
      next[d.dept.id] = {
        allocated_budget: String(amt),
        annual_budget_target: deptAllocations[d.dept.id]?.annual_budget_target || String(d.annual_budget_target || 0),
      };
    });
    setDeptAllocations(next);
  };

  const handleSaveExtractedBudgets = async (e) => {
    e.preventDefault();
    const overallVal = Math.max(0, parseFloat(extractOverallBudget) || 0);
    const allocationsPayload = Object.entries(deptAllocations).map(([department_id, vals]) => ({
      department_id,
      allocated_budget: Math.max(0, parseFloat(vals.allocated_budget) || 0),
      annual_budget_target: Math.max(0, parseFloat(vals.annual_budget_target) || 0),
    }));

    setIsSavingExtractions(true);
    try {
      await ExecutivePerformance.extractDepartmentalBudgets({
        overall_budget: overallVal,
        allocations: allocationsPayload,
      });

      const sumExtracted = allocationsPayload.reduce((s, a) => s + a.allocated_budget, 0);
      toast({
        title: "Departmental Budgets Extracted",
        description: `Allocated $${sumExtracted.toLocaleString()} across ${allocationsPayload.length} departments from the $${overallVal.toLocaleString()} company budget.`,
      });
      setShowExtractModal(false);
      loadData();
    } catch (err) {
      toast({
        title: "Error Extracting Budgets",
        description: err?.response?.data?.error || err?.message || "Failed to save departmental budget allocations.",
        variant: "destructive",
      });
    } finally {
      setIsSavingExtractions(false);
    }
  };

  // ============================================================================
  // 3. SINGLE DEPARTMENT BUDGET & TARGET MODAL
  // ============================================================================
  const openSingleDeptBudgetModal = (dept) => {
    setBudgetDept(dept);
    const overall = Number(data.summary?.overall_company_budget || 0);
    const alloc = Number(dept.allocated_budget || 0);
    setSingleAllocatedBudget(alloc > 0 ? String(alloc) : "");
    setSingleAllocatedPct(overall > 0 && alloc > 0 ? String(Math.round((alloc / overall) * 1000) / 10) : "");
    setSingleRevenueTarget(dept.annual_budget_target > 0 ? String(dept.annual_budget_target) : "");
  };

  const handleSingleBudgetDollarChange = (val) => {
    setSingleAllocatedBudget(val);
    const overall = Number(data.summary?.overall_company_budget || 0);
    const num = parseFloat(val);
    if (overall > 0 && !isNaN(num)) {
      setSingleAllocatedPct(String(Math.round((num / overall) * 1000) / 10));
    } else {
      setSingleAllocatedPct("");
    }
  };

  const handleSingleBudgetPctChange = (val) => {
    setSingleAllocatedPct(val);
    const overall = Number(data.summary?.overall_company_budget || 0);
    const pct = parseFloat(val);
    if (overall > 0 && !isNaN(pct)) {
      setSingleAllocatedBudget(String(Math.round((pct / 100) * overall * 100) / 100));
    }
  };

  const handleSaveSingleBudget = async (e) => {
    e.preventDefault();
    if (!budgetDept) return;
    const allocVal = Math.max(0, parseFloat(singleAllocatedBudget || 0) || 0);
    const targetVal = Math.max(0, parseFloat(singleRevenueTarget || 0) || 0);

    setIsSavingSingleBudget(true);
    try {
      await ExecutivePerformance.updateBudget(budgetDept.dept.id, {
        allocated_budget: allocVal,
        annual_budget_target: targetVal,
      });
      toast({
        title: "Department Budget Updated",
        description: `${budgetDept.dept.name} extracted budget set to $${allocVal.toLocaleString()}.`,
      });
      setBudgetDept(null);
      loadData();
    } catch (err) {
      toast({
        title: "Error Updating Budget",
        description: err?.response?.data?.error || err?.message || "Could not update department budget.",
        variant: "destructive",
      });
    } finally {
      setIsSavingSingleBudget(false);
    }
  };

  // ============================================================================
  // 4. LOG EXPENSE / REVENUE TRANSACTIONS
  // ============================================================================
  const openLogEntry = (deptId = "", type = "expense") => {
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
        title: entryType === "expense" ? "Expense Recorded" : "Revenue Inflow Recorded",
        description: `Successfully logged $${val.toLocaleString()} ${entryType} for the department.`,
      });

      setShowEntryModal(false);
      loadData();
    } catch (err) {
      toast({
        title: "Failed to Record Entry",
        description: err?.response?.data?.error || err?.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSavingEntry(false);
    }
  };

  const handleDeleteRecord = async (recordId) => {
    if (!window.confirm("Are you sure you want to remove this financial entry? This will update department and company totals immediately.")) {
      return;
    }
    setIsDeletingRecordId(recordId);
    try {
      await ExecutivePerformance.deleteFinancialRecord(recordId);
      toast({ title: "Entry Removed", description: "The transaction has been deleted and totals updated." });
      loadData();
      if (ledgerDept) {
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

  const handleExportCSV = () => {
    if (!data.departments || data.departments.length === 0) return;
    const summaryRow = {
      "Department": "OVERALL COMPANY MASTER SUMMARY",
      "Code": "CORPORATE",
      "Manager": "CEO / Executive",
      "Overall Company Budget ($)": data.summary?.overall_company_budget || 0,
      "Extracted Dept Budget ($)": data.summary?.total_allocated_budget || 0,
      "Share of Company Budget (%)": data.summary?.allocation_pct || 0,
      "Total Spending / Expenses ($)": data.summary?.total_expenses || 0,
      "Remaining Dept Budget ($)": data.summary?.remaining_allocated_budget || 0,
      "Budget Utilization (%)": data.summary?.allocated_burn_pct || 0,
      "Budget Status": `${data.summary?.unallocated_budget || 0} Unallocated Reserve`,
      "Money Brought In (Inflow) ($)": data.summary?.total_revenue || 0,
      "Annual Revenue Target ($)": data.summary?.total_annual_target || 0,
      "Net Position ($)": data.summary?.net_contribution || 0,
      "Tasks Completed": data.summary?.total_tasks_completed || 0,
    };
    const rows = [
      summaryRow,
      ...data.departments.map((d) => ({
        "Department": d.dept.name,
        "Code": d.dept.code || "",
        "Manager": d.dept.manager_name || "Unassigned",
        "Overall Company Budget ($)": data.summary?.overall_company_budget || 0,
        "Extracted Dept Budget ($)": d.allocated_budget,
        "Share of Company Budget (%)": d.share_of_company_budget_pct,
        "Total Spending / Expenses ($)": d.total_expenses,
        "Remaining Dept Budget ($)": d.remaining_budget,
        "Budget Utilization (%)": d.budget_utilization_pct,
        "Budget Status": d.spending_status,
        "Money Brought In (Inflow) ($)": d.total_revenue,
        "Annual Revenue Target ($)": d.annual_budget_target,
        "Net Position ($)": d.net_contribution,
        "Tasks Completed": d.completed_tasks,
      })),
    ];
    exportCSV(rows, `Executive_Company_And_Department_Budgets_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-600">Loading master corporate budget & departmental tracker...</p>
      </div>
    );
  }

  const { company_budget, summary, departments } = data;
  const overallCompanyBudget = Number(summary?.overall_company_budget || 0);
  const totalAllocatedBudget = Number(summary?.total_allocated_budget || 0);
  const unallocatedBudget = Number(summary?.unallocated_budget || 0);
  const totalCompanyExpenses = Number(summary?.total_expenses || 0);
  const remainingOverallBudget = Number(summary?.remaining_overall_budget || 0);
  const remainingAllocatedBudget = Number(summary?.remaining_allocated_budget || 0);

  // Filter & Sort Departments
  const filteredDepts = (departments || []).filter((d) => {
    const q = searchQuery.toLowerCase();
    const nameMatch =
      d.dept.name?.toLowerCase().includes(q) ||
      d.dept.code?.toLowerCase().includes(q) ||
      d.dept.manager_name?.toLowerCase().includes(q);
    if (!nameMatch) return false;

    if (statusFilter === "within_budget" && d.spending_status !== "Within Budget") return false;
    if (statusFilter === "near_limit" && d.spending_status !== "Near Limit") return false;
    if (statusFilter === "over_budget" && d.spending_status !== "Over Budget" && d.spending_status !== "Unbudgeted Spend") return false;
    if (statusFilter === "unallocated" && d.allocated_budget > 0) return false;

    return true;
  });

  const sortedDepts = [...filteredDepts].sort((a, b) => {
    if (sortBy === "budget_desc") return b.allocated_budget - a.allocated_budget;
    if (sortBy === "expenses_desc") return b.total_expenses - a.total_expenses;
    if (sortBy === "remaining_desc") return b.remaining_budget - a.remaining_budget;
    if (sortBy === "utilization_desc") return b.budget_utilization_pct - a.budget_utilization_pct;
    if (sortBy === "revenue_desc") return b.total_revenue - a.total_revenue;
    if (sortBy === "profit_desc") return b.net_contribution - a.net_contribution;
    return a.dept.name.localeCompare(b.dept.name);
  });

  // Live calculations for the Bulk Extract Modal
  const modalTotalExtracted = Object.values(deptAllocations).reduce(
    (sum, item) => sum + (Math.max(0, parseFloat(item?.allocated_budget) || 0)),
    0
  );
  const modalUnallocated = Math.round(((Number(extractOverallBudget) || 0) - modalTotalExtracted) * 100) / 100;
  const modalExtractionPct =
    Number(extractOverallBudget) > 0
      ? Math.round((modalTotalExtracted / Number(extractOverallBudget)) * 1000) / 10
      : 0;

  // Selected department inside the Log Expense/Revenue Modal
  const activeEntryDept = (departments || []).find((d) => d.dept.id === entryDeptId);

  return (
    <div className="space-y-6 pb-12">
      {/* ===================================================================== */}
      {/* 1. EXECUTIVE MASTER COMPANY BUDGET HERO & COMMAND CENTER               */}
      {/* ===================================================================== */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 lg:p-8 text-white relative overflow-hidden shadow-xl border border-slate-700/50">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full -translate-y-1/3 translate-x-1/4 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30 px-2.5 py-0.5 rounded-full">
                <Landmark className="w-3.5 h-3.5" /> CEO & Executive Budget Command
              </span>
              <span className="text-xs text-slate-300 font-medium">
                {company_budget?.title || "FY 2026 Master Corporate Budget"}
              </span>
              {company_budget?.budget_file_url && (
                <a
                  href={company_budget.budget_file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-white/15 transition-colors"
                >
                  <FileText className="w-3 h-3" /> {company_budget.budget_file_name || "Uploaded Budget Document"}
                </a>
              )}
            </div>
            <h1 className="text-2xl lg:text-3xl font-heading font-extrabold text-white tracking-tight">
              Corporate Master Budget & Departmental Tracker
            </h1>
            <p className="text-slate-300 text-sm max-w-3xl mt-1.5 leading-relaxed">
              Set or upload the overall initial company budget, extract departmental budgets from the master pool, and track departmental spending, expenses, remaining balances, and inflows in real time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={openCompanyBudgetModal}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold h-9 gap-1.5 shadow-sm"
            >
              <Wallet className="w-4 h-4" />
              {overallCompanyBudget > 0 ? "Edit / Upload Overall Budget" : "Set / Upload Overall Budget"}
            </Button>
            <Button
              size="sm"
              onClick={() => openExtractBudgetsModal()}
              className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold h-9 gap-1.5 shadow-sm"
            >
              <Layers className="w-4 h-4" /> Extract Dept Budgets
            </Button>
            <Button
              size="sm"
              onClick={() => openLogEntry("", "expense")}
              className="bg-rose-500 hover:bg-rose-600 text-white font-semibold h-9 gap-1.5 shadow-sm"
            >
              <MinusCircle className="w-4 h-4" /> Log Expense
            </Button>
            <Button
              size="sm"
              onClick={() => openLogEntry("", "revenue")}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold h-9 gap-1.5 shadow-sm"
            >
              <PlusCircle className="w-4 h-4" /> Log Inflow
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-9 px-2.5"
              title="Refresh Data"
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

        {/* Prompt if Overall Company Budget hasn't been entered yet */}
        {overallCompanyBudget <= 0 && (
          <div className="mt-6 bg-amber-500/15 border border-amber-400/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-amber-200">
                  Step 1: Set or Upload the Overall Company Budget
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  No master corporate budget has been configured yet. Enter or upload the company&apos;s initial overall budget first, then extract individual departmental budgets from it.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={openCompanyBudgetModal}
              className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold shrink-0 gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" /> Enter / Upload Overall Budget
            </Button>
          </div>
        )}

        {/* Executive High-Level Corporate Budget & Spending Totals Bar */}
        {summary && (
          <div className="mt-6 pt-6 border-t border-slate-700/60 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* 1. Overall Company Budget */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <div className="flex items-center justify-between">
                <p className="text-[10.5px] font-semibold text-amber-300 uppercase tracking-wider">Overall Company Budget</p>
                <button
                  onClick={openCompanyBudgetModal}
                  className="text-slate-400 hover:text-white transition-colors"
                  title="Edit Overall Company Budget"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xl lg:text-2xl font-black text-white mt-1">
                ${overallCompanyBudget.toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                {company_budget?.updated_by_name
                  ? `Set by ${company_budget.updated_by_name}`
                  : `Initial Master Pool (${company_budget?.fiscal_year || "2026"})`}
              </p>
            </div>

            {/* 2. Extracted Departmental Budgets */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <div className="flex items-center justify-between">
                <p className="text-[10.5px] font-semibold text-indigo-300 uppercase tracking-wider">Extracted to Depts</p>
                <button
                  onClick={() => openExtractBudgetsModal()}
                  className="text-slate-400 hover:text-white transition-colors"
                  title="Extract Departmental Budgets"
                >
                  <Layers className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xl lg:text-2xl font-black text-indigo-300 mt-1">
                ${totalAllocatedBudget.toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-300 mt-0.5">
                {overallCompanyBudget > 0 ? `${summary.allocation_pct}% of Overall Budget` : `Across ${summary.department_count} depts`}
              </p>
            </div>

            {/* 3. Unallocated Company Reserve */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-[10.5px] font-semibold text-slate-300 uppercase tracking-wider">Unallocated Pool</p>
              <p className={cn(
                "text-xl lg:text-2xl font-black mt-1",
                unallocatedBudget < 0 ? "text-rose-400" : "text-amber-300"
              )}>
                {unallocatedBudget < 0 ? "-" : ""}${Math.abs(unallocatedBudget).toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {unallocatedBudget < 0
                  ? "Over-allocated vs initial budget!"
                  : "Available in master budget"}
              </p>
            </div>

            {/* 4. Total Company Spending / Expenses */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-[10.5px] font-semibold text-rose-300 uppercase tracking-wider">Total Spending (Expenses)</p>
              <p className="text-xl lg:text-2xl font-black text-rose-400 mt-1">
                ${totalCompanyExpenses.toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-300 mt-0.5">
                {overallCompanyBudget > 0
                  ? `${summary.overall_burn_pct}% of Overall (${summary.allocated_burn_pct}% of Dept Budgets)`
                  : `${summary.allocated_burn_pct}% of Extracted Budgets`}
              </p>
            </div>

            {/* 5. Remaining Spendable Budget */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-[10.5px] font-semibold text-emerald-300 uppercase tracking-wider">Remaining Budget</p>
              <p className={cn(
                "text-xl lg:text-2xl font-black mt-1",
                (overallCompanyBudget > 0 ? remainingOverallBudget : remainingAllocatedBudget) < 0
                  ? "text-rose-400"
                  : "text-emerald-300"
              )}>
                ${(overallCompanyBudget > 0 ? remainingOverallBudget : remainingAllocatedBudget).toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {overallCompanyBudget > 0
                  ? `$${remainingAllocatedBudget.toLocaleString()} left in dept budgets`
                  : "Remaining in dept budgets"}
              </p>
            </div>

            {/* 6. Total Money Brought In (Inflow) & Net */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-[10.5px] font-semibold text-emerald-400 uppercase tracking-wider">Inflow / Revenue</p>
              <p className="text-xl lg:text-2xl font-black text-emerald-400 mt-1">
                ${Number(summary.total_revenue || 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-300 mt-0.5">
                Net: {summary.net_contribution >= 0 ? "+" : ""}${Number(summary.net_contribution || 0).toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 2. MASTER BUDGET EXTRACTION & SPENDING VISUAL BREAKDOWN               */}
      {/* ===================================================================== */}
      {summary && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 lg:p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-heading font-bold text-slate-900 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-indigo-600" />
                Overall Company Budget Extraction & Spending Breakdown
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                How the initial corporate budget (${overallCompanyBudget.toLocaleString()}) is extracted across departments and how much has been spent so far.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={openCompanyBudgetModal}
                className="h-8 text-xs font-semibold border-slate-300 gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                Edit Overall Budget
              </Button>
              <Button
                size="sm"
                onClick={() => openExtractBudgetsModal()}
                className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
              >
                <Layers className="w-3.5 h-3.5" />
                Extract / Allocate Dept Budgets
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar 1: Extraction of Departmental Budgets from Initial Company Budget */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/70 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 uppercase tracking-wider">
                  1. Departmental Budget Extraction (From Initial Budget)
                </span>
                <span className="font-bold text-indigo-700">
                  ${totalAllocatedBudget.toLocaleString()} / ${overallCompanyBudget.toLocaleString()} ({summary.allocation_pct}%)
                </span>
              </div>

              {/* Stacked Bar of Departments */}
              <div className="w-full h-3.5 bg-slate-200 rounded-full overflow-hidden flex">
                {(departments || []).map((d) => {
                  const base = Math.max(overallCompanyBudget, totalAllocatedBudget, 1);
                  const pct = Math.max(0, (d.allocated_budget / base) * 100);
                  if (pct <= 0) return null;
                  return (
                    <div
                      key={d.dept.id}
                      style={{
                        width: `${pct}%`,
                        backgroundColor: d.dept.color || "#4f46e5",
                      }}
                      title={`${d.dept.name}: $${Number(d.allocated_budget).toLocaleString()} (${d.share_of_company_budget_pct}%)`}
                      className="h-full border-r border-white/40 transition-all duration-300"
                    />
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600 pt-1 gap-2">
                <span>
                  Extracted to Depts: <strong className="text-slate-900">${totalAllocatedBudget.toLocaleString()}</strong>
                </span>
                <span>
                  Unallocated Reserve:{" "}
                  <strong className={cn(unallocatedBudget < 0 ? "text-rose-600" : "text-emerald-700")}>
                    {unallocatedBudget < 0 ? `Over by $${Math.abs(unallocatedBudget).toLocaleString()}` : `$${unallocatedBudget.toLocaleString()} remaining`}
                  </strong>
                </span>
              </div>
            </div>

            {/* Bar 2: Company-Wide Spending (Expenses) vs Overall & Extracted Budget */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/70 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 uppercase tracking-wider">
                  2. Total Company Spending / Expenses vs Budget
                </span>
                <span className={cn(
                  "font-bold",
                  summary.allocated_burn_pct > 100 ? "text-rose-600" : "text-slate-900"
                )}>
                  ${totalCompanyExpenses.toLocaleString()} Spent ({summary.allocated_burn_pct}% of Extracted)
                </span>
              </div>

              <div className="w-full h-3.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    summary.allocated_burn_pct > 100
                      ? "bg-rose-600"
                      : summary.allocated_burn_pct >= 85
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  )}
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        overallCompanyBudget > 0 && totalAllocatedBudget <= 0
                          ? summary.overall_burn_pct
                          : summary.allocated_burn_pct
                      )
                    )}%`,
                  }}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600 pt-1 gap-2">
                <span>
                  Remaining in Extracted Budgets:{" "}
                  <strong className={cn(remainingAllocatedBudget < 0 ? "text-rose-600" : "text-emerald-700")}>
                    ${remainingAllocatedBudget.toLocaleString()}
                  </strong>
                </span>
                <span>
                  Remaining in Overall Company Budget:{" "}
                  <strong className={cn(remainingOverallBudget < 0 ? "text-rose-600" : "text-slate-900")}>
                    ${remainingOverallBudget.toLocaleString()}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Department Allocation Chips (Quick View & Click to Edit Extracted Budget) */}
          <div className="pt-1">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Departmental Budget Extractions (Click any department to adjust its extracted budget)
            </p>
            <div className="flex flex-wrap gap-2">
              {(departments || []).map((d) => (
                <button
                  key={d.dept.id}
                  type="button"
                  onClick={() => openSingleDeptBudgetModal(d)}
                  className="inline-flex items-center gap-2 text-xs bg-white hover:bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shadow-2xs transition-all"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: d.dept.color || "#1e3a5f" }}
                  />
                  <span className="font-bold text-slate-800">{d.dept.name}:</span>
                  <span className="font-extrabold text-indigo-700">
                    ${Number(d.allocated_budget || 0).toLocaleString()}
                  </span>
                  {overallCompanyBudget > 0 && (
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {d.share_of_company_budget_pct}%
                    </span>
                  )}
                  <span className="text-[10px] text-rose-600 font-medium">
                    (${Number(d.total_expenses || 0).toLocaleString()} spent)
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. FILTER AND SORTING TOOLBAR                                         */}
      {/* ===================================================================== */}
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
          {/* Spending / Budget Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-xs w-44">
              <SelectValue placeholder="Budget Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Budget Statuses</SelectItem>
              <SelectItem value="within_budget">Within Budget (&lt;85%)</SelectItem>
              <SelectItem value="near_limit">Near Budget Limit (85-100%)</SelectItem>
              <SelectItem value="over_budget">Over Budget (&gt;100%)</SelectItem>
              <SelectItem value="unallocated">No Budget Extracted Yet</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort By Dropdown */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-9 text-xs w-52 font-medium">
              <ArrowUpDown className="w-3 h-3 mr-1 text-slate-400" />
              <SelectValue placeholder="Sort Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="budget_desc">Highest Extracted Budget</SelectItem>
              <SelectItem value="expenses_desc">Highest Spending / Expenses</SelectItem>
              <SelectItem value="remaining_desc">Most Remaining Budget</SelectItem>
              <SelectItem value="utilization_desc">Highest Budget Burn %</SelectItem>
              <SelectItem value="revenue_desc">Most Money Brought In (Inflow)</SelectItem>
              <SelectItem value="profit_desc">Highest Net Contribution</SelectItem>
              <SelectItem value="name_asc">Department Name (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4. DEPARTMENTAL BUDGET, SPENDING & INFLOW CARDS                       */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {sortedDepts.map((d) => {
          const isOverBudget = d.spending_status === "Over Budget" || d.spending_status === "Unbudgeted Spend";
          const isNearLimit = d.spending_status === "Near Limit";
          const isWithinBudget = d.spending_status === "Within Budget";

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
                {/* Header: Share of Overall Budget + Name + Spending Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                        {overallCompanyBudget > 0
                          ? `${d.share_of_company_budget_pct}% of Company Budget`
                          : `Dept Budget`}
                      </span>
                      {d.dept.code && (
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {d.dept.code}
                        </span>
                      )}
                    </div>
                    <h3 className="font-heading font-bold text-slate-900 text-base mt-1.5 truncate">
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
                    isOverBudget
                      ? "bg-rose-100 text-rose-800 border border-rose-200"
                      : isNearLimit
                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                      : isWithinBudget
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      : "bg-slate-100 text-slate-600"
                  )}>
                    {d.spending_status}
                  </span>
                </div>

                {/* Extracted Department Budget vs Spending Progress Bar */}
                <div className="mt-4 bg-slate-50 border border-slate-200/70 rounded-xl p-3">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-700 flex items-center gap-1">
                      <Wallet className="w-3.5 h-3.5 text-indigo-600" /> Dept Budget Spending
                    </span>
                    <span className={cn(
                      "font-bold",
                      isOverBudget ? "text-rose-600" : "text-slate-900"
                    )}>
                      {d.allocated_budget > 0 ? `${d.budget_utilization_pct}% Spent` : "No Budget Extracted"}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        isOverBudget
                          ? "bg-rose-600"
                          : isNearLimit
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      )}
                      style={{
                        width: `${
                          d.allocated_budget > 0
                            ? Math.min(100, Math.max(0, d.budget_utilization_pct))
                            : d.total_expenses > 0
                            ? 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-600 mt-2">
                    <span>
                      Extracted: <strong className="text-indigo-700 font-bold">${Number(d.allocated_budget).toLocaleString()}</strong>
                    </span>
                    <span>
                      Spent: <strong className="text-rose-700 font-bold">${Number(d.total_expenses).toLocaleString()}</strong>
                    </span>
                  </div>
                </div>

                {/* 4-Pillar Financial Grid: Extracted Budget, Expenses, Remaining Balance, Inflow */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg p-2.5">
                    <p className="text-[10px] font-semibold text-indigo-800 uppercase tracking-wide">
                      Extracted Budget
                    </p>
                    <p className="text-sm font-black text-indigo-700 mt-0.5">
                      ${Number(d.allocated_budget).toLocaleString()}
                    </p>
                  </div>

                  <div className="bg-rose-50/60 border border-rose-100 rounded-lg p-2.5">
                    <p className="text-[10px] font-semibold text-rose-800 uppercase tracking-wide">
                      Total Expenses
                    </p>
                    <p className="text-sm font-black text-rose-700 mt-0.5">
                      ${Number(d.total_expenses).toLocaleString()}
                    </p>
                  </div>

                  <div className={cn(
                    "border rounded-lg p-2.5",
                    d.remaining_budget < 0
                      ? "bg-rose-50/80 border-rose-200"
                      : "bg-emerald-50/60 border-emerald-100"
                  )}>
                    <p className="text-[10px] font-semibold text-slate-700 uppercase tracking-wide">
                      {d.remaining_budget < 0 ? "Over Budget By" : "Remaining Budget"}
                    </p>
                    <p className={cn(
                      "text-sm font-black mt-0.5",
                      d.remaining_budget < 0 ? "text-rose-700" : "text-emerald-700"
                    )}>
                      {d.remaining_budget < 0 ? "-" : ""}${Math.abs(Number(d.remaining_budget)).toLocaleString()}
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5">
                    <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                      Inflow / Revenue
                    </p>
                    <p className="text-sm font-black text-emerald-700 mt-0.5">
                      ${Number(d.total_revenue).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Task & Net Contribution Footer Line */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span><strong>{d.completed_tasks}</strong> / {d.tasks_count} tasks done</span>
                  </div>
                  <div className="text-[11px] font-medium">
                    Net:{" "}
                    <strong className={cn(d.net_contribution >= 0 ? "text-emerald-700" : "text-rose-600")}>
                      {d.net_contribution >= 0 ? "+" : ""}${Number(d.net_contribution).toLocaleString()}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-3 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openSingleDeptBudgetModal(d)}
                    className="h-7 px-2 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 border-indigo-200 gap-1"
                    title="Extract or edit department budget from company pool"
                  >
                    <Edit3 className="w-3 h-3" /> Budget
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
                    variant="outline"
                    onClick={() => openLogEntry(d.dept.id, "revenue")}
                    className="h-7 px-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 border-emerald-200 gap-1"
                  >
                    <PlusCircle className="w-3 h-3" /> Inflow
                  </Button>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setLedgerDept(d)}
                    className="h-7 px-2 text-[11px] font-medium text-slate-600 hover:text-slate-900 gap-1"
                    title="View Expense & Inflow Ledger"
                  >
                    <History className="w-3 h-3 text-slate-400" /> ({d.total_transactions_count})
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedDept(d)}
                    title="Inspect Full Department Budget & Spending Analytics"
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
            Try adjusting your search keywords or clearing the budget status filter.
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL A: Set / Edit / Upload Overall Company Budget                       */}
      {/* ========================================================================= */}
      {showCompanyBudgetModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Landmark className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-heading font-bold text-base">
                    Overall Company Master Budget
                  </h3>
                  <p className="text-xs text-slate-300">
                    Type, edit, or upload the initial company-wide budget
                  </p>
                </div>
              </div>
              <button onClick={() => setShowCompanyBudgetModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => handleSaveCompanyBudget(e, false)} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700">Budget Title</Label>
                  <Input
                    type="text"
                    required
                    value={cbTitle}
                    onChange={(e) => setCbTitle(e.target.value)}
                    placeholder="e.g. FY 2026 Master Corporate Budget"
                    className="mt-1 text-xs font-medium"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Fiscal Year</Label>
                  <Input
                    type="text"
                    required
                    value={cbFiscalYear}
                    onChange={(e) => setCbFiscalYear(e.target.value)}
                    placeholder="2026"
                    className="mt-1 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4">
                <Label className="text-xs font-bold text-slate-900">
                  Overall Initial Company Budget ($ USD)
                </Label>
                <p className="text-[11px] text-slate-600 mt-0.5 mb-2">
                  Enter the total corporate budget for the company. Departmental budgets will be extracted from this initial budget pool.
                </p>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={cbTotalBudget}
                    onChange={(e) => setCbTotalBudget(e.target.value)}
                    placeholder="e.g. 1000000"
                    className="pl-8 text-lg font-black bg-white h-11"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-slate-500 font-bold">$</span>
                </div>
                {totalAllocatedBudget > 0 && (
                  <p className="text-[11px] text-slate-600 mt-2">
                    Currently extracted to departments: <strong>${totalAllocatedBudget.toLocaleString()}</strong>
                    {cbTotalBudget && !isNaN(parseFloat(cbTotalBudget)) && (
                      <>
                        {" "}• Unallocated Pool:{" "}
                        <strong className={cn(parseFloat(cbTotalBudget) - totalAllocatedBudget < 0 ? "text-rose-600" : "text-emerald-700")}>
                          ${(parseFloat(cbTotalBudget) - totalAllocatedBudget).toLocaleString()}
                        </strong>
                      </>
                    )}
                  </p>
                )}
              </div>

              {/* Upload Official Budget File or CSV */}
              <div className="border border-dashed border-slate-300 rounded-xl p-4 bg-slate-50/60 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5 text-indigo-600" />
                      Upload Budget Document or CSV Spreadsheet (Optional)
                    </Label>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Upload a PDF, Excel, Word, or CSV budget file. Uploading a CSV also auto-extracts departmental budgets!
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadBudgetTemplate}
                    className="h-7 text-[11px] shrink-0 gap-1"
                  >
                    <Download className="w-3 h-3" /> CSV Template
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".csv,.xlsx,.xls,.pdf,.doc,.docx"
                    onChange={handleUploadBudgetFile}
                    disabled={isUploadingBudgetFile}
                    className="text-xs bg-white cursor-pointer"
                  />
                </div>

                {cbFileName && (
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-xs text-emerald-900">
                    <span className="truncate font-semibold flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      {cbFileName}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCbFileUrl("");
                        setCbFileName("");
                        setParsedCsvAllocations([]);
                      }}
                      className="text-slate-400 hover:text-rose-600 ml-2"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {parsedCsvAllocations.length > 0 && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 text-xs text-indigo-900">
                    <p className="font-bold">
                      Ready to auto-extract {parsedCsvAllocations.length} departmental budgets from CSV:
                    </p>
                    <div className="mt-1 max-h-24 overflow-y-auto space-y-0.5 text-[11px]">
                      {parsedCsvAllocations.map((a) => (
                        <div key={a.department_id} className="flex justify-between">
                          <span>{a.department_name}</span>
                          <span className="font-bold">${Number(a.allocated_budget).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Executive Budget Notes (Optional)</Label>
                <Textarea
                  value={cbNotes}
                  onChange={(e) => setCbNotes(e.target.value)}
                  placeholder="Key assumptions, reserve rules, or CEO directives for this fiscal year's budget..."
                  className="mt-1 text-xs min-h-[60px]"
                />
              </div>

              <div className="pt-3 border-t flex flex-wrap items-center justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCompanyBudgetModal(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isSavingCompanyBudget || isUploadingBudgetFile}
                  onClick={(e) => handleSaveCompanyBudget(e, true)}
                  className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 font-bold gap-1"
                >
                  Save & Extract Dept Budgets <ArrowRight className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSavingCompanyBudget || isUploadingBudgetFile}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold"
                >
                  {isSavingCompanyBudget ? "Saving..." : "Save Overall Budget"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL B: Extract Departmental Budgets from Overall Initial Budget         */}
      {/* ========================================================================= */}
      {showExtractModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-heading font-bold text-base">
                    Extract Departmental Budgets from Overall Company Budget
                  </h3>
                  <p className="text-xs text-slate-300">
                    Allocate the company&apos;s initial budget across departments by dollar amount or percentage share
                  </p>
                </div>
              </div>
              <button onClick={() => setShowExtractModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Top Summary & Quick Distribution Bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3 shrink-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <Label className="text-[10.5px] font-bold text-slate-500 uppercase">
                    1. Initial Overall Company Budget ($)
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={extractOverallBudget}
                      onChange={(e) => setExtractOverallBudget(e.target.value)}
                      className="pl-7 h-8 text-sm font-black"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                  </div>
                </div>

                <div className="bg-white border border-indigo-200 rounded-xl p-3">
                  <p className="text-[10.5px] font-bold text-indigo-700 uppercase">
                    2. Total Extracted to Departments
                  </p>
                  <p className="text-lg font-black text-indigo-700 mt-1">
                    ${modalTotalExtracted.toLocaleString()}{" "}
                    <span className="text-xs font-semibold text-slate-500">({modalExtractionPct}%)</span>
                  </p>
                </div>

                <div className={cn(
                  "border rounded-xl p-3",
                  modalUnallocated < 0 ? "bg-rose-50 border-rose-300" : "bg-emerald-50 border-emerald-200"
                )}>
                  <p className="text-[10.5px] font-bold text-slate-700 uppercase">
                    3. Remaining Unallocated Pool
                  </p>
                  <p className={cn(
                    "text-lg font-black mt-1",
                    modalUnallocated < 0 ? "text-rose-700" : "text-emerald-700"
                  )}>
                    {modalUnallocated < 0 ? "-" : ""}${Math.abs(modalUnallocated).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-xs font-semibold text-slate-600">
                  Quick Extraction Helpers:
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleDistributeEqually}
                    className="h-7 text-xs font-semibold"
                  >
                    Distribute Equally
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleDistributeByStaff}
                    className="h-7 text-xs font-semibold"
                  >
                    Distribute by Staff Count
                  </Button>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveExtractedBudgets} className="flex-1 overflow-y-auto p-6">
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                      <th className="py-2.5 px-3">Department</th>
                      <th className="py-2.5 px-3 w-28">Share (%)</th>
                      <th className="py-2.5 px-3 w-44">Extracted Budget ($)</th>
                      <th className="py-2.5 px-3">Current Expenses</th>
                      <th className="py-2.5 px-3">Remaining Balance</th>
                      <th className="py-2.5 px-3 w-40">Revenue Target ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {(departments || []).map((d) => {
                      const rawAlloc = deptAllocations[d.dept.id]?.allocated_budget ?? "0";
                      const numAlloc = Math.max(0, parseFloat(rawAlloc) || 0);
                      const overallNum = Math.max(0, parseFloat(extractOverallBudget) || 0);
                      const sharePct = overallNum > 0 ? Math.round((numAlloc / overallNum) * 1000) / 10 : 0;
                      const remAfterSpend = Math.round((numAlloc - (d.total_expenses || 0)) * 100) / 100;

                      return (
                        <tr key={d.dept.id} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: d.dept.color || "#1e3a5f" }}
                              />
                              <div>
                                <p className="font-bold text-slate-900">{d.dept.name}</p>
                                <p className="text-[10.5px] text-slate-500">
                                  {d.dept.manager_name} • {d.staff_count} staff
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="relative">
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                max="100"
                                value={sharePct}
                                onChange={(e) => handleExtractPctChange(d.dept.id, e.target.value)}
                                className="h-8 pr-6 text-xs font-semibold"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="relative">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={rawAlloc}
                                onChange={(e) => handleExtractAmountChange(d.dept.id, e.target.value)}
                                className="h-8 pl-6 text-xs font-bold text-indigo-900"
                              />
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-rose-700">
                            ${Number(d.total_expenses || 0).toLocaleString()}
                          </td>
                          <td className={cn(
                            "py-2.5 px-3 font-bold",
                            remAfterSpend < 0 ? "text-rose-600" : "text-emerald-700"
                          )}>
                            {remAfterSpend < 0 ? "-" : ""}${Math.abs(remAfterSpend).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="relative">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={deptAllocations[d.dept.id]?.annual_budget_target ?? "0"}
                                onChange={(e) =>
                                  setDeptAllocations((prev) => ({
                                    ...prev,
                                    [d.dept.id]: {
                                      ...(prev[d.dept.id] || {}),
                                      annual_budget_target: e.target.value,
                                    },
                                  }))
                                }
                                className="h-8 pl-6 text-xs"
                              />
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-200 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  {modalUnallocated < 0 ? (
                    <span className="text-rose-600 font-semibold">
                      Note: Total extracted budgets exceed the initial company budget by ${Math.abs(modalUnallocated).toLocaleString()}.
                    </span>
                  ) : (
                    <span>
                      Unallocated reserve remaining in company budget: <strong className="text-slate-800">${modalUnallocated.toLocaleString()}</strong>
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowExtractModal(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSavingExtractions}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    {isSavingExtractions ? "Saving Allocations..." : "Save Extracted Department Budgets"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL C: Single Department Extracted Budget & Target Editor               */}
      {/* ========================================================================= */}
      {budgetDept && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-heading font-bold text-base">Extract / Edit Department Budget</h3>
                  <p className="text-xs text-slate-400">{budgetDept.dept.name}</p>
                </div>
              </div>
              <button onClick={() => setBudgetDept(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSingleBudget} className="p-6 space-y-4">
              {overallCompanyBudget > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Overall Company Budget:</span>
                    <span className="font-bold text-slate-900">${overallCompanyBudget.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Unallocated Pool Available:</span>
                    <span className="font-bold text-emerald-700">
                      ${(unallocatedBudget + Number(budgetDept.allocated_budget || 0)).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs font-bold text-slate-800">
                    Extracted Dept Budget ($ USD)
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={singleAllocatedBudget}
                      onChange={(e) => handleSingleBudgetDollarChange(e.target.value)}
                      placeholder="e.g. 50000"
                      className="pl-7 text-base font-black text-indigo-900"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-bold">$</span>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-800">% of Overall</Label>
                  <div className="relative mt-1">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      disabled={overallCompanyBudget <= 0}
                      value={singleAllocatedPct}
                      onChange={(e) => handleSingleBudgetPctChange(e.target.value)}
                      placeholder="0%"
                      className="pr-6 text-base font-bold"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">%</span>
                  </div>
                </div>
              </div>

              <div className="bg-rose-50/60 border border-rose-100 rounded-lg p-3 text-xs flex items-center justify-between">
                <span className="text-slate-600">Current Dept Expenses: <strong>${Number(budgetDept.total_expenses || 0).toLocaleString()}</strong></span>
                <span className="font-bold text-slate-800">
                  Remaining: ${((parseFloat(singleAllocatedBudget || 0) || 0) - Number(budgetDept.total_expenses || 0)).toLocaleString()}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <Label className="text-xs font-semibold text-slate-700">
                  Annual Revenue / Inflow Target ($ USD) (Optional)
                </Label>
                <p className="text-[11px] text-slate-500 mb-1.5">
                  Expected money brought in by this department over the year.
                </p>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={singleRevenueTarget}
                    onChange={(e) => setSingleRevenueTarget(e.target.value)}
                    placeholder="e.g. 100000"
                    className="pl-7 text-sm font-bold"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">$</span>
                </div>
              </div>

              <div className="pt-2 border-t flex items-center justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setBudgetDept(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSavingSingleBudget}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  {isSavingSingleBudget ? "Saving..." : "Save Department Budget"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL D: Log Expense / Revenue Entry                                      */}
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
                {entryType === "revenue" ? (
                  <PlusCircle className="w-5 h-5 text-emerald-400" />
                ) : (
                  <MinusCircle className="w-5 h-5 text-rose-400" />
                )}
                <div>
                  <h3 className="font-heading font-bold text-base">
                    {entryType === "expense" ? "Log Department Spending / Expense" : "Log Money Brought In (Inflow)"}
                  </h3>
                  <p className="text-xs text-white/80">
                    {entryType === "expense"
                      ? "Deducts from the department's extracted budget & overall company budget"
                      : "Records revenue inflow in the departmental financial ledger"}
                  </p>
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
                    setEntryType("expense");
                    setEntryCategory("Software & Cloud Services");
                  }}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-bold rounded-md transition-all",
                    entryType === "expense" ? "bg-white text-rose-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  - Spending / Expense
                </button>
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
                  + Money Brought In (Inflow)
                </button>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Department</Label>
                <Select value={entryDeptId} onValueChange={setEntryDeptId}>
                  <SelectTrigger className="mt-1 text-xs"><SelectValue placeholder="Select Department" /></SelectTrigger>
                  <SelectContent>
                    {(data.departments || []).map((d) => (
                      <SelectItem key={d.dept.id} value={d.dept.id}>
                        {d.dept.name} (Budget: ${Number(d.allocated_budget || 0).toLocaleString()} • Rem: ${Number(d.remaining_budget || 0).toLocaleString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Live Department Budget Impact Preview when logging an Expense */}
              {activeEntryDept && entryType === "expense" && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs flex items-center justify-between">
                  <div>
                    <span className="text-slate-500">Extracted Budget:</span>{" "}
                    <strong className="text-indigo-700">${Number(activeEntryDept.allocated_budget || 0).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Remaining Before Entry:</span>{" "}
                    <strong className={cn(activeEntryDept.remaining_budget < 0 ? "text-rose-600" : "text-emerald-700")}>
                      ${Number(activeEntryDept.remaining_budget || 0).toLocaleString()}
                    </strong>
                  </div>
                </div>
              )}

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
                <Label className="text-xs font-semibold text-slate-700">Description / Vendor / Deliverable</Label>
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
                  placeholder="Reference number, invoice, receipt notes..."
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
                  {isSavingEntry ? "Saving..." : entryType === "revenue" ? "Record Inflow" : "Record Expense"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL E: Department Financial Ledger                                      */}
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
                  Extracted Budget: ${Number(ledgerDept.allocated_budget).toLocaleString()} | Spent: ${Number(ledgerDept.total_expenses).toLocaleString()} | Remaining: ${Number(ledgerDept.remaining_budget).toLocaleString()}
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
                  onClick={() => openLogEntry(ledgerDept.dept.id, "expense")}
                  className="h-7 text-xs font-semibold text-rose-700 hover:bg-rose-50 border-rose-300 gap-1"
                >
                  <MinusCircle className="w-3.5 h-3.5" /> Log Expense
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openLogEntry(ledgerDept.dept.id, "revenue")}
                  className="h-7 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 border-emerald-300 gap-1"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Log Inflow
                </Button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {(ledgerDept.recent_records || []).length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Coins className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-semibold text-slate-600">No transactions recorded yet for this department</p>
                  <p className="text-xs text-slate-400 mt-1">Use the buttons above to log operating expenses or revenue inflows.</p>
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
      {/* MODAL F: Department Analytics & Spending Breakdown Drilldown              */}
      {/* ========================================================================= */}
      {selectedDept && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-heading font-bold text-base">{selectedDept.dept.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manager: {selectedDept.dept.manager_name} • {selectedDept.staff_count} Active Staff • {selectedDept.share_of_company_budget_pct}% of Company Budget
                </p>
              </div>
              <button onClick={() => setSelectedDept(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* Budget & Spending Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-indigo-50 border border-indigo-200/80 rounded-xl p-3 text-center">
                  <p className="text-[10.5px] font-semibold text-indigo-800 uppercase">Extracted Budget</p>
                  <p className="text-base font-bold text-indigo-900 mt-1">
                    ${Number(selectedDept.allocated_budget).toLocaleString()}
                  </p>
                </div>
                <div className="bg-rose-50 border border-rose-200/80 rounded-xl p-3 text-center">
                  <p className="text-[10.5px] font-semibold text-rose-800 uppercase">Total Expenses</p>
                  <p className="text-base font-bold text-rose-700 mt-1">
                    ${Number(selectedDept.total_expenses).toLocaleString()}
                  </p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-3 text-center">
                  <p className="text-[10.5px] font-semibold text-emerald-800 uppercase">Remaining Budget</p>
                  <p className={cn(
                    "text-base font-bold mt-1",
                    selectedDept.remaining_budget < 0 ? "text-rose-700" : "text-emerald-700"
                  )}>
                    ${Number(selectedDept.remaining_budget).toLocaleString()}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-center">
                  <p className="text-[10.5px] font-semibold text-slate-600 uppercase">Inflow / Revenue</p>
                  <p className="text-base font-bold text-emerald-700 mt-1">
                    ${Number(selectedDept.total_revenue).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Spending Breakdown by Category */}
              {(selectedDept.expenses_by_category || []).length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Expense Breakdown by Category
                  </h4>
                  <div className="space-y-2">
                    {selectedDept.expenses_by_category.map((item) => {
                      const pct =
                        selectedDept.total_expenses > 0
                          ? Math.round((item.amount / selectedDept.total_expenses) * 100)
                          : 0;
                      return (
                        <div key={item.category} className="text-xs">
                          <div className="flex justify-between font-medium text-slate-700 mb-1">
                            <span>{item.category}</span>
                            <span className="font-bold text-rose-700">
                              ${Number(item.amount).toLocaleString()} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-rose-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Work Output & Yield */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-amber-600" /> Operational Work Output & Efficiency
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
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Cost / Completed Task</p>
                    <p className="text-lg font-bold text-slate-800 mt-0.5">${Number(selectedDept.cost_per_completed_task || 0).toLocaleString()}</p>
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
                    (selectedDept.recent_records || []).slice(0, 6).map((r) => (
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

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const deptToEdit = selectedDept;
                  setSelectedDept(null);
                  openSingleDeptBudgetModal(deptToEdit);
                }}
              >
                <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Adjust Extracted Budget
              </Button>
              <Button size="sm" onClick={() => setSelectedDept(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
