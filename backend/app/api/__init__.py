from flask import Blueprint

from .generic import register_entity
from ..models import (
    ActionItem,
    Announcement,
    AuditLog,
    CompanyBranding,
    Department,
    Employee,
    Meeting,
    MeetingMinutes,
    Notification,
    PerformanceReport,
    Report,
    Task,
)


def build_entities_blueprint():
    bp = Blueprint("entities", __name__)

    register_entity(bp, ActionItem, "action-items", create="any", update="owner_or_admin", delete="owner_or_admin")
    register_entity(bp, Announcement, "announcements", create="admin", update="admin", delete="admin")
    register_entity(bp, AuditLog, "audit-logs", create="any", update="admin", delete="admin")
    register_entity(bp, CompanyBranding, "company-brandings", create="admin", update="admin", delete="admin")
    register_entity(bp, Department, "departments", create="admin", update="admin", delete="admin")
    register_entity(bp, Employee, "employees", create="admin", update="admin", delete="admin")
    register_entity(bp, Meeting, "meetings", create="any", update="owner_or_admin", delete="owner_or_admin")
    register_entity(
        bp, MeetingMinutes, "meeting-minutes", create="any", update="owner_or_admin", delete="owner_or_admin"
    )
    register_entity(
        bp,
        Notification,
        "notifications",
        create="any",
        update="owner_or_admin",
        delete="owner_or_admin",
        owner_field="user_id",
    )
    register_entity(bp, PerformanceReport, "performance-reports", create="admin", update="admin", delete="admin")
    register_entity(bp, Report, "reports", create="any", update="owner_or_admin", delete="owner_or_admin")
    register_entity(bp, Task, "tasks", create="any", update="any", delete="owner_or_admin")

    return bp
