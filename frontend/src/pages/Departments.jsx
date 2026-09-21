import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Building2, Plus, Pencil, Trash2, Users, X, Mail, UserPlus,
  Search, Check, ShieldCheck, ArrowRightLeft, UserCheck, AlertCircle,
  DollarSign, Target, Briefcase, Coins, Shield
} from "lucide-react";
import { Department, Employee } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logAudit, isExecutiveSuperAdminOrCEO } from "@/lib/performance";
import { useToast } from "@/components/ui/use-toast";
import { generateDepartmentEmailBase, generateUniqueEmail } from "@/lib/company";
import { cn } from "@/lib/utils";

const COLORS = ["#1e3a5f", "#0f766e", "#7c2d12", "#581c87", "#92400e", "#991b1b", "#1e40af", "#166534"];

export default function Departments() {
  const { performer, role, user, employee } = useOutletContext();
  const { toast } = useToast();
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const isExecutive = isExecutiveSuperAdminOrCEO(user, employee, role);

  // Department edit/create modal
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    email: "",
    description: "",
    manager_id: "",
    color: COLORS[0],
    allocated_budget: "",
    actual_spend: "",
    budget_currency: "ZAR",
    fiscal_year: "2026",
    contribution_type: "Operational Support",
    revenue_generated: "",
    strategic_weight: 3,
    target_contribution_score: 85,
  });

  // Manage Department Members modal
  const [managingDept, setManagingDept] = useState(null);
  const [memberModalTab, setMemberModalTab] = useState("roster"); // "roster" | "assign"
  const [memberSearch, setMemberSearch] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const loadData = async () => {
    try {
      const [depts, emps] = await Promise.all([
        Department.list("-created_date", 100),
        Employee.list("-created_date", 300),
      ]);
      setDepartments(depts || []);
      setEmployees(emps || []);
    } catch (e) {
      toast({ title: "Error", description: "Failed to load departments", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      code: "",
      email: "",
      description: "",
      manager_id: "",
      color: COLORS[0],
      allocated_budget: "",
      actual_spend: "",
      budget_currency: "ZAR",
      fiscal_year: "2026",
      contribution_type: "Operational Support",
      revenue_generated: "",
      strategic_weight: 3,
      target_contribution_score: 85,
    });
    setShowForm(true);
  };

  const openEdit = (dept) => {
    setEditing(dept);
    setForm({
      name: dept.name || "",
      code: dept.code || "",
      email: dept.email || "",
      description: dept.description || "",
      manager_id: dept.manager_id || "",
      color: dept.color || COLORS[0],
      allocated_budget: dept.allocated_budget !== undefined && dept.allocated_budget !== null ? dept.allocated_budget : "",
      actual_spend: dept.actual_spend !== undefined && dept.actual_spend !== null ? dept.actual_spend : "",
      budget_currency: dept.budget_currency || "ZAR",
      fiscal_year: dept.fiscal_year || "2026",
      contribution_type: dept.contribution_type || "Operational Support",
      revenue_generated: dept.revenue_generated !== undefined && dept.revenue_generated !== null ? dept.revenue_generated : "",
      strategic_weight: dept.strategic_weight || 3,
      target_contribution_score: dept.target_contribution_score || 85,
    });
    setShowForm(true);
  };

  const openManageMembers = (dept) => {
    setManagingDept(dept);
    setMemberModalTab("roster");
    setMemberSearch("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const manager = employees.find((emp) => emp.id === form.manager_id);
    const otherEmails = departments.filter((d) => d.id !== editing?.id).map((d) => d.email);
    const email = form.email?.trim() || generateUniqueEmail(generateDepartmentEmailBase(form.name), otherEmails);
    const data = {
      name: form.name,
      code: form.code,
      email,
      description: form.description,
      manager_id: form.manager_id,
      manager_name: manager?.full_name || "",
      color: form.color,
      status: "active",
      ...(isExecutive ? {
        allocated_budget: form.allocated_budget === "" ? 0 : parseFloat(form.allocated_budget || 0),
        actual_spend: form.actual_spend === "" ? 0 : parseFloat(form.actual_spend || 0),
        budget_currency: form.budget_currency || "ZAR",
        fiscal_year: form.fiscal_year || "2026",
        contribution_type: form.contribution_type || "Operational Support",
        revenue_generated: form.revenue_generated === "" ? 0 : parseFloat(form.revenue_generated || 0),
        strategic_weight: parseInt(form.strategic_weight || 3),
        target_contribution_score: form.target_contribution_score === "" ? 85 : parseFloat(form.target_contribution_score || 85),
      } : {}),
    };
    try {
      if (editing) {
        await Department.update(editing.id, data);
        await logAudit("Edited Department", "Department", editing.id, data.name, performer, "Updated department details");
        toast({ title: "Updated", description: "Department updated successfully" });
      } else {
        const created = await Department.create(data);
        await logAudit("Created Department", "Department", created.id, data.name, performer, "New department created");
        toast({ title: "Created", description: "Department created successfully" });
      }
      setShowForm(false);
      loadData();
    } catch (e) {
      toast({ title: "Error", description: e?.message || "Failed to save department", variant: "destructive" });
    }
  };

  const handleDelete = async (dept) => {
    if (!confirm(`Delete department "${dept.name}"? This cannot be undone.`)) return;
    try {
      await Department.delete(dept.id);
      await logAudit("Deleted Department", "Department", dept.id, dept.name, performer, "Department removed");
      toast({ title: "Deleted", description: "Department deleted" });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: e?.message || "Failed to delete department", variant: "destructive" });
    }
  };

  // Helper to check if employee belongs to dept
  const isEmployeeInDept = (emp, deptId) => {
    if (!emp || !deptId) return false;
    const dept = departments.find((d) => d.id === deptId);
    if (dept && dept.manager_id && dept.manager_id === emp.id) return true;
    if (emp.department_id === deptId) return true;
    const deptIds = Array.isArray(emp.department_ids) ? emp.department_ids : [];
    return deptIds.includes(deptId);
  };

  // Assign employee to department
  const handleAssignMember = async (emp, isPrimary = false) => {
    if (!managingDept) return;
    setActionLoadingId(emp.id);
    try {
      await Department.addMembers(managingDept.id, {
        employee_id: emp.id,
        is_primary: isPrimary,
      });

      await logAudit(
        "Assigned Department Member",
        "Department",
        managingDept.id,
        managingDept.name,
        performer,
        `Assigned ${emp.full_name} to ${managingDept.name} (${isPrimary ? "Primary" : "Cross-Department"})`
      );

      toast({
        title: "Member Assigned",
        description: `${emp.full_name} is now a member of ${managingDept.name} (${isPrimary ? "Primary Department" : "Cross-Department Member"}).`,
      });

      await loadData();
    } catch (err) {
      toast({
        title: "Assignment Failed",
        description: err?.message || "Failed to assign staff member to department",
        variant: "destructive",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Remove employee from department
  const handleRemoveMember = async (emp) => {
    if (!managingDept) return;
    if (!confirm(`Remove ${emp.full_name} from ${managingDept.name}?`)) return;

    setActionLoadingId(emp.id);
    try {
      await Department.removeMember(managingDept.id, emp.id);

      await logAudit(
        "Removed Department Member",
        "Department",
        managingDept.id,
        managingDept.name,
        performer,
        `Removed ${emp.full_name} from ${managingDept.name}`
      );

      toast({
        title: "Member Removed",
        description: `${emp.full_name} has been removed from ${managingDept.name}.`,
      });

      await loadData();
    } catch (err) {
      toast({
        title: "Removal Failed",
        description: err?.message || "Failed to remove member from department",
        variant: "destructive",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Set employee primary department
  const handleSetPrimary = async (emp) => {
    if (!managingDept) return;
    await handleAssignMember(emp, true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Members currently belonging to the selected department
  const currentDeptMembers = managingDept
    ? employees.filter((e) => isEmployeeInDept(e, managingDept.id) && e.status === "active")
    : [];

  // Available staff not yet in this department (or for search in assign tab)
  const availableStaff = managingDept
    ? employees.filter((e) => e.status === "active").filter((e) => {
        if (!memberSearch.trim()) return true;
        const q = memberSearch.toLowerCase();
        return (
          e.full_name?.toLowerCase().includes(q) ||
          e.email?.toLowerCase().includes(q) ||
          e.position?.toLowerCase().includes(q) ||
          e.department_name?.toLowerCase().includes(q)
        );
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900">Departments</h1>
          <p className="text-sm text-slate-500 mt-1">Manage company departments, roster assignments, and cross-department staffing</p>
        </div>
        <Button onClick={openCreate} className="bg-slate-800 hover:bg-slate-900 gap-1.5 shadow-sm">
          <Plus className="w-4 h-4" /> New Department
        </Button>
      </div>

      {departments.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No departments yet. Create your first department to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept) => {
            const assignedEmps = employees.filter((e) => isEmployeeInDept(e, dept.id) && e.status === "active");
            const count = assignedEmps.length;

            return (
              <div key={dept.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow group flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm"
                      style={{ backgroundColor: dept.color || "#1e3a5f" }}
                    >
                      {dept.name?.[0]?.toUpperCase() || "D"}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(dept)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                        title="Edit department details"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(dept)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
                        title="Delete department"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-heading font-bold text-slate-900 mt-3 text-base">{dept.name}</h3>
                  {dept.code && <p className="text-xs text-slate-400 font-mono mt-0.5">{dept.code}</p>}
                  {dept.email && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                      <Mail className="w-3 h-3 text-slate-400" /> {dept.email}
                    </p>
                  )}
                  <p className="text-sm text-slate-500 mt-2 line-clamp-2">{dept.description || "No description provided."}</p>

                  {isExecutive && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-700 bg-slate-50 border border-slate-200/70 px-2 py-0.5 rounded-md font-medium">
                        <Coins className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Budget: {dept.budget_currency || "ZAR"} {Number(dept.allocated_budget || 0).toLocaleString()}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        {dept.contribution_type || "Operational Support"}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <button
                      onClick={() => openManageMembers(dept)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100/80 text-amber-800 font-medium border border-amber-200/60 transition-colors"
                      title="Click to view and manage members"
                    >
                      <Users className="w-3.5 h-3.5 text-amber-600" />
                      <span>{count} {count === 1 ? "member" : "members"}</span>
                    </button>

                    <div className="text-xs text-slate-500 truncate max-w-[50%]" title={dept.manager_name || "No manager"}>
                      {dept.manager_name ? `Mgr: ${dept.manager_name}` : "No manager"}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openManageMembers(dept)}
                    className="w-full text-xs h-8 gap-1.5 border-slate-200 hover:bg-slate-50 text-slate-700 font-medium"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-amber-600" />
                    Assign / Manage Members
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manage Department Members Modal */}
      {managingDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setManagingDept(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm"
                  style={{ backgroundColor: managingDept.color || "#1e3a5f" }}
                >
                  {managingDept.name?.[0]?.toUpperCase() || "D"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-heading font-bold text-slate-900">{managingDept.name}</h2>
                    {managingDept.code && (
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-200/70 text-slate-700">
                        {managingDept.code}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Roster Management • {currentDeptMembers.length} {currentDeptMembers.length === 1 ? "member assigned" : "members assigned"}
                  </p>
                </div>
              </div>
              <button onClick={() => setManagingDept(null)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 px-6 pt-2 bg-white">
              <button
                onClick={() => setMemberModalTab("roster")}
                className={cn(
                  "pb-3 px-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors",
                  memberModalTab === "roster"
                    ? "border-amber-500 text-amber-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                )}
              >
                <Users className="w-4 h-4" />
                Current Members ({currentDeptMembers.length})
              </button>
              <button
                onClick={() => setMemberModalTab("assign")}
                className={cn(
                  "pb-3 px-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors",
                  memberModalTab === "assign"
                    ? "border-amber-500 text-amber-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                )}
              >
                <UserPlus className="w-4 h-4" />
                Assign Staff Members
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {memberModalTab === "roster" ? (
                /* Tab 1: Current Members */
                <div>
                  {currentDeptMembers.length === 0 ? (
                    <div className="py-12 px-4 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                      <Users className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
                      <p className="text-sm font-semibold text-slate-700">No staff members currently in {managingDept.name}</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Staff members under other departments or new team members can be assigned to this department right now.
                      </p>
                      <Button
                        size="sm"
                        onClick={() => setMemberModalTab("assign")}
                        className="mt-4 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold gap-1.5"
                      >
                        <UserPlus className="w-4 h-4" /> Assign Staff to {managingDept.name}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between pb-1">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Active Department Roster ({currentDeptMembers.length})
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setMemberModalTab("assign")}
                          className="text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 h-7 gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add More Staff
                        </Button>
                      </div>

                      {currentDeptMembers.map((emp) => {
                        const isPrimary = emp.department_id === managingDept.id;
                        const isManager = managingDept.manager_id === emp.id;
                        const isLoading = actionLoadingId === emp.id;

                        return (
                          <div
                            key={emp.id}
                            className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                                {emp.full_name?.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-semibold text-slate-900 truncate">{emp.full_name}</p>
                                  {isManager && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                      Manager
                                    </span>
                                  )}
                                  {isPrimary ? (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      Primary Dept
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                      Cross-Department
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                                  <span>{emp.position || emp.role}</span>
                                  <span>•</span>
                                  <span className="truncate">{emp.email}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 ml-3">
                              {!isPrimary && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={isLoading}
                                  onClick={() => handleSetPrimary(emp)}
                                  className="text-xs h-8 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                  title="Set this department as their primary department"
                                >
                                  Make Primary
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={isLoading}
                                onClick={() => handleRemoveMember(emp)}
                                className="text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                                title="Remove staff member from this department"
                              >
                                <X className="w-3.5 h-3.5" /> Remove
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* Tab 2: Assign Staff */
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-slate-600">Search Staff Members</Label>
                    <div className="relative mt-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        placeholder="Search by name, position, or current department..."
                        className="pl-9 text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Available Staff Members ({availableStaff.length})
                    </p>

                    <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                      {availableStaff.map((emp) => {
                        const inThisDept = isEmployeeInDept(emp, managingDept.id);
                        const isPrimaryHere = emp.department_id === managingDept.id;
                        const isLoading = actionLoadingId === emp.id;

                        return (
                          <div
                            key={emp.id}
                            className={cn(
                              "p-3 rounded-xl border transition-colors flex items-center justify-between gap-3",
                              inThisDept
                                ? "bg-slate-50/70 border-slate-200"
                                : "bg-white border-slate-200/90 hover:border-slate-300"
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                                {emp.full_name?.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-semibold text-slate-900 truncate">{emp.full_name}</p>
                                  {emp.department_name ? (
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                      Current Dept: {emp.department_name}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                      Unassigned
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5 truncate">
                                  {emp.position || emp.role} • {emp.email}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {inThisDept ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60">
                                  <Check className="w-3.5 h-3.5" />
                                  {isPrimaryHere ? "Primary Member" : "Cross-Member"}
                                </span>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isLoading}
                                    onClick={() => handleAssignMember(emp, false)}
                                    className="text-xs h-8 text-slate-700 hover:bg-slate-100"
                                    title="Add as a cross-department member while preserving their primary department"
                                  >
                                    + Add as Cross-Dept
                                  </Button>
                                  <Button
                                    size="sm"
                                    disabled={isLoading}
                                    onClick={() => handleAssignMember(emp, true)}
                                    className="text-xs h-8 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
                                    title="Assign to this department as their primary department"
                                  >
                                    Assign Primary
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-slate-400" />
                Changes are saved immediately and updated in real time.
              </span>
              <Button size="sm" variant="outline" onClick={() => setManagingDept(null)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Form Dialog for Creating / Editing Department */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-heading font-bold text-slate-900">{editing ? "Edit Department" : "New Department"}</h2>
                <p className="text-xs text-slate-500 mt-0.5">Configure operational metadata and structure</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Department Name *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Operations" />
                </div>
                <div>
                  <Label>Department ID / Code</Label>
                  <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. OPS" />
                </div>
              </div>
              <div>
                <Label>Department Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder={form.name ? `${generateDepartmentEmailBase(form.name)}@epicnetworkgroup.com` : "Auto-generated if left blank"}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>
              <div>
                <Label>Department Manager</Label>
                <Select value={form.manager_id} onValueChange={(v) => setForm({ ...form, manager_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
                  <SelectContent>
                    {employees.filter((e) => e.status === "active").map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.full_name} — {emp.position || emp.role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Brand Color</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                      className={`w-8 h-8 rounded-lg transition-transform ${form.color === c ? "ring-2 ring-offset-2 ring-slate-800 scale-110" : "hover:scale-105"}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>

              {/* Executive Budget & Strategic Contribution Parameters (Super Admin & CEO Only) */}
              {isExecutive && (
                <div className="pt-4 mt-4 border-t-2 border-slate-100 bg-slate-50/70 -mx-6 px-6 py-4 rounded-b-xl space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center text-amber-800">
                        <Coins className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Financial Budget & Strategic Contribution</h4>
                        <p className="text-[11px] text-slate-500">Recorded for executive tracking & contribution indexing</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 border border-amber-300/60 px-2 py-0.5 rounded-full">
                      <Shield className="w-3 h-3" /> Super Admin & CEO Only
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs text-slate-700">Allocated Budget</Label>
                      <div className="relative mt-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={form.allocated_budget}
                          onChange={(e) => setForm({ ...form, allocated_budget: e.target.value })}
                          placeholder="0.00"
                          className="pl-7 text-sm font-medium"
                        />
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
                          {form.budget_currency === "ZAR" ? "R" : form.budget_currency === "USD" ? "$" : form.budget_currency === "EUR" ? "€" : "£"}
                        </span>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs text-slate-700">Actual Spend (YTD)</Label>
                      <div className="relative mt-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={form.actual_spend}
                          onChange={(e) => setForm({ ...form, actual_spend: e.target.value })}
                          placeholder="0.00"
                          className="pl-7 text-sm font-medium"
                        />
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
                          {form.budget_currency === "ZAR" ? "R" : form.budget_currency === "USD" ? "$" : form.budget_currency === "EUR" ? "€" : "£"}
                        </span>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs text-slate-700">Currency & Fiscal Year</Label>
                      <div className="grid grid-cols-2 gap-1.5 mt-1">
                        <Select value={form.budget_currency} onValueChange={(v) => setForm({ ...form, budget_currency: v })}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ZAR">ZAR (R)</SelectItem>
                            <SelectItem value="USD">USD ($)</SelectItem>
                            <SelectItem value="EUR">EUR (€)</SelectItem>
                            <SelectItem value="GBP">GBP (£)</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={form.fiscal_year}
                          onChange={(e) => setForm({ ...form, fiscal_year: e.target.value })}
                          placeholder="2026"
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <Label className="text-xs text-slate-700">Contribution Archetype</Label>
                      <Select value={form.contribution_type} onValueChange={(v) => setForm({ ...form, contribution_type: v })}>
                        <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Operational Support">Operational Support (Cost/Execution Center)</SelectItem>
                          <SelectItem value="Revenue Generating">Revenue Generating (Profit/Commercial Center)</SelectItem>
                          <SelectItem value="Strategic Enabler">Strategic Enabler (Innovation/Infrastructure)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[10.5px] text-slate-400 mt-1">
                        Determines how organizational contribution index (DPCI) is weighted.
                      </p>
                    </div>

                    <div>
                      {form.contribution_type === "Revenue Generating" ? (
                        <div>
                          <Label className="text-xs text-slate-700">Revenue Generated (YTD)</Label>
                          <div className="relative mt-1">
                            <Input
                              type="number"
                              step="0.01"
                              value={form.revenue_generated}
                              onChange={(e) => setForm({ ...form, revenue_generated: e.target.value })}
                              placeholder="0.00"
                              className="pl-7 text-sm font-medium"
                            />
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
                              {form.budget_currency === "ZAR" ? "R" : form.budget_currency === "USD" ? "$" : form.budget_currency === "EUR" ? "€" : "£"}
                            </span>
                          </div>
                          <p className="text-[10.5px] text-slate-400 mt-1">Used to compute contribution ROI and profit margins.</p>
                        </div>
                      ) : (
                        <div>
                          <Label className="text-xs text-slate-700">Strategic Priority Weight (1 to 5)</Label>
                          <Select value={String(form.strategic_weight)} onValueChange={(v) => setForm({ ...form, strategic_weight: parseInt(v) })}>
                            <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 - Baseline Support</SelectItem>
                              <SelectItem value="2">2 - Standard Operations</SelectItem>
                              <SelectItem value="3">3 - High Strategic Value</SelectItem>
                              <SelectItem value="4">4 - Mission Critical</SelectItem>
                              <SelectItem value="5">5 - Enterprise Essential</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-[10.5px] text-slate-400 mt-1">Impact factor applied to departmental task milestones.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-slate-700">Target Contribution Benchmark (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={form.target_contribution_score}
                      onChange={(e) => setForm({ ...form, target_contribution_score: e.target.value })}
                      placeholder="85"
                      className="mt-1 text-sm font-medium max-w-[140px]"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-3 border-t border-slate-200">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold">
                  {editing ? "Update Department" : "Create Department"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}