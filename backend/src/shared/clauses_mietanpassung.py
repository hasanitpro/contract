# Lawyer-approved Mietanpassung clauses (STANDARD / INDEX / STAFFEL)

def staffel_schedule_to_text(staffel_list: list[dict]) -> str:
    """
    staffel_list example:
    [
      {"ab": "2027-01-01", "miete": "1250"},
      {"ab": "2028-01-01", "miete": "1300"},
    ]
    """
    if not staffel_list:
        return "—"

    lines = []
    for i, row in enumerate(staffel_list, start=1):
        ab = str(row.get("ab", "")).strip()
        miete = str(row.get("miete", "")).strip()
        if not ab or not miete:
            continue
        lines.append(f"{i}. ab {ab}: {miete} EUR")
    return "\n".join(lines) if lines else "—"



def build_mietanpassung_clause(mask_b: dict) -> str:
    index = mask_b.get("indexmiete") == "Ja"
    staffel = mask_b.get("staffelmiete") == "Ja"

    if index and staffel:
        raise ValueError("Indexmiete und Staffelmiete dürfen nicht gleichzeitig aktiv sein")

    if index:
        return (
            "Die Miete ist als Indexmiete nach § 557b BGB vereinbart. "
            "Die Veränderung der Miethöhe erfolgt entsprechend der Veränderung "
            "des vom Statistischen Bundesamt ermittelten Verbraucherpreisindexes "
            "für Deutschland."
        )

    if staffel:
        return (
            "Die Miete ist als Staffelmiete vereinbart. "
            "Die Miete erhöht sich zu den folgenden Zeitpunkten:\n\n"
            + mask_b.get("STAFFEL_TEXT", "")
        )

    return "Die Veränderung der Miethöhe richtet sich nach den gesetzlichen Bestimmungen."
