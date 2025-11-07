"""HTTP integration tests for FastAPI dependency helpers."""

import base64
import json
from typing import Optional

import pytest
from fastapi import Depends, FastAPI, Response
from fastapi.testclient import TestClient

from lri import LCE, Intent, LRI, Policy


def _decode_lce_header(header_value: str) -> dict:
    decoded = base64.b64decode(header_value).decode("utf-8")
    return json.loads(decoded)


@pytest.fixture()
def fastapi_dependency_app() -> tuple[LRI, TestClient]:
    """Create a FastAPI app configured with the LRI dependency."""

    lri = LRI()
    app = FastAPI()

    @app.get("/optional")
    async def optional_endpoint(
        lce: Optional[LCE] = Depends(lri.dependency())
    ) -> dict[str, Optional[str]]:
        return {"intent": lce.intent.type if lce else None}

    @app.post("/ingest")
    async def ingest_endpoint(
        payload: dict, lce: LCE = Depends(lri.dependency(required=True))
    ) -> dict[str, str]:
        return {"intent": lce.intent.type, "echo": payload.get("message", "")}

    @app.get("/respond")
    async def respond_endpoint(
        response: Response, lce: Optional[LCE] = Depends(lri.dependency())
    ) -> dict[str, Optional[str]]:
        response_lce = LCE(
            v=1,
            intent=Intent(type="tell", goal="Response payload"),
            policy=Policy(consent="public"),
        )
        response.headers[lri.header_name] = lri.create_header(response_lce)
        return {
            "request_intent": lce.intent.type if lce else None,
            "response_intent": response_lce.intent.type,
        }

    return lri, TestClient(app)


def _build_header(
    *,
    intent_type: str = "ask",
    consent: str = "private",
    overrides: Optional[dict] = None,
) -> str:
    lce = {
        "v": 1,
        "intent": {"type": intent_type},
        "policy": {"consent": consent},
    }

    for key, value in (overrides or {}).items():
        if key in {"intent", "policy"} and isinstance(value, dict):
            lce[key].update(value)
        else:
            lce[key] = value

    header_bytes = json.dumps(lce).encode("utf-8")
    return base64.b64encode(header_bytes).decode("utf-8")


def test_optional_dependency_handles_missing_header(fastapi_dependency_app):
    lri, client = fastapi_dependency_app
    response = client.get("/optional")
    assert response.status_code == 200
    assert response.json() == {"intent": None}

    header = lri.create_header(
        LCE(v=1, intent=Intent(type="notify"), policy=Policy(consent="team"))
    )
    response = client.get("/optional", headers={lri.header_name: header})
    assert response.status_code == 200
    assert response.json() == {"intent": "notify"}


def test_required_dependency_rejects_missing_header(fastapi_dependency_app):
    _, client = fastapi_dependency_app
    response = client.post("/ingest", json={"message": "ping"})
    assert response.status_code == 428
    assert response.json() == {
        "detail": {"error": "LCE header required", "header": "LCE"}
    }


def test_dependency_returns_422_with_schema_errors(fastapi_dependency_app):
    lri, client = fastapi_dependency_app
    header = _build_header(
        intent_type="ask",
        consent="private",
        overrides={"intent": {"type": "invalid"}},
    )

    response = client.post("/ingest", json={"message": "ping"}, headers={"LCE": header})

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["error"] == "Invalid LCE"
    assert any(err["path"].startswith("/intent") for err in detail["details"])


def test_dependency_returns_422_with_model_errors(fastapi_dependency_app):
    lri, client = fastapi_dependency_app
    header = _build_header(
        intent_type="tell",
        consent="private",
        overrides={"unexpected": "value"},
    )

    response = client.post("/ingest", json={"message": "ping"}, headers={"LCE": header})

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["error"] == "LCE validation failed"
    assert "unexpected" in detail["message"]


def test_dependency_round_trips_response_headers(fastapi_dependency_app):
    lri, client = fastapi_dependency_app
    request_header = lri.create_header(
        LCE(v=1, intent=Intent(type="ask"), policy=Policy(consent="private"))
    )

    response = client.get("/respond", headers={"LCE": request_header})

    assert response.status_code == 200
    payload = response.json()
    assert payload["request_intent"] == "ask"
    assert payload["response_intent"] == "tell"

    encoded_header = response.headers[lri.header_name]
    decoded_header = _decode_lce_header(encoded_header)
    assert decoded_header["intent"]["type"] == "tell"
    assert decoded_header["policy"]["consent"] == "public"

