# src/shared/clauses_untervermietung.py

def build_untervermietung_clause(mask_b: dict) -> str:
    model = mask_b.get("unterverm_klausel", "")
    custom_text = mask_b.get("unterverm_individuell_text", "")

    if model == "Zustimmung + Sicherungsabtretung":
        return (
            "(3) Für den Fall einer Untervermietung tritt der Mieter die ihm gegen "
            "den Untermieter zustehenden Forderungen nebst Pfandrecht bis zur Höhe "
            "der Mietforderungen des Vermieters an den Vermieter ab. "
            "Der Vermieter nimmt die Abtretung an."
        )

    if model == "nur Zustimmung":
        return (
            "(3) Der Mieter hat die Zustimmung des Vermieters einzuholen, bevor er "
            "den Mietgegenstand oder Teile davon einem Dritten zum Gebrauch überlässt."
        )

    if model == "individuell" and custom_text.strip():
        return f"(3) {custom_text.strip()}"

    # Safety fallback → no § (3)
    return ""
