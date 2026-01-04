# Lawyer-approved Kleinreparaturen clauses (B6)

def build_kleinreparaturen_clause(
    model: str,
    max_per_repair: str | None,
    max_per_year: str | None,
) -> str:
    """
    Returns a legally safe Kleinreparaturen clause.
    """

    if model != "STANDARD":
        return (
            "Der Mieter ist nicht zur Durchführung oder Kostentragung von "
            "Kleinreparaturen verpflichtet."
        )

    return (
        "Der Mieter trägt die Kosten für Kleinreparaturen an den dem häufigen "
        "Zugriff des Mieters ausgesetzten Einrichtungen der Mietsache bis zu "
        f"einem Betrag von {max_per_repair} EUR je Einzelreparatur. "
        "Die Gesamtbelastung des Mieters ist auf "
        f"{max_per_year} EUR pro Kalenderjahr begrenzt."
    )
