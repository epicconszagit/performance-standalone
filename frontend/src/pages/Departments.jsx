import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Building2, Plus, Pencil, Trash2, Users, X, Mail } from "lucide-react";
import { Department, Employee } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logAudit } from "@/lib/performance";
import { useToast } from "@/components/ui/use-toast";
import { generateDepartmentEmailBase, generateUniqueEmail } from "@/lib/company";

const COLORS = ["#1e3a5f", "#0f766e", "#7c2d12", "#581c87", "#92400e", "#991b1b", "#1e40af", "#166534"];

export default function Departments() {
  const { performer } = useOutletContext();
  const { toast } = useToast();
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", code: "", email: "", description: "", manager_id: "", color: COLORS[0] });

  const loadData = async () => {
    try {
      const [depts, emps] = await Promise.all([
        Department.list("-created_date", 100),
        Employee.list("-created_date", 200),
      ]);
      setDepartments(depts || []);
      setEmployees(emps || []);
    } catch (e) {
      toast({ title: "Error", description: "Failed to load departments", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", code: "", email: "", description: "", manager_id: "", color: COLORS[0] });
    setShowForm(true);
  };

  const openEdit = (dept) => {
    setEditing(dept);
    setForm({ name: dept.name || "", code: dept.code || "", email: dept.email || "", description: dept.description || "", manager_id: dept.manager_id || "", color: dept.color || COLORS[0] });
    setShowForm(true);
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
      toast({ title: "Error", description: "Failed to save department", variant: "destructive" });
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
      toast({ title: "Error", description: "Failed to delete department", variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900">Departments</h1>
          <p className="text-sm text-slate-500 mt-1">Manage company departments and assignments</p>
        </div>
        <Button onClick={openCreate} className="bg-slate-800 hover:bg-slate-900">
          <Plus className="w-4 h-4 mr-1" /> New Department
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
            const count = employees.filter((e) => e.department_id === dept.id && e.status === "active").length;
            return (
              <div key={dept.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow group">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm" style={{ backgroundColor: dept.color || "#1e3a5f" }}>
                    {dept.name?.[0]?.toUpperCase() || "D"}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(dept)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(dept)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <h3 className="font-heading font-bold text-slate-900 mt-3">{dept.name}</h3>
                {dept.code && <p className="text-xs text-slate-400 font-mono mt-0.5">{dept.code}</p>}
                {dept.email && (
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1"><Mail className="w-3 h-3" /> {dept.email}</p>
                )}
                <p className="text-sm text-slate-500 mt-2 line-clamp-2">{dept.description || "No description"}</p>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Users className="w-3.5 h-3.5" /> {count} {count === 1 ? "member" : "members"}
                  </div>
                  <div className="text-xs text-slate-500 truncate max-w-[50%]">
                    {dept.manager_name ? `Mgr: ${dept.manager_name}` : "No manager"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold text-slate-900">{editing ? "Edit Department" : "New Department"}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Department Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Operations" />
              </div>
              <div>
                <Label>Department ID / Code</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. OPS" />
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
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
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
                      className={`w-8 h-8 rounded-lg ${form.color === c ? "ring-2 ring-offset-2 ring-slate-800" : ""}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 bg-slate-800 hover:bg-slate-900">{editing ? "Update" : "Create"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}