def build_zusatz_bk_clause(mask_b: dict) -> str:
    """
    Builds § 7 (3) Zusatz-Betriebskosten list.
    """

    items = mask_b.get("zusatz_bk") or []

    if not isinstance(items, list) or not items:
        return "Es werden keine zusätzlichen Positionen vereinbart."

    lines = []
    for i, item in enumerate(items, start=1):
        item = str(item).strip()
        if not item:
            continue
        lines.append(f"{i}. {item}")

    return "\n".join(lines) if lines else "Es werden keine zusätzlichen Positionen vereinbart."
