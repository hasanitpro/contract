from __future__ import annotations

from typing import Any, Dict

from .formatters import fmt_date_de, fmt_eur, fmt_decimal_de, format_iban
from src.shared.clauses_mietpreisbremse import build_mietpreisbremse_clause
from src.shared.clauses_tierhaltung import build_tierhaltung_clause
from src.shared.clauses_mietanpassung import build_mietanpassung_clause
from src.shared.generator_docx import resolve_kuendigung
from src.shared.clauses_nebenkosten import build_nebenkosten_clause
from src.shared.clauses_kuendigungsausschluss import build_kuendigungsausschluss_clause
from src.shared.clauses_anlagen import build_annex_list, build_clause_datenverarbeitung_energie_anlagen
from src.shared.clauses_betriebskosten import build_zusatz_bk_clause
from src.shared.clauses_untervermietung import build_untervermietung_clause
from src.shared.clauses_haftung import build_haftungsbeschraenkung_clause
from src.shared.clauses_veraenderungen import build_veraenderungen_clause
from src.shared.clauses_schoenheitsreparaturen import build_schoenheitsreparaturen_clause
from src.shared.clauses_endrueckgabe import build_endrueckgabe_clause

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# ------------------------------------------------------------
# Header blocks
# ------------------------------------------------------------

def _build_party_block(
    *,
    name: str,
    address: str,
    represented: bool = False,
    representative: str = "",
    ust_id: str = "",
    tax_number: str = "",
) -> str:
    lines = []

    if name:
        lines.append(name)

    if represented and representative:
        lines.append(f"vertreten durch {representative}")

    if address:
        lines.append(address)

    if ust_id:
        lines.append(f"USt-ID: {ust_id}")

    if tax_number:
        lines.append(f"Steuernummer: {tax_number}")

    return "\n".join(lines)

def _build_signature_block(
    *,
    name: str,
    role_label: str,
    represented: bool = False,
    representative: str = "",
) -> str:
    lines = []

    if name:
        lines.append(name)

    if represented and representative:
        lines.append(f"vertreten durch {representative}")

    lines.append(role_label)

    return "\n".join(lines)


# ------------------------------------------------------------
# § 1 Mietgegenstand
# ------------------------------------------------------------

def build_mietgegenstand_block(mask_a: dict, mask_b: dict) -> str:
    lines = []

    # (1) Objektadresse
    lines.append(
        "(1) Vermietet werden im Gebäude\n"
        f"{mask_a.get('objekt_adresse', '')}\n\n"
        "folgende Wohnräume:"
    )

    # Wohnung description
    wohnung = mask_a.get("wohnung_bez", "")
    nebenraeume = mask_a.get("nebenraeume", [])

    beschreibung = wohnung
    if nebenraeume:
        beschreibung += ", bestehend aus " + ", ".join(nebenraeume)

    lines.append(beschreibung)

    # Ausstattung
    ausstattung = mask_a.get("ausstattung")
    lines.append(
        "\nMitvermietet werden folgende Einrichtungsgegenstände:\n"
        + (ausstattung if ausstattung else "keine")
    )

    # (2) Wohnfläche
    flaeche = fmt_decimal_de(mask_a.get("wohnflaeche"))
    lines.append(
        f"\n(2) Als Wohnfläche wird eine Größe von {flaeche} m² vereinbart. "
        "Bei der Ermittlung der Fläche wurden Flächen wie Balkone, Loggien "
        "und Terrassen zu 50 % berücksichtigt."
    )

    current_no = 3

    # (3) WEG paragraph (CONDITIONAL)
    if (
        mask_a.get("wohnungsart") == "Eigentumswohnung in Mehrfamilienhaus"
        and mask_a.get("weg") == "ja"
    ):
        mea = mask_a.get("mea", "")
        weg_text = mask_b.get("weg_text", "")

        weg_clause = (
            f"({current_no}) Umlageschlüssel für Nebenkosten bei Eigentumswohnung\n\n"
            "Der Mietgegenstand ist eine Eigentumswohnung. Die Abrechnung der "
            "Nebenkosten – ausgenommen der Grundsteuer und ggf. der Heizkosten – "
            "erfolgt im Rahmen der Wohnungseigentümergemeinschaft.\n\n"
            f"Auf die Wohnung entfallen {mea} Miteigentumsanteile."
        )

        if weg_text:
            weg_clause += "\n\n" + weg_text

        lines.append(weg_clause)

    return "\n\n".join(lines)

# ------------------------------------------------------------
# § 2 Zustand des Mietgegenstandes / Schlüssel
# ------------------------------------------------------------

def build_zustand_schluessel_block(mask_a: dict, mask_b: dict) -> str:
    lines = []

    # (1) Zustand
    lines.append(
        "(1) Der Mietgegenstand wird "
        f"{mask_b.get('ZUSTAND_TEXT')} übergeben."
    )

    # (2) Übergabeprotokoll
    lines.append(
        "(2) Über den Zustand des Mietgegenstandes zum Zeitpunkt der Übergabe "
        "erstellen die Parteien ein Übernahmeprotokoll."
    )

    umgebung = mask_b.get("umgebung_laerm", "")

    current_no = 3

    # Umgebung / Lärm
    if umgebung == "aufnehmen":
        lines.append(
            f"({current_no}) Vereinbarungen über die Lage bzw. das Umfeld "
            "des Mietgegenstands sind nicht getroffen. "
            "Insbesondere sind dem Mieter bekannt bzw. während der Besichtigung erkennbar gewesen:"
        )
        current_no += 1

        lines.append(
            f"({current_no}) Dem Mieter ist bekannt, dass sich der Mietgegenstand "
            "in einer Umgebung befindet, in der es zu situativen Geräuschentwicklungen kommen kann."
        )
        current_no += 1

        lines.append(
            f"({current_no}) Die Mietparteien sind sich einig, dass etwaige "
            "Beeinträchtigungen aus dem Umfeld oder von dritten Personen "
            "den Mieter nicht zur Minderung berechtigen."
        )
        current_no += 1

    elif umgebung == "nicht aufnehmen":
        lines.append(
            f"({current_no}) Vereinbarungen über die Lage bzw. das Umfeld "
            "des Mietgegenstands sind nicht getroffen."
        )
        current_no += 1

    # Schlüssel
    arten = ", ".join(mask_a.get("schluessel_arten", [])) or "—"
    anzahl = mask_a.get("schluessel_anzahl", "")

    lines.append(
        f"({current_no}) Der Mieter erhält vom Vermieter für die Mietzeit "
        "die im Übernahmeprotokoll aufgeführten Schlüssel. "
        f"Dies sind {anzahl} Schlüssel, davon:{arten}"
    )

    return "\n\n".join(lines)

# ------------------------------------------------------------
# § 3 Mietzeit
# ------------------------------------------------------------

def build_mietzeit_block(mask_a: dict, mask_b: dict) -> str:
    lines = []

    # (1) Mietbeginn
    mietbeginn = fmt_date_de(mask_a.get("mietbeginn"))
    lines.append(
        f"(1) Das Mietverhältnis beginnt am {mietbeginn}."
    )

    # (2) Unbefristet (current system)
    lines.append(
        "(2) Der Mietvertrag läuft auf unbestimmte Zeit und kann mit "
        "gesetzlicher Frist (§ 573c BGB) gekündigt werden."
    )

    current_no = 3

    # (3) Kündigungsverzicht – CONDITIONAL
    try:
        verzicht_jahre = int(mask_b.get("kuendigungsverzicht", 0))
    except (TypeError, ValueError):
        verzicht_jahre = 0

    if verzicht_jahre > 0:
        lines.append(
            f"({current_no}) Die Parteien verzichten für den Zeitraum von "
            f"{verzicht_jahre} Jahren auf das Recht zur ordentlichen Kündigung "
            "gemäß § 573c BGB. Das Recht zur außerordentlichen Kündigung bleibt "
            "hiervon unberührt."
        )
        current_no += 1

    # (§ 545 BGB) – ALWAYS included
    lines.append(
        f"({current_no}) § 545 BGB wird ausgeschlossen. Durch den Gebrauch "
        "des Mietgegenstands nach Vertragsablauf durch den Mieter verlängert "
        "sich das Mietverhältnis nicht."
    )

    return "\n\n".join(lines)

# ------------------------------------------------------------
# § 4 Miet- und Betriebskosten Tabelle
# ------------------------------------------------------------


def build_miete_bk_tabelle(mask_a: dict) -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    total = 0.0

    def add_row(label: str, value):
        nonlocal total
        try:
            amount = float(value)
        except (TypeError, ValueError):
            return

        if amount <= 0:
            return

        total += amount
        rows.append((label, fmt_eur(amount)))

    # Grundmiete (always)
    add_row("Die Miete beträgt monatlich", mask_a.get("grundmiete"))

    # Conditional surcharges
    add_row("+ Zuschlag für Möblierung", mask_a.get("zuschlag_moeblierung"))
    add_row("+ Zuschlag für teilgewerbliche Nutzung", mask_a.get("zuschlag_teilgewerbe"))
    add_row("+ Zuschlag für Untervermietung", mask_a.get("zuschlag_unterverm"))

    # Betriebskosten
    add_row(
        "Vorauszahlung für die Betriebskosten für Heizung und Warmwasser",
        mask_a.get("vz_heizung"),
    )
    add_row(
        "Vorauszahlung für andere Betriebskosten gemäß § 2 der Betriebskostenverordnung",
        mask_a.get("vz_bk"),
    )

    # Stellplatz
    add_row("Garagen- oder Stellplatzmiete", mask_a.get("stellplatzmiete"))

    # Gesamtbetrag (always last)
    rows.append(
        ("monatlich zu zahlender Gesamtbetrag", fmt_eur(total))
    )

    return rows

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def build_render_context(mask_a: dict, mask_b: dict) -> dict[str, str]:
    ctx = {}

    rolle = (mask_a.get("rolle") or "").lower()

    #--------------------------------------------------
    # Header Blocks - Helpers on top*
    #--------------------------------------------------
    # Determine landlord and tenant based on role for header blocks

    eigene = {
        "name": mask_a.get("vermieter_name"),
        "address": mask_a.get("vermieter_adresse"),
        "represented": mask_a.get("wird_vertreten") == "ja",
        "representative": mask_a.get("vertreten_durch"),
        "ust_id": mask_a.get("ust_id"),
        "tax_number": mask_a.get("steuernummer"),
    }

    gegenpartei = {
        "name": mask_a.get("mieter_name"),
        "address": mask_a.get("mieter_adresse"),
        "represented": False,  # representation applies only to Eigene_Angaben
        "representative": "",
        "ust_id": "",
        "tax_number": "",
    }

    if rolle == "vermieter":
        landlord = eigene
        tenant = gegenpartei
    elif rolle == "mieter":
        landlord = gegenpartei
        tenant = eigene
    else:
        landlord = eigene
        tenant = gegenpartei  # safe fallback

    ctx["LANDLORD_BLOCK"] = _build_party_block(
        name=landlord["name"],
        address=landlord["address"],
        represented=landlord["represented"],
        representative=landlord["representative"],
        ust_id=landlord["ust_id"],
        tax_number=landlord["tax_number"],
    )

    ctx["TENANT_BLOCK"] = _build_party_block(
        name=tenant["name"],
        address=tenant["address"],
        represented=tenant["represented"],
        representative=tenant["representative"],
        ust_id=tenant.get("ust_id", ""),
        tax_number=tenant.get("tax_number", ""),
    )

    #--------------------------------------------------
    # Signature Blocks - Helpers on top*
    #--------------------------------------------------
    # Determine landlord and tenant for signature blocks

    ctx["SIGNATURE_LANDLORD_BLOCK"] = _build_signature_block(
        name=landlord["name"],
        represented=landlord["represented"],
        representative=landlord["representative"],
        role_label="Vermieter",
    )

    ctx["SIGNATURE_TENANT_BLOCK"] = _build_signature_block(
        name=tenant["name"],
        represented=tenant["represented"],
        representative=tenant["representative"],
        role_label="Mieter",
    )

    # --------------------------------------------------
    # § 1 Mietgegenstand - helpers on top*
    # --------------------------------------------------

    ctx["MIETGEGENSTAND_BLOCK"] = build_mietgegenstand_block(mask_a, mask_b)
    
    #--------------------------------------------------
    # § 2 Zustand des Mietgegenstandes / Schlüssel - helpers on top*
    #--------------------------------------------------
    ctx["ZUSTAND_SCHLUESSEL_BLOCK"] = build_zustand_schluessel_block(mask_a, mask_b)

    #--------------------------------------------------
    # § 3 Mietzeit - helpers on top*
    #--------------------------------------------------
    ctx["MIETZEIT_BLOCK"] = build_mietzeit_block(mask_a, mask_b)

    # --------------------------------------------------
    # § 4 Miet- und Betriebskosten - helpers on top*
    # --------------------------------------------------
    ctx["MIETE_BK_TABELLE"] = build_miete_bk_tabelle(mask_a)

    # -------------------------------------------------
    # § 7 Betriebskosten – Zusatzpositionen
    # -------------------------------------------------

    ctx["ZUSATZ_BK"] = build_zusatz_bk_clause(mask_b)

    #--------------------------------------------------
    # § 9 Untervermietung
    #--------------------------------------------------

    ctx["CLAUSE_UNTERVERMIETUNG"] = build_untervermietung_clause(mask_b)

    # --------------------------------------------------
    # § 10 Tierhaltung
    # --------------------------------------------------
    ctx["CLAUSE_TIERHALTUNG"] = build_tierhaltung_clause(mask_a, mask_b)

    # --------------------------------------------------
    # § 11 Haftungsbeschränkung
    # --------------------------------------------------
    ctx["CLAUSE_HAFTUNGSBESCHRAENKUNG"] = build_haftungsbeschraenkung_clause()

    # --------------------------------------------------
    # § 12 Veränderungen an und im Mietgegenstand durch den Mieter
    # --------------------------------------------------
    ctx["CLAUSE_VERAENDERUNGEN"] = build_veraenderungen_clause()

    #--------------------------------------------------
    # § 13 Schönheitsreparaturen
    #--------------------------------------------------
    ctx["CLAUSE_SCHOENHEITSREPARATUREN"] = build_schoenheitsreparaturen_clause(mask_a, mask_b)

    #--------------------------------------------------
    # § 20 Beendigung des Mietverhältnisses
    #--------------------------------------------------
    ctx["CLAUSE_ENDRUECKGABE"] = build_endrueckgabe_clause(mask_b)

    # --------------------------------------------------
    # § 22 Datenverarbeitung und Energieausweis – Anlagen
    # --------------------------------------------------
    ctx["CLAUSE_DATENVERARBEITUNG_ENERGIE_ANLAGEN"] = build_clause_datenverarbeitung_energie_anlagen(mask_b)

    ####################################################
    # Money
    ctx["RENT_AMOUNT"] = fmt_eur(mask_b.get("miete_monatlich"))

    # --------------------------------------------------
    # § 8 Mietsicherheit (Kaution)
    # --------------------------------------------------

    grundmiete_raw = mask_b.get("miete_monatlich")
    kaution_monate_raw = mask_a.get("kaution") or mask_b.get("kaution")

    try:
        grundmiete = float(grundmiete_raw)
        kaution_monate = int(kaution_monate_raw)
    except (TypeError, ValueError):
        grundmiete = 0
        kaution_monate = 0

    kaution_betrag = grundmiete * kaution_monate

    if kaution_monate and grundmiete:
        ctx["CLAUSE_MIETSICHERHEIT"] = (
            f"(1) Der Mieter ist verpflichtet, eine Mietsicherheit in Höhe von "
            f"{kaution_monate} Monatsmieten = "
            f"{fmt_eur(kaution_betrag)} EUR an den Vermieter zu leisten.\n\n"
            "(2) Der Mieter ist zu drei gleichen monatlichen Teilzahlungen berechtigt.\n\n"
            "(3) Die erste Teilzahlung ist zu Beginn des Mietverhältnisses fällig. "
            "Die weiteren Teilzahlungen werden zusammen mit den unmittelbar folgenden Mietzahlungen fällig.\n\n"
            "(4) Für die Anlage der Mietkaution sowie die Verzinsung gelten die gesetzlichen Bestimmungen."
        )
    else:
        ctx["CLAUSE_MIETSICHERHEIT"] = ""


    # City and date
    ctx["CITY_AND_DATE"] = (
        f"{mask_a.get('ort', '')}, {fmt_date_de(mask_b.get('mietbeginn'))}"
    )

    ctx["RENT_START_DATE"] = fmt_date_de(mask_b.get("mietbeginn"))
    ctx["CONTRACT_TYPE"] = mask_b.get("vertragsart", "")

    # Kündigung / Laufzeit / Befristung
    # Resolve termination timing and clauses to keep contract timeline consistent.
    ctx.update(resolve_kuendigung(mask_b))

    # --------------------------------------------------
    # § 14 Kleinreparaturen (UPDATED – calculation based)
    # --------------------------------------------------

    je_raw = mask_b.get("kleinrep_je")
    jahr_raw = mask_b.get("kleinrep_jahr")

    betrag_je_text = f"{je_raw} €" if je_raw else ""
    jahresgrenze_text = ""

    if jahr_raw:
        jahr_raw = str(jahr_raw).strip()

        if "%" in jahr_raw:
            try:
                percent = float(jahr_raw.replace("%", ""))
                jahresgrenze = grundmiete * 12 * (percent / 100)
                jahresgrenze_text = f"{fmt_eur(jahresgrenze)} EUR"
            except ValueError:
                pass
        else:
            try:
                fixed = float(jahr_raw.replace(",", "."))
                jahresgrenze_text = f"{fmt_eur(fixed)} EUR"
            except ValueError:
                pass

    if betrag_je_text and jahresgrenze_text:
        ctx["CLAUSE_KLEINREPARATUREN"] = (
            "(1) Der Mieter ist verpflichtet, die Kosten für Kleinreparaturen "
            "an allen Teilen des Mietgegenstandes zu tragen, die seinem häufigen Zugriff ausgesetzt sind.\n\n"
            f"(2) Die Kostentragungspflicht ist für die einzelne Reparatur auf "
            f"{betrag_je_text} (inklusive Umsatzsteuer) begrenzt. "
            f"Außerdem ist die Kostentragungspflicht für alle Kleinreparaturen "
            f"im Kalenderjahr auf {jahresgrenze_text} begrenzt."
        )
    else:
        ctx["CLAUSE_KLEINREPARATUREN"] = ""

    # --------------------------------------------------
    # Mietanpassung / Staffel
    # --------------------------------------------------

    # Build rent adjustment clause to reflect schedule and permissible changes.
    ctx["CLAUSE_MIETANPASSUNG"] = build_mietanpassung_clause(mask_b)
    # Add rent cap clause to capture regulatory constraints when applicable.
    ctx["CLAUSE_MIETPREISBREMSE"] = build_mietpreisbremse_clause(mask_a, mask_b)

    # -------------------------------------------------
    # § 6 (2) IBAN – always landlord's account
    # -------------------------------------------------

    rolle = mask_a.get("rolle", "").lower()

    if rolle == "vermieter":
        iban_raw = mask_a.get("eigene_iban", "")
    else:
        # Client is tenant → landlord is Gegenpartei
        iban_raw = mask_a.get("gegenpartei_iban", "")  # adjust if you named it differently

    ctx["IBAN"] = format_iban(iban_raw)



    # --------------------------------------------------
    # Nebenkosten
    # --------------------------------------------------

    ctx["CLAUSE_NEBENKOSTEN"] = build_nebenkosten_clause(mask_b)

    # --------------------------------------------------
    # Kündigungsausschluss
    # --------------------------------------------------

    ctx["CLAUSE_KUENDIGUNGSAUSSCHLUSS"] = build_kuendigungsausschluss_clause(mask_b)

    # --------------------------------------------------
    # Anlagen
    # --------------------------------------------------

    annex_text = build_annex_list(mask_b)
    ctx["ANNEX_BLOCK"] = (
        "§ Anlagen / Vertragsbestandteile\n\n" + annex_text
        if annex_text else ""
    )

    return ctx
