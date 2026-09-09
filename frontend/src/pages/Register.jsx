import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, User, Phone, Briefcase, Loader2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

const COMMON_TYPOS = {
  "gmaill.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmial.com": "gmail.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "hotmial.com": "hotmail.com",
  "hotmaill.com": "hotmail.com",
  "outlok.com": "outlook.com",
};

export default function Register() {
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [requestedDepartment, setRequestedDepartment] = useState("");
  const [requestedPosition, setRequestedPosition] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Live email validation state
  const [emailStatus, setEmailStatus] = useState({
    checking: false,
    valid: null,
    error: null,
    suggestion: null,
  });

  // Debounced live email check
  useEffect(() => {
    const trimmed = (email || "").trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setEmailStatus({ checking: false, valid: null, error: null, suggestion: null });
      return;
    }

    const [local, domain] = trimmed.split("@");
    if (!domain) {
      setEmailStatus({ checking: false, valid: null, error: null, suggestion: null });
      return;
    }

    // Check client-side typo first
    if (COMMON_TYPOS[domain]) {
      const suggestedEmail = `${local}@${COMMON_TYPOS[domain]}`;
      setEmailStatus({
        checking: false,
        valid: false,
        error: `Did you mean @${COMMON_TYPOS[domain]}?`,
        suggestion: suggestedEmail,
      });
      return;
    }

    // Only query backend if domain looks like it has a TLD
    if (!domain.includes(".") || domain.endsWith(".")) {
      setEmailStatus({
        checking: false,
        valid: null,
        error: null,
        suggestion: null,
      });
      return;
    }

    const timer = setTimeout(async () => {
      setEmailStatus((prev) => ({ ...prev, checking: true }));
      try {
        const res = await fetch(`/api/auth/check-email?email=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (data.valid) {
          setEmailStatus({ checking: false, valid: true, error: null, suggestion: null });
        } else {
          setEmailStatus({ checking: false, valid: false, error: data.error, suggestion: null });
        }
      } catch (err) {
        setEmailStatus({ checking: false, valid: null, error: null, suggestion: null });
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [email]);

  const applyEmailSuggestion = () => {
    if (emailStatus.suggestion) {
      setEmail(emailStatus.suggestion);
    }
  };

  // Helper for phone preview
  const getPhoneHint = (p) => {
    const trimmed = (p || "").trim().replace(/[\s\-\(\)]/g, "");
    if (!trimmed) return null;
    if (trimmed.startsWith("0")) {
      return {
        formatted: `+263 ${trimmed.slice(1)}`,
        label: "Local format: will deliver via +263 automatically",
      };
    }
    if (trimmed.startsWith("+")) {
      return {
        formatted: trimmed,
        label: "International format recognized",
      };
    }
    if (trimmed.length === 9 && trimmed.startsWith("7")) {
      return {
        formatted: `+263 ${trimmed}`,
        label: "Mobile format: will deliver via +263 automatically",
      };
    }
    return {
      formatted: `+263 ${trimmed}`,
      label: "Will be formatted for SMS delivery",
    };
  };

  const phoneHint = getPhoneHint(phone);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (emailStatus.valid === false && emailStatus.error) {
      setError(emailStatus.error);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await register(email, password, {
        full_name: fullName,
        phone,
        requested_department: requestedDepartment,
        requested_position: requestedPosition,
      });
      window.location.href = "/";
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={UserPlus}
      title="Create your account"
      subtitle="Sign up to get started — an administrator will review and approve your account"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Log in
          </Link>
        </>
      }
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="fullName"
              autoComplete="name"
              autoFocus
              placeholder="Jane Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="email">Email</Label>
            {emailStatus.checking && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Verifying...
              </span>
            )}
            {!emailStatus.checking && emailStatus.valid === true && (
              <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Valid domain
              </span>
            )}
          </div>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`pl-10 h-12 ${
                emailStatus.valid === false ? "border-amber-500 focus-visible:ring-amber-500" : ""
              }`}
              required
            />
          </div>

          {emailStatus.suggestion && (
            <div className="flex items-center justify-between p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Did you mean <strong>{emailStatus.suggestion}</strong>?
              </span>
              <button
                type="button"
                onClick={applyEmailSuggestion}
                className="text-xs font-semibold text-amber-900 dark:text-amber-100 underline hover:no-underline ml-2"
              >
                Use this
              </button>
            </div>
          )}

          {!emailStatus.suggestion && emailStatus.valid === false && emailStatus.error && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {emailStatus.error}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            We'll email your permanent company login details here once an administrator approves your account.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone (optional)</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="077 123 4567 or +263 77 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="pl-10 h-12"
            />
          </div>
          {phoneHint && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 shrink-0" />
              {phoneHint.label}: <strong className="font-mono">{phoneHint.formatted}</strong>
            </p>
          )}
          {!phoneHint && (
            <p className="text-xs text-muted-foreground">
              Accepts all formats (e.g. 077 123 4567, 071..., or +263...). We'll text your credentials here when approved.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="department">Department (optional)</Label>
            <Input
              id="department"
              list="default-departments-list"
              placeholder="Select or enter department"
              value={requestedDepartment}
              onChange={(e) => setRequestedDepartment(e.target.value)}
              className="h-12"
            />
            <datalist id="default-departments-list">
              <option value="Information Technology Department" />
              <option value="Research & Statistics" />
              <option value="Human Resources" />
              <option value="Finance & Fiscal" />
              <option value="Real Estate & Developement" />
            </datalist>
          </div>
          <div className="space-y-2">
            <Label htmlFor="position">Position (optional)</Label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="position"
                placeholder="e.g. Consultant"
                value={requestedPosition}
                onChange={(e) => setRequestedPosition(e.target.value)}
                className="pl-10 h-12"
              />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12"
              required
              minLength={8}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
