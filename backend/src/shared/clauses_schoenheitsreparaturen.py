from __future__ import annotations

from typing import Any, Dict

from .formatters import fmt_eur


def _norm(s: Any) -> str:
    return (str(s or "")).strip().lower()


def build_schoenheitsreparaturen_clause(mask_a: Dict[str, Any], mask_b: Dict[str, Any]) -> str:
    """
    § 13 decision tree:

    STEP 1: Zustand bei Übergabe
      - renoviert OR neu erstellt -> CASE 1
      - gebraucht/vertragsgemäß -> STEP 2

    STEP 2: SR_Modell (from mask_b)
      - pauschal (ohne fristen) -> CASE 2a
      - kostenzuschuss -> CASE 2b-i
      - mietfreiheit -> CASE 2b-ii
    """

    zustand = _norm(mask_a.get("zustand"))

    # --------------------------
    # CASE 1: renovated/new
    # --------------------------
    if zustand in {"renoviert", "neu erstellt", "neu erstellt.", "neu"}:
        return (
            "Der Mieter trägt die Schönheitsreparaturen.\n\n"
            "Zu den Schönheitsreparaturen gehören: das Tapezieren, Anstreichen oder Kalken der Wände "
            "und Decken, das Streichen der Fußböden, Heizkörper einschließlich Heizrohre, der Innentüren "
            "sowie der Fenster und Außentüren von innen."
        )

    # We only branch into the complex variants when it is explicitly the unrenovated/used state:
    if zustand not in {"gebraucht/vertragsgemäß", "gebraucht", "vertragsgemäß"}:
        # Safe fallback (avoid wrong legal content if data is inconsistent)
        return ""

    # --------------------------
    # STEP 2: SR model
    # --------------------------
    sr_modell = _norm(mask_b.get("sr_modell"))

    # Accept a few common spellings from frontend/lawyer mask
    if sr_modell in {"pauschal", "pauschal (ohne fristen)", "ohne fristen"}:
        # CASE 2a
        return (
            "Die Wohnung wird unrenoviert oder renovierungsbedürftig vermietet und übergeben. "
            "Dieser Zustand wird als vertragsgerechter Sollzustand vereinbart. Keine Partei schuldet "
            "Schönheitsreparaturen.\n\n"
            "Bei einer wesentlichen Verschlechterung des anfänglichen Dekorationszustandes "
            "(Sollzustandes) kann der Mieter vom Vermieter die Durchführung von Schönheitsreparaturen verlangen. "
            "In diesem Falle ist der Mieter verpflichtet, sich in angemessenem— in der Regel hälftigem— Umfang "
            "an den erforderlichen Kosten zu beteiligen."
        )

    if sr_modell in {"kostenzuschuss", "zuschuss"}:
        # CASE 2b-i
        betrag_raw = mask_b.get("sr_kostenzuschuss_eur") or mask_b.get("sr_ausgleich_betrag")
        try:
            betrag = float(str(betrag_raw).replace(".", "").replace(",", "."))
        except Exception:
            betrag = 0.0

        if betrag <= 0:
            return ""  # don’t print broken clause

        return (
            "Die Wohnung wird unrenoviert bzw. renovierungsbedürftig vermietet und übergeben. "
            "Der Mieter verpflichtet sich, die erforderlichen Schönheitsreparaturen durchzuführen und erhält "
            f"vom Vermieter für diesen Zweck einen Kostenzuschuss in Höhe von {fmt_eur(betrag)} Euro.\n\n"
            "Zu den Schönheitsreparaturen gehören: das Tapezieren, Anstreichen oder Kalken der Wände und Decken, "
            "das Streichen der Fußböden, Heizkörper einschließlich Heizrohre, der Innentüren sowie der Fenster "
            "und Außentüren von innen."
        )

    if sr_modell in {"mietfreiheit", "mietfrei"}:
        # CASE 2b-ii
        monate_raw = mask_b.get("sr_mietfreiheit_monate") or mask_b.get("sr_ausgleich_monate")
        try:
            monate = int(str(monate_raw).strip())
        except Exception:
            monate = 0

        if monate <= 0:
            return ""

        return (
            "Die Wohnung wird unrenoviert bzw. renovierungsbedürftig vermietet und übergeben. "
            "Der Mieter verpflichtet sich, die erforderlichen Schönheitsreparaturen durchzuführen und erhält "
            f"vom Vermieter für diesen Zweck Mietfreiheit für {monate} Monate.\n\n"
            "Der Mieter ist in diesem Zeitraum von der Zahlung der Nettomiete befreit und hat lediglich die "
            "Betriebskosten einschließlich der Heiz- und Warmwasserkosten zu tragen und die vereinbarten "
            "Vorauszahlungen zu leisten.\n\n"
            "Zu den Schönheitsreparaturen gehören: das Tapezieren, Anstreichen oder Kalken der Wände und Decken, "
            "das Streichen der Fußböden, Heizkörper einschließlich Heizrohre, der Innentüren sowie der Fenster "
            "und Außentüren von innen."
        )

    # If model missing/unknown -> print nothing (safer than wrong text)
    return ""
