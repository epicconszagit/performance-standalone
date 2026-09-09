import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), fill_hex)
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def add_code_block(doc, code_text):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = table.cell(0, 0)
    set_cell_background(cell, '0F172A') # dark slate
    set_cell_margins(cell, top=140, bottom=140, left=200, right=200)
    cell.width = Inches(6.5)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.15
    run = p.add_run(code_text.strip())
    run.font.name = 'Consolas'
    run.font.size = Pt(9.5)
    run.font.color.rgb = RGBColor(226, 232, 240) # light silver
    
    # spacing after table
    sp = doc.add_paragraph()
    sp.paragraph_format.space_before = Pt(0)
    sp.paragraph_format.space_after = Pt(4)

def add_callout(doc, title, text, bg_hex='F0FDF4', border_hex='22C55E'):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = table.cell(0, 0)
    set_cell_background(cell, bg_hex)
    set_cell_margins(cell, top=140, bottom=140, left=200, right=200)
    cell.width = Inches(6.5)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    r_t = p.add_run(f"📌 {title}\n")
    r_t.font.name = 'Segoe UI'
    r_t.font.size = Pt(10.5)
    r_t.font.bold = True
    r_t.font.color.rgb = RGBColor(15, 23, 42)
    
    r_b = p.add_run(text)
    r_b.font.name = 'Segoe UI'
    r_b.font.size = Pt(10)
    r_b.font.color.rgb = RGBColor(51, 65, 85)
    
    sp = doc.add_paragraph()
    sp.paragraph_format.space_before = Pt(0)
    sp.paragraph_format.space_after = Pt(4)

def build_runbook():
    doc = Document()
    
    # Page setup - 1 inch margins
    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)
        
    # Styles
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Segoe UI'
    normal_style.font.size = Pt(10.5)
    normal_style.font.color.rgb = RGBColor(30, 41, 59)
    
    # Title Block
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(0)
    title_p.paragraph_format.space_after = Pt(4)
    run_title = title_p.add_run("DigitalOcean Production Deployment Runbook")
    run_title.font.name = 'Segoe UI'
    run_title.font.size = Pt(24)
    run_title.font.bold = True
    run_title.font.color.rgb = RGBColor(0, 105, 255) # DigitalOcean Blue
    
    sub_p = doc.add_paragraph()
    sub_p.paragraph_format.space_before = Pt(0)
    sub_p.paragraph_format.space_after = Pt(18)
    run_sub = sub_p.add_run("Step-by-Step Technical Guide for Hosting the EPIC TASK PERFORMANCE TRACKING SYSTEM\n(Flask Backend + React Frontend + Supabase PostgreSQL + Nginx + SSL)")
    run_sub.font.name = 'Segoe UI'
    run_sub.font.size = Pt(12)
    run_sub.font.color.rgb = RGBColor(100, 116, 139)
    
    # Divider line
    doc.add_paragraph().paragraph_format.space_after = Pt(6)
    
    # Section 1: Executive Overview & Costs
    h1 = doc.add_heading("1. Architecture Overview & Monthly Costs", level=1)
    h1.paragraph_format.space_before = Pt(12)
    h1.paragraph_format.space_after = Pt(6)
    h1.style.font.color.rgb = RGBColor(15, 23, 42)
    
    p = doc.add_paragraph(
        "This system consists of a unified React frontend and Python Flask API. "
        "Flask is configured to serve the compiled React bundle directly from /frontend/dist, allowing the entire application "
        "to run under a single domain without Cross-Origin Resource Sharing (CORS) complexity. "
        "All database operations connect securely to a managed Supabase PostgreSQL instance via connection pooling."
    )
    p.paragraph_format.space_after = Pt(10)
    
    # Cost Table
    table = doc.add_table(rows=5, cols=3)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    headers = ["Infrastructure Component", "Specifications / Provider", "Monthly Cost"]
    col_widths = [Inches(2.5), Inches(2.7), Inches(1.3)]
    
    for c_idx, text in enumerate(headers):
        cell = table.cell(0, c_idx)
        cell.width = col_widths[c_idx]
        set_cell_background(cell, '0069FF')
        set_cell_margins(cell, top=100, bottom=100, left=150, right=150)
        p = cell.paragraphs[0]
        r = p.add_run(text)
        r.font.bold = True
        r.font.size = Pt(10)
        r.font.color.rgb = RGBColor(255, 255, 255)
        
    cost_rows = [
        ("DigitalOcean Droplet", "1 vCPU, 1 GB RAM, 25 GB NVMe SSD (Ubuntu 24.04)", "$6.00 / month"),
        ("Supabase Database", "PostgreSQL Free Tier (500MB DB, 50,000 MAU)", "$0.00 / month"),
        ("Custom Domain Name", "Namecheap / Porkbun (Annual ~$12/year)", "~$1.00 / month"),
        ("SSL Security Certificate", "Let's Encrypt / Certbot (Auto-renewing)", "$0.00 / month")
    ]
    
    for r_idx, (comp, spec, cost) in enumerate(cost_rows, start=1):
        bg = 'F8FAFC' if r_idx % 2 == 0 else 'FFFFFF'
        for c_idx, val in enumerate([comp, spec, cost]):
            cell = table.cell(r_idx, c_idx)
            cell.width = col_widths[c_idx]
            set_cell_background(cell, bg)
            set_cell_margins(cell, top=80, bottom=80, left=150, right=150)
            p = cell.paragraphs[0]
            r = p.add_run(val)
            r.font.size = Pt(9.5)
            if c_idx == 2:
                r.font.bold = True
                
    doc.add_paragraph().paragraph_format.space_after = Pt(6)
    add_callout(doc, "Free Credit Promotion", "DigitalOcean provides $200 in free credits valid for 60 days to all new verified signups. This makes the initial setup and staging phases completely free.")

    # Section 2: Phase 1 - DigitalOcean Droplet Provisioning
    h2 = doc.add_heading("2. Phase 1: DigitalOcean Droplet Creation", level=1)
    h2.paragraph_format.space_before = Pt(14)
    h2.paragraph_format.space_after = Pt(6)
    
    doc.add_paragraph("Follow these exact steps in the DigitalOcean console to create the server:")
    
    steps_p1 = [
        ("Step 1.1: Sign Up", "Visit https://www.digitalocean.com, click Sign Up, and complete account creation with a credit card or PayPal."),
        ("Step 1.2: Navigate to Droplet Creation", "In your dashboard, click the green 'Create' button at the top right, then select 'Droplets'."),
        ("Step 1.3: Choose Datacenter Region", "Select a region geographically closest to your business (e.g. Frankfurt, London, New York, or Singapore)."),
        ("Step 1.4: Select Operating System Image", "Under 'Choose an image', select Ubuntu 24.04 (LTS) x64."),
        ("Step 1.5: Select Droplet Size", "Choose 'Basic' -> 'Regular' CPU options -> select the $6.00/mo plan (1 GB CPU, 25 GB NVMe SSD, 1,000 GB transfer)."),
        ("Step 1.6: Choose Authentication Method", "Select 'Password'. Create a strong root password (8+ characters, 1 uppercase, 1 number, no special characters at the very end). Note this password down securely."),
        ("Step 1.7: Finalize Hostname & Launch", "Under 'Finalize details', name the server 'performance-server'. Click 'Create Droplet'. Wait 30 seconds for the public IPv4 address to appear (e.g. 159.65.123.45).")
    ]
    for s_title, s_desc in steps_p1:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(3)
        r1 = p.add_run(f"• {s_title}: ")
        r1.font.bold = True
        p.add_run(s_desc)
        
    # Section 3: Phase 2 - Domain DNS Setup
    h3 = doc.add_heading("3. Phase 2: Domain DNS Configuration", level=1)
    h3.paragraph_format.space_before = Pt(14)
    h3.paragraph_format.space_after = Pt(6)
    
    doc.add_paragraph(
        "Before setting up SSL, point your domain to your new Droplet's IP address. "
        "Log in to your domain registrar (Namecheap, Cloudflare, GoDaddy, etc.) and open DNS Management:"
    )
    
    dns_table = doc.add_table(rows=3, cols=4)
    dns_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    dns_headers = ["Record Type", "Host / Name", "Points To / Value", "TTL"]
    dns_widths = [Inches(1.5), Inches(1.5), Inches(2.2), Inches(1.3)]
    
    for c_idx, text in enumerate(dns_headers):
        cell = dns_table.cell(0, c_idx)
        cell.width = dns_widths[c_idx]
        set_cell_background(cell, '1E293B')
        set_cell_margins(cell, top=80, bottom=80, left=120, right=120)
        p = cell.paragraphs[0]
        r = p.add_run(text)
        r.font.bold = True
        r.font.size = Pt(9.5)
        r.font.color.rgb = RGBColor(255, 255, 255)
        
    dns_records = [
        ("A", "@", "YOUR_DROPLET_IP (e.g. 159.65.123.45)", "Automatic / 300s"),
        ("CNAME", "www", "yourdomain.com", "Automatic / 300s")
    ]
    for r_idx, (rtype, host, val, ttl) in enumerate(dns_records, start=1):
        for c_idx, text in enumerate([rtype, host, val, ttl]):
            cell = dns_table.cell(r_idx, c_idx)
            cell.width = dns_widths[c_idx]
            set_cell_background(cell, 'FFFFFF')
            set_cell_margins(cell, top=70, bottom=70, left=120, right=120)
            p = cell.paragraphs[0]
            p.add_run(text).font.size = Pt(9)
            
    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # Section 4: Phase 3 - Server Connection & Hardening
    h4 = doc.add_heading("4. Phase 3: Server Preparation & Security Hardening", level=1)
    h4.paragraph_format.space_before = Pt(14)
    h4.paragraph_format.space_after = Pt(6)
    
    doc.add_paragraph("Open Windows PowerShell on your local PC and connect to your Droplet via SSH:")
    add_code_block(doc, "ssh root@YOUR_DROPLET_IP")
    
    doc.add_paragraph("Once logged in, perform package updates and install essential server components:")
    add_code_block(doc, """# 1. Update Ubuntu system packages
apt update && apt upgrade -y

# 2. Configure Firewall (UFW)
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# 3. Install Python 3, Node.js runtime, Nginx web server, and Certbot
apt install -y python3 python3-pip python3-venv git nginx certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs""")

    add_callout(doc, "Crucial Step: 2GB Swap Space Allocation",
                "Compiling a modern React app (npm run build) can spike RAM usage above 800MB. Creating a 2GB swap file prevents memory crashes during builds on a 1GB Droplet.")
    
    add_code_block(doc, """# Create and enable 2GB swap memory
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab""")

    # Section 5: Phase 4 - Deploy Application Code
    h5 = doc.add_heading("5. Phase 4: Application Code Deployment & Build", level=1)
    h5.paragraph_format.space_before = Pt(14)
    h5.paragraph_format.space_after = Pt(6)
    
    doc.add_paragraph("Clone your Git repository onto the server and build the production assets:")
    add_code_block(doc, """# 1. Clone repository to /var/www
mkdir -p /var/www
cd /var/www
git clone https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY.git performance-app
cd /var/www/performance-app

# 2. Build React Frontend
cd /var/www/performance-app/frontend
npm install
npm run build

# 3. Setup Python Virtual Environment and Dependencies
cd /var/www/performance-app/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install psycopg2-binary""")

    # Section 6: Phase 5 - Database Connection & Migrations
    h6 = doc.add_heading("6. Phase 5: Supabase Database Configuration & Migrations", level=1)
    h6.paragraph_format.space_before = Pt(14)
    h6.paragraph_format.space_after = Pt(6)
    
    doc.add_paragraph("Create the backend environment file with your Supabase credentials:")
    add_code_block(doc, "nano /var/www/performance-app/backend/.env")
    
    doc.add_paragraph("Paste the following production configuration (adjust with your Supabase connection string and random secret keys):")
    add_code_block(doc, """DATABASE_URL=postgresql+psycopg2://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres

SECRET_KEY=generate_a_random_32_character_string_here_abc123
JWT_SECRET_KEY=generate_another_random_32_character_string_xyz789
JWT_ACCESS_TOKEN_EXPIRES_SECONDS=604800
FLASK_DEBUG=0

# Optional Email SMTP (Gmail App Password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
SMTP_FROM=your-email@gmail.com

# Optional Twilio SMS
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=""")

    doc.add_paragraph("Execute the database migrations to create all application tables in Supabase:")
    add_code_block(doc, """cd /var/www/performance-app/backend
source venv/bin/activate
flask db upgrade""")

    # Section 7: Phase 6 - Systemd 24/7 Background Service
    h7 = doc.add_heading("7. Phase 6: Systemd Background Service (24/7 Uptime)", level=1)
    h7.paragraph_format.space_before = Pt(14)
    h7.paragraph_format.space_after = Pt(6)
    
    doc.add_paragraph("Create a systemd unit file so Gunicorn runs continuously and restarts automatically on system reboots:")
    add_code_block(doc, "nano /etc/systemd/system/performance.service")
    
    doc.add_paragraph("Paste the following service definition:")
    add_code_block(doc, """[Unit]
Description=Performance Standalone Flask App
After=network.target

[Service]
User=root
WorkingDirectory=/var/www/performance-app/backend
EnvironmentFile=/var/www/performance-app/backend/.env
ExecStart=/var/www/performance-app/backend/venv/bin/gunicorn run:app --workers 1 --threads 4 --bind 127.0.0.1:5000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target""")

    doc.add_paragraph("Enable and start the service:")
    add_code_block(doc, """systemctl daemon-reload
systemctl enable performance
systemctl start performance
systemctl status performance""")

    # Section 8: Phase 7 - Nginx & SSL Setup
    h8 = doc.add_heading("8. Phase 7: Nginx Web Server & Free SSL (HTTPS)", level=1)
    h8.paragraph_format.space_before = Pt(14)
    h8.paragraph_format.space_after = Pt(6)
    
    doc.add_paragraph("Configure Nginx to reverse proxy web requests to Flask and allow uploads up to 250MB:")
    add_code_block(doc, "nano /etc/nginx/sites-available/performance")
    
    add_code_block(doc, """server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Allow 250MB attachments matching backend MAX_CONTENT_LENGTH
    client_max_body_size 250M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
    }
}""")

    doc.add_paragraph("Enable the site, disable the default placeholder, and restart Nginx:")
    add_code_block(doc, """ln -s /etc/nginx/sites-available/performance /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx""")

    doc.add_paragraph("Activate free, automated SSL encryption via Certbot:")
    add_code_block(doc, "certbot --nginx -d yourdomain.com -d www.yourdomain.com")

    # Section 9: Maintenance & Day-2 Operations
    h9 = doc.add_heading("9. Routine Maintenance & Future Code Updates", level=1)
    h9.paragraph_format.space_before = Pt(14)
    h9.paragraph_format.space_after = Pt(6)
    
    doc.add_paragraph("When you make code changes in GitHub and want to update your production server, run this 1-minute command script:")
    add_code_block(doc, """cd /var/www/performance-app
git pull origin main

# Rebuild frontend
cd frontend && npm install && npm run build

# Apply any new migrations & restart server
cd ../backend
source venv/bin/activate
pip install -r requirements.txt
flask db upgrade
systemctl restart performance""")

    # Save
    output_path = r"c:\Users\nqopz\OneDrive\Desktop\NEWSYSTEM\Performance-Standalone\DigitalOcean_Deployment_Runbook.docx"
    doc.save(output_path)
    print(f"Runbook successfully generated at: {output_path}")

if __name__ == "__main__":
    build_runbook()
