"""HTTP integration tests for FastAPI dependency helpers."""

import base64
import json
from typing import Optional

import pytest
from fastapi import Depends, FastAPI, Response
from fastapi.testclient import TestClient

from lri.lri import LRI
from lri.types import LCE, Intent, Policy


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


@pytest.mark.parametrize(
    "path,method,payload,header_factory,expected_status,expected_body",
    [
        ("/optional", "get", None, None, 200, {"intent": None}),
        (
            "/ingest",
            "post",
            {"message": "ping"},
            lambda lri: lri.create_header(
                LCE(
                    v=1,
                    intent=Intent(type="ask"),
                    policy=Policy(consent="team"),
                )
            ),
            200,
            {"intent": "ask", "echo": "ping"},
        ),
    ],
)
def test_dependency_accepts_valid_requests(
    fastapi_dependency_app,
    path,
    method,
    payload,
    header_factory,
    expected_status,
    expected_body,
):
    lri, client = fastapi_dependency_app

    headers = {}
    if header_factory:
        headers[lri.header_name] = header_factory(lri)

    request_kwargs = {"headers": headers}
    if payload is not None:
        request_kwargs["json"] = payload

    response = getattr(client, method)(path, **request_kwargs)
    assert response.status_code == expected_status
    assert response.json() == expected_body


def test_required_dependency_rejects_missing_header(fastapi_dependency_app):
    lri, client = fastapi_dependency_app
    response = client.post("/ingest", json={"message": "ping"})
    assert response.status_code == 428
    assert response.json() == {
        "detail": {"error": "LCE header required", "header": lri.header_name}
    }


@pytest.mark.parametrize(
    "overrides,expected_error,assertion",
    [
        (
            {"intent": {"type": "invalid"}},
            "Invalid LCE",
            lambda detail: (
                isinstance(detail.get("details"), list)
                and detail["details"]
                and detail["details"][0]["path"].startswith("/intent/type")
                and "Invalid intent type" in detail["details"][0]["message"]
            ),
        ),
        (
            {"unexpected": "value"},
            "LCE validation failed",
            lambda detail: (
                "unexpected" in detail.get("message", "")
                and "Extra inputs are not permitted" in detail["message"]
            ),
        ),
    ],
)
def test_dependency_returns_422_errors(
    fastapi_dependency_app, overrides, expected_error, assertion
):
    lri, client = fastapi_dependency_app
    header = _build_header(
        intent_type="ask",
        consent="private",
        overrides=overrides,
    )

    response = client.post(
        "/ingest",
        json={"message": "ping"},
        headers={lri.header_name: header},
    )

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["error"] == expected_error
    assert assertion(detail), detail


def test_dependency_returns_400_for_malformed_header(fastapi_dependency_app):
    lri, client = fastapi_dependency_app
    response = client.post(
        "/ingest",
        json={"message": "ping"},
        headers={lri.header_name: "!!!!"},
    )

    assert response.status_code == 400
    detail = response.json()["detail"]
    assert detail["error"] == "Malformed LCE header"
    assert detail["message"].startswith("Expecting value"), detail["message"]

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

