import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { User as UserIcon, Upload, Save, Cake, Mail, Briefcase, Building2 } from "lucide-react";
import { getMyProfile, updateMyProfile } from "@/api/profile";
import { UploadFile } from "@/api/integrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

export default function Profile() {
  const { user, employee: contextEmployee, role } = useOutletContext();
  const { toast } = useToast();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ phone: "", date_of_birth: "", address: "", avatar_url: "" });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getMyProfile();
        if (!mounted) return;
        setEmployee(data);
        setForm({
          phone: data.phone || "",
          date_of_birth: data.date_of_birth ? data.date_of_birth.slice(0, 10) : "",
          address: data.address || "",
          avatar_url: data.avatar_url || "",
        });
      } catch (e) {
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await UploadFile({ file });
      setForm((prev) => ({ ...prev, avatar_url: res.file_url }));
    } catch (err) {
      toast({ title: "Error", description: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateMyProfile(form);
      setEmployee(updated);
      toast({ title: "Saved", description: "Your profile has been updated" });
    } catch (err) {
      toast({ title: "Error", description: "Failed to save profile", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const initials = (employee?.full_name || user?.full_name || "U")
    .split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!employee) {
    return (
      <div className="max-w-3xl">
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <UserIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No staff record is linked to your account yet.</p>
          <p className="text-xs text-slate-400 mt-1">Contact an administrator if this seems wrong.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-heading font-bold text-slate-900">My Profile</h1>
        <p className="text-sm text-slate-500 mt-1">View your details and update your personal information</p>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
        {/* Avatar + identity */}
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden shrink-0">
            {form.avatar_url ? (
              <img src={form.avatar_url} alt={employee.full_name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-slate-400">{initials}</span>
            )}
          </div>
          <div className="flex-1">
            <p className="text-lg font-semibold text-slate-900">{employee.full_name}</p>
            <p className="text-xs text-slate-400">{role}</p>
            <label className="cursor-pointer inline-flex items-center gap-2 mt-2 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs text-slate-600">
              <Upload className="w-3.5 h-3.5" /> {uploading ? "Uploading..." : "Change Photo"}
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
            </label>
          </div>
        </div>

        {/* Read-only employment details */}
        <div className="border-t border-slate-100 pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-slate-400 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Company Email</Label>
            <p className="text-sm text-slate-700 mt-1">{employee.email}</p>
          </div>
          <div>
            <Label className="text-slate-400 flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Position</Label>
            <p className="text-sm text-slate-700 mt-1">{employee.position || "—"}</p>
          </div>
          <div>
            <Label className="text-slate-400 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Department</Label>
            <p className="text-sm text-slate-700 mt-1">{employee.department_name || "—"}</p>
          </div>
          <div>
            <Label className="text-slate-400">Role</Label>
            <p className="text-sm text-slate-700 mt-1">{employee.role}</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 -mt-2">Employment details are managed by an administrator. Contact them to make changes.</p>

        {/* Editable personal details */}
        <div className="border-t border-slate-100 pt-6 space-y-4">
          <Label className="text-base font-semibold">Personal Details</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-1.5"><Cake className="w-3.5 h-3.5" /> Date of Birth</Label>
              <Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
              <p className="text-xs text-slate-400 mt-1">Used to celebrate your birthday and send reminders to the team.</p>
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 555 000 0000" />
            </div>
          </div>
          <div>
            <Label>Address</Label>
            <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} placeholder="Street, city, state" />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <Button type="submit" disabled={saving} className="bg-slate-800 hover:bg-slate-900">
            <Save className="w-4 h-4 mr-1" /> {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
