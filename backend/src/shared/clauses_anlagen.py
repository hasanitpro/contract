from __future__ import annotations

from typing import List, Optional, Tuple

def build_annex_list(mask_b: dict) -> str:
    """
    Build a numbered annex list.

    Expected:
      mask_b["anlagen_model"] in {"NONE", "LIST"}
      mask_b["anlagen_list"] = ["...", "..."]
    """

    model = (mask_b.get("anlagen_model") or "NONE").upper()
    if model == "NONE":
        return ""

    items = mask_b.get("anlagen_list") or []
    if not isinstance(items, list):
        return ""

    # Clean + filter empty entries
    cleaned = [str(x).strip() for x in items if str(x).strip()]
    if not cleaned:
        return ""

    lines = ["Anlagen:"]
    for i, item in enumerate(cleaned, start=1):
        lines.append(f"{i}. {item}")

    return "\n".join(lines)

#------------------------------------------------------------
# Helpers for annex references in other clauses
#------------------------------------------------------------

def _match_name(item: str) -> str:
    return (item or "").strip().lower()


def _find_mv_index(annexes: List[str], needle: str) -> Optional[int]:
    """
    Returns 1-based MV index if found, else None.
    Matches case-insensitively by substring.
    """
    n = needle.strip().lower()
    for i, item in enumerate(annexes, start=1):
        if n in _match_name(item):
            return i
    return None


def build_complete_annex_list(annexes: List[str]) -> str:
    if not annexes:
        return ""

    lines = []
    for i, item in enumerate(annexes, start=1):
        lines.append(f"Anlage MV.{i}: {item}")
    return "\n".join(lines)


def resolve_annex_reference_numbers(annexes: List[str]) -> Tuple[str, str]:
    """
    Returns strings X and Y (for MV.[X], MV.[Y]).
    If not found, return empty string for that number.
    """
    x = _find_mv_index(annexes, "dsgvo")  # matches "DSGVO-Informationsblatt"
    y = _find_mv_index(annexes, "energieausweis")

    return (str(x) if x else "", str(y) if y else "")

#------------------------------------------------------------
# Clause builders  for clauses_anlagen.py
#------------------------------------------------------------

def _truthy(val) -> bool:
    return str(val or "").strip().lower() in {"ja", "yes", "true", "1"}

def build_clause_datenverarbeitung_energie_anlagen(mask_b: dict) -> str:
    anlagen = mask_b.get("anlagen") or []
    if not isinstance(anlagen, list):
        anlagen = []

    # ---- AUTO-ADD DSGVO annex if enabled but missing ----
    if _truthy(mask_b.get("dsgvo")):
        has_dsgvo = any("dsgvo" in str(x).lower() for x in anlagen)
        if not has_dsgvo:
            # Put DSGVO annex near the top (usually before Energieausweis or right after it)
            anlagen.insert(0, "DSGVO-Informationsblatt")

    # ---- Numbering MV.1, MV.2, ... ----
    numbered = [(i + 1, str(name)) for i, name in enumerate(anlagen)]

    x_num = next((n for n, name in numbered if "dsgvo" in name.lower()), None)
    y_num = next((n for n, name in numbered if "energieausweis" in name.lower()), None)

    # Build list text
    annex_lines = [f"Anlage MV.{n}: {name}" for n, name in numbered]
    annex_block = "\n".join(annex_lines) if annex_lines else "Es sind keine Anlagen vereinbart."

    # Build §22 text
    parts = ["§ 22 Datenverarbeitung", ""]

    # DSGVO paragraph (only if we have DSGVO annex number)
    if x_num is not None:
        parts.append(f"(1) Die Angaben nach Art. 13 DSGVO ergeben sich aus Anlage MV.{x_num} des Mietvertrages.")
        parts.append("")
    else:
        # If lawyer says DSGVO must exist but list doesn't have it, better fallback:
        parts.append("(1) Die Angaben nach Art. 13 DSGVO ergeben sich aus der entsprechenden Anlage des Mietvertrages.")
        parts.append("")

    # Energy certificate paragraph (only if found)
    if y_num is not None:
        parts.append(
            f"(2) Der Energieausweis liegt dem Mietvertrag als Anlage MV.{y_num} bei. "
            "Er dient lediglich der Information. Er wird weder Bestandteil des Mietvertrages "
            "noch Grundlage für Gewährleistungsansprüche."
        )
    else:
        parts.append(
            "(2) Der Energieausweis liegt dem Mietvertrag als Anlage bei. "
            "Er dient lediglich der Information. Er wird weder Bestandteil des Mietvertrages "
            "noch Grundlage für Gewährleistungsansprüche."
        )

    parts.append("")
    parts.append("Anlagen zum Mietvertrag:")
    parts.append("")
    parts.append(annex_block)

    return "\n".join(parts)
