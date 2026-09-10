import uuid
from datetime import date, datetime

from .extensions import db


def gen_uuid():
    return str(uuid.uuid4())


class BaseModel(db.Model):
    __abstract__ = True

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    created_date = db.Column(db.DateTime, default=datetime.utcnow)
    updated_date = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        result = {}
        for column in self.__table__.columns:
            value = getattr(self, column.name)
            if isinstance(value, date):  # datetime is a subclass of date - covers both
                value = value.isoformat()
            result[column.name] = value
        return result


class User(BaseModel):
    __tablename__ = "users"

    email = db.Column(db.String(255), unique=True, nullable=False)
    # The email they actually signed up with, kept for notification purposes
    # only (e.g. "your account is approved") - `email` above is replaced with
    # their company address at approval and becomes the only valid login.
    personal_email = db.Column(db.String(255))
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(255))
    role = db.Column(db.String(20), nullable=False, default="user")  # "admin" | "user"
    status = db.Column(db.String(20), nullable=False, default="active", server_default="active")  # "pending" | "active"
    # Self-declared at registration - shown to the admin as a hint during
    # approval, which still creates the authoritative Employee record.
    phone = db.Column(db.String(50))
    requested_department = db.Column(db.String(255))
    requested_position = db.Column(db.String(255))
    reset_token = db.Column(db.String(255))
    reset_token_expires = db.Column(db.DateTime)

    def to_public_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "personal_email": self.personal_email,
            "full_name": self.full_name,
            "role": self.role,
            "status": self.status,
            "phone": self.phone,
            "requested_department": self.requested_department,
            "requested_position": self.requested_position,
            "created_date": self.created_date.isoformat() if self.created_date else None,
        }


class Employee(BaseModel):
    __tablename__ = "employees"

    full_name = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255), nullable=False)
    personal_email = db.Column(db.String(255))
    phone = db.Column(db.String(50))
    user_id = db.Column(db.String(36))
    department_id = db.Column(db.String(36))
    department_name = db.Column(db.String(255))
    position = db.Column(db.String(255))
    role = db.Column(db.String(50), nullable=False, default="Staff Member")
    manager_id = db.Column(db.String(36))
    status = db.Column(db.String(20), default="active")
    hire_date = db.Column(db.Date)
    date_of_birth = db.Column(db.Date)
    address = db.Column(db.String(500))
    avatar_url = db.Column(db.String(500))
    employee_id_code = db.Column(db.String(50))
    invited = db.Column(db.Boolean, default=False)
    invited_date = db.Column(db.DateTime)


class Department(BaseModel):
    __tablename__ = "departments"

    name = db.Column(db.String(255), nullable=False)
    code = db.Column(db.String(50))
    description = db.Column(db.Text)
    email = db.Column(db.String(255))
    manager_id = db.Column(db.String(36))
    manager_name = db.Column(db.String(255))
    status = db.Column(db.String(20), default="active")
    color = db.Column(db.String(20), default="#1e3a5f")


class Task(BaseModel):
    __tablename__ = "tasks"

    title = db.Column(db.String(500), nullable=False)
    description = db.Column(db.Text)
    attachment_file_url = db.Column(db.String(500))
    attachment_file_name = db.Column(db.String(255))
    assigned_to_ids = db.Column(db.JSON, default=list)
    assigned_to_names = db.Column(db.JSON, default=list)
    assigned_by_id = db.Column(db.String(36))
    assigned_by_name = db.Column(db.String(255))
    department_id = db.Column(db.String(36))
    status = db.Column(db.String(20), default="Pending")
    deadline = db.Column(db.DateTime)
    expected_completion_date = db.Column(db.Date)
    completed_date = db.Column(db.Date)
    completed_on_time = db.Column(db.Boolean)
    archived = db.Column(db.Boolean, default=False)
    deleted = db.Column(db.Boolean, default=False, server_default="0")
    deleted_date = db.Column(db.DateTime)
    progress_pct = db.Column(db.Integer, default=0)
    tags = db.Column(db.JSON, default=list)
    seen_by_ids = db.Column(db.JSON, default=list)
    last_seen_date = db.Column(db.DateTime)
    doer_started = db.Column(db.Boolean, default=False)
    doer_started_date = db.Column(db.DateTime)
    doer_started_by_id = db.Column(db.String(36))
    doer_started_by_name = db.Column(db.String(255))
    completion_report_heading = db.Column(db.String(500))
    completion_report = db.Column(db.Text)
    completion_report_file_url = db.Column(db.String(500))
    completion_report_file_name = db.Column(db.String(255))
    completion_report_date = db.Column(db.DateTime)
    submitted_date = db.Column(db.DateTime)
    submitted_by_id = db.Column(db.String(36))
    submitted_by_name = db.Column(db.String(255))
    approved_by_id = db.Column(db.String(36))
    approved_by_name = db.Column(db.String(255))
    approved_date = db.Column(db.DateTime)
    rejection_reason = db.Column(db.Text)
    created_by_id = db.Column(db.String(36))


class Meeting(BaseModel):
    __tablename__ = "meetings"

    title = db.Column(db.String(500), nullable=False)
    date = db.Column(db.Date, nullable=False)
    time = db.Column(db.String(50))
    venue = db.Column(db.String(255))
    agenda = db.Column(db.Text)
    resolutions = db.Column(db.Text)
    attendee_ids = db.Column(db.JSON, default=list)
    attendee_names = db.Column(db.JSON, default=list)
    status = db.Column(db.String(20), default="Scheduled")
    created_by_id = db.Column(db.String(36))
    created_by_name = db.Column(db.String(255))
    department_id = db.Column(db.String(36))
    meeting_type = db.Column(db.String(50), default="custom")


class MeetingMinutes(BaseModel):
    __tablename__ = "meeting_minutes"

    meeting_id = db.Column(db.String(36), nullable=False)
    meeting_title = db.Column(db.String(500))
    content = db.Column(db.Text)
    file_url = db.Column(db.String(500))
    file_name = db.Column(db.String(255))
    status = db.Column(db.String(20), nullable=False, default="Draft")
    uploaded_by_id = db.Column(db.String(36))
    uploaded_by_name = db.Column(db.String(255))
    uploaded_date = db.Column(db.DateTime)
    last_edited_by_id = db.Column(db.String(36))
    last_edited_by_name = db.Column(db.String(255))
    last_edited_date = db.Column(db.DateTime)
    approved_by_id = db.Column(db.String(36))
    approved_by_name = db.Column(db.String(255))
    approved_date = db.Column(db.DateTime)
    version = db.Column(db.Integer, default=1)
    audit_trail = db.Column(db.JSON, default=list)
    created_by_id = db.Column(db.String(36))


class ActionItem(BaseModel):
    __tablename__ = "action_items"

    meeting_id = db.Column(db.String(36), nullable=False)
    meeting_title = db.Column(db.String(500))
    description = db.Column(db.Text, nullable=False)
    assigned_to_id = db.Column(db.String(36))
    assigned_to_name = db.Column(db.String(255))
    status = db.Column(db.String(20), default="Pending")
    due_date = db.Column(db.Date)
    completed_date = db.Column(db.Date)
    created_by_id = db.Column(db.String(36))


class Announcement(BaseModel):
    __tablename__ = "announcements"

    title = db.Column(db.String(500), nullable=False)
    content = db.Column(db.Text, nullable=False)
    file_url = db.Column(db.String(500))
    file_name = db.Column(db.String(255))
    category = db.Column(db.String(50), default="General")
    created_by_id = db.Column(db.String(36))
    created_by_name = db.Column(db.String(255))
    active = db.Column(db.Boolean, default=True)
    pinned = db.Column(db.Boolean, default=False)


class Report(BaseModel):
    __tablename__ = "reports"

    heading = db.Column(db.String(500), nullable=False)
    description = db.Column(db.Text, nullable=False)
    submitted_by_id = db.Column(db.String(36))
    submitted_by_name = db.Column(db.String(255))
    submitted_date = db.Column(db.DateTime)
    department_id = db.Column(db.String(36))
    department_name = db.Column(db.String(255))
    category = db.Column(db.String(100), default="General")
    file_url = db.Column(db.String(500))
    file_name = db.Column(db.String(255))
    created_by_id = db.Column(db.String(36))
    submitted_to_ids = db.Column(db.JSON, default=list)
    submitted_to_names = db.Column(db.JSON, default=list)
    is_confidential = db.Column(db.Boolean, default=False)


class Notification(BaseModel):
    __tablename__ = "notifications"

    user_id = db.Column(db.String(36), nullable=False)
    employee_id = db.Column(db.String(36))
    title = db.Column(db.String(500), nullable=False)
    message = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(50), nullable=False, default="task_assigned")
    read = db.Column(db.Boolean, default=False)
    related_id = db.Column(db.String(36))
    link = db.Column(db.String(500))


class AuditLog(BaseModel):
    __tablename__ = "audit_logs"

    action = db.Column(db.String(255), nullable=False)
    entity_type = db.Column(db.String(100), nullable=False)
    entity_id = db.Column(db.String(36))
    entity_name = db.Column(db.String(255))
    performed_by_id = db.Column(db.String(36), nullable=False)
    performed_by_name = db.Column(db.String(255), nullable=False)
    details = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)


class PerformanceReport(BaseModel):
    __tablename__ = "performance_reports"

    employee_id = db.Column(db.String(36), nullable=False)
    employee_name = db.Column(db.String(255), nullable=False)
    department_name = db.Column(db.String(255))
    period_type = db.Column(db.String(20), nullable=False, default="Monthly")
    period_label = db.Column(db.String(100))
    tasks_assigned = db.Column(db.Integer, default=0)
    tasks_completed = db.Column(db.Integer, default=0)
    tasks_on_time = db.Column(db.Integer, default=0)
    tasks_late = db.Column(db.Integer, default=0)
    pending_tasks = db.Column(db.Integer, default=0)
    overdue_tasks = db.Column(db.Integer, default=0)
    productivity_pct = db.Column(db.Float, default=0)
    avg_completion_days = db.Column(db.Float, default=0)
    score = db.Column(db.Float, default=0)
    classification = db.Column(db.String(50), default="Needs Improvement")
    trend = db.Column(db.String(20), default="Stable")
    generated_date = db.Column(db.DateTime)


class CompanyBranding(BaseModel):
    __tablename__ = "company_brandings"

    company_name = db.Column(db.String(255), nullable=False, default="EPIC TASK PERFORMANCE TRACKING SYSTEM")
    tagline = db.Column(db.String(255), default="Task & Performance Management")
    logo_url = db.Column(db.String(500))
    address = db.Column(db.String(500))
    phone = db.Column(db.String(50))
    email = db.Column(db.String(255))
    website = db.Column(db.String(255))
    updated_by_id = db.Column(db.String(36))
    updated_by_name = db.Column(db.String(255))
