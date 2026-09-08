import React, { useState } from "react";
import { X, FileText, Send, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { UploadFile } from "@/api/integrations";
import { useToast } from "@/components/ui/use-toast";

export default function SubmitReportDialog({ task, onSubmit, onClose }) {
  const { toast } = useToast();
  const isResubmit = task.status === "Submitted";
  const [heading, setHeading] = useState(isResubmit ? task.completion_report_heading || "" : "");
  const [report, setReport] = useState(isResubmit ? task.completion_report || "" : "");
  const [fileUrl, setFileUrl] = useState(isResubmit ? task.completion_report_file_url || "" : "");
  const [fileName, setFileName] = useState(isResubmit ? task.completion_report_file_name || "" : "");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await UploadFile({ file });
      setFileUrl(res.file_url);
      setFileName(file.name);
    } catch (err) {
      toast({ title: "Error", description: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!heading.trim() || !report.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(heading.trim(), report.trim(), fileUrl, fileName);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-heading font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5" /> {isResubmit ? "Resubmit Completion Report" : "Submit Completion Report"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              For: {task.title}{isResubmit ? " — replaces your previous submission, still awaiting approval" : ""}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Report Heading *</Label>
            <Input
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              required
              placeholder="e.g. Q3 Financial Analysis — Summary of Findings"
            />
          </div>
          <div>
            <Label>Report Description *</Label>
            <Textarea
              value={report}
              onChange={(e) => setReport(e.target.value)}
              required
              rows={6}
              placeholder="Describe what was done, key outcomes, and any notable findings..."
            />
          </div>
          <div>
            <Label>Attachment (optional)</Label>
            <p className="text-xs text-slate-400 mb-2">Attach a document, spreadsheet, or image supporting this report.</p>
            {fileUrl ? (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 bg-slate-50">
                <span className="text-sm text-slate-700 flex items-center gap-1.5 truncate">
                  <Paperclip className="w-3.5 h-3.5 shrink-0" /> {fileName}
                </span>
                <button
                  type="button"
                  onClick={() => { setFileUrl(""); setFileName(""); }}
                  className="text-slate-400 hover:text-red-500 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm text-slate-600 w-fit">
                <Paperclip className="w-4 h-4" /> {uploading ? "Uploading..." : "Attach a file"}
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || uploading} className="flex-1 bg-slate-800 hover:bg-slate-900">
              {submitting ? "Submitting..." : (<><Send className="w-4 h-4 mr-1" /> Submit for Approval</>)}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
