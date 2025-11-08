"""
FastAPI + LRI Example

Demonstrates LRI usage with FastAPI
"""

from datetime import datetime
from typing import Optional
from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import JSONResponse
import sys
from pathlib import Path

# Add python-lri to path
sys.path.insert(0, str(Path(__file__).parents[2] / "packages" / "python-lri"))

from lri import LRI, LCE, Intent, Policy

app = FastAPI(title="LRI FastAPI Example")
lri = LRI()


@app.exception_handler(HTTPException)
async def passthrough_http_exception(_, exc: HTTPException):
    """Return structured errors so clients and tests can rely on the format."""
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.get("/ping")
async def ping(lce: Optional[LCE] = Depends(lri.dependency())):
    """Simple ping endpoint with optional LCE"""
    if lce:
        print(f"Intent: {lce.intent.type}")
        if lce.affect and lce.affect.tags:
            print(f"Affect: {lce.affect.tags}")

    return {
        "ok": True,
        "timestamp": datetime.utcnow().isoformat(),
        "received_lce": lce is not None,
    }


@app.post("/echo")
async def echo(body: dict, lce: Optional[LCE] = Depends(lri.dependency())):
    """Echo endpoint - mirrors LCE with response"""
    # Create response LCE
    response_lce = LCE(
        v=1,
        intent=Intent(type="tell", goal="Echo response"),
        policy=Policy(consent=lce.policy.consent if lce else "private"),
    )

    # Create response with LCE header
    response_data = {
        "echo": body,
        "lce": response_lce.model_dump(exclude_none=True),
    }

    response = JSONResponse(content=response_data)
    response.headers["LCE"] = lri.create_header(response_lce)
    response.headers["Content-Type"] = "application/liminal.lce+json"

    return response


@app.post("/ingest")
async def ingest(
    payload: dict,
    lce: LCE = Depends(lri.dependency(required=True)),
):
    """Require an LCE header before accepting data writes."""
    return {"intent": lce.intent.type, "echo": payload.get("message", "")}


@app.get("/api/data")
async def get_data(lce: Optional[LCE] = Depends(lri.dependency())):
    """Intent-aware endpoint"""
    intent_type = lce.intent.type if lce else "unknown"

    # Respond differently based on intent
    if intent_type == "ask":
        return {
            "message": "Here is the data you requested",
            "data": [1, 2, 3, 4, 5],
        }
    elif intent_type == "sync":
        return {
            "message": "Context synchronized",
            "coherence": lce.qos.coherence if lce and lce.qos else 0.5,
        }
    else:
        return {
            "message": "Data endpoint",
            "intent": intent_type,
        }


@app.get("/")
async def root():
    """Root endpoint with API info"""
    return {
        "name": "LRI FastAPI Example",
        "version": "0.1.0",
        "endpoints": [
            "/ping",
            "/echo",
            "/ingest",
            "/api/data",
        ],
        "lri": {
            "version": "0.1",
            "header": "LCE",
            "media_type": "application/liminal.lce+json",
        },
    }


if __name__ == "__main__":
    import uvicorn

    print("🚀 FastAPI + LRI server starting...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
