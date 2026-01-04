# Lawyer-approved Mietpreisbremse clauses

from datetime import datetime, date

def parse_date(value) -> date | None:
    """
    Accepts:
    - 'YYYY-MM-DD'
    - 'DD.MM.YYYY'
    - date object
    Returns date or None.
    """
    if not value:
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        s = value.strip()
        # ISO: 2014-01-01
        try:
            return datetime.strptime(s, "%Y-%m-%d").date()
        except ValueError:
            pass
        # German: 01.01.2014
        try:
            return datetime.strptime(s, "%d.%m.%Y").date()
        except ValueError:
            pass
    return None


DATE_CUTOFF = date(2014, 10, 1)
JUNE_2015 = date(2015, 6, 1)

def build_mietpreisbremse_clause(mask_a: dict, mask_b: dict) -> str:
    parts = []

    bezugsfertig = parse_date(mask_a.get("bezugsfertig"))
    status = mask_b.get("mpb_status")

    # STAGE 1
    if bezugsfertig and bezugsfertig >= DATE_CUTOFF:
        return (
            "Die Wohnung, die Gegenstand dieses Mietvertrages ist, wurde vor dem "
            "1. Oktober 2014 weder genutzt noch vermietet. Eine Nutzung oder "
            "Vermietung erfolgte erst nach dem 1. Oktober 2014 (§ 556f BGB)."
        )

    # STAGE 2
    if status == "neubau":
        return (
            "Die Wohnung, die Gegenstand dieses Mietvertrages ist, wurde vor dem "
            "1. Oktober 2014 weder genutzt noch vermietet. Eine Nutzung oder "
            "Vermietung erfolgte erst nach dem 1. Oktober 2014 (§ 556f BGB)."
        )

    # STAGE 3
    vormiet = mask_b.get("mpb_vormiet")
    if vormiet == "vor_juni_2015":
        parts.append("Das Vormietverhältnis hat vor dem 1. Juni 2015 begonnen.")
        return "\n".join(parts)

    parts.append("Das Vormietverhältnis hat nach dem 1. Juni 2015 begonnen.")

    # STAGE 4
    unter_grenze = mask_b.get("mpb_grenze") == "ja"
    if unter_grenze:
        parts.append(
            "Die in diesem Mietvertrag geforderte Miete überschreitet die nach "
            "§ 556d BGB (sogenannte „Mietpreisbremse“) zulässige Miete nicht."
        )
        return "\n".join(parts)

    parts.append(
        "Die in diesem Mietvertrag geforderte Miete überschreitet die nach "
        "§ 556d BGB (sogenannte „Mietpreisbremse“) zulässige Miete."
    )

    parts.append(
        "Der Vermieter erklärt hiermit vor Mietvertragsabschluss, dass die "
        "vereinbarte Miete auf folgender Ausnahme von § 556d BGB "
        "(zulässige Miethöhe bei Mietbeginn) beruht:\n"
    )

    # Justifications
    if mask_b.get("mpb_vormiete"):
        parts.append("")  # empty line
        parts.append(
            f"Die Vormiete gemäß § 556e Abs. 1 BGB betrug "
            f"{mask_b.get('mpb_vormiete_text')} Euro (Nettokaltmiete)."
        )

    if mask_b.get("mpb_modern"):
        parts.append("")  # empty line
        parts.append(
            "In den letzten drei Jahren vor Beginn dieses Mietverhältnisses wurde "
            "eine Modernisierung im Sinne des § 555b BGB durchgeführt, für die "
            "eine Modernisierungsmieterhöhung zulässig gewesen wäre "
            "(§ 556e Abs. 2 BGB)."
        )
        if mask_b.get("mpb_modern_text"):
            parts.append("")  # empty line
            parts.append(mask_b["mpb_modern_text"])

    if mask_b.get("mpb_erstmiete"):
        parts.append("")  # empty line
        parts.append(
            "Bei diesem Mietvertragsabschluss handelt es sich um den ersten nach "
            "umfassender Modernisierung (§ 556f BGB)."
        )
        if mask_b.get("mpb_erstmiete_text"):
            parts.append("")  # empty line
            parts.append(mask_b["mpb_erstmiete_text"])

    return "\n".join(parts)

