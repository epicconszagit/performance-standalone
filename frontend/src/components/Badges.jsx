import React from "react";
import { cn } from "@/lib/utils";
import { getStatusColor, getPriorityColor } from "@/lib/performance";

export function StatusBadge({ status }) {
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border", getStatusColor(status))}>
      {status}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border", getPriorityColor(priority))}>
      {priority}
    </span>
  );
}

export function RoleBadge({ role }) {
  const colors = {
    "Super Administrator": "bg-indigo-100 text-indigo-700 border-indigo-200",
    "Administrator": "bg-blue-100 text-blue-700 border-blue-200",
    "Secretary": "bg-teal-100 text-teal-700 border-teal-200",
    "Department Manager": "bg-purple-100 text-purple-700 border-purple-200",
    "Supervisor": "bg-cyan-100 text-cyan-700 border-cyan-200",
    "Staff Member": "bg-slate-100 text-slate-600 border-slate-200",
    "Director of Operations": "bg-amber-100 text-amber-700 border-amber-200",
  };
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border", colors[role] || "bg-slate-100 text-slate-600 border-slate-200")}>
      {role}
    </span>
  );
}