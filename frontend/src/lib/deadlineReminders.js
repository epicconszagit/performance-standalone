import { Task, Employee, Notification } from "@/api/entities";
import { SendEmail } from "@/api/integrations";
import { formatDateTime } from "@/lib/performance";

/**
 * Scans tasks whose deadlines fall within the next 24 hours and emails each
 * assigned staff member, plus creates an in-app notification. Dedupes per task
 * via the "deadline_approaching" notification's related_id so each task is
 * alerted only once. Run from the client (e.g. on dashboard load by a manager).
 */
export async function checkDeadlineReminders() {
  try {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const tasks = (await Task.list("-created_date", 500)) || [];
    const dueTasks = tasks.filter((t) => {
      if (!t.deadline) return false;
      if (t.status === "Completed" || t.status === "Archived" || t.archived || t.deleted) return false;
      const due = new Date(t.deadline);
      return due > now && due <= in24h;
    });
    if (dueTasks.length === 0) return { checked: 0, notified: 0 };

    const employees = (await Employee.list("-created_date", 500)) || [];
    const empMap = new Map(employees.map((e) => [e.id, e]));

    const existing =
      (await Notification.filter({ type: "deadline_approaching" })) || [];
    const notified = new Set(existing.map((n) => n.related_id));

    let sentCount = 0;
    for (const task of dueTasks) {
      if (notified.has(task.id)) continue;
      const assigneeIds = task.assigned_to_ids || [];
      for (const empId of assigneeIds) {
        const emp = empMap.get(empId);
        if (!emp || !emp.email) continue;
        try {
          await SendEmail({
            to: emp.email,
            subject: `Task Deadline Approaching: "${task.title}"`,
            body: `Hi ${emp.full_name},\n\nYour assigned task "${task.title}" is due on ${formatDateTime(task.deadline)}, which is within 24 hours.\n\nPlease ensure it is completed before the deadline.\n\n— EPIC International Consultants Group`,
          });
        } catch (e) { }
        try {
          await Notification.create({
            user_id: emp.user_id || emp.id,
            employee_id: emp.id,
            title: "Task Deadline Approaching",
            message: `"${task.title}" is due within 24 hours (${formatDateTime(task.deadline)}).`,
            type: "deadline_approaching",
            related_id: task.id,
            link: "/tasks",
          });
        } catch (e) { }
      }
      sentCount++;
    }
    return { checked: dueTasks.length, notified: sentCount };
  } catch (e) {
    return { error: true };
  }
}