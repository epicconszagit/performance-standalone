import os
import shutil
from werkzeug.security import generate_password_hash
from app import create_app
from app.extensions import db
from app.models import (
    User, Employee, Department, Task, Meeting,
    MeetingMinutes, Announcement, ActionItem, Report,
    Notification, AuditLog, PerformanceReport, CompanyBranding
)

def reset_database():
    app = create_app()
    with app.app_context():
        print("=" * 60)
        print("RESETTING DATABASE FOR DEPLOYMENT (PRESERVING ADMIN ACCOUNT)")
        print("=" * 60)

        # 1. Identify existing admin account to preserve
        admin_email = "epiccons.za@gmail.com"
        admin_user = User.query.filter_by(email=admin_email).first() or User.query.filter_by(role="admin").first()

        if admin_user:
            print(f"1. Preserving existing Admin User: {admin_user.email} (ID: {admin_user.id})")
            admin_id = admin_user.id
            admin_email = admin_user.email
            # Ensure admin is active
            admin_user.status = "active"
            admin_user.role = "admin"
        else:
            print(f"1. No existing admin found. Creating Super Administrator account: {admin_email}...")
            admin_password = "OURLIVINGGOD848611"
            admin_user = User(
                email=admin_email,
                personal_email=admin_email,
                password_hash=generate_password_hash(admin_password),
                full_name="Super Administrator",
                role="admin",
                status="active",
            )
            db.session.add(admin_user)
            db.session.flush()
            admin_id = admin_user.id

        # 2. Preserve or create matching Admin Employee record
        admin_employee = Employee.query.filter(
            (Employee.user_id == admin_id) | (Employee.email == admin_email)
        ).first()

        if admin_employee:
            print(f"2. Preserving existing Admin Employee profile: {admin_employee.full_name} (ID: {admin_employee.id})")
            admin_employee.user_id = admin_id
            admin_employee.role = "Super Administrator"
            admin_employee.status = "active"
            admin_emp_id = admin_employee.id
        else:
            print("2. Creating Admin Employee profile...")
            admin_employee = Employee(
                full_name="Super Administrator",
                email=admin_email,
                user_id=admin_id,
                role="Super Administrator",
                position="Executive Administrator",
                status="active",
            )
            db.session.add(admin_employee)
            db.session.flush()
            admin_emp_id = admin_employee.id

        # 3. Clear non-admin users and employees
        print("3. Removing non-admin users and employees...")
        deleted_users = User.query.filter(User.id != admin_id).delete()
        deleted_emps = Employee.query.filter(Employee.id != admin_emp_id).delete()
        print(f"   Removed {deleted_users} non-admin user(s) and {deleted_emps} non-admin employee(s).")

        # 4. Clear all transactional data
        print("4. Clearing all transactional data...")
        del_actions = db.session.query(ActionItem).delete()
        del_notifs = db.session.query(Notification).delete()
        del_audits = db.session.query(AuditLog).delete()
        del_reports = db.session.query(Report).delete()
        del_perf = db.session.query(PerformanceReport).delete()
        del_minutes = db.session.query(MeetingMinutes).delete()
        del_meetings = db.session.query(Meeting).delete()
        del_announcements = db.session.query(Announcement).delete()
        del_tasks = db.session.query(Task).delete()
        print(f"   Deleted: {del_tasks} tasks, {del_meetings} meetings, {del_actions} action items, {del_reports} reports, {del_notifs} notifications, {del_audits} audit logs.")

        # 5. Ensure core departments exist
        print("5. Checking core departments...")
        default_departments = [
            {
                "name": "Information Technology Department",
                "code": "IT",
                "description": "Information technology, systems infrastructure, technical operations and software management.",
                "email": "it@epicnetworkgroup.com",
                "color": "#2563eb",
            },
            {
                "name": "Research & Statistics",
                "code": "RS",
                "description": "Research, strategic data analytics, intelligence gathering and statistical evaluations.",
                "email": "research@epicnetworkgroup.com",
                "color": "#7c3aed",
            },
            {
                "name": "Human Resources",
                "code": "HR",
                "description": "Staff talent management, organizational recruitment, onboarding and personnel relations.",
                "email": "hr@epicnetworkgroup.com",
                "color": "#059669",
            },
            {
                "name": "Finance & Fiscal",
                "code": "FF",
                "description": "Financial management, accounting, budgeting, audit compliance and fiscal governance.",
                "email": "finance@epicnetworkgroup.com",
                "color": "#d97706",
            },
            {
                "name": "Real Estate & Developement",
                "code": "RED",
                "description": "Real estate property portfolio, development projects, and facilities management.",
                "email": "realestate@epicnetworkgroup.com",
                "color": "#dc2626",
            },
        ]

        for dept_data in default_departments:
            existing_dept = Department.query.filter_by(name=dept_data["name"]).first()
            if not existing_dept:
                dept = Department(
                    name=dept_data["name"],
                    code=dept_data["code"],
                    description=dept_data["description"],
                    email=dept_data["email"],
                    color=dept_data["color"],
                    status="active",
                )
                db.session.add(dept)

        # 6. Ensure Company Branding exists
        branding = CompanyBranding.query.first()
        if not branding:
            branding = CompanyBranding(
                company_name="EPIC TASK PERFORMANCE TRACKING SYSTEM",
                tagline="Task & Performance Management",
                email=admin_email,
            )
            db.session.add(branding)

        # Commit all changes
        db.session.commit()

        # 7. Clear local uploads folder
        print("6. Clearing local test uploads directory...")
        upload_dir = app.config.get("UPLOAD_FOLDER")
        if upload_dir and os.path.isdir(upload_dir):
            cleared_files = 0
            for fname in os.listdir(upload_dir):
                fpath = os.path.join(upload_dir, fname)
                try:
                    if os.path.isfile(fpath):
                        os.remove(fpath)
                        cleared_files += 1
                except Exception as e:
                    print(f"   Could not remove {fname}: {e}")
            print(f"   Cleared {cleared_files} file(s) from uploads folder.")

        # 8. Vacuum database if SQLite to reclaim space
        try:
            db.session.execute(db.text("VACUUM"))
            db.session.commit()
            print("7. SQLite database vacuumed successfully.")
        except Exception:
            pass

        print("\n" + "=" * 60)
        print("DATABASE CLEANUP COMPLETE - READY FOR DEPLOYMENT!")
        print("=" * 60)
        print(f"Preserved Admin Account: {admin_user.email} (Active Super Administrator)")
        print("All test users, test employees, tasks, meetings, and notifications cleared.")
        print("Core departmental structure and system branding preserved.")
        print("=" * 60 + "\n")


if __name__ == "__main__":
    reset_database()
