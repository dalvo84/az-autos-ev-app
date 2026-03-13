"""
Auto Trader advert image generator for AZ Autos EV Battery Health Certificate.
Uses ReportLab to render a high-quality single-page PDF, then converts to
1024x768 PNG via PyMuPDF for uploading as a photo in an Auto Trader listing.
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

# ── Colour palette (same as certificate) ─────────────────────────
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
BOX_RADIUS = 10
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
    """Draw a horizontal progress bar. fraction is 0.0–1.0."""
    if fill_color is None:
        fill_color = AZ_GREEN
    _draw_rounded_rect(c, x, y, w, h, r=h / 2, fill_color=MID_GREY)
    fill_w = max(0, min(w, w * fraction))
    if fill_w > h:
        _draw_rounded_rect(c, x, y, fill_w, h, r=h / 2, fill_color=fill_color)


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
    c.setFont("Helvetica-Bold", 48)
    c.setFillColor(DARK_CHARCOAL)
    c.drawCentredString(cx, cy + 6, f"{soh}%")
    c.setFont("Helvetica", 13)
    c.setFillColor(TEXT_GREY)
    c.drawCentredString(cx, cy - 14, "State of Health")
    c.restoreState()

    # Grade label below gauge
    c.saveState()
    c.setFont("Helvetica-Bold", 20)
    c.setFillColor(grade_colour)
    c.drawCentredString(cx, cy - 46, grade.upper())
    c.restoreState()


def _prepare_logo_for_header(logo_path):
    """Prepare Az-02.png for the dark charcoal header: crop and make green bg transparent."""
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


def _prepare_bosch_logo(logo_path, bg_hex="#1A1A2E"):
    """Prepare Bosch logo for the dark header: crop whitespace and make
    white areas transparent for clean overlay on dark background."""
    try:
        img = Image.open(logo_path).convert("RGBA")
        data = np.array(img)
        r, g, b = data[:, :, 0], data[:, :, 1], data[:, :, 2]
        is_content = (r < 240) | (g < 240) | (b < 240)
        rows = np.any(is_content, axis=1)
        cols = np.any(is_content, axis=0)
        if not (np.any(rows) and np.any(cols)):
            return None
        rmin, rmax = np.where(rows)[0][[0, -1]]
        cmin, cmax = np.where(cols)[0][[0, -1]]
        pad = 5
        rmin = max(0, rmin - pad)
        rmax = min(data.shape[0] - 1, rmax + pad)
        cmin = max(0, cmin - pad)
        cmax = min(data.shape[1] - 1, cmax + pad)
        img = img.crop((cmin, rmin, cmax + 1, rmax + 1))
        # Put on a small white rounded badge background for visibility
        badge_w = img.width + 16
        badge_h = img.height + 10
        badge = Image.new("RGBA", (badge_w, badge_h), (255, 255, 255, 230))
        badge.paste(img, (8, 5), img if img.mode == "RGBA" else None)
        buf = io.BytesIO()
        badge.save(buf, format="PNG")
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

    Uses ReportLab to create a high-quality PDF, then converts to PNG
    via PyMuPDF (fitz) for crisp rendering.

    Required data keys:
        soh, grade, ranges, warranty_status, warranty_years, warranty_miles,
        battery_usable_kwh, cert_ref, logo_white, bosch_logo,
        mileage, first_registered, wltp_range (when-new range for bars)
    """
    # Create PDF in memory
    pdf_buf = io.BytesIO()
    c = canvas.Canvas(pdf_buf, pagesize=(PAGE_W, PAGE_H))

    soh = data.get("soh", 0)
    grade = data.get("grade", "Unknown")
    grade_colour = GRADE_COLOURS.get(grade, AZ_GREEN)
    ranges = data.get("ranges", {})
    cert_ref = data.get("cert_ref", "AZ-XXXXXXXXXX")

    # ── Background ────────────────────────────────────────────────
    c.saveState()
    c.setFillColor(LIGHT_GREY)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.restoreState()

    # ── Header bar ────────────────────────────────────────────────
    header_h = 60
    header_y = PAGE_H - header_h

    c.saveState()
    c.setFillColor(DARK_CHARCOAL)
    c.rect(0, header_y, PAGE_W, header_h, fill=1, stroke=0)
    c.restoreState()

    # Green accent line below header
    c.saveState()
    c.setFillColor(AZ_GREEN)
    c.rect(0, header_y - 4, PAGE_W, 4, fill=1, stroke=0)
    c.restoreState()

    # AZ Autos logo (left)
    logo_path = data.get("logo_white", "")
    logo_drawn = False
    if logo_path and os.path.exists(logo_path):
        logo_img = _prepare_logo_for_header(logo_path)
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
        c.setFillColor(AZ_GREEN)
        c.drawString(MARGIN, header_y + 22, "AZ AUTOS")
        c.restoreState()

    # Title (centre)
    c.saveState()
    c.setFont("Helvetica-Bold", 20)
    c.setFillColor(WHITE)
    c.drawCentredString(PAGE_W / 2, header_y + 28, "EV Battery Health Certificate")
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("#FFFFFFBB"))
    c.drawCentredString(PAGE_W / 2, header_y + 12, "Tested with Bosch KTS 590 / ESItronic 2.0")
    c.restoreState()

    # Bosch logo (right)
    bosch_path = data.get("bosch_logo", "")
    bosch_drawn = False
    if bosch_path and os.path.exists(bosch_path):
        bosch_img = _prepare_bosch_logo(bosch_path)
        if bosch_img:
            try:
                c.drawImage(bosch_img, PAGE_W - MARGIN - 110, header_y + 8,
                            width=110, height=header_h - 16,
                            preserveAspectRatio=True, mask='auto')
                bosch_drawn = True
            except Exception:
                pass
    if not bosch_drawn:
        c.saveState()
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(HexColor("#FFFFFFAA"))
        c.drawRightString(PAGE_W - MARGIN, header_y + 24, "BOSCH KTS 590")
        c.restoreState()

    # ── Layout geometry ──────────────────────────────────────────
    # Available vertical space: from below header accent to above footer
    footer_h = 32
    footer_accent = 3
    content_top = header_y - 4 - 12
    content_bottom = footer_h + footer_accent + 14

    available_h = content_top - content_bottom
    # Allocate proportionally: top 65%, gap 5%, bottom 30%
    gap_between = 18
    top_section_h = available_h * 0.65
    bottom_card_h = available_h * 0.30
    top_section_top = content_top

    # ── Compute range card dimensions first (needed for gauge sizing) ─
    left_col_w = 320
    right_col_x = MARGIN + left_col_w + 20
    right_col_w = PAGE_W - right_col_x - MARGIN
    card_gap = 12
    card_h = (top_section_h - 18 - 2 * card_gap) / 3
    range_total_h = 3 * card_h + 2 * card_gap + 18

    # ── LEFT COLUMN: SoH Gauge ────────────────────────────────────
    gauge_card_h = range_total_h
    gauge_card_y = top_section_top - gauge_card_h
    gauge_cx = MARGIN + left_col_w / 2
    gauge_cy = gauge_card_y + gauge_card_h * 0.58
    gauge_r = min(gauge_card_h * 0.34, left_col_w * 0.30)

    # Gauge background card
    _draw_rounded_rect(c, MARGIN, gauge_card_y, left_col_w, gauge_card_h,
                       r=BOX_RADIUS, fill_color=WHITE, stroke_color=MID_GREY, stroke_width=0.5)

    _draw_soh_gauge(c, gauge_cx, gauge_cy, gauge_r, soh, grade)

    # ── RIGHT COLUMN: Range Estimates ─────────────────────────────

    range_items = [
        ("Best Case — Urban",       ranges.get("best_current", 0),    ranges.get("best_new", 0)),
        ("Typical — Mixed Driving",  ranges.get("typical_current", 0), ranges.get("typical_new", 0)),
        ("Worst Case — Winter Mway", ranges.get("worst_current", 0),  ranges.get("worst_new", 0)),
    ]

    # Section label
    c.saveState()
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(DARK_CHARCOAL)
    c.drawString(right_col_x, content_top, "Estimated Range")
    c.restoreState()

    card_top = content_top - 14

    for i, (label, current_mi, new_mi) in enumerate(range_items):
        cy = card_top - i * (card_h + card_gap)
        is_typical = (i == 1)

        # Card
        border_col = AZ_GREEN if is_typical else MID_GREY
        border_w = 1.5 if is_typical else 0.5
        _draw_rounded_rect(c, right_col_x, cy - card_h, right_col_w, card_h,
                           r=BOX_RADIUS, fill_color=WHITE,
                           stroke_color=border_col, stroke_width=border_w)

        # Label
        c.saveState()
        c.setFont("Helvetica", 9)
        c.setFillColor(TEXT_GREY)
        c.drawString(right_col_x + BOX_PAD, cy - 16, label)
        c.restoreState()

        # Miles figure (large)
        c.saveState()
        c.setFont("Helvetica-Bold", 28)
        miles_col = AZ_GREEN if is_typical else DARK_CHARCOAL
        c.setFillColor(miles_col)
        c.drawString(right_col_x + BOX_PAD, cy - 48, f"{current_mi} mi")
        c.restoreState()

        # "When new" text
        c.saveState()
        c.setFont("Helvetica", 8)
        c.setFillColor(TEXT_GREY)
        c.drawRightString(right_col_x + right_col_w - BOX_PAD, cy - 16,
                          f"When new: {new_mi} mi")
        c.restoreState()

        # Progress bar: current vs new
        bar_x = right_col_x + BOX_PAD
        bar_w = right_col_w - 2 * BOX_PAD
        bar_y = cy - card_h + 8
        bar_h = 8
        fraction = current_mi / new_mi if new_mi > 0 else 0
        bar_col = AZ_GREEN if is_typical else HexColor("#A0A0A0")
        _draw_progress_bar(c, bar_x, bar_y, bar_w, bar_h, fraction, fill_color=bar_col)

    # ── Bottom row: Warranty + Battery Capacity ───────────────────
    half_w = (CONTENT_W - 20) / 2

    # --- Warranty card ---
    w_card_x = MARGIN
    w_card_y = gauge_card_y - gap_between - bottom_card_h
    _draw_rounded_rect(c, w_card_x, w_card_y, half_w, bottom_card_h,
                       r=BOX_RADIUS, fill_color=WHITE, stroke_color=MID_GREY, stroke_width=0.5)

    warranty_status = data.get("warranty_status", "Unknown")
    warranty_years = data.get("warranty_years", 8)
    warranty_miles = data.get("warranty_miles", 100000)
    mileage = data.get("mileage", 0)
    first_registered = data.get("first_registered", "")

    # Content block is ~78pt tall (title 11pt + status 13pt + gap + 2 bars)
    # Centre it vertically in the card
    content_h = 78
    content_base = w_card_y + (bottom_card_h - content_h) / 2

    c.saveState()
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(DARK_CHARCOAL)
    c.drawString(w_card_x + BOX_PAD, content_base + content_h - 4, "Battery Warranty")
    c.restoreState()

    # Status badge
    ws_col = GRADE_COLOURS["Excellent"] if warranty_status == "In Warranty" else \
             GRADE_COLOURS["Critical"] if warranty_status == "Expired" else TEXT_GREY
    c.saveState()
    c.setFont("Helvetica-Bold", 13)
    c.setFillColor(ws_col)
    c.drawString(w_card_x + BOX_PAD, content_base + content_h - 22, warranty_status)
    c.restoreState()

    # Warranty progress bars
    bar_inner_w = half_w - 2 * BOX_PAD - 80
    reg_date = _parse_reg_date(first_registered)

    # Time remaining bar
    c.saveState()
    c.setFont("Helvetica", 8)
    c.setFillColor(TEXT_GREY)
    c.drawString(w_card_x + BOX_PAD, content_base + 20, "Time:")
    c.restoreState()

    time_fraction = 1.0
    time_label = ""
    if reg_date and warranty_years > 0:
        years_elapsed = (datetime.now() - reg_date).days / 365.25
        time_fraction = min(1.0, max(0, years_elapsed / warranty_years))
        remaining_yrs = max(0, warranty_years - years_elapsed)
        if remaining_yrs > 0:
            time_label = f"{remaining_yrs:.1f} yrs left"
        else:
            time_label = "Expired"

    time_bar_col = AZ_GREEN if time_fraction < 1.0 else GRADE_COLOURS["Critical"]
    _draw_progress_bar(c, w_card_x + BOX_PAD + 48, content_base + 18, bar_inner_w, 10,
                       time_fraction, fill_color=time_bar_col)
    c.saveState()
    c.setFont("Helvetica", 7)
    c.setFillColor(TEXT_GREY)
    c.drawString(w_card_x + BOX_PAD + 52 + bar_inner_w, content_base + 20, time_label)
    c.restoreState()

    # Mileage remaining bar
    c.saveState()
    c.setFont("Helvetica", 8)
    c.setFillColor(TEXT_GREY)
    c.drawString(w_card_x + BOX_PAD, content_base + 2, "Miles:")
    c.restoreState()

    miles_fraction = min(1.0, max(0, mileage / warranty_miles)) if warranty_miles > 0 else 1.0
    miles_remaining = max(0, warranty_miles - mileage)
    miles_label = f"{miles_remaining:,} mi left" if miles_remaining > 0 else "Exceeded"

    miles_bar_col = AZ_GREEN if miles_fraction < 1.0 else GRADE_COLOURS["Critical"]
    _draw_progress_bar(c, w_card_x + BOX_PAD + 48, content_base, bar_inner_w, 10,
                       miles_fraction, fill_color=miles_bar_col)
    c.saveState()
    c.setFont("Helvetica", 7)
    c.setFillColor(TEXT_GREY)
    c.drawString(w_card_x + BOX_PAD + 52 + bar_inner_w, content_base + 2, miles_label)
    c.restoreState()

    # --- Battery Capacity card ---
    b_card_x = MARGIN + half_w + 20
    b_card_y = w_card_y
    _draw_rounded_rect(c, b_card_x, b_card_y, half_w, bottom_card_h,
                       r=BOX_RADIUS, fill_color=WHITE, stroke_color=MID_GREY, stroke_width=0.5)

    battery_kwh = data.get("battery_usable_kwh", "N/A")
    battery_text = f"{battery_kwh} kWh" if battery_kwh != "N/A" else "N/A"

    # Centre content vertically: label (~11pt) + gap (~8) + big number (~32pt) = ~51pt
    bat_content_h = 51
    bat_base = b_card_y + (bottom_card_h - bat_content_h) / 2

    c.saveState()
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(DARK_CHARCOAL)
    c.drawString(b_card_x + BOX_PAD, bat_base + bat_content_h - 4, "Usable Battery Capacity")
    c.restoreState()

    c.saveState()
    c.setFont("Helvetica-Bold", 32)
    c.setFillColor(DARK_CHARCOAL)
    c.drawString(b_card_x + BOX_PAD, bat_base, battery_text)
    c.restoreState()

    # ── Footer bar ────────────────────────────────────────────────
    # footer_h already defined above (32)
    c.saveState()
    c.setFillColor(DARK_CHARCOAL)
    c.rect(0, 0, PAGE_W, footer_h, fill=1, stroke=0)
    c.restoreState()

    # Green accent line above footer
    c.saveState()
    c.setFillColor(AZ_GREEN)
    c.rect(0, footer_h, PAGE_W, 3, fill=1, stroke=0)
    c.restoreState()

    footer_text = f"Tested with Bosch KTS 590 / ESItronic 2.0   |   Certificate ref: {cert_ref}   |   azautos.co.uk"
    c.saveState()
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("#FFFFFFCC"))
    c.drawCentredString(PAGE_W / 2, 10, footer_text)
    c.restoreState()

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

        # Calculate zoom to achieve target resolution
        # PDF page is PAGE_W x PAGE_H points; we want target_w x target_h pixels
        zoom_x = target_w / page.rect.width
        zoom_y = target_h / page.rect.height
        zoom = max(zoom_x, zoom_y)  # use higher zoom for quality

        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, alpha=False)

        # Convert to PIL and resize to exact target dimensions
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        if img.size != (target_w, target_h):
            img = img.resize((target_w, target_h), Image.LANCZOS)

        img.save(output_path, "PNG")
        doc.close()
        return True
    except ImportError:
        # Fallback: save PDF and try sips (macOS)
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

        # sips can convert PDF to PNG on macOS
        tmp_png = tmp_pdf.replace(".pdf", ".png")
        subprocess.run(
            ["sips", "-s", "format", "png",
             "-z", str(target_h), str(target_w),
             tmp_pdf, "--out", tmp_png],
            capture_output=True, timeout=30,
        )
        if os.path.exists(tmp_png):
            # Move to output path
            import shutil
            shutil.move(tmp_png, output_path)
            os.unlink(tmp_pdf)
            return True
        os.unlink(tmp_pdf)
    except Exception as e:
        print(f"[AutoTrader Image] sips fallback failed: {e}")
    return False
