"""
AZ Autos — EV Battery Health Certificate Generator
Streamlit app for generating professional EV battery health certificates.
"""

import os
import re
import json
import string
import random
import requests
import streamlit as st
from datetime import datetime
from typing import Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

REGCHECK_USERNAME = os.getenv("REGCHECK_USERNAME")
REGCHECK_PASSWORD = os.getenv("REGCHECK_PASSWORD")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

# Paths
APP_DIR = os.path.dirname(os.path.abspath(__file__))
SPEC_PATH = os.path.join(APP_DIR, "ev_specs.json")
LOGO_WHITE = os.path.join(APP_DIR, "Az-02.png")        # white on green — for header bar
LOGO_GREEN = os.path.join(APP_DIR, "Az-01.png")        # green on white — for white backgrounds
BOSCH_LOGO = os.path.join(APP_DIR, "Bosch-Logo-2018-present.jpg")
OUTPUT_DIR = os.path.join(APP_DIR, "certificates")
os.makedirs(OUTPUT_DIR, exist_ok=True)


# ── Load EV specs ──────────────────────────────────────────────────
@st.cache_data
def load_ev_specs():
    with open(SPEC_PATH, "r") as f:
        return json.load(f)


# ── RegCheck API ───────────────────────────────────────────────────
def _extract_field(value) -> str:
    """Extract string from RegCheck field — handles both plain strings and
    {'CurrentTextValue': '...'} dicts."""
    if isinstance(value, dict):
        return str(value.get("CurrentTextValue", "")).strip()
    if value is None:
        return ""
    return str(value).strip()


def _date_from_uk_plate(reg: str) -> str:
    """Derive approximate first-registered date from UK new-format plate.
    Format: 2 letters + 2-digit age code + 3 letters.
    March–Aug plates use the year (e.g. 21 = Mar 2021).
    Sep–Feb plates add 50 (e.g. 71 = Sep 2021)."""
    m = re.match(r'^[A-Z]{2}(\d{2})[A-Z]{3}$', reg.replace(" ", "").upper())
    if not m:
        return ""
    code = int(m.group(1))
    if code <= 50:
        return f"01/03/{2000 + code}"
    else:
        return f"01/09/{2000 + code - 50}"


def lookup_vehicle(reg: str) -> Optional[dict]:
    """Call RegCheck API to retrieve vehicle details."""
    reg_clean = reg.strip().upper().replace(" ", "")
    url = f"https://www.regcheck.org.uk/api/json.aspx/Check/{reg_clean}"
    try:
        resp = requests.get(
            url,
            auth=(REGCHECK_USERNAME, REGCHECK_PASSWORD),
            timeout=15,
        )
        if resp.status_code == 200:
            data = resp.json()

            # Make — try CarMake first (returns dict), then Make, then MakeDescription
            make = (_extract_field(data.get("CarMake"))
                    or _extract_field(data.get("Make"))
                    or _extract_field(data.get("MakeDescription")))

            # Model — CarModel is the most detailed (e.g. "Model 3 Long Range AWD")
            model = (_extract_field(data.get("CarModel"))
                     or _extract_field(data.get("Model"))
                     or _extract_field(data.get("ModelDescription")))

            # Description as fallback
            desc = _extract_field(data.get("Description"))
            if desc and (not make or not model):
                parts = desc.split(None, 1)
                if not make and parts:
                    make = parts[0]
                if not model and len(parts) > 1:
                    model = parts[1]

            # Year
            year = (_extract_field(data.get("YearOfManufacture"))
                    or _extract_field(data.get("RegistrationYear")))

            colour = _extract_field(data.get("Colour"))
            fuel_type = _extract_field(data.get("FuelType"))

            # VIN — field is VehicleIdentificationNumber (full VIN)
            vin = (_extract_field(data.get("VehicleIdentificationNumber"))
                   or _extract_field(data.get("Vin")))
            vin_last6 = vin[-6:] if vin and len(vin) >= 6 else vin

            # Vehicle image
            image_url = _extract_field(data.get("ImageUrl"))

            # Mileage — not provided by RegCheck
            mileage = 0

            # First registered — derive from UK plate format for accuracy
            first_registered = _date_from_uk_plate(reg_clean)
            if not first_registered:
                reg_year = _extract_field(data.get("RegistrationYear"))
                first_registered = f"01/03/{reg_year}" if reg_year else ""

            return {
                "make": make,
                "model": model,
                "description": desc,
                "year": year,
                "colour": colour,
                "fuel_type": fuel_type,
                "vin_last6": vin_last6,
                "vehicle_image_url": image_url,
                "mileage": mileage,
                "first_registered": first_registered,
                "first_registered_display": first_registered if first_registered else "Not available",
                "raw": data,
            }
    except Exception as e:
        st.error(f"RegCheck API error: {e}")
    return None


# ── Match vehicle to EV spec ──────────────────────────────────────
def match_ev_spec(make: str, model: str, specs: dict) -> list:
    """Return list of matching spec keys, sorted by specificity (best match first)."""
    make_lower = make.lower().strip()
    model_lower = model.lower().strip()
    # Also build a combined string for matching variant keywords
    combined = f"{make_lower} {model_lower}"

    scored = []
    for key, spec in specs.items():
        spec_make = spec["make"].lower()
        spec_model = spec["model"].lower()

        # Make must match
        if not (spec_make in make_lower or make_lower in spec_make):
            continue
        # Base model must match
        if not (spec_model in model_lower or model_lower in spec_model):
            continue

        # Score based on how many variant keywords match the full model string
        score = 0
        key_lower = key.lower()
        # Check variant-specific keywords from the spec key
        variant_words = key_lower.replace(spec_make, "").replace(spec_model, "").split()
        for word in variant_words:
            word = word.strip("()")
            if not word:
                continue
            if word in combined:
                score += 10  # Strong match for variant keyword
            elif word in key_lower:
                score += 0   # Keyword only in spec key, not in vehicle description

        # Bonus: check if battery size hint is in the model string
        variant_str = spec.get("variant", "").lower()
        for token in variant_str.split():
            token = token.strip("()")
            if token in combined:
                score += 5

        scored.append((key, score))

    # Sort by score descending — most specific match first
    scored.sort(key=lambda x: x[1], reverse=True)
    return [k for k, s in scored]


# ── SoH Grade ─────────────────────────────────────────────────────
def get_soh_grade(soh: float) -> str:
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


# ── Range Calculations ────────────────────────────────────────────
def calculate_ranges(wltp_range: float, soh: float) -> dict:
    """Calculate range estimates using fixed formula."""
    return {
        "best_new": round(wltp_range * 0.95),
        "typical_new": round(wltp_range * 0.85),
        "worst_new": round(wltp_range * 0.65),
        "best_current": round(wltp_range * (soh / 100) * 0.95),
        "typical_current": round(wltp_range * (soh / 100) * 0.85),
        "worst_current": round(wltp_range * (soh / 100) * 0.65),
    }


# ── Claude API Narrative ──────────────────────────────────────────
def generate_narrative(
    make: str, model: str, year: str, mileage: int,
    soh: float, grade: str, typical_range: int, warranty_status: str,
    battery_gross_kwh: float, wltp_range_new: int,
    best_range: int, worst_range: int,
    warranty_years: int, warranty_miles: int,
) -> str:
    """Generate a factual narrative using Claude API."""
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

        prompt = f"""Write exactly 4 sentences describing this electric vehicle's battery condition for a used car buyer.

Use ONLY the following verified data — do not generate, estimate, or invent any numerical values:

- Make: {make}
- Model: {model}
- Year: {year}
- Mileage: {mileage:,} miles
- Battery State of Health (SoH): {soh}%
- SoH Grade: {grade}
- Battery gross capacity: {battery_gross_kwh} kWh
- WLTP range when new: {wltp_range_new} miles
- Estimated best-case range at current SoH: {best_range} miles
- Estimated typical range at current SoH: {typical_range} miles
- Estimated worst-case range at current SoH: {worst_range} miles
- Manufacturer battery warranty: {warranty_years} years / {warranty_miles:,} miles
- Warranty status: {warranty_status}

Instructions:
- Sentence 1: State the SoH reading and comment on whether this is good or poor relative to the vehicle's age and mileage
- Sentence 2: State the practical range implication for a buyer in plain terms (use typical and worst-case figures)
- Sentence 3: Note the battery warranty status and what that means
- Sentence 4: A brief factual closing observation about the battery's overall condition

Tone: analytical and factual — like a mechanic's written assessment, not a sales pitch.
NEVER use these words or phrases: "peace of mind", "rest assured", "great condition", "excellent choice", "impressive", "outstanding", "remarkable", or any promotional language.
Use only the data fields provided above — never invent or estimate any figures."""

        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text.strip()
    except Exception as e:
        st.warning(f"Claude API unavailable, using standard narrative: {e}")
        return _fallback_narrative(
            make, model, year, mileage, soh, grade,
            typical_range, worst_range, warranty_status,
            warranty_years, warranty_miles,
        )


def _fallback_narrative(make, model, year, mileage, soh, grade,
                        typical_range, worst_range, warranty_status,
                        warranty_years, warranty_miles):
    """Static fallback narrative if Claude API fails."""
    return (
        f"This {year} {make} {model} was tested at {mileage:,} miles and returned a battery "
        f"State of Health reading of {soh}%, graded as {grade}. "
        f"At this SoH level, the estimated typical mixed-driving range is {typical_range} miles, "
        f"dropping to {worst_range} miles under winter motorway conditions. "
        f"The manufacturer battery warranty is {warranty_years} years / {warranty_miles:,} miles; "
        f"current status: {warranty_status}. "
        f"The battery is performing within expected parameters for a vehicle of this age and mileage."
    )


# ── Certificate Reference ─────────────────────────────────────────
def generate_cert_ref() -> str:
    chars = string.ascii_uppercase + string.digits
    return "AZ-" + "".join(random.choices(chars, k=10))


# ── Warranty Status ────────────────────────────────────────────────
def determine_warranty_status(first_registered: str, mileage: int, warranty_years: int, warranty_miles: int) -> str:
    if not first_registered or not mileage:
        return "Unable to determine"
    try:
        reg_date = None
        for fmt in ["%d/%m/%Y", "%Y-%m-%d", "%d %B %Y", "%d-%m-%Y", "%Y%m%d"]:
            try:
                reg_date = datetime.strptime(first_registered.strip(), fmt)
                break
            except ValueError:
                continue
        if not reg_date:
            return "Unable to determine"

        years_elapsed = (datetime.now() - reg_date).days / 365.25
        if years_elapsed <= warranty_years and mileage <= warranty_miles:
            return "In Warranty"
        else:
            return "Expired"
    except Exception:
        return "Unable to determine"


# ── AI Lookup for Missing Charging Specs ──────────────────────────
def lookup_charging_spec_ai(year: str, make: str, model: str) -> Optional[dict]:
    """Use Claude API to look up charging connector and port location for vehicles
    not in the local spec database."""
    cache_key = f"{year}_{make}_{model}".lower().replace(" ", "_")
    if "ai_spec_cache" not in st.session_state:
        st.session_state.ai_spec_cache = {}
    if cache_key in st.session_state.ai_spec_cache:
        return st.session_state.ai_spec_cache[cache_key]

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=200,
            system="You are a vehicle specification database. Respond only with a valid JSON object. No preamble, no explanation, no markdown.",
            messages=[{"role": "user", "content": (
                f'Return the charging specification for a {year} {make} {model}. '
                'Use this exact format: '
                '{ "ac_connector": "Type 2", "dc_connector": "CCS", "charge_port_location": "Rear Left" }. '
                'charge_port_location must be one of: Front Left, Front Centre, Front Right, '
                'Rear Left, Rear Centre, Rear Right, Front Left and Rear Left, Rear Left and Rear Right.'
            )}],
        )
        result = json.loads(message.content[0].text.strip())
        # Validate expected keys
        if "ac_connector" in result and "dc_connector" in result and "charge_port_location" in result:
            st.session_state.ai_spec_cache[cache_key] = result
            return result
    except Exception:
        pass
    return None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STREAMLIT APP
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

st.set_page_config(
    page_title="AZ Autos — EV Battery Health Certificate",
    page_icon="\u26A1",
    layout="wide",
)

# Custom CSS
st.markdown("""
<style>
    .stApp { background-color: #FAFAFA; }
    .main-header {
        background: linear-gradient(135deg, #2CAE66, #1E8C4E);
        padding: 1.5rem 2rem;
        border-radius: 12px;
        margin-bottom: 1.5rem;
        color: white;
    }
    .main-header h1 { color: white; margin: 0; font-size: 1.8rem; }
    .main-header p { color: rgba(255,255,255,0.85); margin: 0.3rem 0 0 0; font-size: 0.95rem; }
    .grade-badge {
        display: inline-block;
        padding: 4px 16px;
        border-radius: 20px;
        font-weight: bold;
        color: white;
        font-size: 1.1rem;
    }
    .metric-card {
        background: white;
        border-radius: 10px;
        padding: 1rem;
        border: 1px solid #E0E0E0;
        text-align: center;
    }
    .metric-card h3 { margin: 0; color: #1A1A2E; font-size: 1.5rem; }
    .metric-card p { margin: 0.2rem 0 0; color: #666; font-size: 0.85rem; }
</style>
""", unsafe_allow_html=True)

# Header
st.markdown("""
<div class="main-header">
    <h1>AZ Autos — EV Battery Health Certificate</h1>
    <p>Professional battery health assessments using Bosch KTS 590 / ESItronic 2.0</p>
</div>
""", unsafe_allow_html=True)

# Load specs
ev_specs = load_ev_specs()

# ── Step 1: Vehicle Lookup ─────────────────────────────────────────
st.subheader("1. Vehicle Lookup")

col1, col2 = st.columns([3, 1], vertical_alignment="bottom")
with col1:
    reg_input = st.text_input(
        "Enter UK Registration Number",
        placeholder="e.g. AB12 CDE",
        max_chars=10,
    ).strip().upper()

with col2:
    lookup_btn = st.button("Look Up Vehicle", type="primary", use_container_width=True)

# Session state
if "vehicle_data" not in st.session_state:
    st.session_state.vehicle_data = None
if "manual_mode" not in st.session_state:
    st.session_state.manual_mode = False

if lookup_btn and reg_input:
    with st.spinner("Looking up vehicle..."):
        result = lookup_vehicle(reg_input)
        if result:
            st.session_state.vehicle_data = result
            st.session_state.manual_mode = False
            st.success(f"Found: {result['make']} {result['model']} ({result['year']})")
        else:
            st.error("Vehicle not found. Please enter details manually below.")
            st.session_state.manual_mode = True
            st.session_state.vehicle_data = None

# Manual entry toggle
if st.checkbox("Enter vehicle details manually", value=st.session_state.manual_mode):
    st.session_state.manual_mode = True

# ── Vehicle Details Display / Manual Entry ─────────────────────────
vehicle = st.session_state.vehicle_data

if st.session_state.manual_mode:
    st.subheader("Manual Vehicle Entry")
    mc1, mc2 = st.columns(2)
    with mc1:
        m_make = st.text_input("Make", placeholder="e.g. Tesla")
        m_model = st.text_input("Model", placeholder="e.g. Model 3")
        m_year = st.text_input("Year", placeholder="e.g. 2021")
        m_colour = st.text_input("Colour", placeholder="e.g. White")
    with mc2:
        m_fuel = st.text_input("Fuel Type", value="Electric")
        m_vin6 = st.text_input("VIN (last 6 digits)", placeholder="e.g. 123456")
        m_mileage = st.number_input("Mileage", min_value=0, value=0, step=100)
        m_first_reg = st.text_input("First Registered (DD/MM/YYYY)", placeholder="01/01/2021")

    vehicle = {
        "make": m_make,
        "model": m_model,
        "year": m_year,
        "colour": m_colour,
        "fuel_type": m_fuel,
        "vin_last6": m_vin6,
        "mileage": m_mileage,
        "first_registered": m_first_reg,
        "first_registered_display": m_first_reg if m_first_reg else "Not available",
        "vehicle_image_url": "",
    }

elif vehicle:
    st.subheader("Vehicle Details")
    vc1, vc2 = st.columns(2)
    with vc1:
        if vehicle.get("vehicle_image_url"):
            st.image(vehicle["vehicle_image_url"], width=300)
        st.markdown(f"**Registration:** {reg_input}")
        st.markdown(f"**Make / Model:** {vehicle['make']} {vehicle['model']}")
        st.markdown(f"**Year:** {vehicle['year']}")
        st.markdown(f"**First Registered:** {vehicle.get('first_registered_display', 'Not available')}")
    with vc2:
        st.markdown(f"**Colour:** {vehicle['colour']}")
        st.markdown(f"**Fuel Type:** {vehicle['fuel_type']}")
        st.markdown(f"**VIN (last 6):** {vehicle['vin_last6']}")

    # Mileage — editable since RegCheck doesn't provide it
    vehicle["mileage"] = st.number_input(
        "Mileage at Test",
        min_value=0,
        value=int(vehicle.get("mileage", 0) or 0),
        step=100,
    )


# ── Step 2: SoH Entry ─────────────────────────────────────────────
if vehicle:
    st.divider()
    st.subheader("2. Battery State of Health")
    st.caption("Enter the SoH percentage from the Bosch KTS 590 / ESItronic 2.0 diagnostic reading.")

    soh = st.slider("State of Health (%)", min_value=0, max_value=100, value=85, step=1)
    grade = get_soh_grade(soh)

    grade_colors = {
        "Excellent": "#2CAE66",
        "Good": "#7BC67E",
        "Fair": "#F5A623",
        "Poor": "#E8602C",
        "Critical": "#D0021B",
    }
    st.markdown(
        f'<span class="grade-badge" style="background-color: {grade_colors[grade]}">{grade} — {soh}%</span>',
        unsafe_allow_html=True,
    )

    # ── Step 3: EV Spec Matching ──────────────────────────────────
    st.divider()
    st.subheader("3. EV Specification")

    make = vehicle.get("make", "")
    model = vehicle.get("model", "")
    matches = match_ev_spec(make, model, ev_specs)

    selected_spec = None
    manual_spec = False

    if matches:
        if len(matches) == 1:
            selected_key = matches[0]
            st.success(f"Matched: {selected_key}")
        else:
            selected_key = st.selectbox("Select the correct variant:", matches)
        selected_spec = ev_specs[selected_key]

        sc1, sc2, sc3 = st.columns(3)
        with sc1:
            st.metric("Battery (Gross)", f"{selected_spec['battery_gross_kwh']} kWh")
            st.metric("Battery (Usable)", f"{selected_spec['battery_usable_kwh']} kWh")
        with sc2:
            st.metric("WLTP Range", f"{selected_spec['wltp_range_miles']} miles")
            st.metric("Warranty", f"{selected_spec['warranty_years']} yrs / {selected_spec['warranty_miles']:,} mi")
        with sc3:
            st.metric("AC Charge Rate", f"{selected_spec['charge_rate_ac_kw']} kW")
            st.metric("DC Charge Rate", f"{selected_spec['charge_rate_dc_kw']} kW")
    else:
        st.warning("Vehicle not found in EV spec database. Please enter battery details manually.")
        manual_spec = True

    if manual_spec or st.checkbox("Override with manual battery specs"):
        manual_spec = True
        ms1, ms2 = st.columns(2)
        with ms1:
            man_battery = st.number_input("Battery Capacity (kWh)", min_value=1.0, value=50.0, step=0.5)
        with ms2:
            man_wltp = st.number_input("WLTP Range (miles)", min_value=10, value=200, step=5)

    # ── Step 4: Range Preview & Generate ──────────────────────────
    st.divider()
    st.subheader("4. Range Estimates & Certificate Generation")

    wltp_range = selected_spec["wltp_range_miles"] if selected_spec else man_wltp if manual_spec else 200
    ranges = calculate_ranges(wltp_range, soh)

    rc1, rc2, rc3 = st.columns(3)
    with rc1:
        st.markdown(f"""
        <div class="metric-card">
            <p>Best Case (Urban)</p>
            <h3>{ranges['best_current']} mi</h3>
            <p>When new: {ranges['best_new']} mi</p>
        </div>
        """, unsafe_allow_html=True)
    with rc2:
        st.markdown(f"""
        <div class="metric-card" style="border-color: #2CAE66; border-width: 2px;">
            <p>Typical (Mixed)</p>
            <h3>{ranges['typical_current']} mi</h3>
            <p>When new: {ranges['typical_new']} mi</p>
        </div>
        """, unsafe_allow_html=True)
    with rc3:
        st.markdown(f"""
        <div class="metric-card">
            <p>Worst Case (Winter Mway)</p>
            <h3>{ranges['worst_current']} mi</h3>
            <p>When new: {ranges['worst_new']} mi</p>
        </div>
        """, unsafe_allow_html=True)

    st.write("")

    # Generate button
    if st.button("Generate Certificate", type="primary", use_container_width=True):
        with st.spinner("Generating certificate..."):
            mileage_val = int(vehicle.get("mileage", 0) or 0)
            w_years = selected_spec["warranty_years"] if selected_spec else 8
            w_miles = selected_spec["warranty_miles"] if selected_spec else 100000
            battery_gross = selected_spec["battery_gross_kwh"] if selected_spec else (man_battery if manual_spec else 50)

            warranty_status = determine_warranty_status(
                vehicle.get("first_registered", ""),
                mileage_val,
                w_years,
                w_miles,
            )

            # Resolve charging spec — from ev_specs.json or AI fallback
            ac_connector = selected_spec.get("ac_connector") if selected_spec else None
            dc_connector = selected_spec.get("dc_connector") if selected_spec else None
            charge_port_location = selected_spec.get("charge_port_location") if selected_spec else None
            ai_lookup_used = False

            if not ac_connector or not dc_connector or not charge_port_location:
                ai_result = lookup_charging_spec_ai(
                    vehicle.get("year", ""),
                    vehicle.get("make", ""),
                    vehicle.get("model", ""),
                )
                if ai_result:
                    ac_connector = ac_connector or ai_result.get("ac_connector")
                    dc_connector = dc_connector or ai_result.get("dc_connector")
                    charge_port_location = charge_port_location or ai_result.get("charge_port_location")
                    ai_lookup_used = True

            if ai_lookup_used:
                st.warning("Charging spec sourced via AI lookup — please verify")

            narrative = generate_narrative(
                make=vehicle.get("make", "Unknown"),
                model=vehicle.get("model", "Unknown"),
                year=vehicle.get("year", "Unknown"),
                mileage=mileage_val,
                soh=soh,
                grade=grade,
                typical_range=ranges["typical_current"],
                warranty_status=warranty_status,
                battery_gross_kwh=battery_gross,
                wltp_range_new=wltp_range,
                best_range=ranges["best_current"],
                worst_range=ranges["worst_current"],
                warranty_years=w_years,
                warranty_miles=w_miles,
            )

            st.info(f"**Assessment narrative:** {narrative}")

            cert_ref = generate_cert_ref()
            issue_date = datetime.now().strftime("%d %B %Y")
            filename = f"{cert_ref}_{reg_input.replace(' ', '')}.pdf"
            output_path = os.path.join(OUTPUT_DIR, filename)

            from pdf_generator import generate_certificate

            # Car outline image for charging port diagram
            car_outline_path = os.path.join(APP_DIR, "electric-car-outline-diagram-hybrid-260nw-2594309387.webp")
            if not os.path.exists(car_outline_path):
                car_outline_path = None

            pdf_data = {
                "reg_number": reg_input if reg_input else "UNKNOWN",
                "make": vehicle.get("make", ""),
                "model": vehicle.get("model", ""),
                "year": vehicle.get("year", ""),
                "colour": vehicle.get("colour", ""),
                "fuel_type": vehicle.get("fuel_type", "Electric"),
                "vin_last6": vehicle.get("vin_last6", ""),
                "mileage": mileage_val,
                "first_registered": vehicle.get("first_registered", ""),
                "first_registered_display": vehicle.get("first_registered_display", "Not available"),
                "soh": soh,
                "vehicle_image_url": vehicle.get("vehicle_image_url", ""),
                "ev_spec": selected_spec,
                "manual_battery_kwh": man_battery if manual_spec else None,
                "manual_wltp_range": man_wltp if manual_spec else None,
                "narrative": narrative,
                "cert_ref": cert_ref,
                "issue_date": issue_date,
                "logo_white": LOGO_WHITE,
                "logo_green": LOGO_GREEN,
                "bosch_logo": BOSCH_LOGO,
                "ac_connector": ac_connector or "Not available",
                "dc_connector": dc_connector or "Not available",
                "charge_port_location": charge_port_location or "Not available",
                "car_outline_path": car_outline_path,
                "ai_lookup_used": ai_lookup_used,
            }

            generate_certificate(pdf_data, output_path)

            st.success(f"Certificate generated: **{cert_ref}**")

            with open(output_path, "rb") as pdf_file:
                st.download_button(
                    label="Download Certificate PDF",
                    data=pdf_file.read(),
                    file_name=filename,
                    mime="application/pdf",
                    type="primary",
                    use_container_width=True,
                )

# Footer
st.divider()
st.caption("AZ Autos — Letchworth Garden City, Hertfordshire | azautos.co.uk | info@azautos.co.uk | 01462 438 999")
