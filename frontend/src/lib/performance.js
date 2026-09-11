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

export const PRIORITY_WEIGHTS = {
  "Low": 1,
  "Medium": 2,
  "High": 3,
  "Urgent": 5,
};

export function getTaskWeight(task) {
  if (task?.weight && !isNaN(Number(task.weight))) {
    return Number(task.weight);
  }
  return PRIORITY_WEIGHTS[task?.priority] || 2;
}

export function calculatePerformance(tasks) {
  const validTasks = (tasks || []).filter((t) => !t.deleted);
  const assigned = validTasks.length;
  const assignedWeight = validTasks.reduce((sum, t) => sum + getTaskWeight(t), 0);

  const completedTasks = validTasks.filter((t) => t.status === "Completed");
  const completed = completedTasks.length;
  const completedWeight = completedTasks.reduce((sum, t) => sum + getTaskWeight(t), 0);

  const onTimeTasks = completedTasks.filter((t) => t.completed_on_time === true);
  const onTime = onTimeTasks.length;
  const onTimeWeight = onTimeTasks.reduce((sum, t) => sum + getTaskWeight(t), 0);

  const lateTasks = completedTasks.filter((t) => t.completed_on_time === false);
  const late = lateTasks.length;
  const lateWeight = lateTasks.reduce((sum, t) => sum + getTaskWeight(t), 0);

  const pendingTasks = validTasks.filter(
    (t) => t.status === "Pending" || t.status === "In Progress" || t.status === "Submitted"
  );
  const pending = pendingTasks.length;

  const overdueTasks = validTasks.filter((t) => isOverdue(t));
  const overdue = overdueTasks.length;
  const overdueWeight = overdueTasks.reduce((sum, t) => sum + getTaskWeight(t), 0);

  const archived = validTasks.filter((t) => t.status === "Archived" || t.archived).length;

  const productivity = assignedWeight > 0 ? Math.round((completedWeight / assignedWeight) * 100) : 0;
  const onTimeRate = completedWeight > 0 ? Math.round((onTimeWeight / completedWeight) * 100) : 0;

  // Weighted Score Formula:
  // 50% weighted completion + 30% weighted on-time rate + 20% productivity
  const completionScore = assignedWeight > 0 ? (completedWeight / assignedWeight) * 50 : 0;
  const onTimeScore = completedWeight > 0 ? (onTimeWeight / completedWeight) * 30 : 0;
  const productivityScore = Math.min(productivity, 100) * 0.2;
  const score = Math.max(0, Math.min(100, Math.round(completionScore + onTimeScore + productivityScore)));

  const classification =
    score >= 90 ? "Outstanding" :
      score >= 80 ? "Excellent" :
        score >= 70 ? "Good" :
          score >= 60 ? "Satisfactory" : "Needs Improvement";

  return {
    assigned,
    assignedWeight,
    completed,
    completedWeight,
    onTime,
    onTimeWeight,
    late,
    lateWeight,
    pending,
    overdue,
    overdueWeight,
    archived,
    productivity,
    onTimeRate,
    completionScore: Math.round(completionScore * 10) / 10,
    onTimeScore: Math.round(onTimeScore * 10) / 10,
    productivityScore: Math.round(productivityScore * 10) / 10,
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