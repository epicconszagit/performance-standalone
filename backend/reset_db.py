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
        print("1. Clearing all existing database tables...")
        # Clear in proper order or delete all
        db.session.query(ActionItem).delete()
        db.session.query(Notification).delete()
        db.session.query(AuditLog).delete()
        db.session.query(Report).delete()
        db.session.query(PerformanceReport).delete()
        db.session.query(MeetingMinutes).delete()
        db.session.query(Meeting).delete()
        db.session.query(Announcement).delete()
        db.session.query(Task).delete()
        db.session.query(Employee).delete()
        db.session.query(Department).delete()
        db.session.query(CompanyBranding).delete()
        db.session.query(User).delete()
        db.session.commit()
        print("   All records deleted.")

        print("2. Clearing local test uploads...")
        upload_dir = app.config.get("UPLOAD_FOLDER")
        if upload_dir and os.path.isdir(upload_dir):
            for fname in os.listdir(upload_dir):
                fpath = os.path.join(upload_dir, fname)
                try:
                    if os.path.isfile(fpath):
                        os.remove(fpath)
                except Exception as e:
                    print(f"   Could not remove {fname}: {e}")
            print("   Uploads directory cleared.")

        print("3. Seeding Super Administrator account...")
        admin_email = "epiccons.za@gmail.com"
        admin_password = "OURLIVINGGOD848611"

        # Create Admin User
        admin_user = User(
            email=admin_email,
            personal_email=admin_email,
            password_hash=generate_password_hash(admin_password),
            full_name="Super Administrator",
            role="admin",
            status="active",
        )
        db.session.add(admin_user)
        db.session.flush() # obtain admin_user.id

        # Create matching Employee record for proper profile & dashboard access
        admin_employee = Employee(
            full_name="Super Administrator",
            email=admin_email,
            user_id=admin_user.id,
            role="Super Administrator",
            position="Executive Administrator",
            status="active",
        )
        db.session.add(admin_employee)

        # Create default Company Branding
        branding = CompanyBranding(
            company_name="EPIC TASK PERFORMANCE TRACKING SYSTEM",
            tagline="Task & Performance Management",
            email=admin_email,
        )
        db.session.add(branding)

        print("4. Seeding default departments...")
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
            dept = Department(
                name=dept_data["name"],
                code=dept_data["code"],
                description=dept_data["description"],
                email=dept_data["email"],
                color=dept_data["color"],
                status="active",
            )
            db.session.add(dept)

        db.session.commit()

        print("\n" + "="*60)
        print("DATABASE SUCCESSFULLY RESET TO SCRATCH!")
        print("="*60)
        print(f"Admin Email:    {admin_email}")
        print(f"Admin Password: {admin_password}")
        print("Role:           Super Administrator (active)")
        print("System Name:    EPIC TASK PERFORMANCE TRACKING SYSTEM")
        print("="*60 + "\n")

if __name__ == "__main__":
    reset_database()
