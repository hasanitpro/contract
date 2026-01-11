from __future__ import annotations
from typing import Any, Dict, Tuple


# ------------------------------------------------------------
# Mask A normalization (Mandantendaten)
# ------------------------------------------------------------

def normalize_mask_a(mask_a: Dict[str, Any]) -> Dict[str, Any]:
    raw = mask_a or {}

    out = {
        # ROLE
        "rolle": raw.get("rolle", ""),

        # -------------------------------------------------
        # Vermieter (Eigene Angaben)
        # -------------------------------------------------
        "vermieter_name": raw.get("eigene_name", ""),
        "vermieter_adresse": raw.get("eigene_anschrift", ""),
        "vermieter_email": raw.get("eigene_email", ""),
        "vermieter_telefon": raw.get("eigene_telefon", ""),
        "eigene_iban": raw.get("eigene_iban", ""),

        # -------------------------------------------------
        # Mieter (Gegenpartei)
        # -------------------------------------------------
        "mieter_name": raw.get("gegenpartei_name", ""),
        "mieter_adresse": raw.get("gegenpartei_anschrift", ""),
        "mieter_email": raw.get("gegenpartei_email", ""),
        "mieter_telefon": raw.get("gegenpartei_telefon", ""),
        "gegenpartei_iban": raw.get("zahler_iban", ""),

        # -------------------------------------------------
        # Representation (Eigene Angaben)
        # -------------------------------------------------
        "wird_vertreten": raw.get("wird_vertreten", ""),
        "vertreten_durch": raw.get("vertreten_durch", ""),

        # -------------------------------------------------
        # Tax IDs (Eigene Angaben)
        # -------------------------------------------------
        "ust_id": raw.get("ust_id", ""),
        "steuernummer": raw.get("steuernummer", ""),

        # -------------------------------------------------
        # Objekt / Wohnung (§ 1)
        # -------------------------------------------------
        "objekt_adresse": raw.get("objektadresse", ""),
        "wohnung_bez": raw.get("wohnung_bez", ""),
        "nebenraeume": raw.get("nebenraeume", []),
        "ausstattung": raw.get("ausstattung", ""),
        "wohnflaeche": raw.get("wohnflaeche", ""),
        "wohnungsart": raw.get("wohnungsart", ""),

        # WEG-related
        "weg": raw.get("weg", ""),
        "mea": raw.get("mea", ""),

        # Mietbeginn
        "mietbeginn": raw.get("mietbeginn"),

        # Zustand & Schlüssel
        "zustand": raw.get("zustand", ""),
        "schluessel_anzahl": raw.get("schluessel_anzahl", ""),
        "schluessel_arten": raw.get("schluessel_arten", []),

        # -------------------------------------------------
        # Miete & Nebenkosten (§ 4)
        # -------------------------------------------------

        "grundmiete": raw.get("grundmiete", ""),
        "zuschlag_moeblierung": raw.get("zuschlag_moeblierung", ""),
        "zuschlag_teilgewerbe": raw.get("zuschlag_teilgewerbe", ""),
        "zuschlag_unterverm": raw.get("zuschlag_unterverm", ""),
        "vz_heizung": raw.get("vz_heizung", ""),
        "vz_bk": raw.get("vz_bk", ""),
        "stellplatzmiete": raw.get("stellplatzmiete", ""),

        # -------------------------------------------------
        # Tierhaltung (§ 10)
        # -------------------------------------------------
        "tiere": raw.get("tiere", ""),
        "tiere_details": raw.get("tiere_details", ""),

        # -------------------------------------------------
        # Ort (derived)
        # -------------------------------------------------
        "ort": _extract_city(raw.get("objektadresse", "")),

        # -------------------------------------------------
        # Kaution (may be overwritten by Mask B)
        # -------------------------------------------------
        "kaution": raw.get("kaution", ""),

        # -------------------------------------------------
        # Keep raw for debugging
        # -------------------------------------------------
        "_raw": raw,
    }

    return out


def _extract_city(address: str) -> str:
    if not address:
        return ""
    parts = address.split(",")
    return parts[-1].strip() if len(parts) > 1 else ""


# ------------------------------------------------------------
# Mask B normalization (Anwaltsmaske)
# ------------------------------------------------------------

def normalize_mask_b(mask_b: Dict[str, Any]) -> Dict[str, Any]:
    raw = mask_b or {}

    staffel_raw = raw.get("staffelmiete_schedule", "")

    def _derive_sr_modell(raw: dict) -> str:
        # Matches your lawyer decision tree labels
        if raw.get("sr_unrenoviert_ohne") is True:
            return "Pauschal (ohne Fristen)"

        if raw.get("sr_unrenoviert_mit") is True:
            opt = (raw.get("sr_ausgleich_option") or "").strip().lower()
            if opt == "zuschuss":
                return "Kostenzuschuss"
            if opt == "mietfrei":
                return "Mietfreiheit"

        # fallback (safest / most conservative)
        return "Pauschal (ohne Fristen)"
    

    out = {
        # Vertragsart
        "vertragsart": raw.get("vertragsart_final", "").lower(),

        # Dates & money
        "mietbeginn": raw.get("ro_mietbeginn"),
        "miete_monatlich": raw.get("ro_grundmiete"),
        "kaution": raw.get("kaution"),

        # Mietanpassung
        "mietanpassung_model": (
            "STAFFEL"
            if raw.get("mietanpassung_normalfall") == "staffel"
            else "STANDARD"
        ),

        # Staffelmiete (ALWAYS list!)
        "staffelmiete_schedule": (
            staffel_raw
            if isinstance(staffel_raw, list)
            else _parse_staffel_text(staffel_raw)
        ),

        # WEG
        "weg_text": raw.get("weg_text", ""),

        # Mietpreisbremse – status
        "mietpreisbremse_status": _map_mietpreisbremse(raw),

        # ------------------------------
        # Mietpreisbremse – Justifications
        # ------------------------------
        "mpb_vormiet": raw.get("mpb_vormiet"),
        "mpb_grenze": raw.get("mpb_grenze"),

        "mpb_vormiete": bool(raw.get("mpb_vormiete")),
        "mpb_vormiete_text": raw.get("mpb_vormiete_text", ""),

        "mpb_modern": bool(raw.get("mpb_modern")),
        "mpb_modern_text": raw.get("mpb_modern_text", ""),

        "mpb_erstmiete": bool(raw.get("mpb_erstmiete")),
        "mpb_erstmiete_text": raw.get("mpb_erstmiete_text", ""),

        # Betriebskosten – Zusatzpositionen
        "zusatz_bk": raw.get("zusatz_bk", ""),

        # Untervermietung
        "unterverm_klausel": raw.get("unterverm_klausel", ""),
        # **this field not added yet in the frontend form**
        "unterverm_individuell_text": raw.get("unterverm_individuell_text", ""),

        # Kleinreparaturen
        "kleinrep_je": raw.get("kleinrep_je"),
        "kleinrep_jahr": raw.get("kleinrep_jahr"),
        "kleinreparaturen_model": "STANDARD",

        # Tierhaltung
        "tierhaltung_model": "PERMISSION_REQUIRED",
        
        # Tierhaltung tone (legal model)
        "tiere_ton": raw.get("tiere_ton", "").lower(),

        # Kündigung
        "kuendigungsverzicht": raw.get("kuendigungsverzicht"),

        # Umgebung / Lärm
        "umgebung_laerm": raw.get("umgebung_laerm", ""),

        # Schönheitsreparaturen
        "sr_modell": raw.get("sr_modell") or _derive_sr_modell(raw),

        # keep what you already pass
        "sr_ausgleich_betrag": raw.get("sr_ausgleich_betrag", ""),
        "sr_ausgleich_monate": raw.get("sr_ausgleich_monate", ""),

        # § 20 Beendigung des Mietverhältnisses
        "endrueckgabe_regel": raw.get("endrueckgabe_regel", ""),
        "endarbeiten_liste": raw.get("endarbeiten_liste", ""),

        "_raw": raw,
    }

    return out

# ------------------------------------------------------------
# Defaults (minimal, explicit)
# ------------------------------------------------------------

def apply_defaults(
    mask_a: Dict[str, Any],
    mask_b: Dict[str, Any],
) -> Tuple[Dict[str, Any], Dict[str, Any]]:

    a = dict(mask_a)
    b = dict(mask_b)

    a.setdefault("rolle", "")
    b.setdefault("vertragsart", "unbefristet")

    return a, b


# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------

def _parse_staffel_text(text: str) -> list[dict]:
    """
    Converts:
      "ab 01.01.2025 +50 EUR; ab 01.01.2026 +50 EUR"
    into:
      [
        {"ab": "2025-01-01", "miete": "50"},
        {"ab": "2026-01-01", "miete": "50"},
      ]
    """
    if not text or not isinstance(text, str):
        return []

    items = []
    for part in text.split(";"):
        part = part.strip()
        if not part:
            continue

        # very defensive parsing
        import re
        m = re.search(r"ab\s+(\d{2})\.(\d{2})\.(\d{4}).*?(\d+)", part)
        if not m:
            continue

        day, month, year, amount = m.groups()
        items.append({
            "ab": f"{year}-{month}-{day}",
            "miete": amount,
        })

    return items


def _map_mietpreisbremse(raw: dict) -> str:
    if raw.get("mpb_status") in ("bereits_vermietet", "neuvermietung"):
        return "COMPLIANT"
    return "NOT_APPLICABLE"
