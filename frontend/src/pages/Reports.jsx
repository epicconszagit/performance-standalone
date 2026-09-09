import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { FileText, Plus, X, Download, Trash2, Search, Upload, Lock, Users, ShieldAlert } from "lucide-react";
import { Report, Employee } from "@/api/entities";
import { UploadFile } from "@/api/integrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatDate, logAudit, createNotification } from "@/lib/performance";
import { useToast } from "@/components/ui/use-toast";

export default function Reports() {
  const { employee, role, performer, user } = useOutletContext();
  const { toast } = useToast();
  const [reports, setReports] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    heading: "",
    description: "",
    file_url: "",
    file_name: "",
    is_confidential: false,
    submitted_to_ids: [],
  });

  const isAdmin = ["Super Administrator", "Administrator", "Director of Operations"].includes(role);

  const loadData = async () => {
    try {
      const [allReports, allEmployees] = await Promise.all([
        Report.list("-submitted_date", 300),
        Employee.list("-created_date", 300),
      ]);
      setReports(allReports || []);
      setEmployees(allEmployees || []);
    } catch (e) {
      toast({ title: "Error", description: "Failed to load reports data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await UploadFile({ file });
      setForm((prev) => ({ ...prev, file_url: res.file_url, file_name: file.name }));
      toast({ title: "Uploaded", description: "File attached" });
    } catch (err) {
      toast({ title: "Error", description: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const toggleRecipient = (empId) => {
    setForm((prev) => {
      const exists = prev.submitted_to_ids.includes(empId);
      const next = exists
        ? prev.submitted_to_ids.filter((id) => id !== empId)
        : [...prev.submitted_to_ids, empId];
      return { ...prev, submitted_to_ids: next };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.is_confidential && form.submitted_to_ids.length === 0) {
      toast({
        title: "Recipient Required",
        description: "Please select at least one recipient authorized to receive this confidential report.",
        variant: "destructive",
      });
      return;
    }

    try {
      const selectedNames = employees
        .filter((emp) => form.submitted_to_ids.includes(emp.id))
        .map((emp) => emp.full_name);

      const created = await Report.create({
        heading: form.heading,
        description: form.description,
        submitted_by_id: performer.id,
        submitted_by_name: performer.name,
        submitted_date: new Date().toISOString(),
        department_id: employee?.department_id || "",
        department_name: employee?.department_name || "",
        file_url: form.file_url,
        file_name: form.file_name,
        is_confidential: form.is_confidential,
        submitted_to_ids: form.submitted_to_ids,
        submitted_to_names: selectedNames,
      });

      // Send notifications to each chosen recipient
      for (const recId of form.submitted_to_ids) {
        const recEmp = employees.find((emp) => emp.id === recId);
        if (recEmp) {
          createNotification(
            recEmp.user_id,
            recEmp.id,
            form.is_confidential ? "Confidential Report Submitted to You" : "New Report Submitted to You",
            `${performer.name} submitted ${form.is_confidential ? "a confidential " : "a "}report: "${form.heading}"`,
            "report_received",
            created.id,
            "/reports"
          );
        }
      }

      await logAudit(
        form.is_confidential ? "Submitted Confidential Report" : "Submitted Report",
        "Report",
        created.id,
        form.heading,
        performer,
        selectedNames.length > 0 ? `Target recipients: ${selectedNames.join(", ")}` : "General / All Staff"
      );

      toast({
        title: "Submitted",
        description: form.is_confidential
          ? "Confidential report submitted to designated recipients"
          : "Report submitted successfully",
      });

      setForm({
        heading: "",
        description: "",
        file_url: "",
        file_name: "",
        is_confidential: false,
        submitted_to_ids: [],
      });
      setShowForm(false);
      loadData();
    } catch (err) {
      toast({ title: "Error", description: "Failed to submit report", variant: "destructive" });
    }
  };

  const handleDelete = async (report) => {
    if (!confirm(`Delete report "${report.heading}"?`)) return;
    try {
      await Report.delete(report.id);
      await logAudit("Deleted Report", "Report", report.id, report.heading, performer, "");
      toast({ title: "Deleted", description: "Report deleted" });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete report", variant: "destructive" });
    }
  };

  // Client-side confidentiality gate (defense in depth on top of backend list filter)
  const isVisibleReport = (r) => {
    if (isAdmin) return true;
    const isConf = !!r.is_confidential;
    const toIds = r.submitted_to_ids || [];
    if (!isConf && toIds.length === 0) return true;
    if (employee && toIds.includes(employee.id)) return true;
    if (r.submitted_by_id === performer.id) return true;
    return false;
  };

  const visibleReports = reports.filter(isVisibleReport);

  const filtered = visibleReports.filter((r) => {
    if (activeTab === "confidential" && !r.is_confidential) return false;
    if (activeTab === "to_me") {
      const toIds = r.submitted_to_ids || [];
      if (!employee || !toIds.includes(employee.id)) return false;
    }
    if (activeTab === "my_submissions") {
      if (r.submitted_by_id !== performer.id) return false;
    }

    if (!search) return true;
    const q = search.toLowerCase();
    const recipientMatch = (r.submitted_to_names || []).some((name) =>
      name.toLowerCase().includes(q)
    );
    return (
      (r.heading || "").toLowerCase().includes(q) ||
      (r.description || "").toLowerCase().includes(q) ||
      (r.submitted_by_name || "").toLowerCase().includes(q) ||
      recipientMatch
    );
  });

  const filteredEmployees = employees
    .filter((emp) => emp.status === "active")
    .filter((emp) => {
      if (!recipientSearch) return true;
      const q = recipientSearch.toLowerCase();
      return (
        (emp.full_name || "").toLowerCase().includes(q) ||
        (emp.role || "").toLowerCase().includes(q) ||
        (emp.department_name || "").toLowerCase().includes(q)
      );
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const confidentialCount = visibleReports.filter((r) => r.is_confidential).length;
  const toMeCount = employee
    ? visibleReports.filter((r) => (r.submitted_to_ids || []).includes(employee.id)).length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Submit, route, and view organizational reports</p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="bg-slate-800 hover:bg-slate-900 shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" /> Submit Report
        </Button>
      </div>

      {/* Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === "all"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All Reports ({visibleReports.length})
          </button>
          <button
            onClick={() => setActiveTab("confidential")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === "confidential"
                ? "bg-white text-amber-700 shadow-sm font-semibold"
                : "text-slate-600 hover:text-amber-700"
            }`}
          >
            <Lock className="w-3 h-3 text-amber-600" />
            Confidential {confidentialCount > 0 && `(${confidentialCount})`}
          </button>
          {employee && (
            <button
              onClick={() => setActiveTab("to_me")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                activeTab === "to_me"
                  ? "bg-white text-slate-900 shadow-sm font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Addressed to Me {toMeCount > 0 && `(${toMeCount})`}
            </button>
          )}
          <button
            onClick={() => setActiveTab("my_submissions")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === "my_submissions"
                ? "bg-white text-slate-900 shadow-sm font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            My Submissions
          </button>
        </div>

        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reports or recipients..."
            className="pl-9 bg-white"
          />
        </div>
      </div>

      {/* Reports Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">
            {search ? "No reports match your search" : "No reports available in this category"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {activeTab === "confidential"
              ? "Confidential reports are restricted to specified recipients and administrators."
              : "Reports submitted will appear here based on your access level."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((r) => {
            const isConfidential = !!r.is_confidential;
            const recipientNames = r.submitted_to_names || [];

            return (
              <div
                key={r.id}
                className={`bg-white rounded-2xl border p-5 hover:shadow-md transition-all relative ${
                  isConfidential ? "border-amber-200/90 shadow-sm" : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <h3 className="font-heading font-bold text-slate-900 text-base leading-snug">
                        {r.heading}
                      </h3>
                      {isConfidential && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                          <Lock className="w-3 h-3 text-amber-600" /> Confidential
                        </span>
                      )}
                      {r.department_name && (
                        <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                          {r.department_name}
                        </span>
                      )}
                    </div>
                  </div>

                  {r.file_url && (
                    <a
                      href={r.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1 shrink-0 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Attachment
                    </a>
                  )}
                </div>

                <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap line-clamp-4 leading-relaxed">
                  {r.description}
                </p>

                {/* Submitted To Badges */}
                <div className="mt-3.5 pt-3 border-t border-slate-100">
                  {recipientNames.length > 0 ? (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50/80 px-2.5 py-1.5 rounded-lg border border-slate-150">
                      <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-700 shrink-0">Submitted to:</span>
                      <span className="text-slate-800 truncate" title={recipientNames.join(", ")}>
                        {recipientNames.join(", ")}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Users className="w-3.5 h-3.5 shrink-0" />
                      <span>Submitted to: General / All Authorized Staff</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
                    <p>
                      By <span className="text-slate-600 font-medium">{r.submitted_by_name || "Unknown"}</span> •{" "}
                      {formatDate(r.submitted_date)}
                    </p>
                    {(isAdmin || r.submitted_by_id === performer.id) && (
                      <button
                        onClick={() => handleDelete(r)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                        title="Delete Report"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submit Report Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-heading font-bold text-slate-900">Submit a Report</h2>
                <p className="text-xs text-slate-500 mt-0.5">Route reports directly to specific leaders or staff</p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Heading *</Label>
                <Input
                  value={form.heading}
                  onChange={(e) => setForm({ ...form, heading: e.target.value })}
                  required
                  placeholder="e.g. Monthly Operations Review / Incident Report"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Brief Description *</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  required
                  rows={4}
                  placeholder="Provide comprehensive details, findings, or action items..."
                  className="mt-1"
                />
              </div>

              {/* Confidentiality & Recipient Selection Container */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`p-2 rounded-lg mt-0.5 ${
                        form.is_confidential ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-slate-900">Confidential Report</span>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Restricts visibility so only designated recipients and administrators can view this report.
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                    <input
                      type="checkbox"
                      checked={form.is_confidential}
                      onChange={(e) => setForm({ ...form, is_confidential: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                  </label>
                </div>

                {/* Recipient Selector */}
                <div className="pt-2 border-t border-slate-200/60">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      Submit To (Designated Recipients){" "}
                      {form.is_confidential && <span className="text-amber-600">*</span>}
                    </Label>
                    {form.submitted_to_ids.length > 0 && (
                      <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        {form.submitted_to_ids.length} selected
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mb-2">
                    {form.is_confidential
                      ? "Select the specific executives, managers, or colleagues authorized to see this."
                      : "Leave unselected for an open/general report, or choose specific recipients to notify them."}
                  </p>

                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <Input
                      value={recipientSearch}
                      onChange={(e) => setRecipientSearch(e.target.value)}
                      placeholder="Filter staff by name or role..."
                      className="pl-8 h-8 text-xs bg-white"
                    />
                  </div>

                  <div className="border border-slate-200 rounded-lg p-2 max-h-36 overflow-y-auto space-y-1 bg-white">
                    {filteredEmployees.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-2">No matching staff found</p>
                    ) : (
                      filteredEmployees.map((emp) => {
                        const isSelected = form.submitted_to_ids.includes(emp.id);
                        return (
                          <label
                            key={emp.id}
                            className={`flex items-center justify-between gap-2 p-1.5 rounded cursor-pointer transition-colors text-xs ${
                              isSelected
                                ? "bg-amber-50 text-amber-950 font-medium"
                                : "hover:bg-slate-50 text-slate-700"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleRecipient(emp.id)}
                                className="rounded text-amber-600 focus:ring-amber-500"
                              />
                              <span className="truncate font-medium">{emp.full_name}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {emp.department_name ? `${emp.department_name} • ` : ""}
                              {emp.role}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                  {form.is_confidential && form.submitted_to_ids.length === 0 && (
                    <p className="text-[11px] text-amber-600 mt-1.5 font-medium flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" /> Please check at least one recipient above.
                    </p>
                  )}
                </div>
              </div>

              {/* File Attachment */}
              <div>
                <Label className="text-xs font-semibold text-slate-700">Attachment (optional)</Label>
                <div className="mt-1 flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 hover:text-slate-900 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 shadow-2xs transition-colors">
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span className="truncate max-w-[240px]">
                      {form.file_name || "Attach document or report file"}
                    </span>
                    <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
                  </label>
                  {form.file_url && (
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, file_url: "", file_name: "" }))}
                      className="text-xs text-red-500 hover:text-red-700 underline"
                    >
                      Remove
                    </button>
                  )}
                  {uploading && <span className="text-xs text-slate-400">Uploading...</span>}
                </div>
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
                >
                  Submit Report
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}