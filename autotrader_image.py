"""
Auto Trader advert image generator for AZ Autos EV Battery Health Certificate.
Generates an 800x600 PNG designed for uploading as a photo in an Auto Trader listing.
"""

import os
from PIL import Image, ImageDraw, ImageFont

# ── Colours ──────────────────────────────────────────────────────
AZ_GREEN = (44, 174, 102)       # #2CAE66
DARK_CHARCOAL = (26, 26, 46)    # #1A1A2E
WHITE = (255, 255, 255)
LIGHT_GREY = (245, 245, 245)    # #F5F5F5
MID_GREY = (180, 180, 180)
TEXT_GREY = (100, 100, 100)
AMBER = (245, 166, 35)          # #F5A623
RED = (208, 2, 27)              # #D0021B
GREEN_DARK = (30, 140, 78)      # darker green for warranty badge


def _grade_colour(grade: str) -> tuple:
    """Return RGB colour for SoH grade."""
    if grade in ("Excellent", "Good"):
        return AZ_GREEN
    elif grade == "Fair":
        return AMBER
    else:
        return RED


def _load_font(bold: bool = False, size: int = 20) -> ImageFont.FreeTypeFont:
    """Load a font, trying system paths then falling back to default."""
    candidates = []
    if bold:
        candidates = [
            "/System/Library/Fonts/Helvetica.ttc",
            "/System/Library/Fonts/SFNSDisplay-Bold.otf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/System/Library/Fonts/HelveticaNeue.ttc",
        ]
    else:
        candidates = [
            "/System/Library/Fonts/Helvetica.ttc",
            "/System/Library/Fonts/SFNSDisplay-Regular.otf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/System/Library/Fonts/HelveticaNeue.ttc",
        ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except (OSError, IOError):
            continue
    # Fallback
    try:
        return ImageFont.truetype("Arial", size)
    except (OSError, IOError):
        return ImageFont.load_default()


def _load_logo(path: str, max_h: int, max_w: int = None) -> Image.Image | None:
    """Load and resize a logo image to fit within max dimensions."""
    try:
        logo = Image.open(path)
        if logo.mode != "RGBA":
            logo = logo.convert("RGBA")
        # Scale to fit max_h while preserving aspect ratio
        ratio = max_h / logo.height
        if max_w:
            ratio = min(ratio, max_w / logo.width)
        new_w = int(logo.width * ratio)
        new_h = int(logo.height * ratio)
        return logo.resize((new_w, new_h), Image.LANCZOS)
    except Exception:
        return None


def _draw_rounded_rect(draw: ImageDraw.Draw, xy: tuple, radius: int,
                       fill=None, outline=None, width: int = 1):
    """Draw a rounded rectangle given (x0, y0, x1, y1)."""
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def generate_autotrader_image(data: dict, output_path: str):
    """
    Generate an 800x600 Auto Trader advert image.

    Required data keys:
        soh, grade, ranges (dict with best_current, typical_current, worst_current),
        warranty_status, battery_usable_kwh, cert_ref,
        warranty_years, warranty_miles, mileage, first_registered,
        logo_white, bosch_logo
    """
    W, H = 800, 600
    img = Image.new("RGB", (W, H), LIGHT_GREY)
    draw = ImageDraw.Draw(img)

    # ── Fonts ────────────────────────────────────────────────────
    font_title = _load_font(bold=True, size=22)
    font_hero = _load_font(bold=True, size=72)
    font_hero_label = _load_font(bold=True, size=24)
    font_grade = _load_font(bold=True, size=28)
    font_range_num = _load_font(bold=True, size=36)
    font_range_label = _load_font(bold=False, size=13)
    font_range_sublabel = _load_font(bold=False, size=11)
    font_info_label = _load_font(bold=False, size=14)
    font_info_val = _load_font(bold=True, size=18)
    font_footer = _load_font(bold=False, size=11)
    font_logo_fallback = _load_font(bold=True, size=16)
    font_bosch_fallback = _load_font(bold=True, size=14)

    # ── Header bar ───────────────────────────────────────────────
    header_h = 60
    draw.rectangle([(0, 0), (W, header_h)], fill=DARK_CHARCOAL)

    # AZ Autos logo (left)
    logo_left = _load_logo(data.get("logo_white", ""), max_h=40, max_w=120)
    if logo_left:
        logo_y = (header_h - logo_left.height) // 2
        img.paste(logo_left, (16, logo_y), logo_left)
        title_x = 16 + logo_left.width + 12
    else:
        draw.text((16, 18), "AZ AUTOS", fill=AZ_GREEN, font=font_logo_fallback)
        title_x = 130

    # Title text
    title_text = "EV Battery Health Certificate"
    title_bbox = draw.textbbox((0, 0), title_text, font=font_title)
    title_w = title_bbox[2] - title_bbox[0]
    title_x_centered = (W - title_w) // 2
    # Use centered or after-logo, whichever is larger
    tx = max(title_x, title_x_centered)
    draw.text((tx, (header_h - 22) // 2), title_text, fill=WHITE, font=font_title)

    # Bosch logo (right)
    bosch_paths = [
        data.get("bosch_logo", ""),
        os.path.join(os.path.dirname(output_path), "..", "hd-bosch-logo-transparent-background-701751694709021apdig4lrgg.png"),
    ]
    bosch_logo = None
    for bp in bosch_paths:
        if bp and os.path.exists(bp):
            bosch_logo = _load_logo(bp, max_h=32, max_w=100)
            if bosch_logo:
                break

    if bosch_logo:
        bx = W - bosch_logo.width - 16
        by = (header_h - bosch_logo.height) // 2
        # Create a white background patch for the Bosch logo area on the dark header
        bosch_bg = Image.new("RGBA", bosch_logo.size, (255, 255, 255, 220))
        img.paste(bosch_bg, (bx, by), bosch_bg)
        img.paste(bosch_logo, (bx, by), bosch_logo)
    else:
        draw.text((W - 130, 20), "BOSCH KTS 590", fill=MID_GREY, font=font_bosch_fallback)

    # ── Green accent line under header ───────────────────────────
    draw.rectangle([(0, header_h), (W, header_h + 4)], fill=AZ_GREEN)

    # ── SoH Hero Section ─────────────────────────────────────────
    soh = data.get("soh", 0)
    grade = data.get("grade", "Unknown")
    grade_col = _grade_colour(grade)

    hero_y = header_h + 24

    # SoH percentage — large and bold
    soh_text = f"{soh}%"
    soh_bbox = draw.textbbox((0, 0), soh_text, font=font_hero)
    soh_w = soh_bbox[2] - soh_bbox[0]
    soh_h = soh_bbox[3] - soh_bbox[1]
    soh_x = (W - soh_w) // 2
    draw.text((soh_x, hero_y), soh_text, fill=grade_col, font=font_hero)

    # "State of Health" label above the percentage
    soh_label = "State of Health"
    soh_label_bbox = draw.textbbox((0, 0), soh_label, font=font_hero_label)
    soh_label_w = soh_label_bbox[2] - soh_label_bbox[0]
    draw.text(((W - soh_label_w) // 2, hero_y - 28), soh_label, fill=DARK_CHARCOAL, font=font_hero_label)

    # Grade badge below percentage
    grade_text = f"{grade}"
    grade_bbox = draw.textbbox((0, 0), grade_text, font=font_grade)
    grade_w = grade_bbox[2] - grade_bbox[0]
    grade_h = grade_bbox[3] - grade_bbox[1]
    badge_w = grade_w + 40
    badge_h = grade_h + 16
    badge_x = (W - badge_w) // 2
    badge_y = hero_y + soh_h + 10
    _draw_rounded_rect(draw, (badge_x, badge_y, badge_x + badge_w, badge_y + badge_h),
                       radius=badge_h // 2, fill=grade_col)
    draw.text((badge_x + 20, badge_y + 8), grade_text, fill=WHITE, font=font_grade)

    # ── Range Estimates Row ──────────────────────────────────────
    ranges = data.get("ranges", {})
    range_y = badge_y + badge_h + 30
    card_w = 220
    card_h = 100
    gap = (W - 3 * card_w) // 4  # equal gaps

    range_items = [
        ("Best Case", "Urban", ranges.get("best_current", 0)),
        ("Typical", "Mixed Driving", ranges.get("typical_current", 0)),
        ("Worst Case", "Winter Motorway", ranges.get("worst_current", 0)),
    ]

    for i, (label, sublabel, miles) in enumerate(range_items):
        cx = gap + i * (card_w + gap)
        # Card background
        is_typical = (i == 1)
        border_col = AZ_GREEN if is_typical else MID_GREY
        border_w = 2 if is_typical else 1
        _draw_rounded_rect(draw, (cx, range_y, cx + card_w, range_y + card_h),
                           radius=10, fill=WHITE, outline=border_col, width=border_w)

        # Label
        lbl_bbox = draw.textbbox((0, 0), label, font=font_range_label)
        lbl_w = lbl_bbox[2] - lbl_bbox[0]
        draw.text((cx + (card_w - lbl_w) // 2, range_y + 10), label, fill=TEXT_GREY, font=font_range_label)

        # Miles figure
        miles_text = f"{miles} mi"
        miles_bbox = draw.textbbox((0, 0), miles_text, font=font_range_num)
        miles_w = miles_bbox[2] - miles_bbox[0]
        miles_col = AZ_GREEN if is_typical else DARK_CHARCOAL
        draw.text((cx + (card_w - miles_w) // 2, range_y + 28), miles_text, fill=miles_col, font=font_range_num)

        # Sublabel
        sub_bbox = draw.textbbox((0, 0), sublabel, font=font_range_sublabel)
        sub_w = sub_bbox[2] - sub_bbox[0]
        draw.text((cx + (card_w - sub_w) // 2, range_y + 72), sublabel, fill=TEXT_GREY, font=font_range_sublabel)

    # ── Info Row: Warranty + Battery Capacity ────────────────────
    info_y = range_y + card_h + 25
    info_card_w = (W - 3 * gap) // 2
    info_card_h = 70

    # Warranty card
    wx = gap
    _draw_rounded_rect(draw, (wx, info_y, wx + info_card_w, info_y + info_card_h),
                       radius=10, fill=WHITE, outline=MID_GREY, width=1)

    warranty_status = data.get("warranty_status", "Unknown")
    warranty_years = data.get("warranty_years", 8)
    warranty_miles = data.get("warranty_miles", 100000)

    warranty_label = "Battery Warranty"
    wlbl_bbox = draw.textbbox((0, 0), warranty_label, font=font_info_label)
    draw.text((wx + 16, info_y + 12), warranty_label, fill=TEXT_GREY, font=font_info_label)

    # Warranty status with colour
    ws_col = AZ_GREEN if warranty_status == "In Warranty" else RED if warranty_status == "Expired" else TEXT_GREY
    warranty_detail = f"{warranty_status}"
    if warranty_status in ("In Warranty", "Expired"):
        warranty_detail += f"  ({warranty_years} yrs / {warranty_miles:,} mi)"
    draw.text((wx + 16, info_y + 36), warranty_detail, fill=ws_col, font=font_info_val)

    # Battery capacity card
    bx = gap + info_card_w + gap
    _draw_rounded_rect(draw, (bx, info_y, bx + info_card_w, info_y + info_card_h),
                       radius=10, fill=WHITE, outline=MID_GREY, width=1)

    battery_label = "Usable Battery Capacity"
    draw.text((bx + 16, info_y + 12), battery_label, fill=TEXT_GREY, font=font_info_label)

    battery_kwh = data.get("battery_usable_kwh", "N/A")
    battery_text = f"{battery_kwh} kWh" if battery_kwh != "N/A" else "N/A"
    draw.text((bx + 16, info_y + 36), battery_text, fill=DARK_CHARCOAL, font=font_info_val)

    # ── Footer ───────────────────────────────────────────────────
    footer_y = H - 36
    draw.rectangle([(0, footer_y - 4), (W, footer_y - 3)], fill=MID_GREY)

    cert_ref = data.get("cert_ref", "AZ-XXXXXXXXXX")
    footer_text = f"Tested with Bosch KTS 590 / ESItronic 2.0  |  Certificate ref: {cert_ref}  |  azautos.co.uk"
    ft_bbox = draw.textbbox((0, 0), footer_text, font=font_footer)
    ft_w = ft_bbox[2] - ft_bbox[0]
    draw.text(((W - ft_w) // 2, footer_y + 4), footer_text, fill=TEXT_GREY, font=font_footer)

    # ── Save ─────────────────────────────────────────────────────
    img.save(output_path, "PNG", quality=95)
    return output_path
