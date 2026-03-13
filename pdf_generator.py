"""
PDF Certificate Generator for AZ Autos EV Battery Health Certificates.
Produces a 3-page A4 PDF using ReportLab with fixed coordinates.
"""

import os
import io
import math
import requests
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from PIL import Image

# ── Colour palette ──────────────────────────────────────────────────
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
    "Good": HexColor("#7BC67E"),
    "Fair": HexColor("#F5A623"),
    "Poor": HexColor("#E8602C"),
    "Critical": HexColor("#D0021B"),
}

PAGE_W, PAGE_H = A4  # 595.28 x 841.89 points
MARGIN = 36
CONTENT_W = PAGE_W - 2 * MARGIN
BOX_RADIUS = 8
BOX_PAD = 12


def _get_soh_grade(soh: float) -> str:
    if soh >= 90:
        return "Excellent"
    elif soh >= 80:
        return "Good"
    elif soh >= 70:
        return "Fair"
    elif soh >= 60:
        return "Poor"
    else:
        return "Critical"


def _draw_rounded_rect(c, x, y, w, h, r=BOX_RADIUS, fill_color=None, stroke_color=None, stroke_width=0.5):
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


def _wrap_text(c, text, font_name, font_size, max_width):
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


def _prepare_logo_for_green_bg(logo_path):
    """Crop Az-02.png (white logo on green bg) to just the logo mark,
    then make the green background transparent so it blends on any green header."""
    try:
        import numpy as np
        img = Image.open(logo_path).convert("RGBA")
        data = np.array(img)
        r, g, b, a = data[:, :, 0], data[:, :, 1], data[:, :, 2], data[:, :, 3]

        # Identify the green background pixels (rgb ≈ 28,152,74)
        is_green = (r < 100) & (g > 100) & (b < 160) & (a > 128)
        is_content = ~is_green & (a > 30)

        # Find bounding box of non-green content
        rows = np.any(is_content, axis=1)
        cols = np.any(is_content, axis=0)
        if not (np.any(rows) and np.any(cols)):
            return None
        rmin, rmax = np.where(rows)[0][[0, -1]]
        cmin, cmax = np.where(cols)[0][[0, -1]]

        # Add a small margin around the content
        pad = 10
        rmin = max(0, rmin - pad)
        rmax = min(data.shape[0] - 1, rmax + pad)
        cmin = max(0, cmin - pad)
        cmax = min(data.shape[1] - 1, cmax + pad)

        # Crop to content
        cropped = data[rmin:rmax + 1, cmin:cmax + 1].copy()

        # Make green pixels fully transparent
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
    """Load the Bosch logo (JPG or PNG), crop whitespace, and composite
    onto the card background colour for a clean render."""
    try:
        import numpy as np
        img = Image.open(logo_path).convert("RGB")
        data = np.array(img)
        r, g, b = data[:, :, 0], data[:, :, 1], data[:, :, 2]
        # Find non-white content pixels (anything not near-white)
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
        # Replace white border areas with the card background colour
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


def _draw_soh_gauge(c, cx, cy, radius, soh, grade):
    grade_colour = GRADE_COLOURS.get(grade, AZ_GREEN)

    # Background arc
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

    # Coloured arc
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

    # SoH text
    c.saveState()
    c.setFont("Helvetica-Bold", 26)
    c.setFillColor(DARK_CHARCOAL)
    c.drawCentredString(cx, cy - 2, f"{soh}%")
    c.setFont("Helvetica", 9)
    c.setFillColor(TEXT_GREY)
    c.drawCentredString(cx, cy - 16, "State of Health")
    c.restoreState()

    # Grade label
    c.saveState()
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(grade_colour)
    c.drawCentredString(cx, cy - 38, grade.upper())
    c.restoreState()


def _draw_header(c, page_num, total_pages, cert_ref, issue_date, logo_path=None):
    """Green header bar. Uses Az-02.png cropped and green-removed for seamless placement."""
    bar_h = 62
    c.saveState()
    c.setFillColor(AZ_GREEN)
    c.rect(0, PAGE_H - bar_h, PAGE_W, bar_h, fill=1, stroke=0)

    # Logo — convert Az-03 green to white for green background
    logo_drawn = False
    if logo_path and os.path.exists(logo_path):
        logo_img = _prepare_logo_for_green_bg(logo_path)
        if logo_img:
            try:
                c.drawImage(logo_img, MARGIN, PAGE_H - bar_h + 8,
                            width=88, height=bar_h - 16,
                            preserveAspectRatio=True, mask='auto')
                logo_drawn = True
            except Exception:
                pass
    if not logo_drawn:
        c.setFont("Helvetica-Bold", 16)
        c.setFillColor(WHITE)
        c.drawString(MARGIN, PAGE_H - 40, "AZ AUTOS")

    # Title
    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(WHITE)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 30, "EV Battery Health Certificate")

    # Subtitle
    c.setFont("Helvetica", 7.5)
    c.setFillColor(HexColor("#FFFFFFCC"))
    c.drawCentredString(PAGE_W / 2, PAGE_H - 45, "Tested with Bosch KTS 590 / ESItronic 2.0")

    # Cert ref and date
    c.setFont("Helvetica", 7.5)
    c.setFillColor(WHITE)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 27, f"Ref: {cert_ref}")
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 40, f"Issued: {issue_date}")

    c.restoreState()


def _draw_footer(c, page_num, total_pages, cert_ref, reg_number, issue_date):
    footer_h = 36
    c.saveState()
    c.setFillColor(LIGHT_GREY)
    c.rect(0, 0, PAGE_W, footer_h, fill=1, stroke=0)
    c.setStrokeColor(MID_GREY)
    c.setLineWidth(0.5)
    c.line(0, footer_h, PAGE_W, footer_h)

    c.setFont("Helvetica", 7)
    c.setFillColor(TEXT_GREY)
    c.drawString(MARGIN, 18, f"Ref: {cert_ref}  |  Reg: {reg_number}  |  {issue_date}")

    c.setFont("Helvetica", 6)
    c.drawCentredString(PAGE_W / 2, 7, "All data shown on this report is for informational purposes only")

    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(AZ_GREEN)
    c.drawRightString(PAGE_W - MARGIN, 18, f"{page_num}/{total_pages}")
    c.setFont("Helvetica", 7)
    c.setFillColor(TEXT_GREY)
    c.drawRightString(PAGE_W - MARGIN, 7, "AZ Autos")

    c.restoreState()


def _draw_reg_plate(c, x, y, reg_number):
    plate_w = 175
    plate_h = 34
    _draw_rounded_rect(c, x, y, plate_w, plate_h, r=4,
                       fill_color=WHITE, stroke_color=DARK_CHARCOAL, stroke_width=1.5)
    c.saveState()
    c.setFont("Helvetica-Bold", 19)
    c.setFillColor(DARK_CHARCOAL)
    c.drawCentredString(x + plate_w / 2, y + 9, reg_number.upper())
    c.restoreState()


def _load_vehicle_image(image_url, target_w=None, target_h=None):
    """Load vehicle image from URL, crop excess black border around the car,
    and resize with LANCZOS resampling for quality."""
    if not image_url:
        return None
    try:
        resp = requests.get(image_url, timeout=10)
        if resp.status_code == 200 and len(resp.content) > 1000:
            import numpy as np
            img = Image.open(io.BytesIO(resp.content)).convert("RGB")
            data = np.array(img)
            r, g, b = data[:, :, 0], data[:, :, 1], data[:, :, 2]
            # Find non-black content (threshold: any channel > 30)
            is_content = (r > 30) | (g > 30) | (b > 30)
            rows = np.any(is_content, axis=1)
            cols = np.any(is_content, axis=0)
            if np.any(rows) and np.any(cols):
                rmin, rmax = np.where(rows)[0][[0, -1]]
                cmin, cmax = np.where(cols)[0][[0, -1]]
                # Keep a generous border around the car
                pad = 20
                rmin = max(0, rmin - pad)
                rmax = min(data.shape[0] - 1, rmax + pad)
                cmin = max(0, cmin - pad)
                cmax = min(data.shape[1] - 1, cmax + pad)
                img = img.crop((cmin, rmin, cmax + 1, rmax + 1))
            # High-quality resize with LANCZOS if target dimensions provided
            if target_w and target_h:
                scale = min(target_w / img.width, target_h / img.height)
                new_w = int(img.width * scale)
                new_h = int(img.height * scale)
                if new_w > 0 and new_h > 0:
                    img = img.resize((new_w, new_h), Image.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format='PNG')
            buf.seek(0)
            return ImageReader(buf), img.width, img.height
    except Exception:
        pass
    return None


def _draw_table_row(c, x, y, label, value, row_w, row_h=20, bg_color=None):
    TEXT_PAD = max(BOX_PAD, 10)  # 10pt minimum text-to-box-edge
    if bg_color:
        c.saveState()
        c.setFillColor(bg_color)
        c.rect(x, y, row_w, row_h, fill=1, stroke=0)
        c.restoreState()
    c.saveState()
    c.setFont("Helvetica", 8)
    c.setFillColor(TEXT_GREY)
    c.drawString(x + TEXT_PAD, y + 6, label)
    c.setFont("Helvetica-Bold", 8.5)
    c.setFillColor(DARK_CHARCOAL)
    c.drawRightString(x + row_w - TEXT_PAD, y + 6, str(value))
    c.restoreState()


# Charge port positions as (x%, y%) on the car outline image.
# The car outline is oriented with:
#   Front = RIGHT of image,  Rear = LEFT of image
#   Car's Left = TOP of image,  Car's Right (offside UK) = BOTTOM of image
CHARGE_PORT_POSITIONS = {
    "Front Left":                (0.80, 0.25),
    "Front Centre":              (0.88, 0.50),
    "Front Right":               (0.80, 0.75),
    "Rear Left":                 (0.20, 0.25),
    "Rear Centre":               (0.12, 0.50),
    "Rear Right":                (0.20, 0.75),
    "Front Left and Rear Left":  [(0.80, 0.25), (0.20, 0.25)],
    "Rear Left and Rear Right":  [(0.20, 0.25), (0.20, 0.75)],
}


def _prepare_car_outline_with_port(outline_path, port_location, img_w=200, img_h=130):
    """Load car outline image, overlay a green dot at the charge port location.
    Dot is 10-12pt diameter, clearly visible on the car body."""
    try:
        img = Image.open(outline_path).convert("RGBA")
        from PIL import ImageDraw
        draw = ImageDraw.Draw(img)
        w, h = img.size
        # 10-12pt dot diameter → ~5-6pt radius, scaled to image pixels
        dot_r = max(8, int(min(w, h) * 0.06))

        positions = CHARGE_PORT_POSITIONS.get(port_location)
        if positions is None:
            # Return image without overlay
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            buf.seek(0)
            return ImageReader(buf)

        if isinstance(positions, tuple):
            positions = [positions]

        for px, py in positions:
            cx = int(w * px)
            cy = int(h * py)
            draw.ellipse(
                [cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r],
                fill=(44, 174, 102, 255),
                outline=(30, 140, 78, 255),
                width=2,
            )

        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return ImageReader(buf)
    except Exception:
        return None


def _draw_progress_bar(c, x, y, w, h, fraction, fill_color=None):
    """Draw a horizontal progress bar. fraction is 0.0–1.0 (used portion)."""
    if fill_color is None:
        fill_color = AZ_GREEN
    # Background
    _draw_rounded_rect(c, x, y, w, h, r=3, fill_color=MID_GREY)
    # Filled portion
    fill_w = max(0, min(w, w * fraction))
    if fill_w > 6:
        _draw_rounded_rect(c, x, y, fill_w, h, r=3, fill_color=fill_color)


def _parse_reg_date(date_str):
    """Parse a date string into a datetime, trying multiple formats."""
    if not date_str:
        return None
    for fmt in ["%d/%m/%Y", "%Y-%m-%d", "%d %B %Y", "%d-%m-%Y"]:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    return None


# ─────────────────────────────────────────────────────────────────────
def generate_certificate(data: dict, output_path: str) -> str:
    c = canvas.Canvas(output_path, pagesize=A4)
    c.setTitle(f"EV Battery Health Certificate - {data['reg_number']}")

    cert_ref = data.get("cert_ref", "AZ-0000000000")
    issue_date = data.get("issue_date", datetime.now().strftime("%d %B %Y"))
    reg = data.get("reg_number", "UNKNOWN")
    soh = data.get("soh", 0)
    grade = _get_soh_grade(soh)

    # Logo: use Az-02.png (white on green) — crop + remove green bg in _draw_header
    app_dir = os.path.dirname(os.path.abspath(__file__))
    logo_path = os.path.join(app_dir, "Az-02.png")
    if not os.path.exists(logo_path):
        logo_path = data.get("logo_white")  # fallback
    bosch_logo = data.get("bosch_logo")

    spec = data.get("ev_spec")
    if spec:
        wltp_range = spec["wltp_range_miles"]
        battery_gross = spec["battery_gross_kwh"]
        battery_usable = spec["battery_usable_kwh"]
        warranty_years = spec["warranty_years"]
        warranty_miles = spec["warranty_miles"]
        warranty_soh_thresh = spec["warranty_soh_threshold"]
        charge_ac = spec["charge_rate_ac_kw"]
        charge_dc = spec["charge_rate_dc_kw"]
    else:
        wltp_range = data.get("manual_wltp_range", 200)
        battery_gross = data.get("manual_battery_kwh", 50)
        battery_usable = round(battery_gross * 0.93, 1)
        warranty_years = 8
        warranty_miles = 100000
        warranty_soh_thresh = 70
        charge_ac = 11
        charge_dc = 50

    # Range calculations
    range_best = round(wltp_range * (soh / 100) * 0.95)
    range_typical = round(wltp_range * (soh / 100) * 0.85)
    range_worst = round(wltp_range * (soh / 100) * 0.65)
    range_new_best = round(wltp_range * 0.95)
    range_new_typical = round(wltp_range * 0.85)
    range_new_worst = round(wltp_range * 0.65)

    # Warranty status
    warranty_status = "Unable to determine"
    first_reg = data.get("first_registered", "")
    mileage = data.get("mileage", 0)
    if first_reg:
        try:
            reg_date = None
            for fmt in ["%d/%m/%Y", "%Y-%m-%d", "%d %B %Y", "%d-%m-%Y"]:
                try:
                    reg_date = datetime.strptime(first_reg.strip(), fmt)
                    break
                except ValueError:
                    continue
            if reg_date:
                years_elapsed = (datetime.now() - reg_date).days / 365.25
                if years_elapsed <= warranty_years and mileage <= warranty_miles:
                    warranty_status = "In Warranty"
                else:
                    warranty_status = "Expired"
        except (ValueError, TypeError):
            pass

    first_reg_display = data.get("first_registered_display", first_reg if first_reg else "Not available")

    # ━━━━━━━━━━━━━━━━━━━━━━ PAGE 1 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    _draw_header(c, 1, 3, cert_ref, issue_date, logo_path)
    _draw_footer(c, 1, 3, cert_ref, reg, issue_date)

    HEADER_BOTTOM = PAGE_H - 62
    FOOTER_TOP = 36
    usable_h = HEADER_BOTTOM - FOOTER_TOP

    # Extract new charging data
    ac_connector = data.get("ac_connector", "Not available")
    dc_connector = data.get("dc_connector", "Not available")
    charge_port_location = data.get("charge_port_location", "Not available")
    car_outline_path = data.get("car_outline_path")

    # Pre-calculate narrative height
    narrative = data.get("narrative", "")
    col_w = (CONTENT_W - 10) / 2
    if narrative:
        narr_lines = _wrap_text(c, narrative, "Helvetica", 7, col_w - 2 * BOX_PAD)
        narr_text_h = len(narr_lines) * 9.5
    else:
        narr_lines = []
        narr_text_h = 0

    # Consolidated warranty card height: title + badge + warranty text + progress bars + legend
    warranty_card_content_h = 14 + 6 + 14 + 12 + 14 + 12 + 12  # heading, gap, time text+bar, gap, miles text+bar, legend
    reg_date_obj = _parse_reg_date(first_reg)
    has_warranty_details = reg_date_obj and mileage
    warranty_card_h = (warranty_card_content_h + 2 * BOX_PAD) if has_warranty_details else (50 + 2 * BOX_PAD)
    actual_warranty_row_h = max(warranty_card_h, narr_text_h + 28)

    # Section heights
    vehicle_card_h = 190
    status_h = 130
    range_h = 96
    grid_card_h = 120  # height of each info card

    # Page 1: vehicle details, battery status, warranty+narrative, range estimates
    # Info cards always go to page 2
    p1_core = vehicle_card_h + status_h + actual_warranty_row_h + range_h
    remaining = usable_h - p1_core
    num_sections = 5  # gaps: top, after vehicle, after status, after warranty, after range
    gap = max(10, remaining / num_sections)

    y = HEADER_BOTTOM - gap

    # ── Left/right column widths — equal widths with 10pt gap ──
    col_gap = 10
    left_col_w = (CONTENT_W - col_gap) / 2
    right_col_w = left_col_w
    right_col_x = MARGIN + left_col_w + col_gap

    # ── Reg plate ──
    _draw_reg_plate(c, MARGIN, y - 34, reg)

    # ── Vehicle image (below reg plate, framed and aligned with left column) ──
    img_top = y - 42
    img_h = vehicle_card_h - 50
    # Draw a frame aligned with the left column (same left edge as reg plate, same right as left col)
    frame_x = MARGIN
    frame_w = left_col_w
    frame_y = img_top - img_h
    _draw_rounded_rect(c, frame_x, frame_y, frame_w, img_h,
                       r=BOX_RADIUS, fill_color=DARK_CHARCOAL, stroke_color=MID_GREY, stroke_width=0.5)
    # Pre-scale at 2x for quality then let ReportLab draw at target size
    img_pad = 4  # padding inside frame
    target_px_w = int((frame_w - 2 * img_pad) * 2)
    target_px_h = int((img_h - 2 * img_pad) * 2)
    vehicle_result = _load_vehicle_image(data.get("vehicle_image_url"), target_px_w, target_px_h)
    if vehicle_result:
        try:
            vehicle_img, actual_pw, actual_ph = vehicle_result
            # Calculate centred position within frame
            avail_w = frame_w - 2 * img_pad
            avail_h = img_h - 2 * img_pad
            scale = min(avail_w / actual_pw, avail_h / actual_ph)
            draw_w = actual_pw * scale
            draw_h = actual_ph * scale
            img_x = frame_x + img_pad + (avail_w - draw_w) / 2
            img_y = frame_y + img_pad + (avail_h - draw_h) / 2
            c.drawImage(vehicle_img, img_x, img_y,
                        width=draw_w, height=draw_h,
                        preserveAspectRatio=True, mask='auto')
        except Exception:
            pass

    # ── Vehicle details card (right column) ──
    card_y = y - vehicle_card_h
    _draw_rounded_rect(c, right_col_x, card_y, right_col_w, vehicle_card_h,
                       r=BOX_RADIUS, fill_color=WHITE, stroke_color=MID_GREY)

    row_h = 21
    rows = [
        ("Make / Model", f"{data.get('make', 'N/A')} {data.get('model', '')}"),
        ("Year", str(data.get("year", "N/A"))),
        ("Colour", str(data.get("colour", "N/A"))),
        ("Fuel Type", str(data.get("fuel_type", "Electric"))),
        ("VIN (last 6)", str(data.get("vin_last6", "N/A"))),
        ("Mileage at Test", f"{mileage:,}" if mileage else "N/A"),
        ("First Registered", first_reg_display),
    ]
    ry = card_y + vehicle_card_h - 40  # start rows below heading area
    for i, (label, value) in enumerate(rows):
        bg = LIGHT_GREY if i % 2 == 0 else None
        _draw_table_row(c, right_col_x, ry, label, value, right_col_w, row_h, bg)
        ry -= row_h

    # Draw heading AFTER rows so it's not covered by alternating row backgrounds
    # Header zone: card top to first row top (40 - 21 = 19pt clear).
    # Fill the header area with white to cover any row bleed, then draw heading centred
    header_zone_top = card_y + vehicle_card_h
    header_zone_bottom = card_y + vehicle_card_h - 40 + row_h  # top of first row
    header_zone_h = header_zone_top - header_zone_bottom
    c.saveState()
    c.setFillColor(WHITE)
    c.rect(right_col_x + 1, header_zone_bottom, right_col_w - 2, header_zone_h, fill=1, stroke=0)
    c.restoreState()
    # Vertically centre the 9pt heading in the header zone
    heading_baseline = header_zone_bottom + (header_zone_h - 9) / 2
    c.saveState()
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(DARK_CHARCOAL)
    c.drawString(right_col_x + BOX_PAD, heading_baseline, "Vehicle Details")
    c.restoreState()

    # ── Battery Status section (full width) ──
    y = card_y - gap
    _draw_rounded_rect(c, MARGIN, y - status_h, CONTENT_W, status_h, r=BOX_RADIUS,
                       fill_color=LIGHT_GREY, stroke_color=MID_GREY, stroke_width=0.3)

    # All three elements share the same baseline — BOX_PAD from box bottom
    box_bottom = y - status_h
    baseline = box_bottom + BOX_PAD + 10  # common bottom baseline

    # Gauge — bottom-aligned: gauge centre placed so bottom of grade label = baseline
    gauge_cx = MARGIN + 95
    gauge_cy = baseline + 38 + 12  # grade label is at cy-38, so cy = baseline + 38; +12 for label font
    _draw_soh_gauge(c, gauge_cx, gauge_cy, 42, soh, grade)

    # Battery info — bottom-aligned: lowest text line at baseline
    info_x = MARGIN + 200
    c.saveState()
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(DARK_CHARCOAL)
    c.drawString(info_x, baseline + 58, "Battery Status")
    c.setFont("Helvetica", 8)
    c.setFillColor(TEXT_GREY)
    c.drawString(info_x, baseline + 42, f"Gross Capacity: {battery_gross} kWh")
    c.drawString(info_x, baseline + 28, f"Usable Capacity: {battery_usable} kWh")
    c.drawString(info_x, baseline + 14, f"WLTP Range (new): {wltp_range} miles")
    c.drawString(info_x, baseline, f"Charge Rate: {charge_ac} kW AC / {charge_dc} kW DC")
    c.restoreState()

    # Bosch badge — right side, bottom-aligned, 2x size
    bosch_x = PAGE_W - MARGIN - 150
    bosch_drawn = False
    if bosch_logo and os.path.exists(bosch_logo):
        try:
            bosch_img_p1 = _prepare_bosch_logo(bosch_logo, "#F5F5F5")
            if bosch_img_p1:
                c.drawImage(bosch_img_p1, bosch_x, baseline + 20, width=130, height=65,
                            preserveAspectRatio=True)
                bosch_drawn = True
        except Exception:
            pass
    if not bosch_drawn:
        c.saveState()
        c.setFont("Helvetica-Bold", 12)
        c.setFillColor(DARK_CHARCOAL)
        c.drawString(bosch_x, baseline + 30, "BOSCH KTS 590")
        c.setFont("Helvetica", 9)
        c.setFillColor(TEXT_GREY)
        c.drawString(bosch_x, baseline + 14, "ESItronic 2.0")
        c.restoreState()

    c.saveState()
    c.setFont("Helvetica-Bold", 7.5)
    c.setFillColor(DARK_CHARCOAL)
    c.drawCentredString(bosch_x + 65, baseline, "KTS 590 / ESItronic 2.0")
    c.restoreState()

    # ── Consolidated Warranty + Assessment Summary row ──
    y = y - status_h - gap

    # Left card: Battery Warranty (consolidated with remaining warranty info)
    _draw_rounded_rect(c, MARGIN, y - actual_warranty_row_h, col_w, actual_warranty_row_h,
                       r=BOX_RADIUS, fill_color=LIGHT_GREY, stroke_color=MID_GREY, stroke_width=0.3)
    c.saveState()
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(DARK_CHARCOAL)
    c.drawString(MARGIN + BOX_PAD, y - 14, "Battery Warranty")

    # Status badge
    if warranty_status == "In Warranty":
        badge_color = AZ_GREEN
    elif warranty_status == "Expired":
        badge_color = HexColor("#E8602C")
    else:
        badge_color = TEXT_GREY
    badge_text = warranty_status.upper()
    tw = c.stringWidth(badge_text, "Helvetica-Bold", 7) + 12
    badge_x = MARGIN + col_w - BOX_PAD - tw
    _draw_rounded_rect(c, badge_x, y - 17, tw, 13, r=3, fill_color=badge_color)
    c.setFont("Helvetica-Bold", 7)
    c.setFillColor(WHITE)
    c.drawString(badge_x + 6, y - 14, badge_text)
    c.restoreState()

    # Warranty terms
    c.saveState()
    c.setFont("Helvetica", 7.5)
    c.setFillColor(TEXT_GREY)
    c.drawString(MARGIN + BOX_PAD, y - 30, f"Warranty: {warranty_years} years / {warranty_miles:,} miles  |  SoH threshold: {warranty_soh_thresh}%")
    c.restoreState()

    # Progress bars (if we have data)
    wy = y - 44
    if has_warranty_details:
        now = datetime.now()
        warranty_end = reg_date_obj.replace(year=reg_date_obj.year + warranty_years)
        if now < warranty_end:
            remaining_days = (warranty_end - now).days
            rem_years = remaining_days // 365
            rem_months = (remaining_days % 365) // 30
            time_text = f"{rem_years}y {rem_months}m remaining"
            time_fraction = (now - reg_date_obj).days / ((warranty_end - reg_date_obj).days or 1)
        else:
            time_text = "Expired"
            time_fraction = 1.0

        remaining_miles = max(0, warranty_miles - mileage)
        miles_text = f"{remaining_miles:,} miles remaining"
        miles_fraction = mileage / warranty_miles if warranty_miles else 1.0

        bar_w = col_w - 2 * BOX_PAD

        c.saveState()
        c.setFont("Helvetica", 7)
        c.setFillColor(DARK_CHARCOAL)
        c.drawString(MARGIN + BOX_PAD, wy, f"Time: {time_text}")
        c.restoreState()
        _draw_progress_bar(c, MARGIN + BOX_PAD, wy - 12, bar_w, 7, min(1.0, time_fraction))

        wy -= 26
        c.saveState()
        c.setFont("Helvetica", 7)
        c.setFillColor(DARK_CHARCOAL)
        c.drawString(MARGIN + BOX_PAD, wy, f"Mileage: {miles_text}")
        c.restoreState()
        _draw_progress_bar(c, MARGIN + BOX_PAD, wy - 12, bar_w, 7, min(1.0, miles_fraction))

        c.saveState()
        c.setFont("Helvetica", 6)
        c.setFillColor(TEXT_GREY)
        c.drawString(MARGIN + BOX_PAD, wy - 24, "Green = used portion")
        c.restoreState()

    # Right card: Assessment Summary
    narr_x = MARGIN + col_w + 10
    narr_w = col_w
    _draw_rounded_rect(c, narr_x, y - actual_warranty_row_h, narr_w, actual_warranty_row_h,
                       r=BOX_RADIUS, fill_color=WHITE, stroke_color=MID_GREY)
    c.saveState()
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(DARK_CHARCOAL)
    c.drawString(narr_x + BOX_PAD, y - 14, "Assessment Summary")
    c.restoreState()

    if narr_lines:
        c.saveState()
        c.setFont("Helvetica", 7)
        c.setFillColor(DARK_CHARCOAL)
        ny = y - 26
        for line in narr_lines:
            c.drawString(narr_x + BOX_PAD, ny, line)
            ny -= 9.5
        c.restoreState()

    # ── Range Estimates Table ──
    y = y - actual_warranty_row_h - gap
    _draw_rounded_rect(c, MARGIN, y - range_h, CONTENT_W, range_h,
                       r=BOX_RADIUS, fill_color=WHITE, stroke_color=MID_GREY)

    c.saveState()
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(DARK_CHARCOAL)
    c.drawString(MARGIN + BOX_PAD, y - 14, "Range Estimates (Miles)")
    c.restoreState()

    col_x = [MARGIN + BOX_PAD, MARGIN + 160, MARGIN + 280, MARGIN + 400]
    th_y = y - 28  # 6pt gap below heading
    c.saveState()
    c.setFont("Helvetica-Bold", 7.5)
    c.setFillColor(TEXT_GREY)
    c.drawString(col_x[0], th_y, "Scenario")
    c.drawString(col_x[1], th_y, "When New")
    c.drawString(col_x[2], th_y, f"At {soh}% SoH")
    c.drawString(col_x[3], th_y, "Difference")
    c.restoreState()

    c.saveState()
    c.setStrokeColor(MID_GREY)
    c.setLineWidth(0.5)
    c.line(MARGIN + BOX_PAD, th_y - 5, MARGIN + CONTENT_W - BOX_PAD, th_y - 5)
    c.restoreState()

    scenarios = [
        ("Best Case (Urban)", range_new_best, range_best, AZ_GREEN_LIGHT),
        ("Typical (Mixed Driving)", range_new_typical, range_typical, LIGHT_GREY),
        ("Worst Case (Winter Motorway)", range_new_worst, range_worst, AZ_GREEN_LIGHT),
    ]
    ry = th_y - 20
    for label, new_val, cur_val, bg in scenarios:
        diff = cur_val - new_val
        c.saveState()
        c.setFillColor(bg)
        c.rect(MARGIN + 6, ry - 3, CONTENT_W - 12, 17, fill=1, stroke=0)
        c.restoreState()

        c.saveState()
        c.setFont("Helvetica", 7.5)
        c.setFillColor(DARK_CHARCOAL)
        c.drawString(col_x[0], ry + 1, label)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(col_x[1], ry + 1, f"{new_val} miles")
        c.setFillColor(AZ_GREEN if grade in ("Excellent", "Good") else HexColor("#E8602C"))
        c.drawString(col_x[2], ry + 1, f"{cur_val} miles")
        c.setFont("Helvetica", 7.5)
        c.setFillColor(TEXT_GREY)
        c.drawString(col_x[3], ry + 1, f"{diff} miles")
        c.restoreState()
        ry -= 19

    # ── Info Row: Charging Compatibility, Clean Air, Charging Port Location ──
    def _draw_info_grid(c, y_start, grid_gap):
        """Draw 3-card info row. Returns the y position after the row."""
        gc_gap = 8
        gc_w = (CONTENT_W - 2 * gc_gap) / 3
        gc_h = grid_card_h

        # Card A — Charging Compatibility
        ax = MARGIN
        ay = y_start - gc_h
        _draw_rounded_rect(c, ax, ay, gc_w, gc_h, r=BOX_RADIUS,
                           fill_color=LIGHT_GREY, stroke_color=MID_GREY, stroke_width=0.3)
        c.saveState()
        c.setFont("Helvetica-Bold", 8.5)
        c.setFillColor(DARK_CHARCOAL)
        c.drawString(ax + BOX_PAD, ay + gc_h - 14, "Charging Compatibility")
        c.setFont("Helvetica", 7)
        c.setFillColor(TEXT_GREY)
        c.drawString(ax + BOX_PAD, ay + gc_h - 30, f"AC: {ac_connector} — {charge_ac} kW")
        c.drawString(ax + BOX_PAD, ay + gc_h - 44, f"DC: {dc_connector} — {charge_dc} kW")
        c.setFont("Helvetica", 6.5)
        c.drawString(ax + BOX_PAD, ay + gc_h - 60, f"AC connector: {ac_connector}")
        c.drawString(ax + BOX_PAD, ay + gc_h - 72, f"DC connector: {dc_connector}")
        c.restoreState()

        # Card B — Clean Air & Tax Status
        bx = MARGIN + gc_w + gc_gap
        _draw_rounded_rect(c, bx, ay, gc_w, gc_h, r=BOX_RADIUS,
                           fill_color=LIGHT_GREY, stroke_color=MID_GREY, stroke_width=0.3)
        c.saveState()
        c.setFont("Helvetica-Bold", 8.5)
        c.setFillColor(DARK_CHARCOAL)
        c.drawString(bx + BOX_PAD, ay + gc_h - 14, "Clean Air & Tax Status")

        badge_items = [("ULEZ: Exempt", ay + gc_h - 32),
                       ("CAZ: Exempt", ay + gc_h - 46),
                       ("VED: \u00a30/year", ay + gc_h - 60)]
        for btxt, by in badge_items:
            btw = c.stringWidth(btxt, "Helvetica-Bold", 6.5) + 10
            _draw_rounded_rect(c, bx + BOX_PAD, by - 2, btw, 12, r=3, fill_color=AZ_GREEN)
            c.setFont("Helvetica-Bold", 6.5)
            c.setFillColor(WHITE)
            c.drawString(bx + BOX_PAD + 5, by + 1, btxt)

        c.setFont("Helvetica", 6)
        c.setFillColor(TEXT_GREY)
        clean_air_lines = _wrap_text(c,
            "Qualifies for free entry into all UK Clean Air Zones and ULEZ.",
            "Helvetica", 6, gc_w - 2 * BOX_PAD)
        cay = ay + gc_h - 76
        for line in clean_air_lines:
            c.drawString(bx + BOX_PAD, cay, line)
            cay -= 8
        c.restoreState()

        # Card C — Charging Port Location
        dx = MARGIN + 2 * (gc_w + gc_gap)
        _draw_rounded_rect(c, dx, ay, gc_w, gc_h, r=BOX_RADIUS,
                           fill_color=LIGHT_GREY, stroke_color=MID_GREY, stroke_width=0.3)
        c.saveState()
        c.setFont("Helvetica-Bold", 8.5)
        c.setFillColor(DARK_CHARCOAL)
        c.drawString(dx + BOX_PAD, ay + gc_h - 14, "Charging Port Location")
        c.restoreState()

        # Car outline with port marker
        outline_img = None
        if car_outline_path and os.path.exists(car_outline_path):
            outline_img = _prepare_car_outline_with_port(
                car_outline_path, charge_port_location)
        if outline_img:
            try:
                img_draw_w = gc_w - 2 * BOX_PAD
                img_draw_h = gc_h - 42
                c.drawImage(outline_img, dx + BOX_PAD, ay + 16,
                            width=img_draw_w, height=img_draw_h,
                            preserveAspectRatio=True, mask='auto')
            except Exception:
                pass
        else:
            # Fallback: simple car rectangle with dot
            car_rx = dx + BOX_PAD + 5
            car_ry = ay + 18
            car_rw = gc_w - 2 * BOX_PAD - 10
            car_rh = gc_h - 56
            _draw_rounded_rect(c, car_rx, car_ry, car_rw, car_rh,
                               r=6, fill_color=WHITE, stroke_color=MID_GREY, stroke_width=0.5)
            c.saveState()
            c.setFont("Helvetica", 5.5)
            c.setFillColor(TEXT_GREY)
            c.drawCentredString(car_rx + car_rw / 2, car_ry + car_rh + 2, "FRONT")
            c.drawCentredString(car_rx + car_rw / 2, car_ry - 7, "REAR")
            c.restoreState()

            positions = CHARGE_PORT_POSITIONS.get(charge_port_location)
            if positions:
                if isinstance(positions, tuple):
                    positions = [positions]
                for px, py in positions:
                    dot_cx = car_rx + car_rw * px
                    dot_cy = car_ry + car_rh * (1 - py)
                    c.saveState()
                    c.setFillColor(AZ_GREEN)
                    c.circle(dot_cx, dot_cy, 5.5, fill=1, stroke=0)
                    c.restoreState()

        # Port location label
        c.saveState()
        c.setFont("Helvetica-Bold", 7)
        c.setFillColor(DARK_CHARCOAL)
        c.drawString(dx + BOX_PAD, ay + 4, charge_port_location)
        c.restoreState()

        return ay - 4

    # Page 1 ends after range table — info cards are on page 2
    c.showPage()

    # ━━━━━━━━━━━━━━━━━━━━━━ PAGE 2 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    _draw_header(c, 2, 3, cert_ref, issue_date, logo_path)
    _draw_footer(c, 2, 3, cert_ref, reg, issue_date)

    # Always draw info cards at top of page 2
    y_p2_grid = HEADER_BOTTOM - 12
    grid_bottom = _draw_info_grid(c, y_p2_grid, 8)
    p2_grid_h = y_p2_grid - grid_bottom + 12

    # Page 2 sections: info cards + grading scale, methodology, equipment, insights+notes
    P2_BOTTOM = FOOTER_TOP + 4  # 40pt from page bottom (footer is 36pt)

    grade_row_h = 22
    grading_h = 14 + 16 + 5 * (grade_row_h + 2)
    method_h = 14 + 2 * (14 + 10 + 4 * 9)
    equip_h = 55
    panel_h = 130

    p2_total = grading_h + method_h + equip_h + panel_h + p2_grid_h
    p2_available = HEADER_BOTTOM - P2_BOTTOM
    p2_remaining = p2_available - p2_total
    p2_gap = max(6, min(12, p2_remaining / 5))

    # Start below info cards with generous spacing (min 28pt from cards)
    y = HEADER_BOTTOM - p2_grid_h - max(p2_gap, 28)

    # ── SoH Grading Scale ──
    c.saveState()
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(DARK_CHARCOAL)
    c.drawString(MARGIN, y, "SoH Grading Scale")
    c.restoreState()

    y -= 26  # space between title and first grade row
    grades = [
        ("Excellent", "90% \u2013 100%", "Battery is performing at or near its original capacity."),
        ("Good", "80% \u2013 89%", "Normal degradation for the vehicle\u2019s age and mileage."),
        ("Fair", "70% \u2013 79%", "Noticeable capacity loss; still functional for daily use."),
        ("Poor", "60% \u2013 69%", "Significant degradation; reduced range may affect usability."),
        ("Critical", "Below 60%", "Severe degradation; battery replacement may be advisable."),
    ]

    for g_name, g_range, g_desc in grades:
        g_colour = GRADE_COLOURS[g_name]
        is_current = (g_name == grade)

        if is_current:
            _draw_rounded_rect(c, MARGIN, y - 4, CONTENT_W, grade_row_h, r=4, fill_color=g_colour)
            text_col = WHITE
        else:
            _draw_rounded_rect(c, MARGIN, y - 4, CONTENT_W, grade_row_h, r=4, fill_color=LIGHT_GREY)
            text_col = DARK_CHARCOAL

        c.saveState()
        c.setFillColor(g_colour if not is_current else WHITE)
        c.circle(MARGIN + 12, y + 5, 3.5, fill=1, stroke=0)
        c.restoreState()

        c.saveState()
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(text_col)
        c.drawString(MARGIN + 22, y + 2, g_name)
        c.setFont("Helvetica", 7)
        c.drawString(MARGIN + 90, y + 2, g_range)
        c.setFillColor(text_col if is_current else TEXT_GREY)
        c.drawString(MARGIN + 165, y + 2, g_desc)
        c.restoreState()

        y -= grade_row_h + 2

    # ── Methodology ──
    y -= p2_gap
    c.saveState()
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(DARK_CHARCOAL)
    c.drawString(MARGIN, y, "Methodology")
    c.restoreState()

    y -= 8
    methods = [
        ("1. Diagnostic Data Collection",
         "Battery State of Health (SoH) data is read directly from the vehicle\u2019s on-board diagnostic "
         "system using a Bosch KTS 590 diagnostic unit running ESItronic 2.0 Online software. The OBD-II "
         "port provides access to the battery management system\u2019s reported health metrics."),
        ("2. Range Estimation",
         "Estimated real-world range is calculated by applying the measured SoH percentage to the "
         "manufacturer\u2019s WLTP-rated range, then adjusting for three driving scenarios: Best Case (Urban, "
         "\u00d70.95), Typical (Mixed, \u00d70.85), and Worst Case (Winter Motorway, \u00d70.65). All calculations use "
         "verified manufacturer specifications."),
    ]

    for title, desc in methods:
        y -= 12
        c.saveState()
        c.setFont("Helvetica-Bold", 8.5)
        c.setFillColor(DARK_CHARCOAL)
        c.drawString(MARGIN + BOX_PAD, y, title)
        c.restoreState()

        y -= 10
        lines = _wrap_text(c, desc, "Helvetica", 7, CONTENT_W - 2 * BOX_PAD)
        c.saveState()
        c.setFont("Helvetica", 7)
        c.setFillColor(TEXT_GREY)
        for line in lines:
            c.drawString(MARGIN + BOX_PAD, y, line)
            y -= 9
        c.restoreState()

    # ── Diagnostic Equipment ──
    y -= p2_gap
    _draw_rounded_rect(c, MARGIN, y - equip_h, CONTENT_W, equip_h,
                       r=BOX_RADIUS, fill_color=LIGHT_GREY, stroke_color=MID_GREY, stroke_width=0.3)

    c.saveState()
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(DARK_CHARCOAL)
    c.drawString(MARGIN + BOX_PAD, y - 14, "Diagnostic Equipment")
    c.restoreState()

    bosch_drawn_p2 = False
    if bosch_logo and os.path.exists(bosch_logo):
        try:
            bosch_img_p2 = _prepare_bosch_logo(bosch_logo, "#F5F5F5")
            if bosch_img_p2:
                c.drawImage(bosch_img_p2, MARGIN + BOX_PAD, y - equip_h + 8,
                            width=55, height=24, preserveAspectRatio=True)
                bosch_drawn_p2 = True
        except Exception:
            pass

    c.saveState()
    c.setFont("Helvetica-Bold", 8.5)
    c.setFillColor(DARK_CHARCOAL)
    tx = MARGIN + BOX_PAD + (65 if bosch_drawn_p2 else 0)
    c.drawString(tx, y - 30, "BOSCH KTS 590")
    c.setFont("Helvetica", 7)
    c.setFillColor(TEXT_GREY)
    c.drawString(tx, y - 42, "ESItronic 2.0 Online \u2014 Professional OBD-II diagnostic platform")
    c.restoreState()

    # ── Two-column panels: Range Insights + Important Notes ──
    y = y - equip_h - p2_gap
    # Dynamically size panels to fit remaining space
    panel_h = max(100, min(panel_h, y - P2_BOTTOM))
    p2_col_w = (CONTENT_W - 10) / 2

    # Range Insights
    _draw_rounded_rect(c, MARGIN, y - panel_h, p2_col_w, panel_h,
                       r=BOX_RADIUS, fill_color=WHITE, stroke_color=MID_GREY)
    c.saveState()
    c.setFont("Helvetica-Bold", 8.5)
    c.setFillColor(DARK_CHARCOAL)
    c.drawString(MARGIN + BOX_PAD, y - 14, "Range Insights")
    c.restoreState()

    text_w = p2_col_w - 2 * BOX_PAD  # available text width inside box
    insight_paras = [
        "Range estimates are provided for three driving scenarios reflecting the most common and the highest/lowest range you can expect.",
        "These figures are estimates and subject to variability. Factors like driving mode, climate control, and driving style will affect the range achieved on a full charge.",
        f"The WLTP combined range for this car is {wltp_range} miles when new.",
    ]
    iy = y - 26
    c.saveState()
    c.setFont("Helvetica", 7)
    c.setFillColor(TEXT_GREY)
    for pi, para in enumerate(insight_paras):
        if pi > 0:
            iy -= 4  # paragraph gap
        lines = _wrap_text(c, para, "Helvetica", 7, text_w)
        for line in lines:
            if iy < (y - panel_h + 4):
                break
            c.drawString(MARGIN + BOX_PAD, iy, line)
            iy -= 9.5
    c.restoreState()

    # Important Notes
    notes_x = MARGIN + p2_col_w + 10
    _draw_rounded_rect(c, notes_x, y - panel_h, p2_col_w, panel_h,
                       r=BOX_RADIUS, fill_color=WHITE, stroke_color=MID_GREY)
    c.saveState()
    c.setFont("Helvetica-Bold", 8.5)
    c.setFillColor(DARK_CHARCOAL)
    c.drawString(notes_x + BOX_PAD, y - 14, "Important Notes")
    c.restoreState()

    note_paras = [
        "SoH readings are taken at a single point in time and reflect the battery\u2019s condition on the date of testing only.",
        "Battery performance can vary based on charging habits, temperature, and driving patterns.",
        "Frequent rapid charging may accelerate battery degradation and should be minimised where possible for long-term battery health.",
        "This report is not a substitute for a full vehicle inspection or manufacturer assessment.",
    ]
    ny = y - 26
    c.saveState()
    c.setFont("Helvetica", 7)
    c.setFillColor(TEXT_GREY)
    for pi, para in enumerate(note_paras):
        if pi > 0:
            ny -= 4  # paragraph gap
        lines = _wrap_text(c, para, "Helvetica", 7, text_w)
        for line in lines:
            if ny < (y - panel_h + 4):
                break
            c.drawString(notes_x + BOX_PAD, ny, line)
            ny -= 9.5
    c.restoreState()

    c.showPage()

    # ━━━━━━━━━━━━━━━━━━━━━━ PAGE 3 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    _draw_header(c, 3, 3, cert_ref, issue_date, logo_path)
    _draw_footer(c, 3, 3, cert_ref, reg, issue_date)

    # Page 3 sections: disclaimers, warranty info, about, cert bar
    # Pre-measure disclaimer height
    disclaimers = [
        "This certificate is an independent assessment based on data obtained from the vehicle\u2019s "
        "on-board diagnostic systems and published manufacturer specifications. It is not issued, "
        "endorsed, or verified by the vehicle manufacturer.",
        "The State of Health (SoH) reading represents the battery\u2019s condition at the time of testing "
        "only. Battery performance can change over time due to usage patterns, charging habits, "
        "temperature exposure, and other environmental factors.",
        "Range estimates are calculated using a fixed formula applied to the manufacturer\u2019s WLTP-rated "
        "range and are provided for illustrative purposes only. Actual range will vary depending on "
        "driving conditions, speed, payload, climate control use, and other factors.",
        "This certificate does not constitute a warranty, guarantee, or binding commitment regarding "
        "the vehicle\u2019s battery performance, reliability, or lifespan. It should be used as one input "
        "among several when evaluating a used electric vehicle.",
        "Any modifications or subsequent changes to the vehicle or its battery management system after "
        "the date of this certificate may render the findings invalid. AZ Autos accepts no liability "
        "for decisions made on the basis of this certificate.",
    ]
    disc_h = 16  # heading
    for disc in disclaimers:
        disc_lines = _wrap_text(c, disc, "Helvetica", 7, CONTENT_W - 35)
        disc_h += 4 + len(disc_lines) * 9 + 4

    warranty_notes = [
        "EVs typically come with two separate warranties: one for the vehicle and one for the "
        "battery inside the vehicle.",
        "Vehicle warranties typically last 3\u20135 years and cover faults with the motor, drivetrain, "
        "electronics and control systems. Speak to your EV retailer for details.",
        "The battery warranty provides protection against accelerated degradation and battery faults. "
        "It covers the performance of the battery, ensuring SoH does not drop below the manufacturer\u2019s "
        "stated threshold during the warranty period.",
        "This report provides the status of the vehicle in the context of the manufacturer\u2019s battery "
        "warranty. Additional criteria may be required from the manufacturer to validate a claim.",
    ]
    warr_notes_h = 16  # heading
    for note in warranty_notes:
        wn_lines = _wrap_text(c, note, "Helvetica", 7, CONTENT_W - 22)
        warr_notes_h += 4 + len(wn_lines) * 9 + 3

    about_h = 110
    cert_bar_h = 26

    p3_total = disc_h + warr_notes_h + about_h + cert_bar_h
    p3_remaining = usable_h - p3_total
    p3_gap = max(10, p3_remaining / 5)

    y = HEADER_BOTTOM - p3_gap

    # ── Disclaimers ──
    c.saveState()
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(DARK_CHARCOAL)
    c.drawString(MARGIN, y, "Disclaimers")
    c.restoreState()

    y -= 10  # 6pt+ gap below heading

    for i, disc in enumerate(disclaimers):
        y -= 4
        c.saveState()
        c.setFillColor(AZ_GREEN)
        c.circle(MARGIN + 10, y + 2, 6, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 7)
        c.setFillColor(WHITE)
        c.drawCentredString(MARGIN + 10, y - 1, str(i + 1))
        c.restoreState()

        lines = _wrap_text(c, disc, "Helvetica", 7, CONTENT_W - 35)
        c.saveState()
        c.setFont("Helvetica", 7)
        c.setFillColor(TEXT_GREY)
        for line in lines:
            c.drawString(MARGIN + 26, y, line)
            y -= 9
        c.restoreState()
        y -= 4

    # ── Battery Warranty vs Vehicle Warranty ──
    y -= p3_gap
    c.saveState()
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(DARK_CHARCOAL)
    c.drawString(MARGIN, y, "Battery Warranty vs Vehicle Warranty")
    c.restoreState()

    y -= 8  # 6pt+ gap below heading
    for note in warranty_notes:
        y -= 4
        lines = _wrap_text(c, note, "Helvetica", 7, CONTENT_W - 22)
        c.saveState()
        c.setFillColor(TEXT_GREY)
        c.circle(MARGIN + 6, y + 2, 2, fill=1, stroke=0)
        c.setFont("Helvetica", 7)
        for line in lines:
            c.drawString(MARGIN + 16, y, line)
            y -= 9
        c.restoreState()
        y -= 3

    # ── About AZ Autos ──
    y -= p3_gap
    _draw_rounded_rect(c, MARGIN, y - about_h, CONTENT_W, about_h,
                       r=BOX_RADIUS, fill_color=LIGHT_GREY, stroke_color=MID_GREY, stroke_width=0.3)

    c.saveState()
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(DARK_CHARCOAL)
    c.drawString(MARGIN + BOX_PAD, y - 16, "About AZ Autos")
    c.restoreState()

    about_lines = [
        "AZ Autos is a trusted used car dealership based in Letchworth Garden City, Hertfordshire.",
        "We specialise in quality pre-owned electric and hybrid vehicles, providing transparent",
        "battery health assessments to help buyers make informed decisions.",
        "",
        "Every EV we sell undergoes a comprehensive battery health check using professional-grade",
        "diagnostic equipment. This certificate is part of our commitment to transparency and",
        "customer confidence in the used EV market.",
    ]
    ay = y - 30
    c.saveState()
    c.setFont("Helvetica", 7)
    c.setFillColor(TEXT_GREY)
    for line in about_lines:
        c.drawString(MARGIN + BOX_PAD, ay, line)
        ay -= 10
    c.restoreState()

    ay -= 2
    c.saveState()
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(AZ_GREEN)
    # Distribute 3 contact items equally across page width
    third_w = CONTENT_W / 3
    c.drawCentredString(MARGIN + third_w * 0.5, ay, "azautos.co.uk")
    c.drawCentredString(MARGIN + third_w * 1.5, ay, "info@azautos.co.uk")
    c.drawCentredString(MARGIN + third_w * 2.5, ay, "01462 438 999")
    c.restoreState()

    # ── Final certificate reference bar ──
    bar_y = FOOTER_TOP + p3_gap
    _draw_rounded_rect(c, MARGIN, bar_y, CONTENT_W, cert_bar_h, r=4, fill_color=AZ_GREEN)
    c.saveState()
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(WHITE)
    c.drawCentredString(PAGE_W / 2, bar_y + 9,
                        f"Certificate Reference: {cert_ref}  |  Issued: {issue_date}  |  Registration: {reg}")
    c.restoreState()

    c.showPage()
    c.save()
    return output_path
