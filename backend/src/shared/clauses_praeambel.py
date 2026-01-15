from __future__ import annotations

from src.shared.formatters import fmt_date_de

def build_praeambel_block(mask_a: dict) -> str:
    if (mask_a.get("zustand") or "").strip().lower() != "neu erstellt":
        return ""

    date_text = fmt_date_de(mask_a.get("bezugsfertig"))
    if not date_text:
        date_text = ""  # or keep empty if date missing

    return (
        "Präambel - Besondere Hinweise\n\n"
        f"Die Wohnung wurde neu errichtet und am {date_text} bezugsfertig."
    )
