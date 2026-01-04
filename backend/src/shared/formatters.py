from datetime import datetime
from typing import Union


def fmt_date_de(value: Union[str, datetime, None]) -> str:
    """
    Convert ISO date or datetime to German date format: DD.MM.YYYY
    """
    if not value:
        return ""

    if isinstance(value, datetime):
        return value.strftime("%d.%m.%Y")

    try:
        dt = datetime.fromisoformat(value)
        return dt.strftime("%d.%m.%Y")
    except Exception:
        return str(value)


def fmt_eur(value) -> str:
    """
    Format number as German EUR style:
    1200 -> 1.200,00
    """
    if value in (None, ""):
        return ""

    try:
        value = float(value)
        return f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except Exception:
        return str(value)

def fmt_decimal_de(value):
    """
    Format number as German decimal style:
    Wohnfläche: 75.5 → 75,50
    """
    try:
        return f"{float(value):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except (TypeError, ValueError):
        return ""

def format_iban(value: str) -> str:
    """
    Format IBAN in groups of 4 characters.
    Example:
    DE89370400440532013000 → DE89 3704 0044 0532 0130 00
    """
    if not value:
        return ""

    s = value.replace(" ", "").strip()
    return " ".join(s[i:i+4] for i in range(0, len(s), 4))
