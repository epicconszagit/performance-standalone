import React, { useState, useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import {
  CalendarDays, Plus, Pencil, Trash2, X, Clock, MapPin, Users as UsersIcon,
  FileText, Upload, Download, ListChecks, ChevronRight, Search, CheckSquare, Square, UserCheck,
  Sun, CalendarRange, Building2, Sparkles, Calendar, Layers
} from "lucide-react";
import { Meeting, Employee, MeetingMinutes, ActionItem, Department } from "@/api/entities";
import { apiClient } from "@/api/client";
import { UploadFile } from "@/api/integrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/Badges";
import { formatDate, formatDateTime, logAudit, createNotification } from "@/lib/performance";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

function getTodayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dt = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dt}`;
}

function getMonthOptions() {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    options.push({ year: y, month: m, label, value: `${y}-${m}` });
  }
  return options;
}

function parseMonthValue(val) {
  const parts = (val || "").split("-");
  const now = new Date();
  if (parts.length === 2) {
    const y = parseInt(parts[0], 10) || now.getFullYear();
    const m = parseInt(parts[1], 10) || (now.getMonth() + 1);
    return { year: y, month: m };
  }
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function getMonthWeekdays(year, month) {
  const dates = [];
  const todayStr = getTodayString();
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    const dow = d.getDay(); // 0 = Sun, 6 = Sat
    if (dow !== 0 && dow !== 6) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dt = String(d.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${dt}`;
      // Never schedule for dates that have already passed
      if (dateStr >= todayStr) {
        dates.push(dateStr);
      }
    }
  }
  return dates;
}

function getMonthWeeklyDays(year, month, targetDayOfWeek = 5) {
  const dates = [];
  const todayStr = getTodayString();
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    if (d.getDay() === Number(targetDayOfWeek)) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dt = String(d.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${dt}`;
      // Never schedule for dates that have already passed
      if (dateStr >= todayStr) {
        dates.push(dateStr);
      }
    }
  }
  return dates;
}

export default function Meetings() {
  const { employee, role, performer, user } = useOutletContext();
  const { toast } = useToast();
  const [meetings, setMeetings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [minutes, setMinutes] = useState([]);
  const [actionItems, setActionItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [editing, setEditing] = useState(null);
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const [filterTab, setFilterTab] = useState("all"); // "all" | "my"
  const [typeFilter, setTypeFilter] = useState("all"); // "all" | "daily_morning" | "weekly_update" | "departmental" | "custom"

  // Scheduling modes: "daily_morning" | "weekly_update" | "departmental" | "custom"
  const [scheduleMode, setScheduleMode] = useState("daily_morning");
  const [submittingMeeting, setSubmittingMeeting] = useState(false);
  const [showDatesPreview, setShowDatesPreview] = useState(false);

  const now = new Date();
  const currentMonthValue = `${now.getFullYear()}-${now.getMonth() + 1}`;
  const [targetMonth, setTargetMonth] = useState(currentMonthValue);
  const [weeklyDay, setWeeklyDay] = useState(5); // 5 = Friday

  const [form, setForm] = useState({
    title: "",
    date: "",
    time: "10:00",
    venue: "",
    agenda: "",
    resolutions: "",
    department_id: "",
    attendee_ids: [],
  });
  const [minutesForm, setMinutesForm] = useState({ content: "", file_url: "", file_name: "", status: "Draft" });
  const [newActionItem, setNewActionItem] = useState({ description: "", assigned_to_id: "", due_date: "" });
  const [uploading, setUploading] = useState(false);
  const [minutesSearch, setMinutesSearch] = useState("");

  const isSecretary = role === "Secretary";
  const isAdmin = ["Super Administrator", "Administrator", "Director of Operations"].includes(role);
  const canAdminister = isSecretary || isAdmin;

  const canEditMeeting = (m) => {
    if (!m) return false;
    if (canAdminister) return true;
    return m.created_by_id === performer.id || m.created_by_id === user?.id || (employee && m.created_by_id === employee.id);
  };

  const loadData = async () => {
    try {
      const [mts, emps, mins, ais, depts] = await Promise.all([
        Meeting.list("-date", 500),
        Employee.list("-created_date", 300),
        MeetingMinutes.list("-uploaded_date", 300),
        ActionItem.list("-created_date", 300),
        Department.list("-created_date", 100),
      ]);
      setMeetings(mts || []);
      setEmployees(emps || []);
      setMinutes(mins || []);
      setActionItems(ais || []);
      setDepartments(depts || []);
    } catch (e) {
      toast({ title: "Error", description: "Failed to load meetings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = (defaultMode = "daily_morning") => {
    setEditing(null);
    setAttendeeSearch("");
    setScheduleMode(defaultMode);
    setShowDatesPreview(false);
    const currentDate = getTodayString();
    const initialMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;
    setTargetMonth(initialMonth);
    setWeeklyDay(5);

    const monthObj = getMonthOptions().find((o) => o.value === initialMonth);
    const monthLabel = monthObj ? monthObj.label : "";

    const activeIds = employees.filter((e) => e.status === "active").map((e) => e.id);
    const initialAttendees = (defaultMode === "daily_morning" || defaultMode === "weekly_update")
      ? activeIds
      : (employee?.id ? [employee.id] : []);

    let title = "";
    let time = "10:00";
    let venue = "";
    let agenda = "";

    if (defaultMode === "daily_morning") {
      title = `Daily Morning Standup - ${monthLabel}`;
      time = "08:30";
      venue = "Main Boardroom / Virtual Standup";
      agenda = "Daily task alignment, priorities check, and blocker identification.";
    } else if (defaultMode === "weekly_update") {
      title = "Weekly Performance & Project Update";
      time = "15:00";
      venue = "Conference Room / Google Meet";
      agenda = "Weekly progress review, milestones achieved, obstacles encountered, and roadmap for next week.";
    } else if (defaultMode === "departmental") {
      const firstDept = departments[0];
      title = firstDept ? `${firstDept.name} Team Alignment` : "Departmental Meeting";
      time = "10:00";
      venue = "Department Meeting Room";
      agenda = "Departmental workflow, task progress, and team discussion.";
    }

    setForm({
      title,
      date: currentDate,
      time,
      venue,
      agenda,
      resolutions: "",
      department_id: departments[0]?.id || "",
      attendee_ids: initialAttendees,
    });
    setShowForm(true);
  };

  const handleModeChange = (newMode) => {
    setScheduleMode(newMode);
    setShowDatesPreview(false);
    const { year, month } = parseMonthValue(targetMonth);
    const monthObj = getMonthOptions().find((o) => o.value === targetMonth);
    const monthLabel = monthObj ? monthObj.label : "";

    if (newMode === "daily_morning") {
      setForm((prev) => ({
        ...prev,
        title: `Daily Morning Standup - ${monthLabel}`,
        time: prev.time && prev.time !== "10:00" ? prev.time : "08:30",
        venue: prev.venue || "Main Boardroom / Virtual Standup",
        agenda: "Daily task alignment, priorities check, and blocker identification.",
      }));
    } else if (newMode === "weekly_update") {
      setForm((prev) => ({
        ...prev,
        title: "Weekly Performance & Project Update",
        time: "15:00",
        venue: prev.venue || "Conference Room / Google Meet",
        agenda: "Weekly progress review, milestones achieved, obstacles encountered, and roadmap for next week.",
      }));
    } else if (newMode === "departmental") {
      const targetDept = departments.find((d) => d.id === form.department_id) || departments[0];
      const deptIds = targetDept
        ? employees.filter((e) => e.department_id === targetDept.id && e.status === "active").map((e) => e.id)
        : [];

      setForm((prev) => ({
        ...prev,
        department_id: targetDept ? targetDept.id : prev.department_id,
        title: targetDept ? `${targetDept.name} Team Alignment` : "Departmental Meeting",
        time: "10:00",
        date: prev.date || getTodayString(),
        venue: prev.venue || "Department Meeting Room",
        agenda: "Departmental operations, active deliverables, and team coordination.",
        attendee_ids: deptIds.length > 0 ? deptIds : prev.attendee_ids,
      }));
    } else {
      // custom
      setForm((prev) => ({
        ...prev,
        title: prev.title.includes("Daily Morning") || prev.title.includes("Weekly") ? "" : prev.title,
        date: prev.date || getTodayString(),
        time: prev.time || "10:00",
      }));
    }
  };

  const handleDepartmentChange = (deptId) => {
    const dept = departments.find((d) => d.id === deptId);
    const deptMemberIds = employees.filter((e) => e.department_id === deptId && e.status === "active").map((e) => e.id);
    setForm((prev) => ({
      ...prev,
      department_id: deptId,
      title: dept ? `${dept.name} Team Alignment` : prev.title,
      attendee_ids: deptMemberIds.length > 0 ? deptMemberIds : prev.attendee_ids,
    }));
  };

  const openEdit = (m) => {
    setEditing(m);
    setScheduleMode(m.meeting_type || "custom");
    setAttendeeSearch("");
    setShowDatesPreview(false);
    setForm({
      title: m.title || "",
      date: m.date || getTodayString(),
      time: m.time || "",
      venue: m.venue || "",
      agenda: m.agenda || "",
      resolutions: m.resolutions || "",
      department_id: m.department_id || "",
      attendee_ids: m.attendee_ids || [],
    });
    setShowForm(true);
  };

  const toggleAttendee = (id) => {
    setForm((prev) => ({
      ...prev,
      attendee_ids: prev.attendee_ids.includes(id) ? prev.attendee_ids.filter((x) => x !== id) : [...prev.attendee_ids, id],
    }));
  };

  const selectAllAttendees = () => {
    const activeIds = employees.filter((e) => e.status === "active").map((e) => e.id);
    setForm((prev) => ({ ...prev, attendee_ids: activeIds }));
  };

  const clearAllAttendees = () => {
    setForm((prev) => ({ ...prev, attendee_ids: [] }));
  };

  const selectDepartmentAttendeesOnly = (deptId) => {
    if (!deptId) return;
    const deptIds = employees.filter((e) => e.department_id === deptId && e.status === "active").map((e) => e.id);
    setForm((prev) => ({ ...prev, attendee_ids: deptIds }));
  };

  const handleMeetingSubmit = async (e) => {
    e.preventDefault();
    if (submittingMeeting) return;
    setSubmittingMeeting(true);

    const names = form.attendee_ids.map((id) => employees.find((emp) => emp.id === id)?.full_name).filter(Boolean);
    const todayStr = getTodayString();

    try {
      if (editing) {
        if (form.date && form.date < todayStr) {
          toast({
            title: "Invalid Date",
            description: "Cannot move or schedule a meeting to a date that has passed. Meeting dates must start from the current date going forward.",
            variant: "destructive",
          });
          setSubmittingMeeting(false);
          return;
        }

        const data = {
          ...form,
          attendee_names: names,
          created_by_id: performer.id,
          created_by_name: performer.name,
          status: editing.status || "Scheduled",
          meeting_type: scheduleMode,
        };
        await Meeting.update(editing.id, data);
        await logAudit("Edited Meeting", "Meeting", editing.id, data.title, performer, "");
        toast({ title: "Updated", description: "Meeting updated successfully" });
      } else if (scheduleMode === "daily_morning") {
        const { year, month } = parseMonthValue(targetMonth);
        const monthObj = getMonthOptions().find((o) => o.value === targetMonth);
        const monthLabel = monthObj ? monthObj.label : "";
        const weekdays = getMonthWeekdays(year, month);
        if (weekdays.length === 0) {
          toast({
            title: "No Upcoming Weekdays",
            description: `All weekdays in ${monthLabel} have already passed. Please select an upcoming month.`,
            variant: "destructive",
          });
          setSubmittingMeeting(false);
          return;
        }

        const meetingsList = weekdays.map((dateStr) => ({
          title: form.title || `Daily Morning Standup (${formatDate(dateStr)})`,
          date: dateStr,
          time: form.time || "08:30",
          venue: form.venue || "",
          agenda: form.agenda || "",
          attendee_ids: form.attendee_ids,
          attendee_names: names,
          status: "Scheduled",
          department_id: form.department_id || "",
          meeting_type: "daily_morning",
        }));

        const res = await apiClient.post("/meetings/batch", {
          meetings: meetingsList,
          summary_title: `Daily Morning Standup (${monthLabel})`,
          summary_message: `${performer.name} scheduled Daily Morning Meetings (Mon–Fri at ${form.time || "08:30"}) for ${monthLabel} (${weekdays.length} upcoming sessions).`,
        });

        await logAudit("Scheduled Daily Morning Meetings", "Meeting", res.created?.[0]?.id || "batch", form.title, performer, `${weekdays.length} sessions scheduled for ${monthLabel}`);
        toast({
          title: "Daily Morning Meetings Scheduled",
          description: `Successfully scheduled ${weekdays.length} upcoming weekday meetings for ${monthLabel} with ${names.length} attendee(s).`,
        });
      } else if (scheduleMode === "weekly_update") {
        const { year, month } = parseMonthValue(targetMonth);
        const monthObj = getMonthOptions().find((o) => o.value === targetMonth);
        const monthLabel = monthObj ? monthObj.label : "";
        const weeklyDays = getMonthWeeklyDays(year, month, weeklyDay);
        const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][weeklyDay] || "Friday";

        if (weeklyDays.length === 0) {
          toast({
            title: "No Upcoming Sessions",
            description: `All ${dayName}s in ${monthLabel} have already passed. Please select an upcoming month.`,
            variant: "destructive",
          });
          setSubmittingMeeting(false);
          return;
        }

        const meetingsList = weeklyDays.map((dateStr) => ({
          title: form.title || `Weekly Team Update (${formatDate(dateStr)})`,
          date: dateStr,
          time: form.time || "15:00",
          venue: form.venue || "",
          agenda: form.agenda || "",
          attendee_ids: form.attendee_ids,
          attendee_names: names,
          status: "Scheduled",
          department_id: form.department_id || "",
          meeting_type: "weekly_update",
        }));

        const res = await apiClient.post("/meetings/batch", {
          meetings: meetingsList,
          summary_title: `Weekly Update Meetings (${monthLabel})`,
          summary_message: `${performer.name} scheduled Weekly Update Meetings (${dayName}s at ${form.time || "15:00"}) for ${monthLabel} (${weeklyDays.length} upcoming sessions).`,
        });

        await logAudit("Scheduled Weekly Meetings", "Meeting", res.created?.[0]?.id || "batch", form.title, performer, `${weeklyDays.length} weekly sessions scheduled for ${monthLabel}`);
        toast({
          title: "Weekly Meetings Scheduled",
          description: `Successfully scheduled ${weeklyDays.length} upcoming weekly meetings (${dayName}s) for ${monthLabel} with ${names.length} attendee(s).`,
        });
      } else {
        // Single meeting: departmental or custom
        if (form.date && form.date < todayStr) {
          toast({
            title: "Invalid Date",
            description: "Cannot schedule a meeting for a date that has passed. Please select today or a future date.",
            variant: "destructive",
          });
          setSubmittingMeeting(false);
          return;
        }

        const data = {
          ...form,
          attendee_names: names,
          created_by_id: performer.id,
          created_by_name: performer.name,
          status: "Scheduled",
          meeting_type: scheduleMode,
        };
        const created = await Meeting.create(data);
        await logAudit("Created Meeting", "Meeting", created.id, data.title, performer, `Scheduled ${scheduleMode} meeting`);

        for (const empId of form.attendee_ids) {
          if (empId === employee?.id) continue;
          const emp = employees.find((e) => e.id === empId);
          if (emp) {
            await createNotification(
              emp.user_id || empId,
              empId,
              "Meeting Invitation",
              `${performer.name} scheduled a meeting: "${data.title}" on ${formatDate(data.date)}${data.time ? ` at ${data.time}` : ""}`,
              "meeting_scheduled",
              created.id,
              "/meetings"
            );
          }
        }
        toast({ title: "Meeting Scheduled", description: `Meeting scheduled with ${names.length} attendee(s).` });
      }

      setShowForm(false);
      loadData();
    } catch (e) {
      toast({ title: "Error", description: e?.response?.data?.error || e?.message || "Failed to save meeting", variant: "destructive" });
    } finally {
      setSubmittingMeeting(false);
    }
  };

  const handleDelete = async (m) => {
    if (!confirm(`Delete meeting "${m.title}"?`)) return;
    try {
      await Meeting.delete(m.id);
      await logAudit("Deleted Meeting", "Meeting", m.id, m.title, performer, "");
      toast({ title: "Deleted", description: "Meeting deleted" });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete meeting", variant: "destructive" });
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await UploadFile({ file });
      setMinutesForm((prev) => ({ ...prev, file_url: res.file_url, file_name: file.name }));
      toast({ title: "Uploaded", description: "File attached" });
    } catch (err) {
      toast({ title: "Error", description: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveMinutes = async (meeting) => {
    const existing = minutes.find((m) => m.meeting_id === meeting.id);
    const trailEntry = { action: existing ? "Edited" : "Uploaded", by_name: performer.name, timestamp: new Date().toISOString() };
    const data = {
      meeting_id: meeting.id,
      meeting_title: meeting.title,
      content: minutesForm.content,
      file_url: minutesForm.file_url,
      file_name: minutesForm.file_name,
      status: minutesForm.status,
      uploaded_by_id: performer.id,
      uploaded_by_name: performer.name,
      uploaded_date: existing?.uploaded_date || new Date().toISOString(),
      last_edited_by_id: performer.id,
      last_edited_by_name: performer.name,
      last_edited_date: new Date().toISOString(),
      version: (existing?.version || 0) + 1,
      audit_trail: [...(existing?.audit_trail || []), trailEntry],
    };
    try {
      if (existing) {
        await MeetingMinutes.update(existing.id, data);
        await logAudit(minutesForm.status === "Approved" ? "Approved Minutes" : "Edited Minutes", "MeetingMinutes", existing.id, meeting.title, performer, `Status: ${minutesForm.status}`);
      } else {
        const created = await MeetingMinutes.create({ ...data, uploaded_date: new Date().toISOString() });
        await logAudit("Uploaded Minutes", "MeetingMinutes", created.id, meeting.title, performer, "");
      }
      toast({ title: "Saved", description: "Meeting minutes saved" });
      loadData();
      setShowDetail(null);
    } catch (e) {
      toast({ title: "Error", description: "Failed to save minutes", variant: "destructive" });
    }
  };

  const openMinutes = (meeting) => {
    const existing = minutes.find((m) => m.meeting_id === meeting.id);
    const isOrganizer = meeting.created_by_id === performer.id || meeting.created_by_id === user?.id;
    setMinutesForm({
      content: existing?.content || "",
      file_url: existing?.file_url || "",
      file_name: existing?.file_name || "",
      status: (canAdminister || isOrganizer) ? (existing?.status || "Draft") : "Draft",
    });
    setShowDetail(meeting);
  };

  const addActionItem = async (meeting) => {
    if (!newActionItem.description || !newActionItem.assigned_to_id) {
      toast({ title: "Error", description: "Fill in description and assignee", variant: "destructive" });
      return;
    }
    if (newActionItem.due_date && newActionItem.due_date < getTodayString()) {
      toast({
        title: "Invalid Due Date",
        description: "Action item due date cannot be in the past. Please select today or a future date.",
        variant: "destructive",
      });
      return;
    }
    const emp = employees.find((e) => e.id === newActionItem.assigned_to_id);
    try {
      const created = await ActionItem.create({
        meeting_id: meeting.id,
        meeting_title: meeting.title,
        description: newActionItem.description,
        assigned_to_id: newActionItem.assigned_to_id,
        assigned_to_name: emp?.full_name || "",
        status: "Pending",
        due_date: newActionItem.due_date,
        created_by_id: performer.id,
      });
      await logAudit("Created Action Item", "ActionItem", created.id, newActionItem.description, performer, `Assigned to ${emp?.full_name}`);
      if (emp) await createNotification(emp.user_id || emp.id, emp.id, "Action Item Assigned", `"${newActionItem.description}" from meeting: ${meeting.title}`, "action_item", created.id, "/meetings");
      setNewActionItem({ description: "", assigned_to_id: "", due_date: "" });
      toast({ title: "Added", description: "Action item created" });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to add action item", variant: "destructive" });
    }
  };

  const updateActionItem = async (ai, status) => {
    try {
      const updates = { status };
      if (status === "Completed") updates.completed_date = new Date().toISOString().split("T")[0];
      await ActionItem.update(ai.id, updates);
      await logAudit("Updated Action Item", "ActionItem", ai.id, ai.description, performer, `Status → ${status}`);
      toast({ title: "Updated", description: "Action item updated" });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to update action item", variant: "destructive" });
    }
  };

  // Filter meetings by search, ownership tab, and meeting type
  const filteredMeetings = meetings.filter((m) => {
    if (filterTab === "my") {
      const isMyCreated = m.created_by_id === performer.id || m.created_by_id === user?.id || (employee && m.created_by_id === employee.id);
      const isMyAttending = employee && m.attendee_ids && m.attendee_ids.includes(employee.id);
      if (!isMyCreated && !isMyAttending) return false;
    }

    if (typeFilter !== "all") {
      const mType = m.meeting_type || "custom";
      if (typeFilter === "custom") {
        if (mType !== "custom" && mType !== "single") return false;
      } else if (mType !== typeFilter) {
        return false;
      }
    }

    if (!minutesSearch) return true;
    const q = minutesSearch.toLowerCase();
    const mn = minutes.find((mm) => mm.meeting_id === m.id);
    return (
      (m.title || "").toLowerCase().includes(q) ||
      (m.agenda || "").toLowerCase().includes(q) ||
      (m.venue || "").toLowerCase().includes(q) ||
      (m.created_by_name || "").toLowerCase().includes(q) ||
      (m.resolutions || "").toLowerCase().includes(q) ||
      (mn?.content || "").toLowerCase().includes(q) ||
      (mn?.file_name || "").toLowerCase().includes(q)
    );
  });

  const activeEmployees = employees.filter((e) => e.status === "active");
  const filteredAttendees = activeEmployees.filter((emp) => {
    if (!attendeeSearch) return true;
    const q = attendeeSearch.toLowerCase();
    return (
      emp.full_name?.toLowerCase().includes(q) ||
      emp.department_name?.toLowerCase().includes(q) ||
      emp.role?.toLowerCase().includes(q) ||
      emp.email?.toLowerCase().includes(q)
    );
  });

  // Calculate preview dates for batch scheduling modes
  const previewDates = useMemo(() => {
    const { year, month } = parseMonthValue(targetMonth);
    if (scheduleMode === "daily_morning") {
      return getMonthWeekdays(year, month);
    }
    if (scheduleMode === "weekly_update") {
      return getMonthWeeklyDays(year, month, weeklyDay);
    }
    return [];
  }, [scheduleMode, targetMonth, weeklyDay]);

  const targetMonthLabel = useMemo(() => {
    const obj = getMonthOptions().find((o) => o.value === targetMonth);
    return obj ? obj.label : targetMonth;
  }, [targetMonth]);

  const renderMeetingTypeBadge = (meetingType) => {
    switch (meetingType) {
      case "daily_morning":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            <Sun className="w-3 h-3 text-amber-500" /> Daily Morning
          </span>
        );
      case "weekly_update":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
            <CalendarRange className="w-3 h-3 text-indigo-500" /> Weekly Update
          </span>
        );
      case "departmental":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Building2 className="w-3 h-3 text-emerald-500" /> Departmental
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200">
            <Sparkles className="w-3 h-3 text-slate-400" /> Custom
          </span>
        );
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with Schedule Meeting button accessible to ALL users */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900">Meetings</h1>
          <p className="text-sm text-slate-500 mt-1">Schedule daily morning standups, weekly updates, departmental meetings, or custom meetings</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => openCreate("daily_morning")} className="bg-slate-800 hover:bg-slate-900 shadow-sm">
            <Plus className="w-4 h-4 mr-1.5" /> Schedule Meeting
          </Button>
        </div>
      </div>

      {/* Filters and search */}
      <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg self-start">
            <button
              onClick={() => setFilterTab("all")}
              className={cn("px-3 py-1.5 text-xs font-semibold rounded-md transition-all", filterTab === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}
            >
              All Meetings ({meetings.length})
            </button>
            <button
              onClick={() => setFilterTab("my")}
              className={cn("px-3 py-1.5 text-xs font-semibold rounded-md transition-all", filterTab === "my" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}
            >
              My Meetings
            </button>
          </div>

          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input value={minutesSearch} onChange={(e) => setMinutesSearch(e.target.value)} placeholder="Search meetings by title, venue, agenda..." className="pl-9" />
          </div>
        </div>

        {/* Secondary filter by meeting category */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          <span className="text-xs text-slate-400 mr-1 font-medium">Type:</span>
          {[
            { id: "all", label: "All Types", icon: Layers, color: "text-slate-600" },
            { id: "daily_morning", label: "Daily Morning (Mon–Fri)", icon: Sun, color: "text-amber-600" },
            { id: "weekly_update", label: "Weekly Update", icon: CalendarRange, color: "text-indigo-600" },
            { id: "departmental", label: "Departmental", icon: Building2, color: "text-emerald-600" },
            { id: "custom", label: "Custom / Ad-hoc", icon: Sparkles, color: "text-slate-600" },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = typeFilter === tab.id;
            const count = meetings.filter((m) => {
              if (tab.id === "all") return true;
              const mt = m.meeting_type || "custom";
              return tab.id === "custom" ? (mt === "custom" || mt === "single") : mt === tab.id;
            }).length;
            return (
              <button
                key={tab.id}
                onClick={() => setTypeFilter(tab.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all border",
                  isActive
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Icon className={cn("w-3.5 h-3.5", isActive ? "text-white" : tab.color)} />
                {tab.label}
                <span className={cn("text-[10px] px-1.5 py-0.2 rounded-full ml-0.5", isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {filteredMeetings.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">{minutesSearch ? "No meetings match your search" : "No meetings found"}</p>
          <p className="text-xs text-slate-400 mt-1">Select a different type filter or schedule a new meeting using the options above.</p>
          <Button onClick={() => openCreate("daily_morning")} variant="outline" className="mt-4">
            <Plus className="w-4 h-4 mr-1" /> Schedule a Meeting
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredMeetings.map((m) => {
            const meetingMinutes = minutes.find((mn) => mn.meeting_id === m.id);
            const meetingActions = actionItems.filter((ai) => ai.meeting_id === m.id);
            const isOrganizer = m.created_by_id === performer.id || m.created_by_id === user?.id || (employee && m.created_by_id === employee.id);
            const canEdit = canEditMeeting(m);

            return (
              <div key={m.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        {renderMeetingTypeBadge(m.meeting_type)}
                        <span className={cn("text-xs px-2.5 py-0.5 rounded-full font-semibold border shrink-0",
                          m.status === "Completed" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                            m.status === "Cancelled" ? "bg-red-100 text-red-700 border-red-200" : "bg-blue-100 text-blue-700 border-blue-200")}>
                          {m.status}
                        </span>
                      </div>
                      <h3 className="font-heading font-bold text-slate-900 text-base leading-snug">{m.title}</h3>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1 font-medium text-slate-700"><CalendarDays className="w-3.5 h-3.5 text-slate-400" /> {formatDate(m.date)}</span>
                        {m.time && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400" /> {m.time}</span>}
                        {m.venue && <span className="flex items-center gap-1 text-slate-600 truncate max-w-xs"><MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {m.venue}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Organizer tag */}
                  <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="text-slate-400">Organizer:</span>
                    <span className="font-medium text-slate-700">{m.created_by_name || "Staff Member"}</span>
                    {isOrganizer && <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold">You</span>}
                  </div>

                  {/* Attendees list / chip */}
                  {m.attendee_names?.length > 0 && (
                    <div className="mt-2 text-xs text-slate-600 flex items-start gap-1.5">
                      <UsersIcon className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                      <span className="line-clamp-2">
                        <strong className="text-slate-700">{m.attendee_names.length} Attendee{m.attendee_names.length > 1 ? "s" : ""}:</strong> {m.attendee_names.join(", ")}
                      </span>
                    </div>
                  )}

                  {m.agenda && (
                    <p className="mt-2 text-xs text-slate-500 line-clamp-2 italic bg-slate-50 p-2 rounded">
                      "{m.agenda}"
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {meetingMinutes ? (
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1",
                        meetingMinutes.status === "Approved" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-amber-50 text-amber-600 border border-amber-200")}>
                        <FileText className="w-3 h-3" /> Minutes: {meetingMinutes.status}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 flex items-center gap-1"><FileText className="w-3 h-3" /> No minutes</span>
                    )}
                    {meetingActions.length > 0 && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <ListChecks className="w-3 h-3" /> {meetingActions.filter((a) => a.status !== "Completed").length} action items
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 ml-auto">
                    {canEdit && (
                      <>
                        <button onClick={() => openEdit(m)} title="Edit meeting" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(m)} title="Delete meeting" className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    <button onClick={() => openMinutes(m)} className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-0.5 px-2 py-1 rounded hover:bg-amber-50">
                      Details <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Meeting Form Dialog (Schedule or Edit) */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-xl font-heading font-bold text-slate-900">{editing ? "Edit Meeting" : "Schedule Meeting"}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Organizer: <strong className="text-slate-800">{performer.name}</strong> ({role})
                </p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>

            {/* Mode Selector Tabs (only shown when creating a new meeting) */}
            {!editing && (
              <div className="mb-5">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Meeting Type & Frequency</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleModeChange("daily_morning")}
                    className={cn(
                      "p-3 rounded-xl border text-left flex flex-col justify-between transition-all",
                      scheduleMode === "daily_morning"
                        ? "bg-amber-50/80 border-amber-400 ring-2 ring-amber-400/20 text-slate-900 shadow-sm"
                        : "bg-white border-slate-200 hover:border-slate-300 text-slate-600"
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <Sun className={cn("w-4 h-4", scheduleMode === "daily_morning" ? "text-amber-600" : "text-slate-400")} />
                      <span className={cn("text-[10px] px-1.5 py-0.2 rounded font-semibold", scheduleMode === "daily_morning" ? "bg-amber-200 text-amber-900" : "bg-slate-100 text-slate-500")}>
                        Batch
                      </span>
                    </div>
                    <span className="font-semibold text-xs text-slate-900">Daily Morning</span>
                    <span className="text-[11px] text-slate-500 mt-0.5 leading-tight">Mon to Fri for a month</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleModeChange("weekly_update")}
                    className={cn(
                      "p-3 rounded-xl border text-left flex flex-col justify-between transition-all",
                      scheduleMode === "weekly_update"
                        ? "bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-400/20 text-slate-900 shadow-sm"
                        : "bg-white border-slate-200 hover:border-slate-300 text-slate-600"
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <CalendarRange className={cn("w-4 h-4", scheduleMode === "weekly_update" ? "text-indigo-600" : "text-slate-400")} />
                      <span className={cn("text-[10px] px-1.5 py-0.2 rounded font-semibold", scheduleMode === "weekly_update" ? "bg-indigo-200 text-indigo-900" : "bg-slate-100 text-slate-500")}>
                        Batch
                      </span>
                    </div>
                    <span className="font-semibold text-xs text-slate-900">Weekly Update</span>
                    <span className="text-[11px] text-slate-500 mt-0.5 leading-tight">Usually Friday at set time</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleModeChange("departmental")}
                    className={cn(
                      "p-3 rounded-xl border text-left flex flex-col justify-between transition-all",
                      scheduleMode === "departmental"
                        ? "bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-400/20 text-slate-900 shadow-sm"
                        : "bg-white border-slate-200 hover:border-slate-300 text-slate-600"
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <Building2 className={cn("w-4 h-4", scheduleMode === "departmental" ? "text-emerald-600" : "text-slate-400")} />
                      <span className={cn("text-[10px] px-1.5 py-0.2 rounded font-semibold", scheduleMode === "departmental" ? "bg-emerald-200 text-emerald-900" : "bg-slate-100 text-slate-500")}>
                        Single
                      </span>
                    </div>
                    <span className="font-semibold text-xs text-slate-900">Departmental</span>
                    <span className="text-[11px] text-slate-500 mt-0.5 leading-tight">Team-specific meeting</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleModeChange("custom")}
                    className={cn(
                      "p-3 rounded-xl border text-left flex flex-col justify-between transition-all",
                      scheduleMode === "custom"
                        ? "bg-slate-100 border-slate-400 ring-2 ring-slate-400/20 text-slate-900 shadow-sm"
                        : "bg-white border-slate-200 hover:border-slate-300 text-slate-600"
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <Sparkles className={cn("w-4 h-4", scheduleMode === "custom" ? "text-slate-800" : "text-slate-400")} />
                      <span className={cn("text-[10px] px-1.5 py-0.2 rounded font-semibold", scheduleMode === "custom" ? "bg-slate-300 text-slate-900" : "bg-slate-100 text-slate-500")}>
                        Single
                      </span>
                    </div>
                    <span className="font-semibold text-xs text-slate-900">Custom</span>
                    <span className="text-[11px] text-slate-500 mt-0.5 leading-tight">Any day & time</span>
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleMeetingSubmit} className="space-y-4">
              {/* Daily Morning Mode Fields */}
              {scheduleMode === "daily_morning" && !editing && (
                <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
                    <Sun className="w-4 h-4 text-amber-600" />
                    <span>Daily Morning Standup Settings (Monday – Friday)</span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    This will schedule a standup every weekday (Monday through Friday, skipping weekends) for the entire selected month.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <Label className="text-xs">Select Month *</Label>
                      <select
                        value={targetMonth}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTargetMonth(val);
                          const monthObj = getMonthOptions().find((o) => o.value === val);
                          if (monthObj) {
                            setForm((prev) => ({ ...prev, title: `Daily Morning Standup - ${monthObj.label}` }));
                          }
                        }}
                        className="w-full mt-1 px-3 py-2 text-xs border border-amber-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        {getMonthOptions().map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label className="text-xs">Daily Standup Time</Label>
                      <Input
                        type="time"
                        value={form.time}
                        onChange={(e) => setForm({ ...form, time: e.target.value })}
                        className="mt-1 text-xs"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between text-xs">
                    <span className="text-amber-900 font-medium">
                      📅 <strong>{previewDates.length} weekday sessions</strong> will be created for {targetMonthLabel}.
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowDatesPreview(!showDatesPreview)}
                      className="text-amber-800 underline hover:text-amber-950 font-medium"
                    >
                      {showDatesPreview ? "Hide dates" : "Preview dates"}
                    </button>
                  </div>

                  {showDatesPreview && (
                    <div className="p-2.5 bg-white/90 rounded-lg border border-amber-200 max-h-32 overflow-y-auto">
                      <div className="flex flex-wrap gap-1.5">
                        {previewDates.map((d) => (
                          <span key={d} className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                            {formatDate(d)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Weekly Update Mode Fields */}
              {scheduleMode === "weekly_update" && !editing && (
                <div className="bg-indigo-50/50 border border-indigo-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-indigo-900 font-semibold text-sm">
                    <CalendarRange className="w-4 h-4 text-indigo-600" />
                    <span>Weekly Update Settings</span>
                  </div>
                  <p className="text-xs text-indigo-800 leading-relaxed">
                    This will schedule a recurring weekly meeting on your chosen day (default Friday) across the selected month.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div>
                      <Label className="text-xs">Select Month *</Label>
                      <select
                        value={targetMonth}
                        onChange={(e) => setTargetMonth(e.target.value)}
                        className="w-full mt-1 px-3 py-2 text-xs border border-indigo-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {getMonthOptions().map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label className="text-xs">Day of Week</Label>
                      <select
                        value={weeklyDay}
                        onChange={(e) => setWeeklyDay(Number(e.target.value))}
                        className="w-full mt-1 px-3 py-2 text-xs border border-indigo-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value={5}>Friday (Recommended)</option>
                        <option value={1}>Monday</option>
                        <option value={2}>Tuesday</option>
                        <option value={3}>Wednesday</option>
                        <option value={4}>Thursday</option>
                      </select>
                    </div>

                    <div>
                      <Label className="text-xs">Meeting Time</Label>
                      <Input
                        type="time"
                        value={form.time}
                        onChange={(e) => setForm({ ...form, time: e.target.value })}
                        className="mt-1 text-xs"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-indigo-200/60 flex items-center justify-between text-xs">
                    <span className="text-indigo-900 font-medium">
                      📅 <strong>{previewDates.length} weekly sessions</strong> will be created for {targetMonthLabel}.
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowDatesPreview(!showDatesPreview)}
                      className="text-indigo-800 underline hover:text-indigo-950 font-medium"
                    >
                      {showDatesPreview ? "Hide dates" : "Preview dates"}
                    </button>
                  </div>

                  {showDatesPreview && (
                    <div className="p-2.5 bg-white/90 rounded-lg border border-indigo-200 max-h-32 overflow-y-auto">
                      <div className="flex flex-wrap gap-1.5">
                        {previewDates.map((d) => (
                          <span key={d} className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-100 text-indigo-900">
                            {formatDate(d)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Departmental Mode Fields */}
              {scheduleMode === "departmental" && (
                <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-900 font-semibold text-sm">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    <span>Departmental Meeting Alignment</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Target Department *</Label>
                      <select
                        value={form.department_id}
                        onChange={(e) => handleDepartmentChange(e.target.value)}
                        className="w-full mt-1 px-3 py-2 text-xs border border-emerald-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => selectDepartmentAttendeesOnly(form.department_id)}
                        className="w-full text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                      >
                        <UserCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                        Select Only {departments.find((d) => d.id === form.department_id)?.name || "Dept"} Staff ({employees.filter((e) => e.department_id === form.department_id && e.status === "active").length})
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Common Fields */}
              <div>
                <Label>Meeting Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Weekly Strategy & Task Alignment" required />
              </div>

              {/* Date & Time for Single / Departmental / Custom modes (or when editing) */}
              {(scheduleMode === "custom" || scheduleMode === "departmental" || editing) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Date *</Label>
                    <Input
                      type="date"
                      min={getTodayString()}
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>Time</Label>
                    <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                  </div>
                </div>
              )}

              <div>
                <Label>Venue / Location / Meeting Link</Label>
                <Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="e.g. Boardroom A or Google Meet / Zoom link" />
              </div>

              <div>
                <Label>Agenda</Label>
                <Textarea value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} rows={2} placeholder="Outline key topics to discuss..." />
              </div>

              {/* Attendee Picker: Schedule Meetings with Other Users */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5 font-semibold text-slate-800">
                    <UsersIcon className="w-4 h-4 text-amber-500" />
                    Invite Attendees ({form.attendee_ids.length} selected)
                  </Label>
                  <div className="flex items-center gap-2 text-xs">
                    <button type="button" onClick={selectAllAttendees} className="text-amber-600 hover:underline">Select All Active</button>
                    <span className="text-slate-300">•</span>
                    <button type="button" onClick={clearAllAttendees} className="text-slate-500 hover:underline">Clear</button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input
                    value={attendeeSearch}
                    onChange={(e) => setAttendeeSearch(e.target.value)}
                    placeholder="Search users/staff by name, department, role..."
                    className="pl-8 text-xs h-8"
                  />
                </div>

                <div className="border border-slate-200 rounded-lg p-2 max-h-48 overflow-y-auto space-y-1 bg-slate-50/50">
                  {filteredAttendees.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">No staff members match "{attendeeSearch}"</p>
                  ) : (
                    filteredAttendees.map((emp) => {
                      const isSelected = form.attendee_ids.includes(emp.id);
                      const isMe = employee?.id === emp.id;
                      const isDeptMember = form.department_id && emp.department_id === form.department_id;
                      return (
                        <label
                          key={emp.id}
                          className={cn(
                            "flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors border text-xs",
                            isSelected ? "bg-amber-50/80 border-amber-200 text-amber-950 font-medium" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleAttendee(emp.id)}
                              className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                            />
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 truncate flex items-center gap-1.5">
                                {emp.full_name} {isMe && <span className="text-[10px] text-amber-600 font-normal">(You)</span>}
                                {isDeptMember && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-normal">Dept</span>
                                )}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate">
                                {emp.position || emp.role} {emp.department_name ? `• ${emp.department_name}` : ""}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">{emp.email}</span>
                        </label>
                      );
                    })
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  {scheduleMode === "daily_morning" || scheduleMode === "weekly_update"
                    ? "Attendees will receive a consolidated summary invitation with the schedule details to prevent inbox clutter."
                    : "Invited attendees will receive an automatic system notification when this meeting is scheduled."}
                </p>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)} disabled={submittingMeeting}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-slate-800 hover:bg-slate-900" disabled={submittingMeeting}>
                  {submittingMeeting ? (
                    <span className="flex items-center gap-1.5">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Scheduling...
                    </span>
                  ) : editing ? (
                    "Update Meeting"
                  ) : scheduleMode === "daily_morning" ? (
                    `Schedule ${previewDates.length} Daily Morning Meetings`
                  ) : scheduleMode === "weekly_update" ? (
                    `Schedule ${previewDates.length} Weekly Update Meetings`
                  ) : (
                    "Schedule Meeting"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Meeting Detail / Minutes Dialog */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={() => setShowDetail(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-xl font-heading font-bold text-slate-900">{showDetail.title}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                  <span>{formatDate(showDetail.date)}</span>
                  {showDetail.time && <span>at {showDetail.time}</span>}
                  {showDetail.venue && <span>• {showDetail.venue}</span>}
                  <span>• Scheduled by <strong>{showDetail.created_by_name || "Staff"}</strong></span>
                </div>
              </div>
              <button onClick={() => setShowDetail(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>

            {showDetail.attendee_names?.length > 0 && (
              <div className="mb-4 p-3 rounded-lg bg-slate-50 border border-slate-100">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <UsersIcon className="w-3.5 h-3.5 text-amber-500" /> Attendees ({showDetail.attendee_names.length})
                </p>
                <p className="text-xs text-slate-700 leading-relaxed">{showDetail.attendee_names.join(", ")}</p>
              </div>
            )}

            {showDetail.agenda && (
              <div className="mb-4 p-3 rounded-lg bg-slate-50">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Agenda</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{showDetail.agenda}</p>
              </div>
            )}

            {showDetail.resolutions && (
              <div className="mb-4 p-3 rounded-lg bg-amber-50/50 border border-amber-100">
                <p className="text-xs font-semibold text-amber-700 uppercase mb-1">Resolutions</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{showDetail.resolutions}</p>
              </div>
            )}

            {/* Minutes section */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><FileText className="w-4 h-4" /> Meeting Minutes</h3>
                {minutes.find((m) => m.meeting_id === showDetail.id)?.file_url && (
                  <a href={minutes.find((m) => m.meeting_id === showDetail.id).file_url} target="_blank" rel="noreferrer"
                    className="text-xs font-medium text-amber-600 hover:text-amber-700 flex items-center gap-1">
                    <Download className="w-3 h-3" /> Download Attached Minutes
                  </a>
                )}
              </div>
              <div className="space-y-3 p-3 border border-slate-200 rounded-lg">
                <div>
                  <Label>Minutes Content</Label>
                  <Textarea value={minutesForm.content} onChange={(e) => setMinutesForm({ ...minutesForm, content: e.target.value })} rows={4} placeholder="Type or paste meeting minutes here..." />
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 hover:text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">
                    <Upload className="w-4 h-4" /> {minutesForm.file_name || "Upload file"}
                    <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                  </label>
                  {uploading && <span className="text-xs text-slate-400">Uploading...</span>}
                </div>
                <div className="flex items-center gap-3">
                  {(canAdminister || showDetail.created_by_id === performer.id) && (
                    <Select value={minutesForm.status} onValueChange={(v) => setMinutesForm({ ...minutesForm, status: v })}>
                      <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Draft">Draft</SelectItem>
                        <SelectItem value="Approved">Approved</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <Button onClick={() => handleSaveMinutes(showDetail)} className="bg-slate-800 hover:bg-slate-900 flex-1">
                    {minutesForm.status === "Approved" ? "Save & Approve Minutes" : "Save Minutes"}
                  </Button>
                </div>
                {minutes.find((m) => m.meeting_id === showDetail.id)?.audit_trail?.length > 0 && (
                  <div className="text-xs text-slate-400 space-y-0.5 pt-2 border-t border-slate-100">
                    <p className="font-semibold">Audit Trail:</p>
                    {minutes.find((m) => m.meeting_id === showDetail.id).audit_trail.map((entry, i) => (
                      <p key={i}>{entry.action} by {entry.by_name} — {formatDateTime(entry.timestamp)}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Action Items */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-2"><ListChecks className="w-4 h-4" /> Action Items</h3>
              <div className="space-y-2 mb-3">
                {actionItems.filter((ai) => ai.meeting_id === showDetail.id).map((ai) => {
                  const isAssignedToMe = ai.assigned_to_id === performer.id || ai.assigned_to_id === employee?.id;
                  const canComplete = canAdminister || showDetail.created_by_id === performer.id || isAssignedToMe;
                  return (
                    <div key={ai.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-100 bg-slate-50/50">
                      <StatusBadge status={ai.status} />
                      <p className="text-sm text-slate-700 flex-1 min-w-0 truncate">{ai.description}</p>
                      <span className="text-xs text-slate-500 font-medium shrink-0">Assigned: {ai.assigned_to_name}</span>
                      {canComplete && ai.status !== "Completed" && (
                        <button onClick={() => updateActionItem(ai, "Completed")} className="text-xs text-emerald-600 hover:underline font-semibold ml-1">Complete</button>
                      )}
                    </div>
                  );
                })}
                {actionItems.filter((ai) => ai.meeting_id === showDetail.id).length === 0 && (
                  <p className="text-sm text-slate-400 italic">No action items recorded for this meeting.</p>
                )}
              </div>

              {/* Add Action Item - Available to organizer, admin, or attendees */}
              <div className="flex flex-wrap gap-2 items-end p-3 border border-slate-200 rounded-lg bg-slate-50/30">
                <div className="flex-1 min-w-[150px]">
                  <Label className="text-xs mb-1">New Action Item</Label>
                  <Input value={newActionItem.description} onChange={(e) => setNewActionItem({ ...newActionItem, description: e.target.value })} placeholder="Task / action item description..." />
                </div>
                <div>
                  <Label className="text-xs mb-1">Assign Colleague</Label>
                  <Select value={newActionItem.assigned_to_id} onValueChange={(v) => setNewActionItem({ ...newActionItem, assigned_to_id: v })}>
                    <SelectTrigger className="w-[170px]"><SelectValue placeholder="Select user" /></SelectTrigger>
                    <SelectContent>{activeEmployees.map((emp) => <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1">Due Date</Label>
                  <Input
                    type="date"
                    min={getTodayString()}
                    value={newActionItem.due_date}
                    onChange={(e) => setNewActionItem({ ...newActionItem, due_date: e.target.value })}
                    className="w-[140px]"
                  />
                </div>
                <Button onClick={() => addActionItem(showDetail)} size="sm" className="bg-slate-800 hover:bg-slate-900">Add Item</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}