"""
Config-driven maturity scoring engine.

The 5(+N) dimensions that sum into a subject's maturity score are NOT
hardcoded in Python — they're declared in config/maturity_dimensions.json.
Adding a new dimension (e.g. "Ownership coverage") means adding one entry to
that file; nothing here or in the routers needs to change, as long as the
raw signal it references already exists in the scoring context built in
seed.py's build_scoring_context().

Supported rule types:
  - boolean_field:    context[field] truthy -> 1.0 else 0.0
  - threshold_lte:    context[field] <= value -> 1.0 else 0.0
  - threshold_gte:    context[field] >= value -> 1.0 else 0.0
  - weighted_fields:  sum(context[c.field] * c.weight) for each component
  - assertion_pass:   0 if no assertions, 1 if any PASS, 0.5 if only FAIL
  - raw_field:        context[field] used as-is, clamped to [0, 1]
"""

import json
from functools import lru_cache
from pathlib import Path

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "maturity_dimensions.json"


@lru_cache(maxsize=1)
def load_dimensions_config():
    with open(CONFIG_PATH) as f:
        return json.load(f)["dimensions"]


def _coerce(value):
    if value is True:
        return 1.0
    if value is False or value is None:
        return 0.0
    return float(value)


def _eval_rule(rule: dict, context: dict) -> float:
    rtype = rule["type"]

    if rtype == "boolean_field":
        return 1.0 if context.get(rule["field"]) else 0.0

    if rtype == "threshold_lte":
        val = context.get(rule["field"])
        return 1.0 if val is not None and val <= rule["value"] else 0.0

    if rtype == "threshold_gte":
        val = context.get(rule["field"])
        return 1.0 if val is not None and val >= rule["value"] else 0.0

    if rtype == "weighted_fields":
        total = 0.0
        for comp in rule["components"]:
            total += _coerce(context.get(comp["field"])) * comp["weight"]
        return total

    if rtype == "assertion_pass":
        assertions = context.get("assertions") or []
        if not assertions:
            return 0.0
        if any(a.get("last_run_status") == "PASS" for a in assertions):
            return 1.0
        return 0.5

    if rtype == "raw_field":
        return max(0.0, min(1.0, _coerce(context.get(rule["field"]))))

    raise ValueError(f"unknown scoring rule type: {rtype}")


def compute_dimension_scores(context: dict) -> dict:
    """Returns {dimension_key: score} for every dimension in config."""
    return {d["key"]: round(_eval_rule(d["rule"], context), 2) for d in load_dimensions_config()}


def dimension_meta() -> list:
    return [
        {
            "key": d["key"],
            "label": d["label"],
            "weight": d.get("weight", 1.0),
            "responsible_role": d.get("responsible_role"),
        }
        for d in load_dimensions_config()
    ]


def dimension_keys() -> list:
    return [d["key"] for d in load_dimensions_config()]


def max_score() -> float:
    return sum(d.get("weight", 1.0) for d in load_dimensions_config())
