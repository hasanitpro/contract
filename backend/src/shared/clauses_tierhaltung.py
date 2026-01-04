def build_tierhaltung_clause(mask_a: dict, mask_b: dict) -> str:
    """
    § 10 Tierhaltung
    """

    ton = (mask_b.get("tiere_ton") or "").lower()
    details = (mask_a.get("tiere_details") or "").strip()

    # -------------------------
    # VARIANT 3: Individuell
    # -------------------------
    if ton == "individuell":
        if details:
            return f"Sondervereinbarung: {details}"
        return ""

    # -------------------------
    # VARIANT 1: Standard
    # -------------------------
    if ton == "standard":
        base = (
            "Die Kleintierhaltung (Zierfische, Kleinvögel, Hamster, etc.) ist im "
            "üblichen Rahmen erlaubt. Andere Tiere dürfen nur mit vorheriger "
            "Zustimmung des Vermieters gehalten werden."
        )

    # -------------------------
    # VARIANT 2: Restriktiver
    # -------------------------
    elif ton == "restriktiver":
        base = (
            "Das Halten von Tieren bedarf der vorherigen schriftlichen Zustimmung "
            "des Vermieters. Dies gilt auch für Kleintiere. Der Vermieter kann die "
            "Zustimmung bei berechtigtem Interesse widerrufen."
        )

    else:
        return ""

    # -------------------------
    # OPTIONAL Sondervereinbarung (append)
    # -------------------------
    if details:
        return f"{base}\n\nSondervereinbarung: {details}"

    return base
