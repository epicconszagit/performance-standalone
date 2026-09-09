# EPIC TASK PERFORMANCE TRACKING SYSTEM

A self-hosted, full-stack Performance and Task Management platform: React frontend, backed by a Flask + PostgreSQL/MySQL/SQLite API.

## Structure

```
backend/     Flask API (auth, entity CRUD, file uploads)
frontend/    React/Vite app (copied from the original, Base44 SDK swapped out)
run_all.py   Run this: `python run_all.py` starts everything in one terminal
start.bat    Alternative: double-click this to start everything in separate windows
```

## Running the system (one command)

```bash
python run_all.py
```

Run that from the `Performance-Standalone` folder. It will:

1. Set up the backend virtual environment and install Python dependencies (first run only)
2. Create the database (first run only)
3. Install frontend dependencies (first run only)
4. Launch the backend and frontend (their logs print right there in the same terminal)
5. Open the app in your browser at `http://localhost:5173`

Press **Ctrl+C** in that terminal to stop everything.

(`start.bat` does the same thing but opens the backend and frontend in two separate console windows instead — use whichever you find easier to work with.)

## Manual backend setup

(Only needed if you want to run pieces individually instead of using `start.bat`.)

```bash
cd backend
python -m venv venv
venv\Scripts\pip install -r requirements.txt
copy .env.example .env        # edit DATABASE_URL etc. if needed
venv\Scripts\python -m flask db upgrade   # creates tables (SQLite by default)
venv\Scripts\python run.py                # runs on http://localhost:5000
```

Leave `DATABASE_URL` unset in `.env` to use a local SQLite file (`backend/app.db`) — good enough for testing. Point it at Clever Cloud (or any) MySQL when ready:

```
DATABASE_URL=mysql+pymysql://<user>:<password>@<host>:<port>/<database>
```

After changing `DATABASE_URL`, re-run `flask db upgrade` to create the tables on the new database.

## Deploying to production

The backend can serve the built frontend itself — build with `npm run build` inside `frontend/` first, and Flask serves `frontend/dist/` (API and uploads still work normally alongside it) whenever that folder exists, with no code changes needed. This means production is one deployable service, not two, and avoids CORS entirely (same origin).

- `backend/Procfile` and `gunicorn` (in `requirements.txt`) are already set up for a real WSGI server — never use `python run.py`'s dev server in production.
- Keep production to **one worker** (`gunicorn run:app --workers 1 --threads 4`, already in the Procfile) — the birthday-reminder scheduler (`backend/app/scheduler.py`) runs inside the app process itself, and multiple workers would each run it independently.
- Leave `FLASK_DEBUG` unset in production — it must only be set by `run.py`'s own dev path. This is also what makes the scheduler start correctly under gunicorn instead of assuming Werkzeug's dev reloader is present.
- `backend/uploads/` is local disk — most hosts wipe it on redeploy, so it needs a persistent volume (or, longer-term, migrating `backend/app/api/uploads.py` to S3-compatible storage) or every uploaded file disappears on the next deploy.

## Manual frontend setup

```bash
cd frontend
npm install
npm run dev        # runs on http://localhost:5173, proxies /api to the Flask backend on :5000
```

## Account onboarding

- **The very first person to register** on a fresh install automatically becomes an active admin — there's nobody else to approve them yet.
- **Everyone who registers after that** starts in a "pending" state. They can log in but only see a "waiting for approval" screen until an admin approves them.
- **Approving** a pending user (from the Staff page's "Pending Approvals" section) opens a small form — the admin fills in their department/role/position, which creates their Staff record and activates their account in one step. Admins can also **Reject** a pending request outright, which deletes it.
- **Company emails**: whatever email someone registered with (personal, random) is replaced at approval time with a standard `@epicnetworkgroup.com` address (first-initial + last name, e.g. Jane Doe → `jdoe@epicnetworkgroup.com`), which becomes their login going forward. Departments and manually-added staff (via "Add Staff") get the same auto-generated addresses if you leave the email field blank — department emails are `departmentname@epicnetworkgroup.com`. The domain/format lives in `backend/app/utils/company.py` (backend) and `frontend/src/lib/company.js` (frontend) if you need to change it later.
- **Note**: existing departments/employees created before this change keep whatever email they already had — nothing was retroactively regenerated.
- **Registration validation**: any correctly-formatted email is accepted (personal providers like Gmail/Yahoo are fine — the point of collecting it is just somewhere to send the new company credentials to after approval), passwords need 8+ characters, and the form also collects full name, phone, requested department, and requested position — all shown to the admin as hints during approval.
- **Approval notifications**: when an admin approves someone, they're notified of their new company login email at the personal email they originally signed up with, and via SMS to their phone number if one was provided.
  - **Email** (`backend/app/utils/email.py`): sends real email via SMTP (Gmail by default) if `SMTP_USERNAME`/`SMTP_PASSWORD` are set in `.env`, otherwise falls back to logging. For Gmail, `SMTP_PASSWORD` must be an [App Password](https://myaccount.google.com/apppasswords) (requires 2-Step Verification enabled on that Google account first), not the real account password.
  - **SMS** (`backend/app/utils/sms.py`): sends real SMS through Twilio if `TWILIO_ACCOUNT_SID` + either `TWILIO_AUTH_TOKEN` or `TWILIO_API_KEY_SID`/`TWILIO_API_KEY_SECRET`, plus `TWILIO_FROM_NUMBER`, are set in `.env`; otherwise falls back to logging. Phone numbers need a country code (e.g. `+263...`) — Twilio requires E.164 format, and numbers without a `+` are skipped with a clear log warning instead of failing. Note: a Twilio **trial** account can only text numbers you've verified in the Twilio console (Phone Numbers → Manage → Verified Caller IDs) — upgrade the account to remove that restriction.
- **"Add Staff" also creates a login now**: entering a staff member directly (not via self-registration) creates their account immediately with a random temporary password, and sends it the same way — email + SMS if both are on file, whichever succeeds otherwise. The Staff page shows exactly which channels the credentials went out on ("Credentials sent to X and Y"), or flags it clearly if neither could be reached so you can share the login manually. This endpoint is `POST /api/employees/onboard` (`backend/app/api/employees_onboard.py`).
- **`.env` changes require a full restart**, not just leaving the dev server running — Flask/dotenv only reads `.env` once at process startup, and the debug auto-reloader (which restarts on `.py` file changes) does not watch `.env`. If you edit `.env`, stop the process (Ctrl+C, not just closing the window) and start it again.

## Staff profiles & birthdays

- **My Profile**: clicking your avatar (sidebar or topbar) opens `/profile`, showing your employment details (email, position, department, role — read-only, admin-managed) and letting you edit personal details: date of birth, phone, address, and a profile photo. Backed by `GET`/`PATCH /api/employees/me` (`backend/app/api/employees_profile.py`), which only allows editing `phone`, `date_of_birth`, `address`, `avatar_url` on your own record — never role/department/status, so self-service can't be used to escalate privileges.
- **Upcoming Birthdays widget**: the dashboard shows everyone's birthday in the next 30 days (today highlighted), for all roles — pure display, computed client-side from each employee's `date_of_birth` (`frontend/src/lib/birthdayReminders.js`).
- **Birthday notifications run server-side on a schedule**, not triggered by anyone loading a page: `backend/app/jobs/birthdays.py` runs daily at 7:00 AM server time (`backend/app/scheduler.py`, via APScheduler) and creates an in-app notification for Super Administrators/Administrators/Directors of Operations/Department Managers whenever it's someone's birthday, deduped so each person only triggers one notification per calendar year. An admin can also trigger it on demand — e.g. to recover a day the server was down — via `POST /api/admin/run-birthday-check`.
  - **Caveat**: the scheduler runs inside the Flask process itself (no separate worker), guarded so Werkzeug's debug reloader doesn't schedule it twice. If this is ever deployed behind a non-reloader production server (e.g. multiple gunicorn workers), the guard in `scheduler.py` would need revisiting — see the comment there.

## What changed from the Base44 version

- **Auth**: email/password + JWT only. No Google OAuth, no email-OTP verification step.
- **Onboarding**: self-register + admin-approval (see above), instead of Base44's admin-sends-an-invite-email flow.
- **Notifications**: ~20s polling instead of a live push channel.
- **Email**: real SMTP if `SMTP_USERNAME`/`SMTP_PASSWORD` are set in `.env` (see Approval notifications above), otherwise stubbed/logged.
- **File uploads**: stored locally under `backend/uploads/`, served at `/uploads/<file>` — allows almost any file type (documents, images, video, audio, archives) up to 250MB, blocking only executables and anything a browser would run as active content (`.html`/`.svg`/`.js`/etc). Always served with `Content-Disposition: attachment`, which is the main defense against an uploaded file executing as script in the app's origin — the extension block is defense in depth on top of that, not the primary protection. Both **tasks** (attached by whoever creates/assigns them) and **task completion reports** (attached by whoever submits them) support one attachment each via this same upload endpoint.
- **Authorization**: previously enforced by Base44's declarative row-level security; now enforced server-side in `backend/app/api/generic.py` per entity (mirrors the original rules — see that file's registrations in `backend/app/api/__init__.py`).

## Known follow-up item

A few entities (Task, Meeting, Report, ActionItem, MeetingMinutes) gate "edit/delete your own" on `created_by_id`, which the backend auto-fills with the *authenticated account's* id on create. Some frontend pages instead display an owner-based edit/delete button using `performer.id` (which can be the *Employee* record's id, a different id, when a user is linked to one). In practice this only affects self-service delete on your own non-admin-created records — admins are unaffected. Worth reconciling if you hit an unexpected 403 on a "delete my own X" action as a non-admin.

## Data migration

Existing data from the Base44-hosted database has **not** been migrated yet — this is a fresh system. Migrating the old data is a separate follow-up step.
