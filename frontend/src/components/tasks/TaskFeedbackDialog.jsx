import React, { useState, useEffect, useRef } from "react";
import {
  X,
  MessageSquare,
  Send,
  Paperclip,
  Clock,
  User,
  FileText,
  AlertCircle,
  RefreshCw,
  CornerDownLeft,
} from "lucide-react";
import { TaskFeedback } from "@/api/entities";
import { UploadFile } from "@/api/integrations";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, PriorityBadge } from "@/components/Badges";
import { formatDateTime, getEffectiveStatus } from "@/lib/performance";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export default function TaskFeedbackDialog({ task, currentUser, currentEmployee, onClose }) {
  const { toast } = useToast();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);

  const myId = currentEmployee?.id || currentUser?.id;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadFeedback = async (isSilent = false) => {
    if (!task?.id) return;
    if (!isSilent) setLoading(true);
    try {
      const data = await TaskFeedback.filter({ task_id: task.id, sort: "created_date" });
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      if (!isSilent) {
        toast({
          title: "Error",
          description: "Failed to load task feedback",
          variant: "destructive",
        });
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedback();
    // Auto-poll for new feedback every 7 seconds while open
    const interval = setInterval(() => {
      loadFeedback(true);
    }, 7000);
    return () => clearInterval(interval);
  }, [task?.id]);

  useEffect(() => {
    if (!loading) {
      scrollToBottom();
    }
  }, [messages, loading]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await UploadFile({ file });
      setAttachmentUrl(res.file_url);
      setAttachmentName(res.file_name || file.name);
      toast({ title: "Attached", description: `File attached: ${file.name}` });
    } catch (err) {
      toast({ title: "Upload Failed", description: "Could not upload attachment", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    const clean = text.trim();
    if (!clean && !attachmentUrl) return;

    setSending(true);
    try {
      const newMsg = await TaskFeedback.create({
        task_id: task.id,
        message: clean || (attachmentName ? `Attached: ${attachmentName}` : "Feedback attachment"),
        attachment_file_url: attachmentUrl || "",
        attachment_file_name: attachmentName || "",
      });

      setText("");
      setAttachmentUrl("");
      setAttachmentName("");
      setMessages((prev) => [...prev, newMsg]);
      toast({ title: "Sent", description: "Feedback / message posted" });
    } catch (err) {
      toast({
        title: "Error",
        description: err?.message || "Failed to post message",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isMyMessage = (msg) => {
    if (!myId) return false;
    return msg.sender_id === myId || msg.sender_id === currentUser?.id || msg.sender_id === currentEmployee?.id;
  };

  const effStatus = task ? getEffectiveStatus(task) : "Pending";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col h-[85vh] max-h-[750px] overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                <MessageSquare className="w-3.5 h-3.5" /> Task Feedback & Discussion
              </span>
              <StatusBadge status={effStatus} />
              <PriorityBadge priority={task?.priority || "Medium"} />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate" title={task?.title}>
              {task?.title}
            </h2>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
              {task?.assigned_by_name && (
                <span>Assigned by: <strong className="text-slate-700">{task.assigned_by_name}</strong></span>
              )}
              {task?.assigned_to_names?.length > 0 && (
                <span>Assignee: <strong className="text-slate-700">{task.assigned_to_names.join(", ")}</strong></span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => loadFeedback(false)}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
              title="Refresh messages"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Informational banner if task has a submitted report awaiting approval */}
        {task?.status === "Submitted" && (
          <div className="bg-amber-50/90 border-b border-amber-200 px-4 py-2.5 flex items-center gap-2 text-xs text-amber-800">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <div className="truncate flex-1">
              <span className="font-semibold">Report Submitted:</span> &ldquo;{task.completion_report_heading || "Completion Report"}&rdquo; is awaiting approval. Use this thread to communicate feedback, ask questions, or request revisions.
            </div>
          </div>
        )}

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-gradient-to-b from-slate-50/40 to-white">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
              <p className="text-xs">Loading feedback history...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3 shadow-inner">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">No feedback messages yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Have a question about this task, need clarification, or want to provide feedback on progress or a submitted report? Send a message below!
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const mine = isMyMessage(msg);
              const isAssignerTag = msg.sender_role?.includes("Assigner");
              const isAssigneeTag = msg.sender_role?.includes("Assignee");
              const isMgmtTag = msg.sender_role?.includes("Admin") || msg.sender_role?.includes("Management");

              return (
                <div
                  key={msg.id}
                  className={cn("flex flex-col max-w-[85%] sm:max-w-[80%]", mine ? "ml-auto items-end" : "mr-auto items-start")}
                >
                  {/* Sender & timestamp header */}
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-500">
                    <span className="font-medium text-slate-700">{mine ? "You" : msg.sender_name}</span>
                    {msg.sender_role && (
                      <span
                        className={cn(
                          "px-1.5 py-0.2 rounded text-[10px] font-medium border",
                          isAssignerTag
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : isAssigneeTag
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : isMgmtTag
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        )}
                      >
                        {msg.sender_role}
                      </span>
                    )}
                    <span className="text-slate-400">• {formatDateTime(msg.created_date)}</span>
                  </div>

                  {/* Bubble */}
                  <div
                    className={cn(
                      "rounded-2xl p-3.5 text-sm shadow-xs border transition-all",
                      mine
                        ? "bg-slate-900 text-white border-slate-800 rounded-tr-xs"
                        : "bg-white text-slate-800 border-slate-200/90 rounded-tl-xs hover:border-slate-300"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.message}</p>

                    {/* Attachment if present */}
                    {msg.attachment_file_url && (
                      <a
                        href={msg.attachment_file_url}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          "mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                          mine
                            ? "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        )}
                      >
                        <FileText className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                        <span className="truncate max-w-[200px]">{msg.attachment_file_name || "Attached document"}</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input & Action Area */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-white">
          {/* Active Attachment chip */}
          {attachmentUrl && (
            <div className="mb-2 flex items-center justify-between px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-900">
              <span className="flex items-center gap-1.5 truncate">
                <Paperclip className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <strong className="font-medium truncate">{attachmentName}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setAttachmentUrl("");
                  setAttachmentName("");
                }}
                className="text-slate-400 hover:text-red-500 p-0.5 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <form onSubmit={handleSend} className="flex flex-col gap-2">
            <div className="relative rounded-xl border border-slate-200 focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100 transition-all bg-white">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Write a message, question, review feedback, or revision request... (Enter to send, Shift+Enter for newline)"
                rows={2}
                className="resize-none border-0 shadow-none focus-visible:ring-0 text-sm p-3 min-h-[60px]"
              />

              <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 bg-slate-50/50 rounded-b-xl">
                <div>
                  <label
                    className={cn(
                      "cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors",
                      uploading && "opacity-50 pointer-events-none"
                    )}
                    title="Attach document, image or file"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                    <span>{uploading ? "Uploading..." : "Attach File"}</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploading || sending}
                    />
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 hidden sm:inline">
                    Press <kbd className="px-1 py-0.5 bg-slate-200 text-slate-600 rounded text-[10px] font-mono">Enter</kbd> to send
                  </span>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={sending || uploading || (!text.trim() && !attachmentUrl)}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-medium px-4 h-8 gap-1.5 rounded-lg shadow-xs"
                  >
                    <span>Send</span>
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
