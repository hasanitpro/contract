from __future__ import annotations

from typing import Any


def _endarbeiten_to_text(value: Any) -> str:
    """
    Accepts:
      - string: "1. ...\n2. ..."
      - list[str]: ["Wände weiß streichen", "Dübellöcher schließen"]
    Returns clean multiline text.
    """
    if value is None:
        return ""

    if isinstance(value, list):
        items = []
        for x in value:
            s = str(x).strip()
            if s:
                items.append(s)
        return "\n".join(items).strip()

    return str(value).strip()


def build_endrueckgabe_clause(mask_b: dict) -> str:
    regel = str(mask_b.get("endrueckgabe_regel") or "").strip().lower()
    endarbeiten_text = _endarbeiten_to_text(mask_b.get("endarbeiten_liste"))

    # -------------------------
    # VARIANT A: Standard
    # -------------------------
    if regel in ("vertragsgemäß/sauber", "vertragsgemaess/sauber"):
        return (
            "(1) Bei Beendigung des Mietverhältnisses hat der Mieter den Mietgegenstand "
            "in sauberem und vertragsgemäßem Zustand (vgl. §§ 13 - 17) zurückzugeben."
            "(2) Er hat alle Schlüssel, von ihm selbst beschaffte, zurückzugeben.\n"
            "(3) Er hat dem Vermieter bei Auszug aus der Wohnung – auch wenn dieser vor "
            "Beendigung des Mietverhältnisses erfolgt – unverzüglich seine neue Anschrift mitzuteilen."
        )

    # -------------------------
    # VARIANT B: Endarbeiten
    # -------------------------
    if regel in ("zusätzliche endarbeiten", "zusaetzliche endarbeiten"):
        list_block = f"\n\n{endarbeiten_text}\n" if endarbeiten_text else "\n"
        return (
            "(1) Bei Beendigung des Mietverhältnisses hat der Mieter den Mietgegenstand "
            "in sauberem und vertragsgemäßem Zustand (vgl. §§ 13 - 17) zurückzugeben und "
            "folgende Endarbeiten durchzuführen:"
            f"{list_block}\n"
            "(2) Er hat alle Schlüssel, von ihm selbst beschaffte, zurückzugeben.\n"
            "(3) Er hat dem Vermieter bei Auszug aus der Wohnung – auch wenn dieser vor "
            "Beendigung des Mietverhältnisses erfolgt – unverzüglich seine neue Anschrift mitzuteilen."
        )

    # Unknown / not set -> empty so placeholder paragraph can be removed
    return ""
