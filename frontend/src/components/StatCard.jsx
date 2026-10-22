import React from "react";
import { cn } from "@/lib/utils";

export default function StatCard({ icon: Icon, label, value, sublabel, accent = "navy", trend }) {
  const accentMap = {
    navy: "from-slate-800 to-slate-900 text-white",
    gold: "from-amber-500 to-amber-600 text-white",
    emerald: "from-emerald-500 to-emerald-600 text-white",
    blue: "from-blue-500 to-blue-600 text-white",
    red: "from-red-500 to-red-600 text-white",
    purple: "from-purple-500 to-purple-600 text-white",
    slate: "from-slate-100 to-slate-200 text-slate-800",
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-5 shadow-xs hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">{label}</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-0.5 sm:mt-1">{value}</p>
          {sublabel && <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1 truncate">{sublabel}</p>}
        </div>
        {Icon && (
          <div className={cn("w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-gradient-to-br flex items-center justify-center shrink-0 shadow-xs", accentMap[accent])}>
            <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-2 sm:mt-3 flex items-center gap-1 text-[11px] sm:text-xs">
          <span className={trend.type === "up" ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>
            {trend.type === "up" ? "↑" : "↓"} {trend.value}
          </span>
          <span className="text-slate-400 truncate">{trend.label}</span>
        </div>
      )}
    </div>
  );
}