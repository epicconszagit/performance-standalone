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
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
          {sublabel && <p className="text-xs text-slate-400 mt-1">{sublabel}</p>}
        </div>
        {Icon && (
          <div className={cn("w-11 h-11 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-sm", accentMap[accent])}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          <span className={trend.type === "up" ? "text-emerald-600" : "text-red-600"}>
            {trend.type === "up" ? "↑" : "↓"} {trend.value}
          </span>
          <span className="text-slate-400">{trend.label}</span>
        </div>
      )}
    </div>
  );
}