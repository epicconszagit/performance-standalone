import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Building2, Users, Palette, Upload, Save, Check, ScrollText } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { CompanyBranding } from "@/api/entities";
import { UploadFile } from "@/api/integrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { logAudit } from "@/lib/performance";
import { useToast } from "@/components/ui/use-toast";
import Departments from "./Departments";
import Employees from "./Employees";
import AuditLog from "./AuditLog";
import { cn } from "@/lib/utils";

// Each tab lists who can see it - Settings itself is reachable by anyone who
// qualifies for at least one of these (see SETTINGS_ROLES in Layout.jsx), so
// a Department Manager landing here only ever sees "Staff", never Branding
// or Audit Log.
const ALL_TABS = [
  { key: "departments", label: "Departments", icon: Building2, roles: ["Super Administrator", "Administrator", "Director of Operations"] },
  { key: "staff", label: "Staff", icon: Users, roles: ["Super Administrator", "Administrator", "Director of Operations", "Department Manager"] },
  { key: "branding", label: "Company Branding", icon: Palette, roles: ["Super Administrator", "Administrator"] },
  { key: "audit", label: "Audit Log", icon: ScrollText, roles: ["Super Administrator", "Administrator"] },
];

function BrandingSettings() {
  const { performer } = useOutletContext();
  const { toast } = useToast();
  const [branding, setBranding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_name: "Epic International Consultants",
    tagline: "Excellence in Consulting",
    logo_url: "",
    address: "",
    phone: "",
    email: "",
    website: "",
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await CompanyBranding.list("-created_date", 1);
        if (mounted) {
          if (data && data.length > 0) {
            setBranding(data[0]);
            setForm({
              company_name: data[0].company_name || "Epic International Consultants",
              tagline: data[0].tagline || "Excellence in Consulting",
              logo_url: data[0].logo_url || "",
              address: data[0].address || "",
              phone: data[0].phone || "",
              email: data[0].email || "",
              website: data[0].website || "",
            });
          }
        }
      } catch (e) {
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await UploadFile({ file });
      setForm((prev) => ({ ...prev, logo_url: res.file_url }));
      toast({ title: "Uploaded", description: "Logo uploaded" });
    } catch (err) {
      toast({ title: "Error", description: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = { ...form, updated_by_id: performer.id, updated_by_name: performer.name };
    try {
      if (branding) {
        await CompanyBranding.update(branding.id, data);
      } else {
        const created = await CompanyBranding.create(data);
        setBranding(created);
      }
      await logAudit("Updated Branding", "CompanyBranding", branding?.id || "", data.company_name, performer, "Company branding updated");
      toast({ title: "Saved", description: "Company branding updated" });
    } catch (e) {
      toast({ title: "Error", description: "Failed to save branding", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <form onSubmit={handleSave} className="max-w-3xl bg-white rounded-xl border border-slate-200 p-6 space-y-6">
      {/* Logo */}
      <div>
        <Label className="text-base font-semibold">Company Logo</Label>
        <p className="text-xs text-slate-400 mb-3">Upload your company logo. It appears throughout the system.</p>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden shrink-0">
            {form.logo_url ? (
              <img src={form.logo_url} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <Building2 className="w-8 h-8 text-slate-300" />
            )}
          </div>
          <label className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm text-slate-600">
            <Upload className="w-4 h-4" /> {uploading ? "Uploading..." : "Upload Logo"}
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
          </label>
          {form.logo_url && (
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, logo_url: "" }))}
              className="text-sm text-red-500 hover:text-red-600"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-6 space-y-4">
        <div>
          <Label>Company Name</Label>
          <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
        </div>
        <div>
          <Label>Tagline</Label>
          <Input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
        </div>
        <div>
          <Label>Address</Label>
          <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>Website</Label>
            <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-100">
        <Button type="submit" disabled={saving} className="bg-slate-800 hover:bg-slate-900">
          {saving ? <Check className="w-4 h-4 mr-1" /> : <Save className="w-4 h-4 mr-1" />}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}

export default function Settings() {
  const { role } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const visibleTabs = ALL_TABS.filter((tab) => tab.roles.includes(role));

  const requestedTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    visibleTabs.some((t) => t.key === requestedTab) ? requestedTab : visibleTabs[0]?.key
  );

  const selectTab = (key) => {
    setActiveTab(key);
    setSearchParams(key === visibleTabs[0]?.key ? {} : { tab: key }, { replace: true });
  };

  if (visibleTabs.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <p className="text-slate-500">You don't have access to any settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Organization structure, branding, and administration</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => selectTab(tab.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === tab.key
                  ? "border-amber-500 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "departments" && <Departments />}
      {activeTab === "staff" && <Employees />}
      {activeTab === "branding" && <BrandingSettings />}
      {activeTab === "audit" && <AuditLog />}
    </div>
  );
}
