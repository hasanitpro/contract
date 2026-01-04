def build_nebenkosten_clause(mask_b: dict) -> str:
    model = mask_b.get("nebenkosten_model", "NONE")

    if model == "NONE":
        return ""

    if model == "PAUSCHALE":
        amount = mask_b.get("nebenkosten_vorauszahlung_monatlich", "")
        return (
            "Die Betriebskosten sind mit einer monatlichen Pauschale abgegolten. "
            "Eine gesonderte Abrechnung erfolgt nicht."
            + (f" Die Pauschale beträgt {amount} EUR." if amount else "")
        )

    if model == "VORAUSZAHLUNG":
        amount = mask_b.get("nebenkosten_vorauszahlung_monatlich", "")
        abrechnung = mask_b.get("nebenkosten_abrechnung", "ANNUAL")

        text = (
            "Der Mieter leistet monatliche Vorauszahlungen auf die Betriebskosten."
        )

        if amount:
            text += f" Die Vorauszahlung beträgt {amount} EUR."

        if abrechnung == "ANNUAL":
            text += (
                " Über die Vorauszahlungen wird jährlich nach den gesetzlichen "
                "Vorschriften abgerechnet."
            )

        katalog = mask_b.get("betriebskosten_katalog", [])
        if katalog:
            text += (
                " Umlagefähig sind insbesondere folgende Betriebskosten: "
                + ", ".join(katalog)
                + "."
            )

        return text

    return ""
