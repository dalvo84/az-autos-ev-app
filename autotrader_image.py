"""
Auto Trader advert image generator for AZ Autos EV Battery Health Certificate.
Uses ReportLab to render a high-quality single-page PDF, then converts to
1024x768 PNG via PyMuPDF for uploading as a photo in an Auto Trader listing.

Design matches the certificate PDF (page 1) visual language:
  - Green header bar with AZ Autos logo, title, ref/date
  - Grey SoH card with gauge, battery status info, Bosch logo
  - Warranty card with badge, progress bars
  - Range estimates table with 3 scenarios
  - Light grey footer with ref, disclaimer
"""

import os
import io
import math
import tempfile
from datetime import datetime
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from PIL import Image
import numpy as np

# ── Colour palette (identical to certificate) ────────────────────
AZ_GREEN = HexColor("#2CAE66")
AZ_GREEN_LIGHT = HexColor("#E8F8EF")
AZ_GREEN_DARK = HexColor("#1E8C4E")
DARK_CHARCOAL = HexColor("#1A1A2E")
LIGHT_GREY = HexColor("#F5F5F5")
MID_GREY = HexColor("#E0E0E0")
TEXT_GREY = HexColor("#666666")
WHITE = white
BLACK = black

GRADE_COLOURS = {
    "Excellent": HexColor("#2CAE66"),
    "Good":      HexColor("#7BC67E"),
    "Fair":      HexColor("#F5A623"),
    "Poor":      HexColor("#E8602C"),
    "Critical":  HexColor("#D0021B"),
}

# Page dimensions in points (landscape)
PAGE_W = 1024
PAGE_H = 768
MARGIN = 40
CONTENT_W = PAGE_W - 2 * MARGIN
BOX_RADIUS = 8
BOX_PAD = 12


# ── Helpers ───────────────────────────────────────────────────────

def _draw_rounded_rect(c, x, y, w, h, r=BOX_RADIUS, fill_color=None,
                       stroke_color=None, stroke_width=0.5):
    """Draw a rounded rectangle at (x, y) with width w and height h."""
    c.saveState()
    if fill_color:
        c.setFillColor(fill_color)
    if stroke_color:
        c.setStrokeColor(stroke_color)
        c.setLineWidth(stroke_width)
    else:
        c.setStrokeColor(fill_color if fill_color else WHITE)
    p = c.beginPath()
    p.roundRect(x, y, w, h, r)
    if fill_color and stroke_color:
        c.drawPath(p, fill=1, stroke=1)
    elif fill_color:
        c.drawPath(p, fill=1, stroke=0)
    elif stroke_color:
        c.drawPath(p, fill=0, stroke=1)
    c.restoreState()


def _draw_progress_bar(c, x, y, w, h, fraction, fill_color=None):
    """Draw a horizontal progress bar. fraction is 0.0–1.0 (used portion)."""
    if fill_color is None:
        fill_color = AZ_GREEN
    _draw_rounded_rect(c, x, y, w, h, r=3, fill_color=MID_GREY)
    fill_w = max(0, min(w, w * fraction))
    if fill_w > 6:
        _draw_rounded_rect(c, x, y, fill_w, h, r=3, fill_color=fill_color)


def _draw_soh_gauge(c, cx, cy, radius, soh, grade):
    """Draw a semicircular arc gauge centred at (cx, cy)."""
    grade_colour = GRADE_COLOURS.get(grade, AZ_GREEN)

    # Background arc (full 180°)
    c.saveState()
    c.setStrokeColor(MID_GREY)
    c.setLineWidth(14)
    c.setLineCap(1)
    for i in range(0, 181, 2):
        a1 = math.radians(180 - i)
        a2 = math.radians(180 - i - 2)
        c.line(cx + radius * math.cos(a1), cy + radius * math.sin(a1),
               cx + radius * math.cos(a2), cy + radius * math.sin(a2))
    c.restoreState()

    # Coloured arc (proportional to SoH)
    sweep = int(soh * 1.8)
    c.saveState()
    c.setStrokeColor(grade_colour)
    c.setLineWidth(14)
    c.setLineCap(1)
    for i in range(0, min(sweep, 180), 2):
        a1 = math.radians(180 - i)
        a2 = math.radians(180 - i - 2)
        c.line(cx + radius * math.cos(a1), cy + radius * math.sin(a1),
               cx + radius * math.cos(a2), cy + radius * math.sin(a2))
    c.restoreState()

    # SoH text inside gauge
    c.saveState()
    c.setFont("Helvetica-Bold", 28)
    c.setFillColor(DARK_CHARCOAL)
    c.drawCentredString(cx, cy - 2, f"{soh}%")
    c.setFont("Helvetica", 9)
    c.setFillColor(TEXT_GREY)
    c.drawCentredString(cx, cy - 16, "State of Health")
    c.restoreState()

    # Grade label below gauge
    c.saveState()
    c.setFont("Helvetica-Bold", 13)
    c.setFillColor(grade_colour)
    c.drawCentredString(cx, cy - 38, grade.upper())
    c.restoreState()


def _prepare_logo_for_green_bg(logo_path):
    """Crop Az-02.png (white logo on green bg), make green bg transparent."""
    try:
        img = Image.open(logo_path).convert("RGBA")
        data = np.array(img)
        r, g, b, a = data[:, :, 0], data[:, :, 1], data[:, :, 2], data[:, :, 3]
        is_green = (r < 100) & (g > 100) & (b < 160) & (a > 128)
        is_content = ~is_green & (a > 30)
        rows = np.any(is_content, axis=1)
        cols = np.any(is_content, axis=0)
        if not (np.any(rows) and np.any(cols)):
            return None
        rmin, rmax = np.where(rows)[0][[0, -1]]
        cmin, cmax = np.where(cols)[0][[0, -1]]
        pad = 10
        rmin = max(0, rmin - pad)
        rmax = min(data.shape[0] - 1, rmax + pad)
        cmin = max(0, cmin - pad)
        cmax = min(data.shape[1] - 1, cmax + pad)
        cropped = data[rmin:rmax + 1, cmin:cmax + 1].copy()
        cr, cg, cb, ca = cropped[:, :, 0], cropped[:, :, 1], cropped[:, :, 2], cropped[:, :, 3]
        green_mask = (cr < 100) & (cg > 100) & (cb < 160)
        cropped[green_mask] = [0, 0, 0, 0]
        result = Image.fromarray(cropped, "RGBA")
        buf = io.BytesIO()
        result.save(buf, format="PNG")
        buf.seek(0)
        return ImageReader(buf)
    except Exception:
        return None


def _prepare_bosch_logo(logo_path, bg_hex="#F5F5F5"):
    """Load Bosch logo, crop whitespace, composite onto bg colour."""
    try:
        img = Image.open(logo_path).convert("RGB")
        data = np.array(img)
        r, g, b = data[:, :, 0], data[:, :, 1], data[:, :, 2]
        is_content = (r < 240) | (g < 240) | (b < 240)
        rows = np.any(is_content, axis=1)
        cols = np.any(is_content, axis=0)
        if np.any(rows) and np.any(cols):
            rmin, rmax = np.where(rows)[0][[0, -1]]
            cmin, cmax = np.where(cols)[0][[0, -1]]
            pad = 10
            rmin = max(0, rmin - pad)
            rmax = min(data.shape[0] - 1, rmax + pad)
            cmin = max(0, cmin - pad)
            cmax = min(data.shape[1] - 1, cmax + pad)
            img = img.crop((cmin, rmin, cmax + 1, rmax + 1))
        bg_r = int(bg_hex[1:3], 16)
        bg_g = int(bg_hex[3:5], 16)
        bg_b = int(bg_hex[5:7], 16)
        data2 = np.array(img)
        r2, g2, b2 = data2[:, :, 0], data2[:, :, 1], data2[:, :, 2]
        white_mask = (r2 > 240) & (g2 > 240) & (b2 > 240)
        data2[white_mask] = [bg_r, bg_g, bg_b]
        result = Image.fromarray(data2, "RGB")
        buf = io.BytesIO()
        result.save(buf, format="PNG")
        buf.seek(0)
        return ImageReader(buf)
    except Exception:
        return None


def _parse_reg_date(date_str):
    """Parse a date string into a datetime."""
    if not date_str:
        return None
    for fmt in ["%d/%m/%Y", "%Y-%m-%d", "%d %B %Y", "%d-%m-%Y"]:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    return None


# ── Main generator ────────────────────────────────────────────────

def generate_autotrader_image(data: dict, output_path: str):
    """
    Generate an Auto Trader advert image (1024x768 PNG).

    Matches the certificate PDF (page 1) visual language:
    green header, grey SoH card, warranty card, range table, footer.

    Required data keys:
        soh, grade, ranges, warranty_status, warranty_years, warranty_miles,
        battery_usable_kwh, battery_gross_kwh, cert_ref, logo_white,
        bosch_logo, mileage, first_registered, wltp_range,
        ac_charge_kw, dc_charge_kw
    """
    pdf_buf = io.BytesIO()
    c = canvas.Canvas(pdf_buf, pagesize=(PAGE_W, PAGE_H))

    soh = data.get("soh", 0)
    grade = data.get("grade", "Unknown")
    grade_colour = GRADE_COLOURS.get(grade, AZ_GREEN)
    ranges = data.get("ranges", {})
    cert_ref = data.get("cert_ref", "AZ-XXXXXXXXXX")
    issue_date = datetime.now().strftime("%d %B %Y")

    battery_usable = data.get("battery_usable_kwh", "N/A")
    battery_gross = data.get("battery_gross_kwh", "N/A")
    wltp_range = data.get("wltp_range", 0)
    ac_charge = data.get("ac_charge_kw", "N/A")
    dc_charge = data.get("dc_charge_kw", "N/A")

    # ── Background ────────────────────────────────────────────────
    c.saveState()
    c.setFillColor(WHITE)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.restoreState()

    # ══════════════════════════════════════════════════════════════
    # HEADER — Green bar (matches certificate _draw_header)
    # ══════════════════════════════════════════════════════════════
    header_h = 62
    header_y = PAGE_H - header_h

    c.saveState()
    c.setFillColor(AZ_GREEN)
    c.rect(0, header_y, PAGE_W, header_h, fill=1, stroke=0)
    c.restoreState()

    # AZ Autos logo (left)
    logo_path = data.get("logo_white", "")
    logo_drawn = False
    if logo_path and os.path.exists(logo_path):
        logo_img = _prepare_logo_for_green_bg(logo_path)
        if logo_img:
            try:
                c.drawImage(logo_img, MARGIN, header_y + 8,
                            width=100, height=header_h - 16,
                            preserveAspectRatio=True, mask='auto')
                logo_drawn = True
            except Exception:
                pass
    if not logo_drawn:
        c.saveState()
        c.setFont("Helvetica-Bold", 18)
        c.setFillColor(WHITE)
        c.drawString(MARGIN, header_y + 22, "AZ AUTOS")
        c.restoreState()

    # Title (centre)
    c.saveState()
    c.setFont("Helvetica-Bold", 16)
    c.setFillColor(WHITE)
    c.drawCentredString(PAGE_W / 2, header_y + 32, "EV Battery Health Certificate")
    c.setFont("Helvetica", 8)
    c.setFillColor(HexColor("#FFFFFFCC"))
    c.drawCentredString(PAGE_W / 2, header_y + 16, "Tested with Bosch KTS 590 / ESItronic 2.0")
    c.restoreState()

    # Cert ref and date (right)
    c.saveState()
    c.setFont("Helvetica", 8)
    c.setFillColor(WHITE)
    c.drawRightString(PAGE_W - MARGIN, header_y + 36, f"Ref: {cert_ref}")
    c.drawRightString(PAGE_W - MARGIN, header_y + 22, f"Issued: {issue_date}")
    c.restoreState()

    # ══════════════════════════════════════════════════════════════
    # FOOTER — Light grey bar (matches certificate _draw_footer)
    # ══════════════════════════════════════════════════════════════
    footer_h = 36
    c.saveState()
    c.setFillColor(LIGHT_GREY)
    c.rect(0, 0, PAGE_W, footer_h, fill=1, stroke=0)
    c.setStrokeColor(MID_GREY)
    c.setLineWidth(0.5)
    c.line(0, footer_h, PAGE_W, footer_h)
    c.restoreState()

    c.saveState()
    c.setFont("Helvetica", 7.5)
    c.setFillColor(TEXT_GREY)
    c.drawString(MARGIN, 16, f"Ref: {cert_ref}  |  {issue_date}")
    c.setFont("Helvetica", 6.5)
    c.drawCentredString(PAGE_W / 2, 6,
                        "All data shown on this report is for informational purposes only")
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(AZ_GREEN)
    c.drawRightString(PAGE_W - MARGIN, 16, "azautos.co.uk")
    c.restoreState()

    # ══════════════════════════════════════════════════════════════
    # LAYOUT GEOMETRY
    # ══════════════════════════════════════════════════════════════
    content_top = header_y - 14       # 14pt below header
    content_bottom = footer_h + 14    # 14pt above footer
    available_h = content_top - content_bottom

    # Section heights (proportional to content)
    status_h = 148                    # SoH gauge + battery info card
    gap = 14                          # gap between sections
    warranty_h = 110                  # warranty card
    range_h = 116                     # range table

    total_needed = status_h + warranty_h + range_h + 2 * gap
    # If we have more space, distribute evenly
    extra = available_h - total_needed
    if extra > 0:
        top_pad = extra * 0.3
        gap = gap + extra * 0.15
    else:
        top_pad = 0

    y = content_top - top_pad

    # ══════════════════════════════════════════════════════════════
    # BATTERY STATUS SECTION — Grey card with gauge, info, Bosch logo
    # (matches certificate Battery Status section)
    # ══════════════════════════════════════════════════════════════
    status_y = y - status_h
    _draw_rounded_rect(c, MARGIN, status_y, CONTENT_W, status_h,
                       r=BOX_RADIUS, fill_color=LIGHT_GREY,
                       stroke_color=MID_GREY, stroke_width=0.3)

    # Three-column layout inside the card
    box_bottom = status_y
    baseline = box_bottom + BOX_PAD + 10

    # LEFT: SoH Gauge — bottom-aligned
    gauge_cx = MARGIN + 120
    gauge_cy = baseline + 38 + 14
    gauge_r = 48
    _draw_soh_gauge(c, gauge_cx, gauge_cy, gauge_r, soh, grade)

    # CENTRE: Battery Status info — bottom-aligned
    info_x = MARGIN + 260
    c.saveState()
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(DARK_CHARCOAL)
    c.drawString(info_x, baseline + 72, "Battery Status")
    c.setFont("Helvetica", 8.5)
    c.setFillColor(TEXT_GREY)

    info_lines = []
    if battery_gross != "N/A":
        info_lines.append(f"Gross Capacity: {battery_gross} kWh")
    if battery_usable != "N/A":
        info_lines.append(f"Usable Capacity: {battery_usable} kWh")
    if wltp_range:
        info_lines.append(f"WLTP Range (new): {wltp_range} miles")
    if ac_charge != "N/A" and dc_charge != "N/A":
        info_lines.append(f"Charge Rate: {ac_charge} kW AC / {dc_charge} kW DC")
    elif ac_charge != "N/A":
        info_lines.append(f"AC Charge Rate: {ac_charge} kW")
    elif dc_charge != "N/A":
        info_lines.append(f"DC Charge Rate: {dc_charge} kW")

    info_y = baseline + 54
    for line in info_lines:
        c.drawString(info_x, info_y, line)
        info_y -= 16
    c.restoreState()

    # RIGHT: Bosch logo + label — bottom-aligned
    bosch_x = PAGE_W - MARGIN - 180
    bosch_path = data.get("bosch_logo", "")
    bosch_drawn = False
    if bosch_path and os.path.exists(bosch_path):
        try:
            bosch_img = _prepare_bosch_logo(bosch_path, "#F5F5F5")
            if bosch_img:
                c.drawImage(bosch_img, bosch_x + 10, baseline + 24,
                            width=140, height=60,
                            preserveAspectRatio=True)
                bosch_drawn = True
        except Exception:
            pass
    if not bosch_drawn:
        c.saveState()
        c.setFont("Helvetica-Bold", 13)
        c.setFillColor(DARK_CHARCOAL)
        c.drawString(bosch_x + 20, baseline + 42, "BOSCH KTS 590")
        c.setFont("Helvetica", 9)
        c.setFillColor(TEXT_GREY)
        c.drawString(bosch_x + 20, baseline + 26, "ESItronic 2.0")
        c.restoreState()

    c.saveState()
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(DARK_CHARCOAL)
    c.drawCentredString(bosch_x + 80, baseline + 8, "KTS 590 / ESItronic 2.0")
    c.restoreState()

    # ══════════════════════════════════════════════════════════════
    # BOTTOM ROW: Warranty (left) + Range Table (right)
    # ══════════════════════════════════════════════════════════════
    y = status_y - gap

    # Split into two columns
    col_gap = 16
    left_w = CONTENT_W * 0.38
    right_w = CONTENT_W - left_w - col_gap
    right_x = MARGIN + left_w + col_gap

    # Use the larger of warranty_h and range_h for both cards
    card_h = max(warranty_h, range_h)
    # But don't exceed available space
    max_card_h = y - content_bottom
    card_h = min(card_h, max_card_h)

    # ── LEFT: Battery Warranty Card ──────────────────────────────
    w_y = y - card_h
    _draw_rounded_rect(c, MARGIN, w_y, left_w, card_h,
                       r=BOX_RADIUS, fill_color=LIGHT_GREY,
                       stroke_color=MID_GREY, stroke_width=0.3)

    warranty_status = data.get("warranty_status", "Unknown")
    warranty_years = data.get("warranty_years", 8)
    warranty_miles = data.get("warranty_miles", 100000)
    warranty_soh_thresh = data.get("warranty_soh_threshold", 70)
    mileage = data.get("mileage", 0)
    first_registered = data.get("first_registered", "")

    # Heading
    c.saveState()
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(DARK_CHARCOAL)
    c.drawString(MARGIN + BOX_PAD, y - 18, "Battery Warranty")
    c.restoreState()

    # Status badge (matches certificate style)
    if warranty_status == "In Warranty":
        badge_color = AZ_GREEN
    elif warranty_status == "Expired":
        badge_color = HexColor("#E8602C")
    else:
        badge_color = TEXT_GREY

    badge_text = warranty_status.upper()
    c.saveState()
    tw = c.stringWidth(badge_text, "Helvetica-Bold", 7.5) + 14
    badge_x = MARGIN + left_w - BOX_PAD - tw
    _draw_rounded_rect(c, badge_x, y - 22, tw, 16, r=4, fill_color=badge_color)
    c.setFont("Helvetica-Bold", 7.5)
    c.setFillColor(WHITE)
    c.drawString(badge_x + 7, y - 17, badge_text)
    c.restoreState()

    # Warranty terms
    c.saveState()
    c.setFont("Helvetica", 7.5)
    c.setFillColor(TEXT_GREY)
    terms_text = f"{warranty_years} yrs / {warranty_miles:,} mi  |  SoH threshold: {warranty_soh_thresh}%"
    c.drawString(MARGIN + BOX_PAD, y - 38, terms_text)
    c.restoreState()

    # Progress bars
    reg_date = _parse_reg_date(first_registered)
    bar_w = left_w - 2 * BOX_PAD

    if reg_date and warranty_years > 0:
        now = datetime.now()
        try:
            warranty_end = reg_date.replace(year=reg_date.year + warranty_years)
        except ValueError:
            warranty_end = reg_date.replace(year=reg_date.year + warranty_years, day=28)

        if now < warranty_end:
            remaining_days = (warranty_end - now).days
            rem_years = remaining_days // 365
            rem_months = (remaining_days % 365) // 30
            time_text = f"{rem_years}y {rem_months}m remaining"
            time_fraction = (now - reg_date).days / ((warranty_end - reg_date).days or 1)
        else:
            time_text = "Expired"
            time_fraction = 1.0

        # Time bar
        c.saveState()
        c.setFont("Helvetica", 7.5)
        c.setFillColor(DARK_CHARCOAL)
        c.drawString(MARGIN + BOX_PAD, y - 54, f"Time: {time_text}")
        c.restoreState()
        _draw_progress_bar(c, MARGIN + BOX_PAD, y - 68, bar_w, 8,
                           min(1.0, time_fraction))

        # Mileage bar
        remaining_miles = max(0, warranty_miles - mileage)
        miles_text = f"{remaining_miles:,} miles remaining"
        miles_fraction = mileage / warranty_miles if warranty_miles else 1.0

        c.saveState()
        c.setFont("Helvetica", 7.5)
        c.setFillColor(DARK_CHARCOAL)
        c.drawString(MARGIN + BOX_PAD, y - 82, f"Mileage: {miles_text}")
        c.restoreState()
        _draw_progress_bar(c, MARGIN + BOX_PAD, y - 96, bar_w, 8,
                           min(1.0, miles_fraction))

        # Legend
        c.saveState()
        c.setFont("Helvetica", 6)
        c.setFillColor(TEXT_GREY)
        c.drawString(MARGIN + BOX_PAD, y - card_h + 6, "Green = used portion")
        c.restoreState()

    # ── RIGHT: Range Estimates Table ─────────────────────────────
    _draw_rounded_rect(c, right_x, w_y, right_w, card_h,
                       r=BOX_RADIUS, fill_color=WHITE,
                       stroke_color=MID_GREY, stroke_width=0.5)

    # Heading
    c.saveState()
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(DARK_CHARCOAL)
    c.drawString(right_x + BOX_PAD, y - 18, "Range Estimates (Miles)")
    c.restoreState()

    # Table header
    # Column positions (relative to right_x)
    inner_w = right_w - 2 * BOX_PAD
    col_scenario_x = right_x + BOX_PAD
    col_new_x = right_x + BOX_PAD + inner_w * 0.45
    col_current_x = right_x + BOX_PAD + inner_w * 0.65
    col_diff_x = right_x + BOX_PAD + inner_w * 0.85

    th_y = y - 34
    c.saveState()
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(TEXT_GREY)
    c.drawString(col_scenario_x, th_y, "Scenario")
    c.drawString(col_new_x, th_y, "When New")
    c.drawString(col_current_x, th_y, f"At {soh}% SoH")
    c.drawString(col_diff_x, th_y, "Difference")
    c.restoreState()

    # Divider line
    c.saveState()
    c.setStrokeColor(MID_GREY)
    c.setLineWidth(0.5)
    c.line(col_scenario_x, th_y - 6,
           right_x + right_w - BOX_PAD, th_y - 6)
    c.restoreState()

    # Range data
    range_best_new = ranges.get("best_new", 0)
    range_typical_new = ranges.get("typical_new", 0)
    range_worst_new = ranges.get("worst_new", 0)
    range_best_cur = ranges.get("best_current", 0)
    range_typical_cur = ranges.get("typical_current", 0)
    range_worst_cur = ranges.get("worst_current", 0)

    scenarios = [
        ("Best Case (Urban)", range_best_new, range_best_cur, AZ_GREEN_LIGHT),
        ("Typical (Mixed Driving)", range_typical_new, range_typical_cur, LIGHT_GREY),
        ("Worst Case (Winter Mway)", range_worst_new, range_worst_cur, AZ_GREEN_LIGHT),
    ]

    ry = th_y - 22
    row_h = 22
    for label, new_val, cur_val, bg in scenarios:
        diff = cur_val - new_val

        # Row background
        c.saveState()
        c.setFillColor(bg)
        c.rect(right_x + 6, ry - 4, right_w - 12, row_h, fill=1, stroke=0)
        c.restoreState()

        # Row text
        c.saveState()
        c.setFont("Helvetica", 8)
        c.setFillColor(DARK_CHARCOAL)
        c.drawString(col_scenario_x, ry + 2, label)

        c.setFont("Helvetica-Bold", 8.5)
        c.drawString(col_new_x, ry + 2, f"{new_val} mi")

        soh_col = AZ_GREEN if grade in ("Excellent", "Good") else HexColor("#E8602C")
        c.setFillColor(soh_col)
        c.drawString(col_current_x, ry + 2, f"{cur_val} mi")

        c.setFont("Helvetica", 8)
        c.setFillColor(TEXT_GREY)
        c.drawString(col_diff_x, ry + 2, f"{diff} mi")
        c.restoreState()

        ry -= (row_h + 4)

    # ── Finish PDF ────────────────────────────────────────────────
    c.showPage()
    c.save()
    pdf_bytes = pdf_buf.getvalue()

    # ── Convert PDF to PNG via PyMuPDF ────────────────────────────
    _pdf_to_png(pdf_bytes, output_path, target_w=1024, target_h=768)

    return output_path


def _pdf_to_png(pdf_bytes: bytes, output_path: str,
                target_w: int = 1024, target_h: int = 768):
    """Convert a single-page PDF (as bytes) to a PNG image using PyMuPDF."""
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page = doc[0]

        zoom_x = target_w / page.rect.width
        zoom_y = target_h / page.rect.height
        zoom = max(zoom_x, zoom_y)

        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, alpha=False)

        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        if img.size != (target_w, target_h):
            img = img.resize((target_w, target_h), Image.LANCZOS)

        img.save(output_path, "PNG")
        doc.close()
        return True
    except ImportError:
        return _pdf_to_png_sips(pdf_bytes, output_path, target_w, target_h)
    except Exception as e:
        print(f"[AutoTrader Image] PyMuPDF conversion failed: {e}")
        return _pdf_to_png_sips(pdf_bytes, output_path, target_w, target_h)


def _pdf_to_png_sips(pdf_bytes: bytes, output_path: str,
                     target_w: int = 1024, target_h: int = 768):
    """Fallback: convert PDF to PNG using macOS sips command."""
    import subprocess
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(pdf_bytes)
            tmp_pdf = tmp.name

        tmp_png = tmp_pdf.replace(".pdf", ".png")
        subprocess.run(
            ["sips", "-s", "format", "png",
             "-z", str(target_h), str(target_w),
             tmp_pdf, "--out", tmp_png],
            capture_output=True, timeout=30,
        )
        if os.path.exists(tmp_png):
            import shutil
            shutil.move(tmp_png, output_path)
            os.unlink(tmp_pdf)
            return True
        os.unlink(tmp_pdf)
    except Exception as e:
        print(f"[AutoTrader Image] sips fallback failed: {e}")
    return False
