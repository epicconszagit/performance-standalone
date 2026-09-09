import React from "react";
import { Clock } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";

const LOGO_URL = "https://media.base44.com/images/public/6a5df9c009518866564e2bed/28390cb4e_image.png";

export default function PendingApproval() {
  const { logout, user } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md w-full text-center space-y-4 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-white shadow ring-2 ring-amber-400/50 mx-auto mb-2">
          <img src={LOGO_URL} alt="EPIC TASK PERFORMANCE TRACKING SYSTEM" className="w-full h-full object-contain" />
        </div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-amber-600">
          EPIC TASK PERFORMANCE TRACKING SYSTEM
        </p>
        <h1 className="text-xl font-heading font-bold text-slate-900">Waiting for approval</h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          Your account ({user?.email}) has been created but hasn't been approved by an administrator yet.
          You'll be granted access to the EPIC TASK PERFORMANCE TRACKING SYSTEM once approved.
        </p>
        <Button variant="outline" onClick={logout} className="mt-2">
          Log out
        </Button>
      </div>
    </div>
  );
}
