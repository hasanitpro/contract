from datetime import datetime

from .formatters import fmt_date_de


def _parse_iso_date(value: str) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except Exception:
        return None


def _add_months(dt: datetime, months: int) -> datetime:
    """
    Add months to a date without external libraries.
    Handles year rollover correctly.
    """
    month = dt.month - 1 + months
    year = dt.year + month // 12
    month = month % 12 + 1

    # Clamp day to last day of target month
    day = min(
        dt.day,
        [31, 29 if year % 4 == 0 else 28, 31, 30, 31, 30,
         31, 31, 30, 31, 30, 31][month - 1]
    )

    return datetime(year, month, day)


def build_kuendigungsausschluss_clause(mask_b: dict) -> str:
    """
    Kündigungsausschluss / Mindestmietdauer clause.

    Model:
    - NONE
    - MUTUAL (wechselseitig)
    """

    model = (mask_b.get("kuendigungsausschluss_model") or "NONE").upper()
    months = mask_b.get("kuendigungsausschluss_monate")

    if model != "MUTUAL":
        return ""

    try:
        months_int = int(months)
    except Exception:
        return ""

    if months_int <= 0:
        return ""

    # Not applicable for fixed-term contracts
    if (mask_b.get("vertragsart") or "").lower() == "befristet":
        return ""

    start_dt = _parse_iso_date(mask_b.get("mietbeginn"))
    earliest_text = ""

    if start_dt:
        earliest_dt = _add_months(start_dt, months_int)
        earliest_text = fmt_date_de(earliest_dt)

    text = (
        f"Die Parteien verzichten wechselseitig für die Dauer von {months_int} Monaten "
        "ab Mietbeginn auf ihr Recht zur ordentlichen Kündigung."
    )

    if earliest_text:
        text += f" Eine ordentliche Kündigung ist erstmals zum {earliest_text} möglich."

    return text
