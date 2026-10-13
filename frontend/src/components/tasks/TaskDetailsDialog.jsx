import React from "react";
import {
  X,
  Calendar,
  Clock,
  User,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Paperclip,
  Send,
  MessageSquare,
  Building2,
  Award,
  ArrowRight,
  Pencil,
  Eye,
  Check,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge, PriorityBadge } from "@/components/Badges";
import {
  formatDateTime,
  formatDate,
  isOverdue,
  getEffectiveStatus,
  daysUntil,
  canApproveTask,
  canEditTask,
  getTaskScope,
} from "@/lib/performance";
import { cn } from "@/lib/utils";

export default function TaskDetailsDialog({
  task,
  onClose,
  currentEmployee,
  currentUser,
  departments = [],
  employees = [],
  feedbackCounts = {},
  onStartTask,
  onSubmitReport,
  onApproveTask,
  onRejectTask,
  onReopenTask,
  onEditTask,
  onOpenFeedback,
  isAdmin = false,
  isSecretary = false,
}) {
  if (!task) return null;

  const effStatus = getEffectiveStatus(task);
  const overdue = isOverdue(task);
  const daysLeft = daysUntil(task.deadline);

  const isAssignee = !!(
    task &&
    (task.assigned_to_ids || []).some(
      (id) =>
        (currentEmployee && id === currentEmployee.id) ||
        (currentUser && id === currentUser.id)
    )
  );

  const userRole = currentEmployee?.role || currentUser?.role || "";
  const canApprove = canApproveTask(task, currentEmployee, currentUser, userRole, departments);
  const canEdit = canEditTask(task, currentEmployee, currentUser, userRole, departments);
  const scope = getTaskScope(task, currentEmployee, currentUser, employees);

  const isAssigner = canApprove;

  const dept = departments.find((d) => d.id === task.department_id);

  // Collect assigned employees details
  const assigneeObjects = (task.assigned_to_ids || [])
    .map((id) => employees.find((e) => e.id === id))
    .filter(Boolean);

  const seenByList = (task.seen_by_ids || [])
    .map((id) => employees.find((e) => e.id === id)?.full_name)
    .filter(Boolean);

  const feedbackCount = feedbackCounts[task.id] || 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/70">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={effStatus} />
              <PriorityBadge priority={task.priority || "Medium"} />
              {scope === "mine" ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1">
                  <User className="w-3 h-3" /> My Task
                </span>
              ) : scope === "department" ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> Department Task
                </span>
              ) : (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 border border-slate-300 flex items-center gap-1">
                  <Users className="w-3 h-3" /> Other Dept Task
                </span>
              )}
              <span
                className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs"
                title="Performance Weight"
              >
                <Award className="w-3 h-3 inline mr-1 text-amber-500" />
                {task.weight ||
                  (task.priority === "Urgent"
                    ? 5
                    : task.priority === "High"
                    ? 3
                    : task.priority === "Low"
                    ? 1
                    : 2)}{" "}
                points
              </span>
              {task.archived && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-200 text-zinc-700">
                  Archived
                </span>
              )}
            </div>
            <h2 className="text-xl font-heading font-bold text-slate-900 leading-snug break-words">
              {task.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Key Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Department */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-white border border-slate-200 text-blue-600 shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  Department
                </p>
                <p className="text-sm font-semibold text-slate-800 truncate mt-0.5">
                  {dept?.name || "General / Unassigned"}
                </p>
                {dept?.code && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    Code: {dept.code}
                  </span>
                )}
              </div>
            </div>

            {/* Deadline */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-3">
              <div
                className={cn(
                  "p-2 rounded-lg bg-white border border-slate-200 shrink-0",
                  overdue ? "text-red-500 border-red-200" : "text-slate-600"
                )}
              >
                <Clock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  Deadline
                </p>
                <p
                  className={cn(
                    "text-sm font-semibold truncate mt-0.5",
                    overdue ? "text-red-600" : "text-slate-800"
                  )}
                >
                  {formatDateTime(task.deadline)}
                </p>
                {task.deadline && (
                  <p
                    className={cn(
                      "text-[11px] font-medium mt-0.5",
                      overdue
                        ? "text-red-500"
                        : daysLeft === 0
                        ? "text-amber-600 font-bold"
                        : "text-slate-500"
                    )}
                  >
                    {overdue
                      ? "Deadline has passed"
                      : daysLeft === 0
                      ? "Due Today"
                      : daysLeft > 0
                      ? `${daysLeft} day${daysLeft > 1 ? "s" : ""} remaining`
                      : "Due soon"}
                  </p>
                )}
              </div>
            </div>

            {/* Assigned By */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-white border border-slate-200 text-indigo-600 shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  Assigned By
                </p>
                <p className="text-sm font-semibold text-slate-800 truncate mt-0.5">
                  {task.assigned_by_name || "System Administrator"}
                </p>
                <p className="text-[11px] text-slate-400">
                  Created {formatDate(task.created_date)}
                </p>
              </div>
            </div>

            {/* Expected / Completed Dates */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-white border border-slate-200 text-emerald-600 shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  Completion Timeline
                </p>
                {task.completed_date ? (
                  <>
                    <p className="text-sm font-semibold text-emerald-700 mt-0.5">
                      Completed {formatDate(task.completed_date)}
                    </p>
                    <span
                      className={cn(
                        "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                        task.completed_on_time
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-700"
                      )}
                    >
                      {task.completed_on_time ? "Completed On Time" : "Completed Late"}
                    </span>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-slate-800 mt-0.5">
                      Target: {formatDate(task.expected_completion_date) || "Not set"}
                    </p>
                    {task.doer_started && task.doer_started_by_name && (
                      <p className="text-[11px] text-blue-600">
                        Work started by {task.doer_started_by_name}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Full Task Description / Brief */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" /> Task Description & Instructions
            </h3>
            <div className="bg-slate-50/90 rounded-xl border border-slate-200 p-4.5 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap break-words min-h-[90px]">
              {task.description?.trim() ? (
                task.description
              ) : (
                <span className="text-slate-400 italic">No description provided for this task.</span>
              )}
            </div>
          </div>

          {/* Assigned Staff Members */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" /> Assigned Staff (
                {task.assigned_to_names?.length || 0})
              </span>
              {seenByList.length > 0 && (
                <span className="text-[11px] font-normal text-emerald-600 lowercase">
                  seen by {seenByList.length} of {task.assigned_to_names?.length || 1}
                </span>
              )}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(task.assigned_to_names || []).map((name, i) => {
                const empId = task.assigned_to_ids?.[i];
                const empObj = assigneeObjects.find((e) => e.id === empId);
                const hasSeen = (task.seen_by_ids || []).includes(empId);

                return (
                  <div
                    key={empId || i}
                    className="flex items-center justify-between gap-2 p-2.5 bg-white border border-slate-200 rounded-lg shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {name ? name.charAt(0).toUpperCase() : "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">{name}</p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {empObj?.department_name || empObj?.role || "Staff Member"}
                        </p>
                      </div>
                    </div>
                    <div>
                      {hasSeen ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <Eye className="w-2.5 h-2.5" /> Seen
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                          Unopened
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {(!task.assigned_to_names || task.assigned_to_names.length === 0) && (
                <p className="text-xs text-slate-400 italic">No assigned staff members.</p>
              )}
            </div>
          </div>

          {/* Assigner Attached File */}
          {task.attachment_file_url && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-slate-400" /> Attached Document
              </h3>
              <div className="flex items-center justify-between p-3.5 bg-blue-50/50 rounded-xl border border-blue-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-600 shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">
                      {task.attachment_file_name || "Task Brief Attachment"}
                    </p>
                    <p className="text-[10px] text-slate-400">Attached by assigner</p>
                  </div>
                </div>
                <a
                  href={task.attachment_file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 transition-colors shadow-2xs shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open / Download
                </a>
              </div>
            </div>
          )}

          {/* Completion Report Section (if submitted or completed) */}
          {(task.completion_report_heading || task.completion_report) && (
            <div className="space-y-2.5 p-4 bg-amber-50/40 rounded-xl border border-amber-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-amber-600" /> Completion Report Submission
                </h3>
                {task.completion_report_date && (
                  <span className="text-[11px] text-slate-400">
                    {formatDateTime(task.completion_report_date)}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900">
                  {task.completion_report_heading}
                </h4>
                {task.submitted_by_name && (
                  <p className="text-xs text-slate-500">
                    Submitted by <strong className="text-slate-700">{task.submitted_by_name}</strong>
                  </p>
                )}
              </div>

              <div className="bg-white rounded-lg p-3 border border-amber-200/60 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                {task.completion_report}
              </div>

              {task.completion_report_file_url && (
                <div className="pt-1">
                  <a
                    href={task.completion_report_file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-800 hover:underline"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    {task.completion_report_file_name || "View submission attachment"}
                  </a>
                </div>
              )}

              {task.approved_by_name && (
                <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Approved by <strong>{task.approved_by_name}</strong> on{" "}
                    {formatDateTime(task.approved_date)}
                  </span>
                </div>
              )}

              {task.rejection_reason && (
                <div className="p-2.5 bg-red-50 rounded-lg border border-red-200 flex items-center gap-2 text-xs text-red-800 font-medium">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>
                    Revision requested: <strong>{task.rejection_reason}</strong>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 flex-wrap">
          {/* Left: Feedback Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onClose();
              if (onOpenFeedback) onOpenFeedback(task);
            }}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-700 border-slate-200 hover:bg-slate-100"
          >
            <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
            <span>Discussion / Feedback</span>
            {feedbackCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                {feedbackCount}
              </span>
            )}
          </Button>

          {/* Right: Workflow Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Start Task for Assignee */}
            {isAssignee && task.status === "Pending" && (
              <Button
                size="sm"
                onClick={() => {
                  onClose();
                  if (onStartTask) onStartTask(task);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
              >
                <Check className="w-3.5 h-3.5" /> Start Task Now
              </Button>
            )}

            {/* Submit Report for Assignee */}
            {isAssignee && task.status === "In Progress" && (
              <Button
                size="sm"
                onClick={() => {
                  onClose();
                  if (onSubmitReport) onSubmitReport(task);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
              >
                <Send className="w-3.5 h-3.5" /> Submit Report
              </Button>
            )}

            {/* Resubmit Report */}
            {isAssignee && task.status === "Submitted" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onClose();
                  if (onSubmitReport) onSubmitReport(task);
                }}
                className="border-blue-200 text-blue-600 hover:bg-blue-50 text-xs gap-1.5"
              >
                <Send className="w-3.5 h-3.5" /> Resubmit Report
              </Button>
            )}

            {/* Assigner Approval Actions */}
            {isAssigner && task.status === "Submitted" && (
              <>
                <Button
                  size="sm"
                  onClick={() => {
                    onClose();
                    if (onApproveTask) onApproveTask(task);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onClose();
                    if (onRejectTask) onRejectTask(task);
                  }}
                  className="border-red-200 text-red-600 hover:bg-red-50 text-xs gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject / Request Revision
                </Button>
              </>
            )}

            {/* Reopen Completed Task */}
            {isAssigner && task.status === "Completed" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onClose();
                  if (onReopenTask) onReopenTask(task);
                }}
                className="text-xs gap-1.5 text-slate-700"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reopen Task
              </Button>
            )}

            {/* Edit Task for Assigner / Department Manager / Admin */}
            {canEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onClose();
                  if (onEditTask) onEditTask(task);
                }}
                className="text-xs gap-1 text-slate-700"
              >
                <Pencil className="w-3 h-3" /> Edit
              </Button>
            )}

            <Button size="sm" variant="outline" onClick={onClose} className="text-xs">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
