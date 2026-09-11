# Resend & GoDaddy DNS Setup Guide
**Domain**: `epicnetworkgroup.co`  
**System**: EPIC Task Performance Tracking System

This guide outlines the complete step-by-step process for connecting Resend to GoDaddy DNS to enable production email sending for employee invitations and login credentials.

---

## Step 1: Add Domain in Resend

1. Go to [Resend Dashboard](https://resend.com) and log in.
2. Click **Domains** on the left navigation bar (or visit [resend.com/domains](https://resend.com/domains)).
3. Click the **Add Domain** button in the top right.
4. Enter the domain:
   ```text
   epicnetworkgroup.co
   ```
5. Select your region (e.g., `US East (N. Virginia)`).
6. Click **Add Domain**.
7. Keep this page open — Resend will display the DNS records you need to add to GoDaddy.

---

## Step 2: Add DNS Records in GoDaddy

1. In a new browser tab, log in to [GoDaddy](https://godaddy.com).
2. Go to **My Products** $\rightarrow$ scroll down to **Domains** $\rightarrow$ click on `epicnetworkgroup.co`.
3. Click the **DNS** tab (or **Manage DNS**).
4. For each record displayed on your Resend screen, click **Add New Record** in GoDaddy:

### Important GoDaddy Hostname Rule
> **WARNING:** GoDaddy automatically appends your domain name (`.epicnetworkgroup.co`) to whatever you enter in the "Name" field.  
> - If Resend says Name: `resend._domainkey.epicnetworkgroup.co`, enter **ONLY** `resend._domainkey` in GoDaddy.
> - If Resend says Name: `send.epicnetworkgroup.co`, enter **ONLY** `send` in GoDaddy.
> - If Resend says Name: `epicnetworkgroup.co` or `@`, enter `@` in GoDaddy.

### Common Records Required by Resend

| Type | Name / Host in GoDaddy | Value / Target / Data | TTL |
| :--- | :--- | :--- | :--- |
| **TXT** (DKIM) | `resend._domainkey` | Value starting with `k=rsa; p=...` (from Resend) | `1/2 Hour` |
| **TXT** (SPF) | `send` *(or as displayed by Resend)* | `v=spf1 include:amazonses.com ~all` *(from Resend)* | `1/2 Hour` |
| **MX** *(if required)* | `send` *(or as displayed by Resend)* | `feedback-smtp.us-east-1.amazonses.com` (Priority: 10) | `1/2 Hour` |
| **TXT** (DMARC - optional) | `_dmarc` | `v=DMARC1; p=none;` | `1/2 Hour` |

5. Click **Save** for each record.

---

## Step 3: Verify Domain in Resend

1. Go back to your Resend tab.
2. Click **Verify DNS Records** (or check back after a few minutes).
3. DNS records usually take 2 to 15 minutes to propagate (up to a few hours depending on GoDaddy).
4. Once verified, the status badge will turn green: **Verified**.

---

## Step 4: Create Resend API Key

1. In your Resend dashboard, click **API Keys** on the left menu.
2. Click **Create API Key**.
3. Fill in:
   - **Name**: `Performance System Production`
   - **Permission**: `Full access` (or `Sending access`)
   - **Domain**: `epicnetworkgroup.co` (or All Domains)
4. Click **Add**.
5. **Copy the API Key immediately** (it begins with `re_...`). It will only be shown once.

---

## Step 5: Configure Application Environment

### Local Development (`backend/.env`)
The system supports dual Resend channels:
```env
# General System (Tasks, Meetings, Announcements, Performance, Reminders)
RESEND_API_KEY=your_general_resend_api_key_here
RESEND_FROM=EPIC Performance <notifications@epicnetworkgroup.co>

# Dedicated Onboarding Channel (Welcome, Account Creation & Approval)
RESEND_ONBOARDING_API_KEY=your_onboarding_resend_api_key_here
RESEND_ONBOARDING_FROM=EPIC Onboarding <onboarding@epicnetworkgroup.co>
```

*(Note: If `RESEND_API_KEY` is present, `backend/app/utils/email.py` uses Resend HTTPS port 443 automatically. If omitted or empty, it falls back to standard SMTP).*

### Production Deployment (DigitalOcean / Heroku / Clever Cloud)
In your cloud dashboard environment variables / config settings:
1. `RESEND_API_KEY`: Add your general Resend API key
2. `RESEND_FROM`: `EPIC Performance <notifications@epicnetworkgroup.co>`
3. `RESEND_ONBOARDING_API_KEY`: Add your onboarding Resend API key
4. `RESEND_ONBOARDING_FROM`: `EPIC Onboarding <onboarding@epicnetworkgroup.co>`

---

## Step 6: Test Sending an Email

You can test email sending using Python in the backend environment:
```powershell
cd backend
# Test General Channel
.\venv\Scripts\python.exe -c "from app.utils.email import send_email; send_email('your-email@gmail.com', 'Test from Resend', 'Resend integration is working!')"

# Test Onboarding Channel
.\venv\Scripts\python.exe -c "from app.utils.email import send_email; send_email('your-email@gmail.com', 'Your account has been created', 'Welcome to EPIC!', category='onboarding')"
```
```
Check your inbox to confirm delivery.
