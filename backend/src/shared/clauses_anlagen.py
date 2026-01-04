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
