import { AuditLog, Notification } from "@/api/entities";

export function isOverdue(task) {
  if (!task) return false;
  if (task.archived || task.status === "Completed" || task.status === "Archived") return false;
  if (!task.deadline) return false;
  return new Date(task.deadline) < new Date();
}

export function getEffectiveStatus(task) {
  if (!task) return "Pending";
  if (task.archived || task.status === "Archived") return "Archived";
  if (isOverdue(task)) return "Overdue";
  return task.status;
}

export function calculatePerformance(tasks) {
  const assigned = tasks.length;
  const completed = tasks.filter((t) => t.status === "Completed").length;
  const onTime = tasks.filter((t) => t.completed_on_time === true).length;
  const late = tasks.filter(
    (t) => t.status === "Completed" && t.completed_on_time === false
  ).length;
  const pending = tasks.filter(
    (t) => t.status === "Pending" || t.status === "In Progress" || t.status === "Submitted"
  ).length;
  const overdue = tasks.filter((t) => isOverdue(t)).length;
  const archived = tasks.filter((t) => t.status === "Archived" || t.archived).length;

  const productivity = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
  const onTimeRate = completed > 0 ? Math.round((onTime / completed) * 100) : 0;

  // Score: 50% completion + 30% on-time rate + 20% productivity
  const completionScore = assigned > 0 ? (completed / assigned) * 50 : 0;
  const onTimeScore = completed > 0 ? (onTime / completed) * 30 : 0;
  const productivityScore = Math.min(productivity, 100) * 0.2;
  const score = Math.round(completionScore + onTimeScore + productivityScore);

  const classification =
    score >= 90 ? "Outstanding" :
      score >= 80 ? "Excellent" :
        score >= 70 ? "Good" :
          score >= 60 ? "Satisfactory" : "Needs Improvement";

  return {
    assigned,
    completed,
    onTime,
    late,
    pending,
    overdue,
    archived,
    productivity,
    onTimeRate,
    score,
    classification,
  };
}

export function getClassificationColor(classification) {
  const map = {
    "Outstanding": "text-emerald-600 bg-emerald-50 border-emerald-200",
    "Excellent": "text-green-600 bg-green-50 border-green-200",
    "Good": "text-blue-600 bg-blue-50 border-blue-200",
    "Satisfactory": "text-amber-600 bg-amber-50 border-amber-200",
    "Needs Improvement": "text-red-600 bg-red-50 border-red-200",
  };
  return map[classification] || "text-slate-600 bg-slate-50 border-slate-200";
}

export function getPriorityColor(priority) {
  const map = {
    "Urgent": "bg-red-100 text-red-700 border-red-200",
    "High": "bg-orange-100 text-orange-700 border-orange-200",
    "Medium": "bg-amber-100 text-amber-700 border-amber-200",
    "Low": "bg-slate-100 text-slate-600 border-slate-200",
  };
  return map[priority] || "bg-slate-100 text-slate-600 border-slate-200";
}

export function getStatusColor(status) {
  const map = {
    "Completed": "bg-emerald-100 text-emerald-700 border-emerald-200",
    "In Progress": "bg-blue-100 text-blue-700 border-blue-200",
    "Submitted": "bg-amber-100 text-amber-700 border-amber-200",
    "Pending": "bg-slate-100 text-slate-600 border-slate-200",
    "Overdue": "bg-red-100 text-red-700 border-red-200",
    "Archived": "bg-zinc-100 text-zinc-500 border-zinc-200",
  };
  return map[status] || "bg-slate-100 text-slate-600 border-slate-200";
}

export async function logAudit(action, entityType, entityId, entityName, performer, details = "") {
  try {
    await AuditLog.create({
      action,
      entity_type: entityType,
      entity_id: entityId || "",
      entity_name: entityName || "",
      performed_by_id: performer?.id || "",
      performed_by_name: performer?.name || "System",
      details,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    // audit logging should not block operations
  }
}

export async function createNotification(userId, employeeId, title, message, type, relatedId = "", link = "") {
  try {
    await Notification.create({
      user_id: userId || "",
      employee_id: employeeId || "",
      title,
      message,
      type,
      read: false,
      related_id: relatedId,
      link,
    });
  } catch (e) {
    // non-blocking
  }
}

export function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - now) / (1000 * 60 * 60 * 24));
}