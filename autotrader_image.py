"""
Auto Trader advert image generator for AZ Autos EV Battery Health Certificate.
Uses ReportLab to render a high-quality single-page PDF, then converts to
1024x768 PNG via PyMuPDF for uploading as a photo in an Auto Trader listing.

Design matches the certificate PDF (page 1) visual language:
  - Green header bar with AZ Autos logo, title, ref/date
  - Grey SoH card with gauge, battery status info, Bosch logo
  - Warranty card with badge, progress bars
  - Range estimates table with 3 scenarios
  - Assessment summary with AI narrative
  - Approval stamp (SoH >= 75%)
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
BOX_PAD = 14


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
    c.setLineWidth(18)
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
    c.setLineWidth(18)
    c.setLineCap(1)
    for i in range(0, min(sweep, 180), 2):
        a1 = math.radians(180 - i)
        a2 = math.radians(180 - i - 2)
        c.line(cx + radius * math.cos(a1), cy + radius * math.sin(a1),
               cx + radius * math.cos(a2), cy + radius * math.sin(a2))
    c.restoreState()

    # SoH text inside gauge
    c.saveState()
    c.setFont("Helvetica-Bold", 36)
    c.setFillColor(DARK_CHARCOAL)
    c.drawCentredString(cx, cy - 4, f"{soh}%")
    c.setFont("Helvetica", 11)
    c.setFillColor(TEXT_GREY)
    c.drawCentredString(cx, cy - 20, "State of Health")
    c.restoreState()

    # Grade label below gauge
    c.saveState()
    c.setFont("Helvetica-Bold", 16)
    c.setFillColor(grade_colour)
    c.drawCentredString(cx, cy - 44, grade.upper())
    c.restoreState()


def _draw_approval_stamp(c, cx, cy, radius, soh):
    """Draw a rotated circular approval stamp at (cx, cy)."""
    c.saveState()
    c.translate(cx, cy)
    c.rotate(-15)  # slight tilt like a physical stamp

    # Outer ring
    c.setStrokeColor(AZ_GREEN)
    c.setLineWidth(3.5)
    c.setFillColor(HexColor("#FFFFFF"))
    c.circle(0, 0, radius, fill=1, stroke=1)

    # Inner ring
    c.setLineWidth(1.5)
    c.circle(0, 0, radius - 6, fill=0, stroke=1)

    # "AZ AUTOS" curved around the top
    c.setFillColor(AZ_GREEN)
    c.setFont("Helvetica-Bold", 11)
    top_text = "AZ AUTOS"
    # Draw each character along an arc at the top
    arc_radius = radius - 16
    total_angle = len(top_text) * 14  # degrees spread
    start_angle = 90 + total_angle / 2
    for i, ch in enumerate(top_text):
        angle = math.radians(start_angle - i * 14)
        tx = arc_radius * math.cos(angle)
        ty = arc_radius * math.sin(angle)
        c.saveState()
        c.translate(tx, ty)
        c.rotate(math.degrees(angle) - 90)
        c.drawCentredString(0, 0, ch)
        c.restoreState()

    # "APPROVED" bold across the centre
    c.setFont("Helvetica-Bold", 18)
    c.setFillColor(AZ_GREEN)
    c.drawCentredString(0, 2, "APPROVED")

    # SoH percentage below
    c.setFont("Helvetica-Bold", 13)
    c.setFillColor(DARK_CHARCOAL)
    c.drawCentredString(0, -16, f"{soh}% SoH")

    # "BATTERY HEALTH" curved around the bottom
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(AZ_GREEN)
    bottom_text = "BATTERY HEALTH"
    total_angle_b = len(bottom_text) * 12
    start_angle_b = 270 - total_angle_b / 2
    for i, ch in enumerate(bottom_text):
        angle = math.radians(start_angle_b + i * 12)
        tx = arc_radius * math.cos(angle)
        ty = arc_radius * math.sin(angle)
        c.saveState()
        c.translate(tx, ty)
        c.rotate(math.degrees(angle) + 90)
        c.drawCentredString(0, 0, ch)
        c.restoreState()

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


def _wrap_text(c, text, font_name, font_size, max_width):
    """Word-wrap text to fit within max_width, returning a list of lines."""
    words = text.split()
    lines = []
    current = ""
    for word in words:
        test = f"{current} {word}".strip()
        if c.stringWidth(test, font_name, font_size) <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


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
    header_h = 72
    header_y = PAGE_H - header_h

    c.saveState()
    c.setFillColor(AZ_GREEN)
    c.rect(0, header_y, PAGE_W, header_h, fill=1, stroke=0)
    c.restoreState()

    # AZ Autos logo (left) — larger
    logo_path = data.get("logo_white", "")
    logo_drawn = False
    if logo_path and os.path.exists(logo_path):
        logo_img = _prepare_logo_for_green_bg(logo_path)
        if logo_img:
            try:
                c.drawImage(logo_img, MARGIN, header_y + 8,
                            width=130, height=header_h - 16,
                            preserveAspectRatio=True, mask='auto')
                logo_drawn = True
            except Exception:
                pass
    if not logo_drawn:
        c.saveState()
        c.setFont("Helvetica-Bold", 22)
        c.setFillColor(WHITE)
        c.drawString(MARGIN, header_y + 26, "AZ AUTOS")
        c.restoreState()

    # Title (centre) — scaled up
    c.saveState()
    c.setFont("Helvetica-Bold", 20)
    c.setFillColor(WHITE)
    c.drawCentredString(PAGE_W / 2, header_y + 38, "EV Battery Health Certificate")
    c.setFont("Helvetica", 10)
    c.setFillColor(HexColor("#FFFFFFCC"))
    c.drawCentredString(PAGE_W / 2, header_y + 20, "Tested with Bosch KTS 590 / ESItronic 2.0")
    c.restoreState()

    # Cert ref and date (right) — scaled up
    c.saveState()
    c.setFont("Helvetica", 10)
    c.setFillColor(WHITE)
    c.drawRightString(PAGE_W - MARGIN, header_y + 42, f"Ref: {cert_ref}")
    c.drawRightString(PAGE_W - MARGIN, header_y + 26, f"Issued: {issue_date}")
    c.restoreState()

    # ══════════════════════════════════════════════════════════════
    # FOOTER — Light grey bar (matches certificate _draw_footer)
    # ══════════════════════════════════════════════════════════════
    footer_h = 40
    c.saveState()
    c.setFillColor(LIGHT_GREY)
    c.rect(0, 0, PAGE_W, footer_h, fill=1, stroke=0)
    c.setStrokeColor(MID_GREY)
    c.setLineWidth(0.5)
    c.line(0, footer_h, PAGE_W, footer_h)
    c.restoreState()

    c.saveState()
    c.setFont("Helvetica", 9)
    c.setFillColor(TEXT_GREY)
    c.drawString(MARGIN, 18, f"Ref: {cert_ref}  |  {issue_date}")
    c.setFont("Helvetica", 8)
    c.drawCentredString(PAGE_W / 2, 7,
                        "All data shown on this report is for informational purposes only")
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(AZ_GREEN)
    c.drawRightString(PAGE_W - MARGIN, 18, "azautos.co.uk")
    c.restoreState()

    # ══════════════════════════════════════════════════════════════
    # LAYOUT GEOMETRY — evenly distributed sections
    # ══════════════════════════════════════════════════════════════
    content_top = header_y
    content_bottom = footer_h
    available_h = content_top - content_bottom

    # Fixed section heights
    status_h = 150                    # SoH gauge + battery info card
    mid_row_h = 118                   # warranty + range row (taller for bigger fonts)
    # Narrative gets remaining space after sections and 4 equal gaps
    total_sections_h = status_h + mid_row_h
    remaining = available_h - total_sections_h
    # Narrative takes up a fair share; rest is gaps
    narrative_h = max(remaining * 0.55, 80)
    total_gap = remaining - narrative_h
    gap = total_gap / 4  # 4 equal gaps

    y = content_top - gap

    # ══════════════════════════════════════════════════════════════
    # BATTERY STATUS SECTION — Grey card with gauge, info, Bosch logo
    # (matches certificate Battery Status section)
    # ══════════════════════════════════════════════════════════════
    status_y = y - status_h
    _draw_rounded_rect(c, MARGIN, status_y, CONTENT_W, status_h,
                       r=BOX_RADIUS, fill_color=LIGHT_GREY,
                       stroke_color=MID_GREY, stroke_width=0.3)

    # Three-column layout: gauge | info | bosch — evenly spaced, vertically centred
    box_mid_y = status_y + status_h / 2  # vertical midpoint of the card

    # Divide CONTENT_W into 3 equal zones
    zone_w = CONTENT_W / 3
    zone1_cx = MARGIN + zone_w * 0.5          # centre of left zone (gauge)
    zone2_x = MARGIN + zone_w + BOX_PAD       # left edge of centre zone (info text)
    zone3_cx = MARGIN + zone_w * 2.5          # centre of right zone (bosch)

    # LEFT: SoH Gauge — vertically centred in box
    # Gauge visual extent: top of arc = cy + radius, bottom of grade label = cy - 44
    # Total visual height ≈ radius + 44. Centre that within the box.
    gauge_r = 54
    gauge_visual_h = gauge_r + 44
    gauge_cx = zone1_cx
    gauge_cy = box_mid_y + (gauge_visual_h / 2 - 44)  # centre the visual block
    _draw_soh_gauge(c, gauge_cx, gauge_cy, gauge_r, soh, grade)

    # CENTRE: Battery Status info — vertically centred in zone 2
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

    heading_h = 16  # heading font height
    heading_gap = 14  # space between heading and first data line
    line_spacing = 18
    total_info_h = heading_h + heading_gap + len(info_lines) * line_spacing
    info_top_y = box_mid_y + total_info_h / 2

    c.saveState()
    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(DARK_CHARCOAL)
    c.drawString(zone2_x, info_top_y - heading_h, "Battery Status")
    c.setFont("Helvetica", 11)
    c.setFillColor(TEXT_GREY)
    info_y = info_top_y - heading_h - heading_gap
    for line in info_lines:
        c.drawString(zone2_x, info_y, line)
        info_y -= line_spacing
    c.restoreState()

    # RIGHT: Bosch logo + label — centred in zone 3
    bosch_path = data.get("bosch_logo", "")
    bosch_drawn = False
    bosch_logo_w = 160
    bosch_logo_h = 70
    bosch_label_h = 14
    bosch_total_h = bosch_logo_h + 4 + bosch_label_h
    bosch_top_y = box_mid_y + bosch_total_h / 2
    bosch_img_x = zone3_cx - bosch_logo_w / 2

    if bosch_path and os.path.exists(bosch_path):
        try:
            bosch_img = _prepare_bosch_logo(bosch_path, "#F5F5F5")
            if bosch_img:
                c.drawImage(bosch_img, bosch_img_x, bosch_top_y - bosch_logo_h,
                            width=bosch_logo_w, height=bosch_logo_h,
                            preserveAspectRatio=True)
                bosch_drawn = True
        except Exception:
            pass
    if not bosch_drawn:
        c.saveState()
        c.setFont("Helvetica-Bold", 16)
        c.setFillColor(DARK_CHARCOAL)
        c.drawCentredString(zone3_cx, bosch_top_y - 24, "BOSCH KTS 590")
        c.setFont("Helvetica", 11)
        c.setFillColor(TEXT_GREY)
        c.drawCentredString(zone3_cx, bosch_top_y - 42, "ESItronic 2.0")
        c.restoreState()

    c.saveState()
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(DARK_CHARCOAL)
    c.drawCentredString(zone3_cx, bosch_top_y - bosch_logo_h - 6 - bosch_label_h, "KTS 590 / ESItronic 2.0")
    c.restoreState()

    # ══════════════════════════════════════════════════════════════
    # MIDDLE ROW: Warranty (left) + Range Table (right)
    # ══════════════════════════════════════════════════════════════
    y = status_y - gap
    card_h = mid_row_h

    # Split into two columns
    col_gap = 14
    left_w = CONTENT_W * 0.38
    right_w = CONTENT_W - left_w - col_gap
    right_x = MARGIN + left_w + col_gap

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

    # Heading — scaled up
    c.saveState()
    c.setFont("Helvetica-Bold", 13)
    c.setFillColor(DARK_CHARCOAL)
    c.drawString(MARGIN + BOX_PAD, y - 18, "Battery Warranty")
    c.restoreState()

    # Status badge (matches certificate style) — scaled up
    if warranty_status == "In Warranty":
        badge_color = AZ_GREEN
    elif warranty_status == "Expired":
        badge_color = HexColor("#E8602C")
    else:
        badge_color = TEXT_GREY

    badge_text = warranty_status.upper()
    c.saveState()
    tw = c.stringWidth(badge_text, "Helvetica-Bold", 9.5) + 16
    badge_x = MARGIN + left_w - BOX_PAD - tw
    _draw_rounded_rect(c, badge_x, y - 22, tw, 18, r=4, fill_color=badge_color)
    c.setFont("Helvetica-Bold", 9.5)
    c.setFillColor(WHITE)
    c.drawString(badge_x + 8, y - 17, badge_text)
    c.restoreState()

    # Warranty terms — scaled up
    c.saveState()
    c.setFont("Helvetica", 9.5)
    c.setFillColor(TEXT_GREY)
    terms_text = f"{warranty_years} yrs / {warranty_miles:,} mi  |  SoH threshold: {warranty_soh_thresh}%"
    c.drawString(MARGIN + BOX_PAD, y - 36, terms_text)
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

        # Time bar — scaled up labels
        c.saveState()
        c.setFont("Helvetica", 9.5)
        c.setFillColor(DARK_CHARCOAL)
        c.drawString(MARGIN + BOX_PAD, y - 52, f"Time: {time_text}")
        c.restoreState()
        _draw_progress_bar(c, MARGIN + BOX_PAD, y - 64, bar_w, 8,
                           min(1.0, time_fraction))

        # Mileage bar
        remaining_miles = max(0, warranty_miles - mileage)
        miles_text = f"{remaining_miles:,} miles remaining"
        miles_fraction = mileage / warranty_miles if warranty_miles else 1.0

        c.saveState()
        c.setFont("Helvetica", 9.5)
        c.setFillColor(DARK_CHARCOAL)
        c.drawString(MARGIN + BOX_PAD, y - 80, f"Mileage: {miles_text}")
        c.restoreState()
        _draw_progress_bar(c, MARGIN + BOX_PAD, y - 92, bar_w, 8,
                           min(1.0, miles_fraction))

        # Legend — scaled up
        c.saveState()
        c.setFont("Helvetica", 7.5)
        c.setFillColor(TEXT_GREY)
        c.drawString(MARGIN + BOX_PAD, w_y + 5, "Green = used portion")
        c.restoreState()

    # ── RIGHT: Range Estimates Table ─────────────────────────────
    _draw_rounded_rect(c, right_x, w_y, right_w, card_h,
                       r=BOX_RADIUS, fill_color=WHITE,
                       stroke_color=MID_GREY, stroke_width=0.5)

    # Heading — scaled up
    c.saveState()
    c.setFont("Helvetica-Bold", 13)
    c.setFillColor(DARK_CHARCOAL)
    c.drawString(right_x + BOX_PAD, y - 18, "Range Estimates (Miles)")
    c.restoreState()

    # Table header — column positions, scaled up fonts
    inner_w = right_w - 2 * BOX_PAD
    col_scenario_x = right_x + BOX_PAD
    col_new_x = right_x + BOX_PAD + inner_w * 0.45
    col_current_x = right_x + BOX_PAD + inner_w * 0.65
    col_diff_x = right_x + BOX_PAD + inner_w * 0.85

    th_y = y - 36
    c.saveState()
    c.setFont("Helvetica-Bold", 10)
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
        ("Typical (Mixed)", range_typical_new, range_typical_cur, LIGHT_GREY),
        ("Worst Case (Winter Mway)", range_worst_new, range_worst_cur, AZ_GREEN_LIGHT),
    ]

    ry = th_y - 22
    row_h = 22
    for label, new_val, cur_val, bg in scenarios:
        diff = cur_val - new_val

        # Row background
        c.saveState()
        c.setFillColor(bg)
        c.rect(right_x + 6, ry - 3, right_w - 12, row_h, fill=1, stroke=0)
        c.restoreState()

        # Row text — scaled up
        c.saveState()
        c.setFont("Helvetica", 10)
        c.setFillColor(DARK_CHARCOAL)
        c.drawString(col_scenario_x, ry + 2, label)

        c.setFont("Helvetica-Bold", 11)
        c.drawString(col_new_x, ry + 2, f"{new_val} mi")

        soh_col = AZ_GREEN if grade in ("Excellent", "Good") else HexColor("#E8602C")
        c.setFillColor(soh_col)
        c.drawString(col_current_x, ry + 2, f"{cur_val} mi")

        c.setFont("Helvetica", 10)
        c.setFillColor(TEXT_GREY)
        c.drawString(col_diff_x, ry + 2, f"{diff} mi")
        c.restoreState()

        ry -= (row_h + 3)

    # ══════════════════════════════════════════════════════════════
    # ASSESSMENT SUMMARY — Full-width grey card, dynamic height
    # ══════════════════════════════════════════════════════════════
    y = w_y - gap

    # Pre-calculate narrative text to determine dynamic box height
    narrative = data.get("narrative", "")
    narr_font = "Helvetica"
    narr_size = 14
    line_height = narr_size + 4.5  # 18.5pt line spacing for 14pt text
    narr_max_w = CONTENT_W - 2 * BOX_PAD

    heading_zone = 24   # heading row height
    text_start = 38     # offset from card top to first text line
    bottom_pad = 14     # padding below last line

    if narrative:
        narr_lines = _wrap_text(c, narrative, narr_font, narr_size, narr_max_w)
        # Limit to what fits above the footer
        max_available_h = y - content_bottom - gap - 10  # leave room for stamp
        max_lines = int((max_available_h - text_start - bottom_pad) / line_height)
        truncated = len(narr_lines) > max_lines
        if truncated:
            narr_lines = narr_lines[:max_lines]
            # Extra line for truncation text
            narr_card_h = text_start + len(narr_lines) * line_height + line_height + bottom_pad
        else:
            narr_card_h = text_start + len(narr_lines) * line_height + bottom_pad
    else:
        narr_lines = []
        truncated = False
        narr_card_h = 60  # minimum empty card

    _draw_rounded_rect(c, MARGIN, y - narr_card_h, CONTENT_W, narr_card_h,
                       r=BOX_RADIUS, fill_color=LIGHT_GREY,
                       stroke_color=MID_GREY, stroke_width=0.3)

    # Heading
    c.saveState()
    c.setFont("Helvetica-Bold", 13)
    c.setFillColor(DARK_CHARCOAL)
    c.drawString(MARGIN + BOX_PAD, y - 18, "Assessment Summary")
    c.restoreState()

    # Charging compatibility — light green pill badge, right-aligned in heading row
    ac_connector = data.get("ac_connector", "Not available")
    dc_connector = data.get("dc_connector", "Not available")
    if ac_connector != "Not available" or dc_connector != "Not available":
        charging_text = f"AC: {ac_connector} — {ac_charge} kW  |  DC: {dc_connector} — {dc_charge} kW"
        c.saveState()
        c.setFont("Helvetica-Bold", 10)
        charging_badge_w = c.stringWidth(charging_text, "Helvetica-Bold", 10) + 20
        badge_pill_x = MARGIN + CONTENT_W - BOX_PAD - charging_badge_w
        badge_pill_y = y - 22
        _draw_rounded_rect(c, badge_pill_x, badge_pill_y, charging_badge_w, 18,
                           r=4, fill_color=AZ_GREEN_LIGHT)
        c.setFillColor(DARK_CHARCOAL)
        c.drawString(badge_pill_x + 10, badge_pill_y + 4, charging_text)
        c.restoreState()

    # Narrative text
    if narr_lines:
        c.saveState()
        c.setFont(narr_font, narr_size)
        c.setFillColor(DARK_CHARCOAL)
        ny = y - text_start
        for line in narr_lines:
            c.drawString(MARGIN + BOX_PAD, ny, line)
            ny -= line_height
        c.restoreState()

        if truncated:
            c.saveState()
            c.setFont("Helvetica-Oblique", 11)
            c.setFillColor(TEXT_GREY)
            c.drawString(MARGIN + BOX_PAD, ny, "... See full certificate for details")
            c.restoreState()

    narr_card_bottom = y - narr_card_h

    # ══════════════════════════════════════════════════════════════
    # APPROVAL STAMP — below assessment box, on white background
    # Only for SoH >= 75%
    # ══════════════════════════════════════════════════════════════
    if soh >= 75:
        stamp_radius = 52
        # Centre stamp vertically between assessment box bottom and footer top
        stamp_space = narr_card_bottom - content_bottom
        stamp_cx = PAGE_W - MARGIN - stamp_radius - 20
        stamp_cy = narr_card_bottom - stamp_space / 2
        # Clamp so it doesn't overlap footer or assessment box
        stamp_cy = max(content_bottom + stamp_radius + 4, stamp_cy)
        stamp_cy = min(narr_card_bottom - stamp_radius - 4, stamp_cy)
        _draw_approval_stamp(c, stamp_cx, stamp_cy, stamp_radius, soh)

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
