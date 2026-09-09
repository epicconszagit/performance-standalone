import os
import pptx
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

def create_presentation():
    prs = Presentation()
    # 16:9 Widescreen dimensions
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Color Palette - Modern Executive Dark Tech
    COLOR_BG = RGBColor(15, 23, 42)         # Deep Slate #0F172A
    COLOR_CARD = RGBColor(30, 41, 59)       # Slate Card #1E293B
    COLOR_CARD_BORDER = RGBColor(51, 65, 85) # Muted Border #334155
    COLOR_DO_BLUE = RGBColor(0, 105, 255)   # DigitalOcean Brand Blue #0069FF
    COLOR_CYAN = RGBColor(14, 165, 233)     # Accent Cyan #0EA5E9
    COLOR_WHITE = RGBColor(255, 255, 255)   # White
    COLOR_GRAY = RGBColor(148, 163, 184)    # Slate Gray #94A3B8
    COLOR_GREEN = RGBColor(34, 197, 94)     # Success Green #22C55E
    COLOR_AMBER = RGBColor(245, 158, 11)    # Warning Amber #F59E0B
    COLOR_RED = RGBColor(239, 68, 68)       # Red #EF4444

    def apply_background(slide):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
        bg.fill.solid()
        bg.fill.fore_color.rgb = COLOR_BG
        bg.line.fill.background() # no line
        return bg

    def add_header(slide, category, title, subtitle=None):
        # Category Badge / Eyebrow
        cat_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.5), Inches(11.7), Inches(0.4))
        tf_cat = cat_box.text_frame
        tf_cat.word_wrap = True
        tf_cat.margin_left = tf_cat.margin_top = tf_cat.margin_right = tf_cat.margin_bottom = 0
        p_cat = tf_cat.paragraphs[0]
        p_cat.text = category.upper()
        p_cat.font.size = Pt(11)
        p_cat.font.bold = True
        p_cat.font.color.rgb = COLOR_CYAN
        p_cat.font.name = "Arial"

        # Main Title
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.85), Inches(11.7), Inches(0.6))
        tf_title = title_box.text_frame
        tf_title.word_wrap = True
        tf_title.margin_left = tf_title.margin_top = tf_title.margin_right = tf_title.margin_bottom = 0
        p_title = tf_title.paragraphs[0]
        p_title.text = title
        p_title.font.size = Pt(24)
        p_title.font.bold = True
        p_title.font.color.rgb = COLOR_WHITE
        p_title.font.name = "Arial"

        if subtitle:
            sub_box = slide.shapes.add_textbox(Inches(0.8), Inches(1.45), Inches(11.7), Inches(0.4))
            tf_sub = sub_box.text_frame
            tf_sub.word_wrap = True
            tf_sub.margin_left = tf_sub.margin_top = tf_sub.margin_right = tf_sub.margin_bottom = 0
            p_sub = tf_sub.paragraphs[0]
            p_sub.text = subtitle
            p_sub.font.size = Pt(13)
            p_sub.font.color.rgb = COLOR_GRAY
            p_sub.font.name = "Arial"

    # =========================================================================
    # SLIDE 1: TITLE SLIDE
    # =========================================================================
    s1 = prs.slides.add_slide(blank_layout)
    apply_background(s1)

    # Accent Top Bar
    accent_bar = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.5), Inches(1.2), Inches(0.08))
    accent_bar.fill.solid()
    accent_bar.fill.fore_color.rgb = COLOR_DO_BLUE
    accent_bar.line.fill.background()

    # Title & Subtitle Box
    t_box = s1.shapes.add_textbox(Inches(0.8), Inches(1.9), Inches(11.7), Inches(3.0))
    tf1 = t_box.text_frame
    tf1.word_wrap = True

    p1 = tf1.paragraphs[0]
    p1.text = "Infrastructure Selection Strategy"
    p1.font.size = Pt(38)
    p1.font.bold = True
    p1.font.color.rgb = COLOR_WHITE
    p1.font.name = "Arial"

    p2 = tf1.add_paragraph()
    p2.text = "Why DigitalOcean is the Optimal Cloud Choice for EPIC TASK PERFORMANCE TRACKING SYSTEM"
    p2.font.size = Pt(18)
    p2.font.color.rgb = COLOR_CYAN
    p2.font.name = "Arial"
    p2.space_before = Pt(16)

    p3 = tf1.add_paragraph()
    p3.text = "A direct, executive evaluation of cost, operational reliability, and deployment agility."
    p3.font.size = Pt(14)
    p3.font.color.rgb = COLOR_GRAY
    p3.font.name = "Arial"
    p3.space_before = Pt(10)

    # Key Highlights Pill Cards at Bottom
    pill_data = [
        ("Deployment Agility", "Instant launch with zero manual account verification delays"),
        ("100% Data Persistence", "Permanent NVMe storage for all task attachments up to 250MB"),
        ("Predictable Low Cost", "$6.00/month flat rate with $200 new-user credit")
    ]
    for i, (title, desc) in enumerate(pill_data):
        x = Inches(0.8 + i * 3.95)
        y = Inches(5.2)
        card = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, Inches(3.8), Inches(1.4))
        card.fill.solid()
        card.fill.fore_color.rgb = COLOR_CARD
        card.line.color.rgb = COLOR_CARD_BORDER
        card.line.width = Pt(1)

        c_box = s1.shapes.add_textbox(x + Inches(0.25), y + Inches(0.2), Inches(3.3), Inches(1.0))
        c_tf = c_box.text_frame
        c_tf.word_wrap = True
        cp1 = c_tf.paragraphs[0]
        cp1.text = title
        cp1.font.size = Pt(13)
        cp1.font.bold = True
        cp1.font.color.rgb = COLOR_DO_BLUE
        cp1.font.name = "Arial"

        cp2 = c_tf.add_paragraph()
        cp2.text = desc
        cp2.font.size = Pt(11)
        cp2.font.color.rgb = COLOR_GRAY
        cp2.font.name = "Arial"
        cp2.space_before = Pt(4)

    # =========================================================================
    # SLIDE 2: THE 3 CORE INFRASTRUCTURE REQUIREMENTS
    # =========================================================================
    s2 = prs.slides.add_slide(blank_layout)
    apply_background(s2)
    add_header(s2, "Architecture Context", "What Our Performance System Actually Demands", 
               "Evaluating platforms against the technical reality of our Flask + React + APScheduler application.")

    reqs = [
        ("1. Persistent File Storage", 
         "CRITICAL REQUIREMENT",
         "The app allows staff to attach task files and completion reports up to 250MB directly to disk (/uploads).\n\n"
         "• PaaS platforms (Heroku, Render free tier) use ephemeral disks that delete all uploaded documents on every deploy.\n"
         "• DigitalOcean gives a dedicated, persistent NVMe SSD drive that never wipes files."),
        
        ("2. 24/7 Continuous Background Jobs", 
         "OPERATIONAL INTEGRITY",
         "The app features an integrated APScheduler running daily at 7:00 AM for staff birthday alerts.\n\n"
         "• Serverless/sleep-mode hosts shut down worker threads after 15 minutes of idle time, breaking cron jobs.\n"
         "• DigitalOcean maintains a constant Systemd daemon process that never sleeps."),
        
        ("3. Frictionless Time-to-Market", 
         "EXECUTION SPEED",
         "We needed immediate deployment without red tape or administrative blockers.\n\n"
         "• Alternative VPS providers (e.g., Hetzner) impose strict KYC fraud-checks requiring manual passport audits.\n"
         "• DigitalOcean activates instantly upon sign-up with immediate global infrastructure.")
    ]

    for i, (title, tag, body) in enumerate(reqs):
        x = Inches(0.8 + i * 3.95)
        y = Inches(2.1)
        card = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, Inches(3.8), Inches(4.7))
        card.fill.solid()
        card.fill.fore_color.rgb = COLOR_CARD
        card.line.color.rgb = COLOR_CARD_BORDER

        tb = s2.shapes.add_textbox(x + Inches(0.3), y + Inches(0.3), Inches(3.2), Inches(4.1))
        tf = tb.text_frame
        tf.word_wrap = True

        p_tag = tf.paragraphs[0]
        p_tag.text = tag
        p_tag.font.size = Pt(9.5)
        p_tag.font.bold = True
        p_tag.font.color.rgb = COLOR_CYAN
        p_tag.font.name = "Arial"

        p_t = tf.add_paragraph()
        p_t.text = title
        p_t.font.size = Pt(15)
        p_t.font.bold = True
        p_t.font.color.rgb = COLOR_WHITE
        p_t.font.name = "Arial"
        p_t.space_before = Pt(8)

        p_b = tf.add_paragraph()
        p_b.text = body
        p_b.font.size = Pt(11.5)
        p_b.font.color.rgb = COLOR_GRAY
        p_b.font.name = "Arial"
        p_b.space_before = Pt(14)

    # =========================================================================
    # SLIDE 3: COMPETITIVE LANDSCAPE (WHY NOT THE OTHERS?)
    # =========================================================================
    s3 = prs.slides.add_slide(blank_layout)
    apply_background(s3)
    add_header(s3, "Vendor Comparison", "Why Alternative Options Were Eliminated",
               "Evaluating Hetzner, PaaS solutions (Render/Heroku), and Hyperscalers (AWS).")

    competitors = [
        ("Hetzner Cloud", "DISQUALIFIED: KYC BLOCKER", COLOR_AMBER,
         "• Aggressive anti-fraud verification flagged our new account registration.\n"
         "• Demands manual support intervention, photo ID / passport submission, and up to 24-48h wait time.\n"
         "• High risk of account suspension for international developers.\n\n"
         "Verdict: Unacceptable deployment delay and regulatory friction."),

        ("Render / Heroku (PaaS)", "DISQUALIFIED: STORAGE & SLEEP", COLOR_RED,
         "• Ephemeral Filesystem: Every staff attachment in /uploads disappears on the next code update.\n"
         "• Sleep Mode: Free/entry tiers spin down after 15m idle time, killing the 7:00 AM birthday scheduler.\n"
         "• Persistent storage add-ons or S3 integration drive costs to $15–$25/mo.\n\n"
         "Verdict: Architecturally incompatible without re-engineering file storage."),

        ("AWS / Azure (Hyperscalers)", "DISQUALIFIED: COMPLEXITY & COST", COLOR_AMBER,
         "• Excessive architectural complexity (VPC, IAM, Security Groups, EC2 provisioning).\n"
         "• Unpredictable billing with hidden costs for egress bandwidth, EBS volumes, and IP addresses.\n"
         "• Equivalent VM specs cost $20+/month.\n\n"
         "Verdict: Over-engineered for an internal operational system.")
    ]

    for i, (name, status, color, details) in enumerate(competitors):
        x = Inches(0.8 + i * 3.95)
        y = Inches(2.1)
        card = s3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, Inches(3.8), Inches(4.7))
        card.fill.solid()
        card.fill.fore_color.rgb = COLOR_CARD
        card.line.color.rgb = color
        card.line.width = Pt(1.5)

        tb = s3.shapes.add_textbox(x + Inches(0.3), y + Inches(0.3), Inches(3.2), Inches(4.1))
        tf = tb.text_frame
        tf.word_wrap = True

        p_status = tf.paragraphs[0]
        p_status.text = status
        p_status.font.size = Pt(9.5)
        p_status.font.bold = True
        p_status.font.color.rgb = color
        p_status.font.name = "Arial"

        p_name = tf.add_paragraph()
        p_name.text = name
        p_name.font.size = Pt(16)
        p_name.font.bold = True
        p_name.font.color.rgb = COLOR_WHITE
        p_name.font.name = "Arial"
        p_name.space_before = Pt(6)

        p_det = tf.add_paragraph()
        p_det.text = details
        p_det.font.size = Pt(11)
        p_det.font.color.rgb = COLOR_GRAY
        p_det.font.name = "Arial"
        p_det.space_before = Pt(12)

    # =========================================================================
    # SLIDE 4: THE DIGITALOCEAN ADVANTAGE (DECISION MATRIX)
    # =========================================================================
    s4 = prs.slides.add_slide(blank_layout)
    apply_background(s4)
    add_header(s4, "Evaluation Matrix", "Head-to-Head Comparison Matrix",
               "How DigitalOcean outperforms competitors across key operational pillars.")

    # Create Table
    rows = 6
    cols = 5
    left = Inches(0.8)
    top = Inches(2.1)
    width = Inches(11.733)
    height = Inches(4.6)

    table_shape = s4.shapes.add_table(rows, cols, left, top, width, height)
    table = table_shape.table

    # Column widths
    table.columns[0].width = Inches(2.8)
    table.columns[1].width = Inches(2.3)
    table.columns[2].width = Inches(2.2)
    table.columns[3].width = Inches(2.2)
    table.columns[4].width = Inches(2.233)

    headers = ["Evaluation Criteria", "DigitalOcean Droplet", "Hetzner Cloud", "Render / PaaS", "AWS EC2"]
    for col_idx, text in enumerate(headers):
        cell = table.cell(0, col_idx)
        cell.fill.solid()
        cell.fill.fore_color.rgb = COLOR_DO_BLUE if col_idx == 1 else RGBColor(19, 30, 49)
        cell.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = cell.text_frame.paragraphs[0]
        p.text = text
        p.font.bold = True
        p.font.size = Pt(12)
        p.font.color.rgb = COLOR_WHITE
        p.font.name = "Arial"

    data = [
        ("Account Setup & Verification", "Instant (Zero delays)", "Manual KYC audit (1-2 days)", "Instant", "Instant (Requires card verification)"),
        ("File Upload Persistence (/uploads)", "Permanent NVMe SSD", "Permanent SSD", "Ephemeral (Wiped on deploy)", "Requires EBS / S3 setup"),
        ("Background Scheduler (APScheduler)", "100% Uptime (Systemd)", "100% Uptime (Systemd)", "Sleeps after 15m idle", "Requires dedicated instance"),
        ("Monthly Base Cost", "$6.00 / month flat", "~$4.50 / month", "$7.00 - $15.00 / mo", "$18.00 - $30.00 / mo"),
        ("Setup Complexity", "Simple (Standard Ubuntu)", "Simple (Standard Ubuntu)", "Low (Automated)", "High (IAM, VPC, Configs)")
    ]

    for row_idx, row_data in enumerate(data, start=1):
        for col_idx, cell_text in enumerate(row_data):
            cell = table.cell(row_idx, col_idx)
            cell.fill.solid()
            cell.fill.fore_color.rgb = RGBColor(24, 34, 52) if col_idx == 1 else COLOR_CARD
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            p = cell.text_frame.paragraphs[0]
            p.text = cell_text
            p.font.size = Pt(11)
            p.font.name = "Arial"
            if col_idx == 1:
                p.font.bold = True
                p.font.color.rgb = COLOR_WHITE
            elif col_idx == 0:
                p.font.bold = True
                p.font.color.rgb = COLOR_WHITE
            else:
                p.font.color.rgb = COLOR_GRAY

    # =========================================================================
    # SLIDE 5: PRICING & ROI
    # =========================================================================
    s5 = prs.slides.add_slide(blank_layout)
    apply_background(s5)
    add_header(s5, "Financial Analysis", "Cost Breakdown & Total Cost of Ownership",
               "Transparent monthly running costs with zero hidden charges or surprise invoices.")

    # Left: Big Cost Card
    c_left = s5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(2.1), Inches(4.5), Inches(4.7))
    c_left.fill.solid()
    c_left.fill.fore_color.rgb = COLOR_CARD
    c_left.line.color.rgb = COLOR_DO_BLUE
    c_left.line.width = Pt(2)

    tb_cost = s5.shapes.add_textbox(Inches(1.1), Inches(2.4), Inches(3.9), Inches(4.1))
    tf_cost = tb_cost.text_frame
    tf_cost.word_wrap = True

    p_badge = tf_cost.paragraphs[0]
    p_badge.text = "TOTAL PREDICTABLE COST"
    p_badge.font.size = Pt(11)
    p_badge.font.bold = True
    p_badge.font.color.rgb = COLOR_CYAN

    p_num = tf_cost.add_paragraph()
    p_num.text = "$7.00"
    p_num.font.size = Pt(54)
    p_num.font.bold = True
    p_num.font.color.rgb = COLOR_WHITE
    p_num.space_before = Pt(4)

    p_per = tf_cost.add_paragraph()
    p_per.text = "per month total infrastructure cost"
    p_per.font.size = Pt(13)
    p_per.font.color.rgb = COLOR_GRAY
    p_per.space_before = Pt(0)

    p_credit = tf_cost.add_paragraph()
    p_credit.text = "\n🎁 $200 New User Credit\nDigitalOcean grants $200 in free usage credits for 60 days, effectively making our initial staging and deployment 100% free."
    p_credit.font.size = Pt(11.5)
    p_credit.font.color.rgb = COLOR_GREEN
    p_credit.space_before = Pt(16)

    # Right: Itemized Table
    c_right = s5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(5.6), Inches(2.1), Inches(6.933), Inches(4.7))
    c_right.fill.solid()
    c_right.fill.fore_color.rgb = COLOR_CARD
    c_right.line.color.rgb = COLOR_CARD_BORDER

    tb_items = s5.shapes.add_textbox(Inches(5.9), Inches(2.4), Inches(6.3), Inches(4.1))
    tf_items = tb_items.text_frame
    tf_items.word_wrap = True

    p_it_title = tf_items.paragraphs[0]
    p_it_title.text = "Itemized Budget Breakdown"
    p_it_title.font.size = Pt(16)
    p_it_title.font.bold = True
    p_it_title.font.color.rgb = COLOR_WHITE

    items = [
        ("DigitalOcean 1GB Droplet", "$6.00 / mo", "1 vCPU, 1GB RAM, 25GB NVMe SSD, 1,000GB data transfer. Runs Flask API, Gunicorn, React build, and local disk uploads."),
        ("Supabase Database", "$0.00 / mo", "Free tier PostgreSQL database (500MB storage, 50,000 MAU, connection pooling)."),
        ("Custom Domain (Annualized)", "~$1.00 / mo", "Custom corporate domain purchased from Namecheap/Porkbun at ~$12/year."),
        ("SSL Security (HTTPS)", "$0.00 / mo", "Automated, self-renewing SSL certificate via Let's Encrypt / Certbot."),
    ]

    for item, cost, desc in items:
        p_row = tf_items.add_paragraph()
        p_row.text = f"• {item} — {cost}"
        p_row.font.size = Pt(13)
        p_row.font.bold = True
        p_row.font.color.rgb = COLOR_WHITE
        p_row.space_before = Pt(12)

        p_desc = tf_items.add_paragraph()
        p_desc.text = f"   {desc}"
        p_desc.font.size = Pt(10.5)
        p_desc.font.color.rgb = COLOR_GRAY
        p_desc.space_before = Pt(2)

    # =========================================================================
    # SLIDE 6: STRATEGIC SUMMARY & IMMEDIATE NEXT STEPS
    # =========================================================================
    s6 = prs.slides.add_slide(blank_layout)
    apply_background(s6)
    add_header(s6, "Implementation Plan", "Deployment Roadmap & Strategic Summary",
               "The path forward from decision to live production within 1 hour.")

    steps = [
        ("Phase 1: Droplet Provisioning", "10 Minutes", "Create 1GB Ubuntu 24.04 Droplet in nearest region, allocate 2GB swap space, and enable UFW firewall."),
        ("Phase 2: Code & Asset Build", "15 Minutes", "Clone GitHub repository, build React frontend (`npm run build`), configure Python virtualenv and `psycopg2-binary`."),
        ("Phase 3: Database & Daemon Setup", "15 Minutes", "Connect Supabase `DATABASE_URL`, execute `flask db upgrade`, and register `performance.service` Systemd daemon."),
        ("Phase 4: Nginx & SSL Go-Live", "10 Minutes", "Configure reverse proxy with 250MB upload buffer and activate instant Let's Encrypt HTTPS via Certbot.")
    ]

    for i, (title, duration, details) in enumerate(steps):
        x = Inches(0.8 + i * 2.95)
        y = Inches(2.1)
        card = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, Inches(2.8), Inches(3.6))
        card.fill.solid()
        card.fill.fore_color.rgb = COLOR_CARD
        card.line.color.rgb = COLOR_CARD_BORDER

        tb = s6.shapes.add_textbox(x + Inches(0.2), y + Inches(0.25), Inches(2.4), Inches(3.1))
        tf = tb.text_frame
        tf.word_wrap = True

        p_num = tf.paragraphs[0]
        p_num.text = f"STEP {i+1}"
        p_num.font.size = Pt(10)
        p_num.font.bold = True
        p_num.font.color.rgb = COLOR_CYAN

        p_dur = tf.add_paragraph()
        p_dur.text = duration
        p_dur.font.size = Pt(9.5)
        p_dur.font.bold = True
        p_dur.font.color.rgb = COLOR_GREEN
        p_dur.space_before = Pt(2)

        p_t = tf.add_paragraph()
        p_t.text = title
        p_t.font.size = Pt(13)
        p_t.font.bold = True
        p_t.font.color.rgb = COLOR_WHITE
        p_t.space_before = Pt(8)

        p_d = tf.add_paragraph()
        p_d.text = details
        p_d.font.size = Pt(10.5)
        p_d.font.color.rgb = COLOR_GRAY
        p_d.space_before = Pt(8)

    # Bottom Banner
    banner = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(6.0), Inches(11.733), Inches(0.9))
    banner.fill.solid()
    banner.fill.fore_color.rgb = COLOR_CARD
    banner.line.color.rgb = COLOR_DO_BLUE
    banner.line.width = Pt(1.5)

    tb_b = s6.shapes.add_textbox(Inches(1.1), Inches(6.15), Inches(11.1), Inches(0.6))
    tf_b = tb_b.text_frame
    tf_b.word_wrap = True
    p_b1 = tf_b.paragraphs[0]
    p_b1.text = "Bottom Line: DigitalOcean eliminates Hetzner's verification blocker, solves PaaS file-wipe limitations, and guarantees 24/7 background cron execution for only $7.00/month."
    p_b1.font.size = Pt(12)
    p_b1.font.bold = True
    p_b1.font.color.rgb = COLOR_WHITE

    # Save presentation
    output_path = r"c:\Users\nqopz\OneDrive\Desktop\NEWSYSTEM\Performance-Standalone\DigitalOcean_Deployment_Strategy.pptx"
    prs.save(output_path)
    print(f"Presentation saved successfully to: {output_path}")

if __name__ == "__main__":
    create_presentation()
