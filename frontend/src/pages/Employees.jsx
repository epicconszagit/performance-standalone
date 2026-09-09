import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Users, Plus, Pencil, Trash2, X, Search, Mail, Phone, CheckCircle2, UserCheck, UserPlus, Check, Ban, Send, BadgeCheck, Lock } from "lucide-react";
import { Employee, Department } from "@/api/entities";
import { listPendingUsers, approveUser, rejectUser } from "@/api/pendingUsers";
import { onboardEmployee } from "@/api/staffOnboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RoleBadge } from "@/components/Badges";
import { logAudit } from "@/lib/performance";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { generateEmployeeEmailBase, generateUniqueEmail, EMAIL_DOMAIN } from "@/lib/company";

const ROLES = ["Super Administrator", "Administrator", "Secretary", "Department Manager", "Supervisor", "Staff Member", "Director of Operations"];

const emptyApproveForm = { full_name: "", phone: "", department_id: "", position: "", role: "Staff Member", hire_date: "" };

export default function Employees() {
  const { performer, user, role } = useOutletContext();
  const { toast } = useToast();

  const isCurrentAdmin = user?.role === "admin" || ["Super Administrator", "Administrator"].includes(role);

  const isAdminProfile = (emp) => {
    if (!emp) return false;
    return (
      emp.role === "Super Administrator" ||
      emp.role === "Administrator" ||
      (emp.email && emp.email.toLowerCase() === "epiccons.za@gmail.com") ||
      (emp.user_id && emp.user_id === user?.id && user?.role === "admin")
    );
  };
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [approvingUser, setApprovingUser] = useState(null);
  const [approveForm, setApproveForm] = useState(emptyApproveForm);
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", department_id: "", position: "",
    role: "Staff Member", hire_date: "", status: "active", employee_id_code: "",
    manager_id: "",
  });

  const loadData = async () => {
    try {
      const [emps, depts] = await Promise.all([
        Employee.list("-created_date", 300),
        Department.list("-created_date", 100),
      ]);
      setEmployees(emps || []);
      setDepartments(depts || []);
    } catch (e) {
      toast({ title: "Error", description: "Failed to load staff", variant: "destructive" });
    } finally {
      setLoading(false);
    }
    // Pending-approval requests are admin-only server-side (User.role, a
    // stricter check than the Employee.role that gates this page) - a
    // Department Manager can reach this page but always gets a 403 here,
    // which must not block the employee/department list above from loading.
    try {
      setPendingUsers((await listPendingUsers()) || []);
    } catch (e) {
      setPendingUsers([]);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      full_name: "",
      personal_email: "",
      email: "",
      phone: "",
      department_id: "",
      position: "",
      role: "Staff Member",
      hire_date: "",
      status: "active",
      employee_id_code: "",
      manager_id: "",
    });
    setShowForm(true);
  };

  const openEdit = (emp) => {
    if (isAdminProfile(emp) && !isCurrentAdmin) {
      toast({
        title: "Access Denied",
        description: "Only administrators are authorized to edit the administrator profile.",
        variant: "destructive",
      });
      return;
    }
    setEditing(emp);
    setForm({
      full_name: emp.full_name || "",
      personal_email: emp.personal_email || "",
      email: emp.email || "",
      phone: emp.phone || "",
      department_id: emp.department_id || "",
      position: emp.position || "",
      role: emp.role || "Staff Member",
      hire_date: emp.hire_date || "",
      status: emp.status || "active",
      employee_id_code: emp.employee_id_code || "",
      manager_id: emp.manager_id || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editing && isAdminProfile(editing) && !isCurrentAdmin) {
      toast({
        title: "Access Denied",
        description: "Only administrators are authorized to edit the administrator profile.",
        variant: "destructive",
      });
      return;
    }
    const dept = departments.find((d) => d.id === form.department_id);
    const otherEmails = employees.filter((emp) => emp.id !== editing?.id).map((emp) => emp.email);
    const email = form.email?.trim() || generateUniqueEmail(generateEmployeeEmailBase(form.full_name), otherEmails);
    const data = {
      ...form,
      email,
      personal_email: form.personal_email?.trim() || "",
      department_name: dept?.name || "",
      employee_id_code: form.employee_id_code?.trim() || (editing?.employee_id_code || `EIC-${Date.now().toString().slice(-6)}`),
    };
    try {
      if (editing) {
        await Employee.update(editing.id, data);
        await logAudit("Edited Employee", "Employee", editing.id, data.full_name, performer, "Updated staff information");
        toast({ title: "Updated", description: "Staff member updated" });
      } else {
        const result = await onboardEmployee(data);
        await logAudit("Created Employee", "Employee", result.employee.id, data.full_name, performer, "New staff member added with login credentials");
        const { email: emailSent, sms: smsSent, recipient } = result.notified || {};
        if (emailSent || smsSent) {
          const channels = [emailSent && (recipient || email), smsSent && data.phone].filter(Boolean).join(" and ");
          toast({ title: "Credentials sent", description: `Login details sent to ${channels}. They can now log in.` });
        } else {
          toast({ title: "Staff member added", description: "Account created, but credentials could not be dispatched automatically. Share their login details manually.", variant: "destructive" });
        }
      }
      setShowForm(false);
      loadData();
    } catch (e) {
      toast({ title: "Error", description: e?.response?.data?.error || e?.message || "Failed to save staff member", variant: "destructive" });
    }
  };

  const handleToggleStatus = async (emp) => {
    if (isAdminProfile(emp) && !isCurrentAdmin) {
      toast({
        title: "Access Denied",
        description: "Only administrators are authorized to change an administrator's status.",
        variant: "destructive",
      });
      return;
    }
    if (emp.email?.toLowerCase() === "epiccons.za@gmail.com" && emp.status === "active") {
      toast({
        title: "Action Denied",
        description: "The primary administrator account cannot be deactivated.",
        variant: "destructive",
      });
      return;
    }
    const newStatus = emp.status === "active" ? "inactive" : "active";
    try {
      await Employee.update(emp.id, { status: newStatus });
      await logAudit(newStatus === "active" ? "Activated Employee" : "Deactivated Employee", "Employee", emp.id, emp.full_name, performer, `Status changed to ${newStatus}`);
      toast({ title: "Updated", description: `${emp.full_name} ${newStatus === "active" ? "activated" : "deactivated"}` });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  const handleDelete = async (emp) => {
    if (isAdminProfile(emp) && !isCurrentAdmin) {
      toast({
        title: "Access Denied",
        description: "Only administrators are authorized to delete an administrator profile.",
        variant: "destructive",
      });
      return;
    }
    if (emp.email?.toLowerCase() === "epiccons.za@gmail.com") {
      toast({
        title: "Action Denied",
        description: "The primary administrator account cannot be deleted.",
        variant: "destructive",
      });
      return;
    }
    if (!confirm(`Remove ${emp.full_name}? This cannot be undone.`)) return;
    try {
      await Employee.delete(emp.id);
      await logAudit("Deleted Employee", "Employee", emp.id, emp.full_name, performer, "Staff member removed");
      toast({ title: "Removed", description: "Staff member removed" });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to remove staff member", variant: "destructive" });
    }
  };

  const openApprove = (pendingUser) => {
    setApprovingUser(pendingUser);
    setApproveForm({
      ...emptyApproveForm,
      full_name: pendingUser.full_name || "",
      phone: pendingUser.phone || "",
      position: pendingUser.requested_position || "",
    });
  };

  const handleApprove = async (e) => {
    e.preventDefault();
    try {
      const result = await approveUser(approvingUser.id, approveForm);
      await logAudit("Approved Account", "Employee", approvingUser.id, approveForm.full_name, performer, `Approved ${approvingUser.email} as ${approveForm.role}`);
      const { email: emailSent, sms: smsSent } = result.notified || {};
      if (emailSent || smsSent) {
        const channels = [emailSent && (approvingUser.personal_email || approvingUser.email), smsSent && approveForm.phone].filter(Boolean).join(" and ");
        toast({ title: "Credentials sent", description: `New login details sent to ${channels}. They can now log in.` });
      } else {
        toast({ title: "Approved", description: `${approveForm.full_name || approvingUser.email} can now access the system, but the notification couldn't be sent - share their new login email manually.`, variant: "destructive" });
      }
      setApprovingUser(null);
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to approve user", variant: "destructive" });
    }
  };

  const handleReject = async (pendingUser) => {
    if (!confirm(`Reject the account request from ${pendingUser.email}? This deletes their registration.`)) return;
    try {
      await rejectUser(pendingUser.id);
      await logAudit("Rejected Account", "User", pendingUser.id, pendingUser.email, performer, "Account request rejected");
      toast({ title: "Rejected", description: `${pendingUser.email}'s request was rejected` });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to reject user", variant: "destructive" });
    }
  };

  const filtered = employees.filter((emp) => {
    const matchSearch = !search ||
      emp.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      emp.email?.toLowerCase().includes(search.toLowerCase()) ||
      emp.position?.toLowerCase().includes(search.toLowerCase());
    const matchDept = filterDept === "all" || emp.department_id === filterDept;
    const matchRole = filterRole === "all" || emp.role === filterRole;
    return matchSearch && matchDept && matchRole;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900">Staff Management</h1>
          <p className="text-sm text-slate-500 mt-1">{employees.length} total • {employees.filter((e) => e.status === "active").length} active</p>
        </div>
        <Button onClick={openCreate} className="bg-slate-800 hover:bg-slate-900">
          <Plus className="w-4 h-4 mr-1" /> Add Staff
        </Button>
      </div>

      {/* Pending approvals */}
      {pendingUsers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-amber-800 flex items-center gap-2 mb-3">
            <UserPlus className="w-4 h-4" /> Pending Approvals ({pendingUsers.length})
          </h2>
          <div className="space-y-2">
            {pendingUsers.map((pu) => (
              <div key={pu.id} className="flex items-center justify-between bg-white rounded-lg border border-amber-100 px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-800">{pu.full_name || pu.email}</p>
                  <p className="text-xs text-slate-400">{pu.email}</p>
                  {(pu.requested_department || pu.requested_position) && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      Requested: {[pu.requested_position, pu.requested_department].filter(Boolean).join(" — ")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleReject(pu)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Reject">
                    <Ban className="w-4 h-4" />
                  </button>
                  <Button size="sm" onClick={() => openApprove(pu)} className="bg-amber-500 hover:bg-amber-600 text-slate-900">
                    <Check className="w-3.5 h-3.5 mr-1" /> Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, position..." className="pl-9" />
        </div>
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Departments" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Name</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Department</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Role</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Contact</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Portal Access</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {emp.full_name?.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-800">{emp.full_name}</p>
                          {emp.employee_id_code && (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {emp.employee_id_code}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">{emp.position || emp.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-sm text-slate-600">{emp.department_name || "—"}</p>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <RoleBadge role={emp.role} />
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <p className="text-xs text-slate-700 font-medium flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400" /> {emp.email || "—"}</p>
                    {emp.phone && <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3 text-slate-400" /> {emp.phone}</p>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {emp.user_id ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                        <CheckCircle2 className="w-3 h-3" /> Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
                        <UserCheck className="w-3 h-3" /> No login yet
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold",
                      emp.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500")}>
                      {emp.status === "active" ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {(!isAdminProfile(emp) || isCurrentAdmin) ? (
                        <>
                          <button onClick={() => openEdit(emp)} title="Edit staff member" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                            <Pencil className="w-4 h-4" />
                          </button>
                          {emp.email?.toLowerCase() !== "epiccons.za@gmail.com" && (
                            <button onClick={() => handleToggleStatus(emp)} className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 text-xs font-medium" title={emp.status === "active" ? "Deactivate" : "Activate"}>
                              {emp.status === "active" ? "Deactivate" : "Activate"}
                            </button>
                          )}
                          {emp.email?.toLowerCase() !== "epiccons.za@gmail.com" && (
                            <button onClick={() => handleDelete(emp)} title="Delete staff member" className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-md" title="Only administrators can edit this profile">
                          <Lock className="w-3 h-3 text-slate-400" /> Protected
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No staff members found</p>
          </div>
        )}
      </div>

      {/* Add/Edit Staff Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold text-slate-900">{editing ? "Edit Staff Member" : "Add Staff Member"}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Full Name *</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Jane Doe" required />
                </div>
                <div>
                  <Label>Personal / Notification Email</Label>
                  <Input
                    type="email"
                    value={form.personal_email}
                    onChange={(e) => setForm({ ...form, personal_email: e.target.value })}
                    placeholder="e.g. employee@gmail.com"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Credentials & temporary password will be sent here.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Official Company Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder={form.full_name ? `${generateEmployeeEmailBase(form.full_name)}@${EMAIL_DOMAIN}` : "Auto-generated if left blank"}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Official username for logging in</p>
                </div>
                <div>
                  <Label className="flex items-center justify-between">
                    <span>Employee ID</span>
                    <span className="text-[10px] text-amber-600 font-semibold">Admin Editable</span>
                  </Label>
                  <Input
                    value={form.employee_id_code}
                    onChange={(e) => setForm({ ...form, employee_id_code: e.target.value })}
                    placeholder="Auto-generated if left blank (e.g. EIC-XXXXXX)"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Displayed on profile as read-only</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="077 123 4567 or +263..." />
                  {form.phone && form.phone.trim().startsWith("0") && (
                    <p className="text-xs text-emerald-600 mt-1">✓ Local number (auto-formats as +263 {form.phone.trim().slice(1)})</p>
                  )}
                </div>
                <div>
                  <Label>Position / Title</Label>
                  <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="e.g. Senior Consultant" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Department</Label>
                  <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Role *</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(isCurrentAdmin ? ROLES : ROLES.filter((r) => !["Super Administrator", "Administrator"].includes(r))).map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Direct Manager</Label>
                <Select value={form.manager_id} onValueChange={(v) => setForm({ ...form, manager_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select manager (optional)" /></SelectTrigger>
                  <SelectContent>
                    {employees.filter((e) => e.status === "active" && e.id !== editing?.id).map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.full_name} — {emp.position || emp.role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Hire Date</Label>
                  <Input type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 bg-slate-800 hover:bg-slate-900">{editing ? "Update" : "Add Staff"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approve Pending User Dialog */}
      {approvingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setApprovingUser(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold text-slate-900">Approve {approvingUser.email}</h2>
              <button onClick={() => setApprovingUser(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleApprove} className="space-y-4">
              <div>
                <Label>Full Name *</Label>
                <Input value={approveForm.full_name} onChange={(e) => setApproveForm({ ...approveForm, full_name: e.target.value })} required />
                {approveForm.full_name && (
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <Mail className="w-3 h-3" /> New login &amp; company email: <span className="font-medium text-slate-600">{generateEmployeeEmailBase(approveForm.full_name)}@{EMAIL_DOMAIN}</span>
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  They'll be notified at {approvingUser.personal_email || approvingUser.email}
                  {approveForm.phone ? ` and ${approveForm.phone}` : ""}.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={approveForm.phone}
                    onChange={(e) => setApproveForm({ ...approveForm, phone: e.target.value })}
                    placeholder="077 123 4567 or +263..."
                  />
                  {approveForm.phone && approveForm.phone.trim().startsWith("0") && (
                    <p className="text-xs text-emerald-600 mt-1">✓ Local number (auto-formats as +263 {approveForm.phone.trim().slice(1)})</p>
                  )}
                </div>
                <div>
                  <Label>Position / Title</Label>
                  <Input value={approveForm.position} onChange={(e) => setApproveForm({ ...approveForm, position: e.target.value })} placeholder="e.g. Senior Consultant" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Department</Label>
                  <Select value={approveForm.department_id} onValueChange={(v) => setApproveForm({ ...approveForm, department_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {approvingUser?.requested_department && (
                    <p className="text-xs text-slate-400 mt-1">They entered: "{approvingUser.requested_department}"</p>
                  )}
                </div>
                <div>
                  <Label>Role *</Label>
                  <Select value={approveForm.role} onValueChange={(v) => setApproveForm({ ...approveForm, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Hire Date</Label>
                <Input type="date" value={approveForm.hire_date} onChange={(e) => setApproveForm({ ...approveForm, hire_date: e.target.value })} />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setApprovingUser(null)}>Cancel</Button>
                <Button type="submit" className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900">Approve &amp; Create Staff Record</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
