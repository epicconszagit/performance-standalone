import React from "react";
import { Clock } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";

export default function PendingApproval() {
  const { logout, user } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md w-full text-center space-y-4 bg-white rounded-2xl border border-slate-200 p-8">
        <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
          <Clock className="w-7 h-7 text-amber-600" />
        </div>
        <h1 className="text-xl font-heading font-bold text-slate-900">Waiting for approval</h1>
        <p className="text-sm text-slate-500">
          Your account ({user?.email}) has been created but hasn't been approved by an administrator yet.
          You'll be able to access the system once that happens.
        </p>
        <Button variant="outline" onClick={logout} className="mt-2">
          Log out
        </Button>
      </div>
    </div>
  );
}
