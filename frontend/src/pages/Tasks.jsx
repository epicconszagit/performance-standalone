import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import {
  CheckSquare, Plus, Pencil, Trash2, X, Search, Archive, Clock,
  AlertTriangle, CheckCircle2, ArchiveRestore, LayoutGrid, List,
  Eye, FileText, Send, Check, XCircle, Paperclip
} from "lucide-react";
import { Task, Employee, Department } from "@/api/entities";
import { SendEmail, UploadFile } from "@/api/integrations";
import KanbanBoard from "@/components/tasks/KanbanBoard";
import SubmitReportDialog from "@/components/tasks/SubmitReportDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/Badges";
import { isOverdue, getEffectiveStatus, formatDate, formatDateTime, logAudit, createNotification } from "@/lib/performance";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

const STATUSES = ["Pending", "In Progress", "Submitted", "Completed", "Archived"];
const TABS = [
  { key: "all", label: "All", icon: CheckSquare },
  { key: "pending", label: "Pending", icon: Clock },
  { key: "in_progress", label: "In Progress", icon: Clock },
  { key: "submitted", label: "Submitted", icon: Send },
  { key: "overdue", label: "Overdue", icon: AlertTriangle },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
  { key: "archived", label: "Archived", icon: Archive },
  { key: "trash", label: "Trash", icon: Trash2, adminOnly: true },
];

export default function Tasks() {
  const { employee, role, performer, user } = useOutletContext();
  const { toast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [trashedTasks, setTrashedTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [view, setView] = useState("list");
  const [reportTask, setReportTask] = useState(null);
  const [reportViewTask, setReportViewTask] = useState(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", assigned_to_ids: [],
    deadline: "", expected_completion_date: "",
    attachment_file_url: "", attachment_file_name: "",
  });

  const isAdmin = ["Super Administrator", "Administrator", "Director of Operations", "Department Manager"].includes(role);
  const isSecretary = role === "Secretary";
  const canAssignToAnyone = ["Super Administrator", "Administrator", "Director of Operations", "Department Manager"].includes(role);

  const isAssignee = (task) => !!(employee && (task.assigned_to_ids || []).includes(employee.id));
  const isAssigner = (task) => !!((employee && task.assigned_by_id === employee.id) || isAdmin || isSecretary);

  const loadData = async () => {
    try {
      const [allTasks, emps, depts] = await Promise.all([
        Task.list("-created_date", 300),
        Employee.list("-created_date", 300),
        Department.list("-created_date", 100),
      ]);
      let myTasks = allTasks || [];
      if (!isAdmin && !isSecretary) {
        // No linked employee record means we can't tell which tasks are theirs -
        // show none rather than leaking every task in the company.
        myTasks = employee ? (allTasks || []).filter((t) => (t.assigned_to_ids || []).includes(employee.id)) : [];
      } else if (role === "Department Manager") {
        myTasks = employee ? (allTasks || []).filter((t) => !t.department_id || t.department_id === employee.department_id || (t.assigned_to_ids || []).includes(employee.id)) : [];
      }
      const activeTasks = myTasks.filter((t) => !t.deleted);
      setTasks(activeTasks);
      setTrashedTasks(myTasks.filter((t) => t.deleted));
      setEmployees(emps || []);
      setDepartments(depts || []);
      if (employee) markTasksSeen(activeTasks, emps || []);
    } catch (e) {
      toast({ title: "Error", description: "Failed to load tasks", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [employee]);

  const markTasksSeen = async (myTasks, emps) => {
    if (!employee) return;
    const unseen = myTasks.filter((t) =>
      (t.assigned_to_ids || []).includes(employee.id) &&
      !((t.seen_by_ids || []).includes(employee.id)) &&
      !t.archived && t.status !== "Archived"
    );
    for (const task of unseen) {
      try {
        const seenBy = [...(task.seen_by_ids || []), employee.id];
        await Task.update(task.id, {
          seen_by_ids: seenBy,
          last_seen_date: new Date().toISOString(),
        });
        if (task.assigned_by_id && task.assigned_by_id !== employee.id) {
          const mgr = emps.find((e) => e.id === task.assigned_by_id);
          if (mgr) {
            await createNotification(mgr.user_id || mgr.id, mgr.id, "Task Seen", `${employee.full_name} has seen the task "${task.title}"`, "task_seen", task.id, "/tasks");
          }
        }
      } catch (e) { }
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: "", description: "",
      assigned_to_ids: (!canAssignToAnyone && employee) ? [employee.id] : [],
      deadline: "", expected_completion_date: "",
      attachment_file_url: "", attachment_file_name: "",
    });
    setShowForm(true);
  };

  const openEdit = (task) => {
    setEditing(task);
    setForm({
      title: task.title || "", description: task.description || "",
      assigned_to_ids: task.assigned_to_ids || [],
      deadline: task.deadline ? task.deadline.slice(0, 16) : "", expected_completion_date: task.expected_completion_date || "",
      attachment_file_url: task.attachment_file_url || "", attachment_file_name: task.attachment_file_name || "",
    });
    setShowForm(true);
  };

  const handleAttachmentUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAttachment(true);
    try {
      const res = await UploadFile({ file });
      setForm((prev) => ({ ...prev, attachment_file_url: res.file_url, attachment_file_name: file.name }));
    } catch (err) {
      toast({ title: "Error", description: "Upload failed", variant: "destructive" });
    } finally {
      setUploadingAttachment(false);
    }
  };

  const toggleAssignee = (empId) => {
    setForm((prev) => ({
      ...prev,
      assigned_to_ids: prev.assigned_to_ids.includes(empId)
        ? prev.assigned_to_ids.filter((id) => id !== empId)
        : [...prev.assigned_to_ids, empId],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalAssigneeIds = (!canAssignToAnyone && employee) ? [employee.id] : form.assigned_to_ids;
    if (finalAssigneeIds.length === 0) {
      toast({ title: "Error", description: "Please assign at least one staff member", variant: "destructive" });
      return;
    }
    const assignedNames = finalAssigneeIds
      .map((id) => employees.find((emp) => emp.id === id)?.full_name)
      .filter(Boolean);
    const data = {
      title: form.title,
      description: form.description,
      assigned_to_ids: finalAssigneeIds,
      assigned_to_names: assignedNames,
      assigned_by_id: performer.id,
      assigned_by_name: performer.name,
      deadline: form.deadline,
      expected_completion_date: form.expected_completion_date,
      attachment_file_url: form.attachment_file_url,
      attachment_file_name: form.attachment_file_name,
      status: editing?.status || "Pending",
    };
    try {
      if (editing) {
        await Task.update(editing.id, data);
        await logAudit("Edited Task", "Task", editing.id, data.title, performer, "Task details updated");
        toast({ title: "Updated", description: "Task updated successfully" });
      } else {
        const created = await Task.create(data);
        await logAudit("Created Task", "Task", created.id, data.title, performer, `Assigned to ${assignedNames.join(", ")}`);
        for (const empId of finalAssigneeIds) {
          const emp = employees.find((e) => e.id === empId);
          if (emp) {
            await createNotification(emp.user_id || empId, empId, "New Task Assigned", `You have been assigned: "${data.title}"`, "task_assigned", created.id, "/tasks");
          }
        }
        toast({ title: "Created", description: "Task assigned successfully" });
      }
      setShowForm(false);
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to save task", variant: "destructive" });
    }
  };

  const handleStart = async (task) => {
    if (!isAssignee(task)) {
      toast({ title: "Denied", description: "Only the assigned staff member can start this task", variant: "destructive" });
      return;
    }
    if (task.status !== "Pending") return;
    try {
      await Task.update(task.id, {
        status: "In Progress",
        doer_started: true,
        doer_started_date: new Date().toISOString(),
        doer_started_by_id: employee.id,
        doer_started_by_name: employee.full_name,
        progress_pct: 25,
      });
      await logAudit("Started Task", "Task", task.id, task.title, performer, "Doer started work");
      if (task.assigned_by_id && task.assigned_by_id !== employee.id) {
        const mgr = employees.find((e) => e.id === task.assigned_by_id);
        if (mgr) await createNotification(mgr.user_id || mgr.id, mgr.id, "Task Started", `${employee.full_name} started working on "${task.title}"`, "task_started", task.id, "/tasks");
      }
      toast({ title: "Started", description: "Task is now in progress" });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to start task", variant: "destructive" });
    }
  };

  const handleSubmitReport = async (heading, report, fileUrl, fileName) => {
    const task = reportTask;
    if (!task) return;
    if (!isAssignee(task)) {
      toast({ title: "Denied", description: "Only the assigned staff member can submit a report", variant: "destructive" });
      return;
    }
    if (task.status !== "In Progress" && task.status !== "Submitted") {
      toast({ title: "Error", description: "Start the task before submitting a report", variant: "destructive" });
      return;
    }
    try {
      await Task.update(task.id, {
        status: "Submitted",
        completion_report_heading: heading,
        completion_report: report,
        completion_report_file_url: fileUrl || "",
        completion_report_file_name: fileName || "",
        completion_report_date: new Date().toISOString(),
        submitted_date: new Date().toISOString(),
        submitted_by_id: employee.id,
        submitted_by_name: employee.full_name,
        progress_pct: 90,
      });
      await logAudit("Submitted Task for Approval", "Task", task.id, task.title, performer, "Completion report submitted");
      if (task.assigned_by_id) {
        const mgr = employees.find((e) => e.id === task.assigned_by_id);
        if (mgr) await createNotification(mgr.user_id || mgr.id, mgr.id, "Task Submitted for Approval", `${employee.full_name} submitted "${task.title}" for your approval`, "task_submitted", task.id, "/tasks");
      }
      toast({ title: "Submitted", description: "Task submitted for approval" });
      setReportTask(null);
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to submit report", variant: "destructive" });
    }
  };

  const handleApprove = async (task) => {
    if (!isAssigner(task)) {
      toast({ title: "Denied", description: "Only the task assigner or admin can approve", variant: "destructive" });
      return;
    }
    if (task.status !== "Submitted") return;
    const today = new Date().toISOString().split("T")[0];
    try {
      await Task.update(task.id, {
        status: "Completed",
        completed_date: today,
        completed_on_time: task.deadline ? new Date(task.deadline) >= new Date(today) : true,
        approved_by_id: employee?.id || performer.id,
        approved_by_name: employee?.full_name || performer.name,
        approved_date: new Date().toISOString(),
        progress_pct: 100,
      });
      await logAudit("Approved Task", "Task", task.id, task.title, performer, "Task approved and completed");
      for (const empId of task.assigned_to_ids || []) {
        const emp = employees.find((e) => e.id === empId);
        if (emp) await createNotification(emp.user_id || emp.id, emp.id, "Task Approved", `"${task.title}" has been approved and marked complete`, "task_approved", task.id, "/tasks");
      }
      toast({ title: "Approved", description: "Task approved and completed" });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to approve task", variant: "destructive" });
    }
  };

  const handleReject = async (task) => {
    if (!isAssigner(task)) {
      toast({ title: "Denied", description: "Only the task assigner or admin can reject", variant: "destructive" });
      return;
    }
    const reason = prompt("Reason for rejection (optional):") || "";
    try {
      await Task.update(task.id, {
        status: "In Progress",
        rejection_reason: reason,
      });
      await logAudit("Rejected Task Submission", "Task", task.id, task.title, performer, reason || "Submission rejected");
      for (const empId of task.assigned_to_ids || []) {
        const emp = employees.find((e) => e.id === empId);
        if (emp) await createNotification(emp.user_id || emp.id, emp.id, "Task Needs Revision", `"${task.title}" was not approved. ${reason}`, "task_rejected", task.id, "/tasks");
      }
      toast({ title: "Rejected", description: "Task sent back for revision" });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to reject task", variant: "destructive" });
    }
  };

  const handleStatusChange = async (task, newStatus) => {
    if (newStatus === "In Progress") return handleStart(task);
    if (newStatus === "Submitted") {
      toast({ title: "Info", description: "Use the 'Submit Report' button to send for approval" });
      return;
    }
    if (newStatus === "Completed") {
      if (task.status !== "Submitted") {
        toast({ title: "Cannot complete", description: "Task must be submitted for approval first", variant: "destructive" });
        return;
      }
      return handleApprove(task);
    }
    if (newStatus === "Pending") {
      if (!isAssigner(task)) {
        toast({ title: "Denied", description: "Only the assigner or admin can reopen", variant: "destructive" });
        return;
      }
      try {
        // Clear the "Completed" markers along with the status, or the card
        // shows a Pending badge next to a stale "Completed" date/approver.
        // The submitted report itself is kept as a historical record.
        await Task.update(task.id, {
          status: "Pending",
          progress_pct: 0,
          completed_date: "",
          completed_on_time: null,
          approved_by_id: "",
          approved_by_name: "",
          approved_date: "",
          doer_started: false,
          doer_started_date: "",
          doer_started_by_id: "",
          doer_started_by_name: "",
        });
        await logAudit("Reopened Task", "Task", task.id, task.title, performer, "");
        toast({ title: "Reopened", description: "Task reopened" });
        loadData();
      } catch (e) {
        toast({ title: "Error", description: "Failed to reopen task", variant: "destructive" });
      }
    }
  };

  const handleArchive = async (task) => {
    try {
      // "archived" is an independent flag, not a substitute for the real
      // workflow status - toggling it must never overwrite status, or
      // restoring a task always lands it on the wrong state.
      await Task.update(task.id, { archived: !task.archived });
      await logAudit(task.archived ? "Unarchived Task" : "Archived Task", "Task", task.id, task.title, performer, "");
      toast({ title: "Updated", description: task.archived ? "Task restored" : "Task archived" });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to archive task", variant: "destructive" });
    }
  };

  const handleDelete = async (task) => {
    if (!confirm(`Move "${task.title}" to Trash? You can restore it later from the Trash tab.`)) return;
    try {
      await Task.update(task.id, { deleted: true, deleted_date: new Date().toISOString() });
      await logAudit("Deleted Task", "Task", task.id, task.title, performer, "Moved to trash");
      toast({ title: "Moved to Trash", description: "Task can be restored from the Trash tab" });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete task", variant: "destructive" });
    }
  };

  const handleRestoreFromTrash = async (task) => {
    try {
      await Task.update(task.id, { deleted: false, deleted_date: "" });
      await logAudit("Restored Task", "Task", task.id, task.title, performer, "Restored from trash");
      toast({ title: "Restored", description: "Task restored" });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to restore task", variant: "destructive" });
    }
  };

  const handlePermanentDelete = async (task) => {
    if (!confirm(`Permanently delete "${task.title}"? This cannot be undone.`)) return;
    try {
      await Task.delete(task.id);
      await logAudit("Permanently Deleted Task", "Task", task.id, task.title, performer, "Removed from trash permanently");
      toast({ title: "Deleted", description: "Task permanently deleted" });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to permanently delete task", variant: "destructive" });
    }
  };

  const isTrashView = activeTab === "trash";

  const filtered = (isTrashView ? trashedTasks : tasks).filter((task) => {
    const matchSearch = !search || task.title?.toLowerCase().includes(search.toLowerCase());
    let matchTab = true;
    if (activeTab === "pending") matchTab = task.status === "Pending";
    else if (activeTab === "in_progress") matchTab = task.status === "In Progress";
    else if (activeTab === "submitted") matchTab = task.status === "Submitted";
    else if (activeTab === "overdue") matchTab = isOverdue(task);
    else if (activeTab === "completed") matchTab = task.status === "Completed";
    else if (activeTab === "archived") matchTab = task.status === "Archived" || task.archived;
    return matchSearch && matchTab;
  });

  const counts = {
    all: tasks.length,
    pending: tasks.filter((t) => t.status === "Pending").length,
    in_progress: tasks.filter((t) => t.status === "In Progress").length,
    submitted: tasks.filter((t) => t.status === "Submitted").length,
    overdue: tasks.filter((t) => isOverdue(t)).length,
    completed: tasks.filter((t) => t.status === "Completed").length,
    archived: tasks.filter((t) => t.status === "Archived" || t.archived).length,
    trash: trashedTasks.length,
  };

  const canEditTask = (task) => isAdmin || isSecretary || (employee && (task.assigned_to_ids || []).includes(employee.id));

  const boardTasks = tasks.filter((t) => {
    if (t.status === "Archived" || t.archived) return false;
    if (!search) return true;
    return t.title?.toLowerCase().includes(search.toLowerCase());
  });

  const seenNames = (task) => (task.seen_by_ids || [])
    .map((id) => employees.find((e) => e.id === id)?.full_name)
    .filter(Boolean);

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900">Tasks</h1>
          <p className="text-sm text-slate-500 mt-1">{isAdmin ? "Manage all company tasks" : "Your assigned tasks"}</p>
        </div>
        <Button onClick={openCreate} className="bg-slate-800 hover:bg-slate-900">
          <Plus className="w-4 h-4 mr-1" /> New Task
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.filter((tab) => !tab.adminOnly || isAdmin || isSecretary).map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                activeTab === tab.key ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              )}>
              <Icon className="w-3.5 h-3.5" /> {tab.label}
              <span className={cn("text-xs px-1.5 py-0.5 rounded-full", activeTab === tab.key ? "bg-white/20" : "bg-slate-100")}>{counts[tab.key]}</span>
            </button>
          );
        })}
      </div>

      {/* Search + view toggle */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative max-w-md flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks..." className="pl-9" />
        </div>
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
          <button onClick={() => setView("list")} className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors", view === "list" ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100")}>
            <List className="w-3.5 h-3.5" /> List
          </button>
          <button onClick={() => setView("board")} className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors", view === "board" ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100")}>
            <LayoutGrid className="w-3.5 h-3.5" /> Board
          </button>
        </div>
      </div>

      {/* Task board / list */}
      {isTrashView ? (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Trash2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Trash is empty</p>
            </div>
          ) : (
            filtered.map((task) => (
              <div key={task.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 truncate">{task.title}</h3>
                    <p className="text-xs text-slate-400 mt-1">Deleted {formatDateTime(task.deleted_date)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => handleRestoreFromTrash(task)}
                      className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors flex items-center gap-1">
                      <ArchiveRestore className="w-3.5 h-3.5" /> Restore
                    </button>
                    <button onClick={() => handlePermanentDelete(task)}
                      className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-1">
                      <Trash2 className="w-3.5 h-3.5" /> Delete Forever
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : view === "board" ? (
        <KanbanBoard
          tasks={boardTasks}
          onMoveTask={handleStatusChange}
          onEditTask={openEdit}
          onArchiveTask={handleArchive}
          onDeleteTask={handleDelete}
          canEditTask={canEditTask}
          isAdmin={isAdmin || isSecretary}
        />
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <CheckSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No tasks found</p>
            </div>
          ) : (
            filtered.map((task) => {
              const effStatus = getEffectiveStatus(task);
              const assignee = isAssignee(task);
              const assigner = isAssigner(task);
              const seenBy = seenNames(task);
              return (
                <div key={task.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className={cn("w-1 self-stretch rounded-full",
                      task.status === "Completed" ? "bg-emerald-500" :
                        task.status === "Submitted" ? "bg-amber-500" :
                          task.status === "In Progress" ? "bg-blue-500" :
                            isOverdue(task) ? "bg-red-500" : "bg-slate-300")} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-slate-900">{task.title}</h3>
                          {task.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{task.description}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <StatusBadge status={effStatus} />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-slate-400">
                        {task.assigned_to_names?.length > 0 && (
                          <span className="flex items-center gap-1">
                            {task.assigned_to_names.slice(0, 2).join(", ")}
                            {task.assigned_to_names.length > 2 && ` +${task.assigned_to_names.length - 2}`}
                          </span>
                        )}
                        {task.deadline && (
                          <span className={cn("flex items-center gap-1", isOverdue(task) && "text-red-500 font-medium")}>
                            <Clock className="w-3 h-3" /> Due {formatDateTime(task.deadline)}
                          </span>
                        )}
                        {task.assigned_by_name && <span>by {task.assigned_by_name}</span>}
                        {seenBy.length > 0 && (
                          <span className="flex items-center gap-1 text-emerald-500" title={`Seen by ${seenBy.join(", ")}`}>
                            <Eye className="w-3 h-3" /> Seen by {seenBy.length}
                          </span>
                        )}
                        {task.doer_started && task.doer_started_by_name && (
                          <span className="text-blue-500">Started by {task.doer_started_by_name}</span>
                        )}
                        {task.completed_date && <span className="text-emerald-600">Completed {formatDate(task.completed_date)}</span>}
                      </div>

                      {/* Task attachment (from the assigner) */}
                      {task.attachment_file_url && (
                        <a href={task.attachment_file_url} target="_blank" rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700">
                          <Paperclip className="w-3.5 h-3.5" /> {task.attachment_file_name || "Task attachment"}
                        </a>
                      )}

                      {/* Completion report indicator */}
                      {task.completion_report_heading && (
                        <button onClick={() => setReportViewTask(task)}
                          className="mt-2 ml-3 inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700">
                          <FileText className="w-3.5 h-3.5" /> {task.completion_report_heading}
                        </button>
                      )}

                      {/* Workflow actions */}
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        {assignee && task.status === "Pending" && (
                          <button onClick={() => handleStart(task)}
                            className="text-xs font-medium px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors flex items-center gap-1">
                            <Check className="w-3 h-3" /> Start Task
                          </button>
                        )}
                        {assignee && task.status === "In Progress" && (
                          <button onClick={() => setReportTask(task)}
                            className="text-xs font-medium px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors flex items-center gap-1">
                            <Send className="w-3 h-3" /> Submit Report
                          </button>
                        )}
                        {task.status === "Submitted" && (
                          <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-600 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Awaiting Approval
                          </span>
                        )}
                        {assignee && task.status === "Submitted" && (
                          <button onClick={() => setReportTask(task)}
                            className="text-xs font-medium px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors flex items-center gap-1">
                            <Send className="w-3 h-3" /> Resubmit
                          </button>
                        )}
                        {assigner && task.status === "Submitted" && (
                          <>
                            <button onClick={() => handleApprove(task)}
                              className="text-xs font-medium px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Approve
                            </button>
                            <button onClick={() => handleReject(task)}
                              className="text-xs font-medium px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> Reject
                            </button>
                          </>
                        )}
                        {assigner && task.status === "Completed" && (
                          <button onClick={() => handleStatusChange(task, "Pending")}
                            className="text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors">
                            Reopen
                          </button>
                        )}
                        {(isAdmin || isSecretary) && (
                          <>
                            <button onClick={() => handleArchive(task)} className="text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-50 text-zinc-600 hover:bg-zinc-100 transition-colors flex items-center gap-1">
                              {task.archived ? <ArchiveRestore className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                              {task.archived ? "Restore" : "Archive"}
                            </button>
                            <button onClick={() => openEdit(task)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDelete(task)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
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
      )}

      {/* Form Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold text-slate-900">{editing ? "Edit Task" : "New Task"}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Task Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Prepare quarterly report" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
              </div>
              <div>
                <Label>Assign To *</Label>
                {canAssignToAnyone ? (
                  <>
                    <div className="border border-slate-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1.5">
                      {employees.filter((e) => e.status === "active").map((emp) => (
                        <label key={emp.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded">
                          <input type="checkbox" checked={form.assigned_to_ids.includes(emp.id)} onChange={() => toggleAssignee(emp.id)} className="rounded" />
                          <span className="text-sm text-slate-700">{emp.full_name}</span>
                          <span className="text-xs text-slate-400">{emp.department_name || emp.role}</span>
                        </label>
                      ))}
                    </div>
                    {form.assigned_to_ids.length > 0 && (
                      <p className="text-xs text-slate-500 mt-1">{form.assigned_to_ids.length} selected</p>
                    )}
                  </>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-600">
                    This task will be assigned to <span className="font-semibold text-slate-800">{employee?.full_name || "you"}</span>.
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Deadline</Label>
                  <Input type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                </div>
                <div>
                  <Label>Expected Completion Date</Label>
                  <Input type="date" value={form.expected_completion_date} onChange={(e) => setForm({ ...form, expected_completion_date: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Attachment (optional)</Label>
                <p className="text-xs text-slate-400 mb-2">Attach any supporting material — a document, PDF, video, or any other file.</p>
                {form.attachment_file_url ? (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 bg-slate-50">
                    <span className="text-sm text-slate-700 flex items-center gap-1.5 truncate">
                      <Paperclip className="w-3.5 h-3.5 shrink-0" /> {form.attachment_file_name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, attachment_file_url: "", attachment_file_name: "" })}
                      className="text-slate-400 hover:text-red-500 shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm text-slate-600 w-fit">
                    <Paperclip className="w-4 h-4" /> {uploadingAttachment ? "Uploading..." : "Attach a file"}
                    <input type="file" className="hidden" onChange={handleAttachmentUpload} disabled={uploadingAttachment} />
                  </label>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" disabled={uploadingAttachment} className="flex-1 bg-slate-800 hover:bg-slate-900">{editing ? "Update" : "Create Task"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submit Report Dialog */}
      {reportTask && (
        <SubmitReportDialog
          task={reportTask}
          onSubmit={handleSubmitReport}
          onClose={() => setReportTask(null)}
        />
      )}

      {/* View Report Dialog */}
      {reportViewTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setReportViewTask(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5" /> Completion Report
              </h2>
              <button onClick={() => setReportViewTask(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <h3 className="font-semibold text-slate-900">{reportViewTask.completion_report_heading}</h3>
            <p className="text-xs text-slate-400 mt-1">
              Submitted by {reportViewTask.submitted_by_name || "—"} • {formatDateTime(reportViewTask.completion_report_date)}
            </p>
            <div className="mt-3 p-4 bg-slate-50 rounded-lg text-sm text-slate-700 whitespace-pre-wrap">
              {reportViewTask.completion_report}
            </div>
            {reportViewTask.completion_report_file_url && (
              <a
                href={reportViewTask.completion_report_file_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 mt-3"
              >
                <FileText className="w-3.5 h-3.5" /> {reportViewTask.completion_report_file_name || "View attachment"}
              </a>
            )}
            {reportViewTask.approved_by_name && (
              <p className="text-xs text-emerald-600 mt-3">Approved by {reportViewTask.approved_by_name} on {formatDateTime(reportViewTask.approved_date)}</p>
            )}
            {reportViewTask.rejection_reason && (
              <p className="text-xs text-red-500 mt-3">Rejection reason: {reportViewTask.rejection_reason}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}