import React, { useState, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import {
  ListTodo, Plus, CheckCircle2, Circle, Trash2, Pencil, Calendar,
  AlertCircle, ArrowRightCircle, Users, Check, X, Search, Filter,
  Clock, ShieldCheck
} from "lucide-react";
import { TodoItem, Employee, Department } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PriorityBadge } from "@/components/Badges";
import { formatDateTime, formatDate } from "@/lib/performance";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export default function TodoList() {
  const { employee, role, performer, user } = useOutletContext();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [todos, setTodos] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tabs: "my" vs "team"
  const canViewTeam = ["Super Administrator", "Administrator", "Director of Operations", "Department Manager"].includes(role);
  const [activeTab, setActiveTab] = useState("my");

  // Team view filters
  const [selectedDeptId, setSelectedDeptId] = useState("all");
  const [selectedEmpId, setSelectedEmpId] = useState("all");

  // Status filter: "all" | "active" | "completed"
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // New todo form
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState("Medium");
  const [newDueDate, setNewDueDate] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Edit modal
  const [editingTodo, setEditingTodo] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allTodos, emps, depts] = await Promise.all([
        TodoItem.list("-created_date", 500),
        Employee.list("-created_date", 300),
        Department.list("-created_date", 100),
      ]);
      setTodos(allTodos || []);
      setEmployees(emps || []);
      setDepartments(depts || []);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load to-do items", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter employees for department manager
  const scopedEmployees = (role === "Department Manager" && employee)
    ? employees.filter((e) => e.department_id === employee.department_id)
    : employees;

  // Handle Quick Add
  const handleCreateTodo = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast({ title: "Validation Error", description: "Title is required", variant: "destructive" });
      return;
    }

    try {
      await TodoItem.create({
        title: newTitle.trim(),
        description: newDescription.trim(),
        priority: newPriority,
        due_date: newDueDate || null,
        completed: false,
      });
      toast({ title: "Created", description: "To-do item added to your personal list" });
      setNewTitle("");
      setNewDescription("");
      setNewPriority("Medium");
      setNewDueDate("");
      setShowAddForm(false);
      loadData();
    } catch (err) {
      toast({ title: "Error", description: "Failed to create to-do item", variant: "destructive" });
    }
  };

  // Toggle completed
  const handleToggleComplete = async (todo) => {
    try {
      const nextCompleted = !todo.completed;
      await TodoItem.update(todo.id, {
        completed: nextCompleted,
        completed_date: nextCompleted ? new Date().toISOString() : null,
      });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: "Failed to update item", variant: "destructive" });
    }
  };

  // Delete
  const handleDeleteTodo = async (id) => {
    if (!confirm("Are you sure you want to delete this to-do item?")) return;
    try {
      await TodoItem.delete(id);
      toast({ title: "Deleted", description: "To-do item removed" });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete item", variant: "destructive" });
    }
  };

  // Save Edit
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingTodo) return;
    try {
      await TodoItem.update(editingTodo.id, {
        title: editingTodo.title,
        description: editingTodo.description,
        priority: editingTodo.priority,
        due_date: editingTodo.due_date || null,
      });
      toast({ title: "Updated", description: "To-do item updated" });
      setEditingTodo(null);
      loadData();
    } catch (err) {
      toast({ title: "Error", description: "Failed to update item", variant: "destructive" });
    }
  };

  const isAdministrator = (emp) => {
    if (!emp) return false;
    const r = emp.role || "";
    const name = emp.full_name || "";
    return (
      ["Super Administrator", "Administrator"].includes(r) ||
      r.toLowerCase().includes("admin") ||
      name.toLowerCase() === "super administrator" ||
      name.toLowerCase() === "administrator"
    );
  };

  // Convert to Official Task (Department Manager / Admin action)
  const handleConvertToTask = (todo) => {
    const targetEmp = employees.find((e) => e.id === todo.employee_id);
    if (isAdministrator(targetEmp)) {
      toast({
        title: "Action Blocked",
        description: "Tasks cannot be assigned to Administrators.",
        variant: "destructive",
      });
      return;
    }
    const targetEmpId = todo.employee_id || "";
    const params = new URLSearchParams({
      convert_title: todo.title,
      convert_desc: todo.description || "",
      assign_to: targetEmpId,
      priority: todo.priority || "Medium",
    });
    navigate(`/tasks?${params.toString()}`);
  };

  // Current employee ID
  const myEmpId = employee?.id || user?.id;

  // Filter items for "My To-Dos"
  const myTodos = todos.filter((t) => t.employee_id === myEmpId || t.created_by_id === user?.id);

  // Filter items for "Team Members' To-Dos"
  const teamTodos = todos.filter((t) => {
    if (selectedDeptId !== "all" && t.department_id !== selectedDeptId) return false;
    if (selectedEmpId !== "all" && t.employee_id !== selectedEmpId) return false;
    return true;
  });

  const displayedList = (activeTab === "my" ? myTodos : teamTodos).filter((t) => {
    if (statusFilter === "active" && t.completed) return false;
    if (statusFilter === "completed" && !t.completed) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return t.title.toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q);
    }
    return true;
  });

  // Calculate stats for current view
  const currentTotal = (activeTab === "my" ? myTodos : teamTodos).length;
  const currentCompleted = (activeTab === "my" ? myTodos : teamTodos).filter((t) => t.completed).length;
  const currentActive = currentTotal - currentCompleted;
  const progressPct = currentTotal > 0 ? Math.round((currentCompleted / currentTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <ListTodo className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold text-slate-900">Personal To-Do List</h1>
              <p className="text-xs text-slate-500">
                Manage personal day-to-day work, notes, and checklists without affecting company performance metrics.
              </p>
            </div>
          </div>
        </div>

        {activeTab === "my" && (
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" /> Add To-Do Item
          </Button>
        )}
      </div>

      {/* Tabs (for managers/admins) */}
      {canViewTeam && (
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("my")}
            className={cn(
              "pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors",
              activeTab === "my"
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <ListTodo className="w-4 h-4" /> My To-Dos ({myTodos.length})
          </button>
          <button
            onClick={() => setActiveTab("team")}
            className={cn(
              "pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors",
              activeTab === "team"
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <Users className="w-4 h-4" /> Team Members' To-Dos
          </button>
        </div>
      )}

      {/* Quick Add Form (Collapsible/Toggle) */}
      {activeTab === "my" && showAddForm && (
        <div className="bg-white rounded-xl border border-amber-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-600" /> New Personal To-Do
            </h3>
            <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleCreateTodo} className="space-y-3">
            <div>
              <Label className="text-xs">Title *</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Review client proposal draft..."
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label className="text-xs">Notes / Description (Optional)</Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Add checklist details, links, or notes..."
                rows={2}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Priority</Label>
                <Select value={newPriority} onValueChange={setNewPriority}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Target Due Date & Time (Optional)</Label>
                <Input
                  type="datetime-local"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold">
                Save To-Do
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Team Filter Bar (If in Team tab) */}
      {activeTab === "team" && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-4">
          {role !== "Department Manager" && (
            <div className="w-48">
              <Label className="text-xs text-slate-500">Department</Label>
              <Select value={selectedDeptId} onValueChange={(val) => { setSelectedDeptId(val); setSelectedEmpId("all"); }}>
                <SelectTrigger className="mt-1 bg-white">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="w-56">
            <Label className="text-xs text-slate-500">Select Team Member</Label>
            <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
              <SelectTrigger className="mt-1 bg-white">
                <SelectValue placeholder="All Team Members" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Team Members</SelectItem>
                {scopedEmployees
                  .filter((e) => selectedDeptId === "all" || e.department_id === selectedDeptId)
                  .map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name} ({e.position || e.role})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[200px] flex items-end">
            <div className="p-2.5 rounded-lg bg-amber-50/80 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                As a manager, you can inspect staff to-do lists and click <strong>"Convert to Official Task"</strong> to assign it officially with performance weight.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Progress & Search Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Status filter chips */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setStatusFilter("all")}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-semibold transition-colors",
                statusFilter === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              All ({currentTotal})
            </button>
            <button
              onClick={() => setStatusFilter("active")}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-semibold transition-colors",
                statusFilter === "active" ? "bg-amber-500 text-slate-900" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              Active ({currentActive})
            </button>
            <button
              onClick={() => setStatusFilter("completed")}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-semibold transition-colors",
                statusFilter === "completed" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              Completed ({currentCompleted})
            </button>
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search to-dos..."
              className="pl-8 text-xs h-8"
            />
          </div>
        </div>

        {/* Progress bar */}
        {currentTotal > 0 && (
          <div className="space-y-1 pt-1 border-t border-slate-100">
            <div className="flex justify-between text-xs text-slate-500">
              <span>{currentCompleted} of {currentTotal} completed</span>
              <span className="font-semibold text-slate-700">{progressPct}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* To-Do Items List */}
      <div className="space-y-2.5">
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm">Loading to-do items...</div>
        ) : displayedList.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <ListTodo className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">No to-do items found</p>
            <p className="text-xs text-slate-400 mt-1">
              {activeTab === "my"
                ? "Click 'Add To-Do Item' above to start tracking your daily tasks."
                : "No to-do items recorded for the selected team members."}
            </p>
          </div>
        ) : (
          displayedList.map((todo) => {
            const isOwner = todo.created_by_id === user?.id || todo.employee_id === myEmpId;
            return (
              <div
                key={todo.id}
                className={cn(
                  "bg-white rounded-xl border p-4 transition-all duration-200 flex items-start gap-3.5 group hover:shadow-sm",
                  todo.completed ? "border-slate-200 bg-slate-50/50" : "border-slate-200"
                )}
              >
                {/* Interactive Checkbox (for owner) or Indicator */}
                {isOwner ? (
                  <button
                    onClick={() => handleToggleComplete(todo)}
                    className="mt-0.5 text-slate-400 hover:text-emerald-600 transition-colors shrink-0"
                    title={todo.completed ? "Mark incomplete" : "Mark complete"}
                  >
                    {todo.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-50" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>
                ) : (
                  <div className="mt-0.5 shrink-0">
                    {todo.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Clock className="w-5 h-5 text-slate-300" />
                    )}
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "text-sm font-semibold transition-colors",
                          todo.completed ? "line-through text-slate-400" : "text-slate-900"
                        )}
                      >
                        {todo.title}
                      </p>
                      {todo.description && (
                        <p className={cn("text-xs mt-1 whitespace-pre-line", todo.completed ? "text-slate-400" : "text-slate-600")}>
                          {todo.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <PriorityBadge priority={todo.priority || "Medium"} />
                    </div>
                  </div>

                  {/* Metadata & Actions row */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mt-2.5 pt-2 border-t border-slate-100 text-xs text-slate-400">
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Owner display in team tab */}
                      {activeTab === "team" && todo.employee_name && (
                        <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {todo.employee_name}
                        </span>
                      )}

                      {todo.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Target: {String(todo.due_date).includes("T") || String(todo.due_date).includes(" ") ? formatDateTime(todo.due_date) : formatDate(todo.due_date)}
                        </span>
                      )}

                      {todo.completed && todo.completed_date && (
                        <span className="text-emerald-600 font-medium">
                          Completed on {new Date(todo.completed_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5">
                      {/* Convert to Official Task button for managers (only if owner is not an admin) */}
                      {canViewTeam && activeTab === "team" && !todo.completed && !isAdministrator(employees.find((e) => e.id === todo.employee_id)) && (
                        <Button
                          onClick={() => handleConvertToTask(todo)}
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 font-medium gap-1"
                        >
                          <ArrowRightCircle className="w-3.5 h-3.5" /> Convert to Official Task
                        </Button>
                      )}

                      {/* Edit / Delete for owner */}
                      {isOwner && (
                        <>
                          <button
                            onClick={() => setEditingTodo(todo)}
                            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTodo(todo.id)}
                            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit Dialog Modal */}
      {editingTodo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setEditingTodo(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-heading font-bold text-slate-900">Edit To-Do Item</h3>
              <button onClick={() => setEditingTodo(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <Label>Title *</Label>
                <Input
                  value={editingTodo.title}
                  onChange={(e) => setEditingTodo({ ...editingTodo, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={editingTodo.description || ""}
                  onChange={(e) => setEditingTodo({ ...editingTodo, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Priority</Label>
                  <Select
                    value={editingTodo.priority || "Medium"}
                    onValueChange={(val) => setEditingTodo({ ...editingTodo, priority: val })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Due Date & Time</Label>
                  <Input
                    type="datetime-local"
                    value={editingTodo.due_date ? String(editingTodo.due_date).slice(0, 16) : ""}
                    onChange={(e) => setEditingTodo({ ...editingTodo, due_date: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <Button type="button" variant="outline" onClick={() => setEditingTodo(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold">
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
