from __future__ import annotations

from typing import Any, Dict, List, Tuple


def validate_core(mask_a: Dict[str, Any], mask_b: Dict[str, Any]) -> Tuple[bool, List[str]]:
    errors: List[str] = []

    # Minimal guardrails from project rules (extend as needed).
    vertragsart = (mask_b.get("vertragsart") or "").strip().lower()

    if vertragsart == "befristet":
        if not mask_b.get("mietende"):
            errors.append("Bei 'befristet' ist 'mietende' erforderlich.")
        if not mask_b.get("befristungsgrund"):
            errors.append("Bei 'befristet' ist 'befristungsgrund' erforderlich.")

    # Mutually exclusive example:
    if (mask_b.get("indexmiete") is True) and (mask_b.get("staffelmiete") is True):
        errors.append("Indexmiete und Staffelmiete dürfen nicht gleichzeitig aktiv sein.")

    # Basic presence checks that often break decision trees
    if not mask_a.get("rolle"):
        errors.append("maskA.rolle ist erforderlich (Vermieter/Mieter).")

    return (len(errors) == 0), errors
