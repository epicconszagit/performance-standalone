import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ExecutivePerformance } from "@/api/entities";
import { UploadFile } from "@/api/integrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Download,
  RefreshCw,
  Pencil,
  Trash2,
  Upload,
  FileText,
  History,
} from "lucide-react";
import { toast } from "sonner";

const EXPENSE_CATEGORIES = [
  "Operations & Overhead",
  "Payroll & Contractors",
  "Software & Tools",
  "Marketing & Campaigns",
  "Travel & Events",
  "Equipment & Supplies",
  "Other Expense",
];

const INFLOW_CATEGORIES = [
  "Client Retainer",
  "Project Delivery",
  "Consulting Fee",
  "Product Sales",
  "Other Inflow",
];

const formatCurrency = (val) => {
  const num = Number(val) || 0;
  const abs = Math.abs(num);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return num < 0 ? `-$${formatted}` : `$${formatted}`;
};

export default function DepartmentalPerformance() {
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [companyBudgetOpen, setCompanyBudgetOpen] = useState(false);
  const [allocateModalOpen, setAllocateModalOpen] = useState(false);
  const [singleDeptBudgetOpen, setSingleDeptBudgetOpen] = useState(false);
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  const [selectedDept, setSelectedDept] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Forms
  const [companyBudgetForm, setCompanyBudgetForm] = useState({
    total_budget: "",
    fiscal_year: String(new Date().getFullYear()),
    title: `FY ${new Date().getFullYear()} Company Budget`,
    notes: "",
    budget_file_url: "",
    budget_file_name: "",
  });

  const [extractTotalBudget, setExtractTotalBudget] = useState("");
  const [extractAllocations, setExtractAllocations] = useState([]);

  const [singleDeptForm, setSingleDeptForm] = useState({
    department_id: "",
    department_name: "",
    allocated_budget: "",
  });

  const [recordForm, setRecordForm] = useState({
    department_id: "",
    record_type: "expense",
    amount: "",
    title: "",
    category: EXPENSE_CATEGORIES[0],
    transaction_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["executive-department-performance"],
    queryFn: () => ExecutivePerformance.getOverview(),
    staleTime: 15000,
  });

  const companyBudget = data?.company_budget || {};
  const summary = data?.summary || {};
  const departments = data?.departments || [];

  const overallCompanyBudget = Number(
    summary.overall_company_budget ?? companyBudget.total_budget ?? 0
  );
  const totalAllocatedBudget = Number(summary.total_allocated_budget || 0);
  const unallocatedBudget = Number(
    summary.unallocated_budget ?? overallCompanyBudget - totalAllocatedBudget
  );
  const totalExpenses = Number(summary.total_expenses || 0);
  const remainingAllocatedBudget = Number(
    summary.remaining_allocated_budget ?? totalAllocatedBudget - totalExpenses
  );
  const totalRevenue = Number(summary.total_revenue || 0);
  const allocatedBurnPct = Number(summary.allocated_burn_pct || 0);

  // Mutations
  const saveCompanyBudgetMutation = useMutation({
    mutationFn: (payload) => ExecutivePerformance.saveCompanyBudget(payload),
    onSuccess: () => {
      toast.success("Overall company budget saved");
      queryClient.invalidateQueries({
        queryKey: ["executive-department-performance"],
      });
      setCompanyBudgetOpen(false);
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to save company budget");
    },
  });

  const extractBudgetsMutation = useMutation({
    mutationFn: (payload) =>
      ExecutivePerformance.extractDepartmentalBudgets(payload),
    onSuccess: () => {
      toast.success("Departmental budgets updated");
      queryClient.invalidateQueries({
        queryKey: ["executive-department-performance"],
      });
      setAllocateModalOpen(false);
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to update departmental budgets");
    },
  });

  const updateDeptBudgetMutation = useMutation({
    mutationFn: ({ deptId, payload }) =>
      ExecutivePerformance.updateDepartmentBudget(deptId, payload),
    onSuccess: () => {
      toast.success("Department budget saved");
      queryClient.invalidateQueries({
        queryKey: ["executive-department-performance"],
      });
      setSingleDeptBudgetOpen(false);
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to update department budget");
    },
  });

  const createRecordMutation = useMutation({
    mutationFn: (payload) => ExecutivePerformance.createRecord(payload),
    onSuccess: () => {
      toast.success("Transaction recorded");
      queryClient.invalidateQueries({
        queryKey: ["executive-department-performance"],
      });
      setRecordModalOpen(false);
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to save transaction");
    },
  });

  const deleteRecordMutation = useMutation({
    mutationFn: (recordId) => ExecutivePerformance.deleteRecord(recordId),
    onSuccess: () => {
      toast.success("Transaction removed");
      queryClient.invalidateQueries({
        queryKey: ["executive-department-performance"],
      });
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to delete transaction");
    },
  });

  // Handlers
  const openCompanyBudgetModal = () => {
    setCompanyBudgetForm({
      total_budget:
        overallCompanyBudget > 0 ? String(overallCompanyBudget) : "",
      fiscal_year:
        companyBudget.fiscal_year || String(new Date().getFullYear()),
      title:
        companyBudget.title || `FY ${new Date().getFullYear()} Company Budget`,
      notes: companyBudget.notes || "",
      budget_file_url: companyBudget.budget_file_url || "",
      budget_file_name: companyBudget.budget_file_name || "",
    });
    setCompanyBudgetOpen(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Parse CSV if uploaded
    if (file.name.toLowerCase().endsWith(".csv")) {
      try {
        const text = await file.text();
        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        let parsedTotal = 0;
        for (const line of lines) {
          const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
          if (cols.length >= 2) {
            const label = cols[0].toLowerCase();
            const num = parseFloat(cols[1].replace(/[$,\s]/g, ""));
            if (
              !isNaN(num) &&
              (label.includes("overall") ||
                label.includes("company") ||
                label.includes("total") ||
                label.includes("master"))
            ) {
              parsedTotal = num;
              break;
            }
          }
        }
        if (parsedTotal > 0) {
          setCompanyBudgetForm((prev) => ({
            ...prev,
            total_budget: String(parsedTotal),
          }));
          toast.success(
            `Detected budget of ${formatCurrency(parsedTotal)} from CSV`
          );
        }
      } catch {
        // Ignore CSV parse error and proceed with upload
      }
    }

    try {
      setUploadingFile(true);
      const uploaded = await UploadFile({ file });
      if (uploaded?.file_url) {
        setCompanyBudgetForm((prev) => ({
          ...prev,
          budget_file_url: uploaded.file_url,
          budget_file_name: uploaded.file_name || file.name,
        }));
        toast.success(`Attached "${file.name}"`);
      }
    } catch (err) {
      toast.error(err?.message || "File upload failed");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSaveCompanyBudget = (e) => {
    e.preventDefault();
    const num = parseFloat(companyBudgetForm.total_budget);
    if (isNaN(num) || num < 0) {
      toast.error("Please enter a valid budget amount");
      return;
    }
    saveCompanyBudgetMutation.mutate({
      total_budget: num,
      fiscal_year: companyBudgetForm.fiscal_year,
      title: companyBudgetForm.title,
      notes: companyBudgetForm.notes,
      budget_file_url: companyBudgetForm.budget_file_url,
      budget_file_name: companyBudgetForm.budget_file_name,
    });
  };

  const openAllocateModal = () => {
    const basePool = overallCompanyBudget > 0 ? overallCompanyBudget : totalAllocatedBudget;
    setExtractTotalBudget(basePool > 0 ? String(basePool) : "");
    setExtractAllocations(
      departments.map((d) => ({
        department_id: d.dept.id,
        department_name: d.dept.name,
        manager_name: d.dept.manager_name,
        allocated_budget:
          d.allocated_budget > 0 ? String(d.allocated_budget) : "0",
        spent: d.total_expenses || 0,
      }))
    );
    setAllocateModalOpen(true);
  };

  const handleAllocationAmountChange = (deptId, val) => {
    setExtractAllocations((prev) =>
      prev.map((row) =>
        row.department_id === deptId ? { ...row, allocated_budget: val } : row
      )
    );
  };

  const handleAllocationPctChange = (deptId, pctStr) => {
    const pool = parseFloat(extractTotalBudget) || 0;
    const pct = parseFloat(pctStr);
    if (pool <= 0 || isNaN(pct)) return;
    const amount = Math.round((pool * pct) / 100);
    setExtractAllocations((prev) =>
      prev.map((row) =>
        row.department_id === deptId
          ? { ...row, allocated_budget: String(amount) }
          : row
      )
    );
  };

  const handleDistributeEqually = () => {
    const pool = parseFloat(extractTotalBudget) || 0;
    if (pool <= 0 || extractAllocations.length === 0) {
      toast.error("Enter the overall company budget first");
      return;
    }
    const perDept = Math.floor(pool / extractAllocations.length);
    setExtractAllocations((prev) =>
      prev.map((row, idx) => ({
        ...row,
        allocated_budget: String(
          idx === 0
            ? pool - perDept * (extractAllocations.length - 1)
            : perDept
        ),
      }))
    );
  };

  const handleSaveAllocations = (e) => {
    e.preventDefault();
    const pool = parseFloat(extractTotalBudget);
    const payload = {
      allocations: extractAllocations.map((r) => ({
        department_id: r.department_id,
        allocated_budget: parseFloat(r.allocated_budget) || 0,
      })),
    };
    if (!isNaN(pool) && pool >= 0) {
      payload.total_company_budget = pool;
    }
    extractBudgetsMutation.mutate(payload);
  };

  const openSingleDeptBudgetModal = (item) => {
    setSingleDeptForm({
      department_id: item.dept.id,
      department_name: item.dept.name,
      allocated_budget:
        item.allocated_budget > 0 ? String(item.allocated_budget) : "",
    });
    setSingleDeptBudgetOpen(true);
  };

  const handleSaveSingleDeptBudget = (e) => {
    e.preventDefault();
    const num = parseFloat(singleDeptForm.allocated_budget);
    if (isNaN(num) || num < 0) {
      toast.error("Enter a valid budget amount");
      return;
    }
    updateDeptBudgetMutation.mutate({
      deptId: singleDeptForm.department_id,
      payload: { allocated_budget: num },
    });
  };

  const openRecordModal = (deptId = "", defaultType = "expense") => {
    const targetDeptId = deptId || departments[0]?.dept?.id || "";
    setRecordForm({
      department_id: targetDeptId,
      record_type: defaultType,
      amount: "",
      title: "",
      category:
        defaultType === "expense"
          ? EXPENSE_CATEGORIES[0]
          : INFLOW_CATEGORIES[0],
      transaction_date: new Date().toISOString().slice(0, 10),
      notes: "",
    });
    setRecordModalOpen(true);
  };

  const handleCreateRecord = (e) => {
    e.preventDefault();
    const amountNum = parseFloat(recordForm.amount);
    if (!recordForm.department_id) {
      toast.error("Please select a department");
      return;
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    createRecordMutation.mutate({
      ...recordForm,
      amount: amountNum,
    });
  };

  const handleExportCSV = () => {
    if (!departments.length) return;
    const headers = [
      "Department",
      "Manager",
      "Allocated Budget",
      "Share of Company Budget (%)",
      "Spent (Expenses)",
      "Remaining Budget",
      "Inflow / Revenue",
    ];
    const rows = [
      [
        "OVERALL COMPANY TOTAL",
        "-",
        overallCompanyBudget,
        100,
        totalExpenses,
        remainingAllocatedBudget,
        totalRevenue,
      ],
      ...departments.map((d) => [
        `"${d.dept.name}"`,
        `"${d.dept.manager_name}"`,
        d.allocated_budget,
        d.share_of_company_budget_pct,
        d.total_expenses,
        d.remaining_budget,
        d.total_revenue,
      ]),
    ];
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `company_budget_tracker_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered departments
  const filteredDepartments = departments.filter((d) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      d.dept.name.toLowerCase().includes(q) ||
      (d.dept.manager_name || "").toLowerCase().includes(q)
    );
  });

  // Live totals inside Allocate modal
  const modalPool = parseFloat(extractTotalBudget) || 0;
  const modalAllocatedSum = extractAllocations.reduce(
    (acc, r) => acc + (parseFloat(r.allocated_budget) || 0),
    0
  );
  const modalRemaining = modalPool - modalAllocatedSum;

  // Keep selectedDept fresh for history modal
  const activeHistoryDept = selectedDept
    ? departments.find((d) => d.dept.id === selectedDept.dept.id) ||
      selectedDept
    : null;

  return (
    <div className="space-y-6 pb-10">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900">
            Executive Budget Tracker
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <p className="text-sm text-slate-500">
              Set the overall company budget, allocate department budgets, and
              track spending.
            </p>
            {companyBudget.budget_file_url && (
              <a
                href={companyBudget.budget_file_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 underline hover:text-slate-900"
              >
                <FileText className="w-3.5 h-3.5" />
                {companyBudget.budget_file_name || "View Budget File"}
              </a>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={openCompanyBudgetModal}
            className="bg-slate-900 hover:bg-slate-800 text-white"
          >
            Set Company Budget
          </Button>
          <Button variant="outline" onClick={openAllocateModal}>
            Allocate to Departments
          </Button>
          <Button
            variant="outline"
            onClick={() => openRecordModal("", "expense")}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Record Transaction
          </Button>
          <Button variant="outline" size="icon" onClick={handleExportCSV} title="Export CSV">
            <Download className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh">
            <RefreshCw
              className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Overall Company Budget
            </p>
            <button
              onClick={openCompanyBudgetModal}
              className="text-xs text-slate-400 hover:text-slate-700"
              title="Edit Company Budget"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {formatCurrency(overallCompanyBudget)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Allocated to Depts: {formatCurrency(totalAllocatedBudget)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Unallocated Balance
          </p>
          <p
            className={`text-2xl font-bold mt-2 ${
              unallocatedBudget < 0 ? "text-red-600" : "text-slate-900"
            }`}
          >
            {formatCurrency(unallocatedBudget)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {unallocatedBudget < 0
              ? "Exceeds company budget"
              : "Available to allocate"}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Total Spent (Expenses)
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {formatCurrency(totalExpenses)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {allocatedBurnPct}% of allocated budget spent
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Remaining Budget
          </p>
          <p
            className={`text-2xl font-bold mt-2 ${
              remainingAllocatedBudget < 0 ? "text-red-600" : "text-slate-900"
            }`}
          >
            {formatCurrency(remainingAllocatedBudget)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Total Inflow: {formatCurrency(totalRevenue)}
          </p>
        </div>
      </div>

      {/* Department Budgets & Spending Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Department Budgets & Spending
            </h2>
            <p className="text-xs text-slate-500">
              {departments.length} departments
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search department..."
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading budget data...
          </div>
        ) : filteredDepartments.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No departments found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Allocated Budget</th>
                  <th className="px-4 py-3 font-medium">Spent (Expenses)</th>
                  <th className="px-4 py-3 font-medium">Remaining</th>
                  <th className="px-4 py-3 font-medium">Inflow</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredDepartments.map((item) => {
                  const dept = item.dept;
                  const isOver =
                    item.allocated_budget > 0 &&
                    item.total_expenses > item.allocated_budget;
                  const utilPct = Math.min(
                    100,
                    Math.round(item.budget_utilization_pct || 0)
                  );

                  return (
                    <tr
                      key={dept.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-900">
                          {dept.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          Manager: {dept.manager_name || "Unassigned"}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900">
                          {formatCurrency(item.allocated_budget)}
                        </div>
                        {overallCompanyBudget > 0 && (
                          <div className="text-xs text-slate-500">
                            {item.share_of_company_budget_pct}% of company
                            budget
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-900">
                          {formatCurrency(item.total_expenses)}
                        </div>
                        {item.allocated_budget > 0 && (
                          <div className="w-28 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
                            <div
                              className={`h-full rounded-full ${
                                isOver ? "bg-red-600" : "bg-slate-700"
                              }`}
                              style={{ width: `${utilPct}%` }}
                            />
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`font-medium ${
                            isOver ? "text-red-600" : "text-slate-900"
                          }`}
                        >
                          {item.allocated_budget > 0
                            ? formatCurrency(item.remaining_budget)
                            : "—"}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-slate-700">
                        {formatCurrency(item.total_revenue)}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => openSingleDeptBudgetModal(item)}
                          >
                            Edit Budget
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => openRecordModal(dept.id, "expense")}
                          >
                            Record
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs text-slate-600"
                            onClick={() => {
                              setSelectedDept(item);
                              setHistoryModalOpen(true);
                            }}
                            title="Transaction History"
                          >
                            <History className="w-3.5 h-3.5 mr-1" />
                            {item.total_transactions_count || 0}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Set / Upload Overall Company Budget */}
      <Dialog open={companyBudgetOpen} onOpenChange={setCompanyBudgetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Overall Company Budget</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveCompanyBudget} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-700">
                  Budget Title
                </label>
                <Input
                  value={companyBudgetForm.title}
                  onChange={(e) =>
                    setCompanyBudgetForm({
                      ...companyBudgetForm,
                      title: e.target.value,
                    })
                  }
                  placeholder="FY 2026 Company Budget"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">
                  Fiscal Year
                </label>
                <Input
                  value={companyBudgetForm.fiscal_year}
                  onChange={(e) =>
                    setCompanyBudgetForm({
                      ...companyBudgetForm,
                      fiscal_year: e.target.value,
                    })
                  }
                  placeholder="2026"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700">
                Overall Company Budget ($)
              </label>
              <Input
                type="number"
                step="any"
                min="0"
                required
                value={companyBudgetForm.total_budget}
                onChange={(e) =>
                  setCompanyBudgetForm({
                    ...companyBudgetForm,
                    total_budget: e.target.value,
                  })
                }
                placeholder="e.g. 500000"
                className="mt-1 text-base font-semibold"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                Upload Budget File (Optional CSV, Excel, or PDF)
              </label>
              <label className="flex items-center justify-center gap-2 px-3 py-2.5 border border-dashed border-slate-300 rounded-lg text-xs text-slate-600 cursor-pointer hover:bg-slate-50">
                <Upload className="w-4 h-4 text-slate-500" />
                <span>
                  {uploadingFile
                    ? "Uploading..."
                    : companyBudgetForm.budget_file_name ||
                      "Choose file to attach"}
                </span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,.pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700">
                Notes (Optional)
              </label>
              <Input
                value={companyBudgetForm.notes}
                onChange={(e) =>
                  setCompanyBudgetForm({
                    ...companyBudgetForm,
                    notes: e.target.value,
                  })
                }
                placeholder="Optional notes"
                className="mt-1"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCompanyBudgetOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveCompanyBudgetMutation.isPending}
                className="bg-slate-900 hover:bg-slate-800 text-white"
              >
                {saveCompanyBudgetMutation.isPending ? "Saving..." : "Save Budget"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Allocate Departmental Budgets from Overall Budget */}
      <Dialog open={allocateModalOpen} onOpenChange={setAllocateModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Allocate Department Budgets</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={handleSaveAllocations}
            className="space-y-4 flex-1 overflow-y-auto pr-1"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
              <div>
                <label className="text-xs font-medium text-slate-500">
                  Overall Company Budget ($)
                </label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={extractTotalBudget}
                  onChange={(e) => setExtractTotalBudget(e.target.value)}
                  placeholder="Enter total budget"
                  className="mt-1 h-8 bg-white font-semibold"
                />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Allocated to Departments
                </p>
                <p className="text-lg font-bold text-slate-900 mt-1.5">
                  {formatCurrency(modalAllocatedSum)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Unallocated Balance
                </p>
                <p
                  className={`text-lg font-bold mt-1.5 ${
                    modalRemaining < 0 ? "text-red-600" : "text-slate-900"
                  }`}
                >
                  {formatCurrency(modalRemaining)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">
                Enter each department's budget below:
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={handleDistributeEqually}
              >
                Split Equally
              </Button>
            </div>

            <div className="border border-slate-200 rounded-lg divide-y divide-slate-200 max-h-72 overflow-y-auto">
              {extractAllocations.map((row) => {
                const amt = parseFloat(row.allocated_budget) || 0;
                const pct =
                  modalPool > 0 ? ((amt / modalPool) * 100).toFixed(1) : "0.0";
                return (
                  <div
                    key={row.department_id}
                    className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {row.department_name}
                      </p>
                      <p className="text-xs text-slate-500">
                        Spent so far: {formatCurrency(row.spent)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24">
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={pct}
                          onChange={(e) =>
                            handleAllocationPctChange(
                              row.department_id,
                              e.target.value
                            )
                          }
                          className="h-8 text-xs text-right"
                          title="Share %"
                        />
                      </div>
                      <span className="text-xs text-slate-400">%</span>
                      <div className="w-36">
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          value={row.allocated_budget}
                          onChange={(e) =>
                            handleAllocationAmountChange(
                              row.department_id,
                              e.target.value
                            )
                          }
                          placeholder="0"
                          className="h-8 text-sm font-medium"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAllocateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={extractBudgetsMutation.isPending}
                className="bg-slate-900 hover:bg-slate-800 text-white"
              >
                {extractBudgetsMutation.isPending
                  ? "Saving..."
                  : "Save Allocations"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: Edit Single Department Budget */}
      <Dialog
        open={singleDeptBudgetOpen}
        onOpenChange={setSingleDeptBudgetOpen}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Edit Budget — {singleDeptForm.department_name}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveSingleDeptBudget} className="space-y-4">
            {overallCompanyBudget > 0 && (
              <p className="text-xs text-slate-500">
                Overall Company Budget: {formatCurrency(overallCompanyBudget)}
              </p>
            )}
            <div>
              <label className="text-xs font-medium text-slate-700">
                Allocated Department Budget ($)
              </label>
              <Input
                type="number"
                step="any"
                min="0"
                required
                value={singleDeptForm.allocated_budget}
                onChange={(e) =>
                  setSingleDeptForm({
                    ...singleDeptForm,
                    allocated_budget: e.target.value,
                  })
                }
                placeholder="e.g. 50000"
                className="mt-1 font-semibold"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSingleDeptBudgetOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateDeptBudgetMutation.isPending}
                className="bg-slate-900 hover:bg-slate-800 text-white"
              >
                {updateDeptBudgetMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: Record Expense or Inflow */}
      <Dialog open={recordModalOpen} onOpenChange={setRecordModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Transaction</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateRecord} className="space-y-4">
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() =>
                  setRecordForm({
                    ...recordForm,
                    record_type: "expense",
                    category: EXPENSE_CATEGORIES[0],
                  })
                }
                className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                  recordForm.record_type === "expense"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Expense (Spending)
              </button>
              <button
                type="button"
                onClick={() =>
                  setRecordForm({
                    ...recordForm,
                    record_type: "revenue",
                    category: INFLOW_CATEGORIES[0],
                  })
                }
                className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                  recordForm.record_type === "revenue"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Inflow (Revenue)
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700">
                Department
              </label>
              <Select
                value={recordForm.department_id}
                onValueChange={(val) =>
                  setRecordForm({ ...recordForm, department_id: val })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.dept.id} value={d.dept.id}>
                      {d.dept.name} (Budget:{" "}
                      {formatCurrency(d.allocated_budget)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700">
                  Amount ($)
                </label>
                <Input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={recordForm.amount}
                  onChange={(e) =>
                    setRecordForm({ ...recordForm, amount: e.target.value })
                  }
                  placeholder="0.00"
                  className="mt-1 font-semibold"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Date</label>
                <Input
                  type="date"
                  value={recordForm.transaction_date}
                  onChange={(e) =>
                    setRecordForm({
                      ...recordForm,
                      transaction_date: e.target.value,
                    })
                  }
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700">
                Description
              </label>
              <Input
                required
                value={recordForm.title}
                onChange={(e) =>
                  setRecordForm({ ...recordForm, title: e.target.value })
                }
                placeholder={
                  recordForm.record_type === "expense"
                    ? "e.g. Software subscription"
                    : "e.g. Client retainer payment"
                }
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700">
                Category
              </label>
              <Select
                value={recordForm.category}
                onValueChange={(val) =>
                  setRecordForm({ ...recordForm, category: val })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(recordForm.record_type === "expense"
                    ? EXPENSE_CATEGORIES
                    : INFLOW_CATEGORIES
                  ).map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRecordModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createRecordMutation.isPending}
                className="bg-slate-900 hover:bg-slate-800 text-white"
              >
                {createRecordMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 5: Department Transaction History */}
      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {activeHistoryDept?.dept?.name} — Transactions
            </DialogTitle>
          </DialogHeader>

          {activeHistoryDept && (
            <div className="space-y-4 flex-1 overflow-y-auto">
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500">Allocated Budget</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {formatCurrency(activeHistoryDept.allocated_budget)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Spent (Expenses)</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {formatCurrency(activeHistoryDept.total_expenses)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Remaining</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {formatCurrency(activeHistoryDept.remaining_budget)}
                  </p>
                </div>
              </div>

              {!activeHistoryDept.recent_records ||
              activeHistoryDept.recent_records.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">
                  No transactions recorded for this department yet.
                </p>
              ) : (
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
                  {activeHistoryDept.recent_records.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-3 flex items-center justify-between gap-3 text-sm"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">
                            {rec.title}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-normal"
                          >
                            {rec.record_type === "expense"
                              ? "Expense"
                              : "Inflow"}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {rec.category} • {rec.transaction_date}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-slate-900">
                          {rec.record_type === "expense" ? "-" : "+"}
                          {formatCurrency(rec.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteRecordMutation.mutate(rec.id)}
                          className="text-slate-400 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
