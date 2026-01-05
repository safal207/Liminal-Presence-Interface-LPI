"""
LCE validation against JSON Schema
"""

import json
from pathlib import Path
from typing import Any, Optional


def load_schema() -> dict[str, Any]:
    """Load LCE JSON Schema"""
    schema_path = Path(__file__).parents[3] / "schemas" / "lce-v0.1.json"
    with open(schema_path, "r") as f:
        return json.load(f)


def validate_lce(data: dict[str, Any]) -> Optional[list[dict[str, str]]]:
    """
    Validate LCE data against JSON Schema

    Args:
        data: LCE data to validate

    Returns:
        List of validation errors, or None if valid

    Note:
        This is a basic validator. For production use, consider jsonschema library.
    """
    errors = []

    # Check required fields
    if "v" not in data:
        errors.append({"path": "/v", "message": "Required field 'v' missing"})
    elif data["v"] != 1:
        errors.append({"path": "/v", "message": "Version must be 1"})

    if "intent" not in data:
        errors.append({"path": "/intent", "message": "Required field 'intent' missing"})
    elif not isinstance(data["intent"], dict):
        errors.append({"path": "/intent", "message": "Intent must be an object"})
    elif "type" not in data["intent"]:
        errors.append(
            {"path": "/intent/type", "message": "Required field 'type' missing"}
        )
    else:
        valid_intents = [
            "ask",
            "tell",
            "propose",
            "confirm",
            "notify",
            "sync",
            "plan",
            "agree",
            "disagree",
            "reflect",
        ]
        if data["intent"]["type"] not in valid_intents:
            errors.append(
                {
                    "path": "/intent/type",
                    "message": f"Invalid intent type. Must be one of: {', '.join(valid_intents)}",
                }
            )

    if "policy" not in data:
        errors.append({"path": "/policy", "message": "Required field 'policy' missing"})
    elif not isinstance(data["policy"], dict):
        errors.append({"path": "/policy", "message": "Policy must be an object"})
    elif "consent" not in data["policy"]:
        errors.append(
            {"path": "/policy/consent", "message": "Required field 'consent' missing"}
        )
    else:
        valid_consent = ["private", "team", "public"]
        if data["policy"]["consent"] not in valid_consent:
            errors.append(
                {
                    "path": "/policy/consent",
                    "message": f"Invalid consent level. Must be one of: {', '.join(valid_consent)}",
                }
            )

    # Validate affect.pad if present
    if "affect" in data and isinstance(data["affect"], dict):
        if "pad" in data["affect"]:
            pad = data["affect"]["pad"]
            if not isinstance(pad, list) or len(pad) != 3:
                errors.append(
                    {"path": "/affect/pad", "message": "PAD must be array of 3 numbers"}
                )
            elif not all(isinstance(x, (int, float)) and -1 <= x <= 1 for x in pad):
                errors.append(
                    {
                        "path": "/affect/pad",
                        "message": "PAD values must be numbers in range [-1, 1]",
                    }
                )

    # Validate qos.coherence if present
    if "qos" in data and isinstance(data["qos"], dict):
        if "coherence" in data["qos"]:
            coherence = data["qos"]["coherence"]
            if not isinstance(coherence, (int, float)) or not (0 <= coherence <= 1):
                errors.append(
                    {
                        "path": "/qos/coherence",
                        "message": "Coherence must be number in range [0, 1]",
                    }
                )

    return errors if errors else None
