from __future__ import annotations

from src.shared.formatters import fmt_date_de


def _norm(s: str) -> str:
    return str(s or "").strip().lower()


def build_praeambel_block(mask_a: dict) -> str:
    """
    PRÄAMBEL: Only shown if Zustand_Bei_Uebergabe == 'neu erstellt'
    """
    zustand = _norm(mask_a.get("zustand"))

    if zustand != "neu erstellt":
        return ""

    date_txt = fmt_date_de(mask_a.get("bezugsfertig"))

    # If date missing/invalid, still show without date? (Safer to hide date only)
    if not date_txt:
        date_txt = "—"

    return (
        "Präambel - Besondere Hinweise\n\n"
        f"Die Wohnung wurde neu errichtet und am {date_txt} bezugsfertig."
    )
