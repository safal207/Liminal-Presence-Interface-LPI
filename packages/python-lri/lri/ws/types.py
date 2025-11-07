"""
WebSocket LHS Protocol Types

LHS (Liminal Handshake Sequence) messages for WebSocket negotiation.
"""

from typing import Literal, Optional
from pydantic import BaseModel, Field

Encoding = Literal["json", "cbor"]
Feature = Literal["ltp", "lss", "compression"]


class LHSHello(BaseModel):
    """
    Step 1: Client → Server
    Client announces capabilities
    """

    step: Literal["hello"] = "hello"
    lri_version: str = "0.2"
    encodings: list[Encoding] = Field(default_factory=lambda: ["json", "cbor"])
    features: list[Feature] = Field(default_factory=lambda: ["ltp", "lss"])
    client_id: Optional[str] = None


class LHSMirror(BaseModel):
    """
    Step 2: Server → Client
    Server responds with selected options
    """

    step: Literal["mirror"] = "mirror"
    lri_version: str = "0.2"
    encoding: Encoding = "json"
    features: list[Feature] = Field(default_factory=list)
    server_id: Optional[str] = None


class LHSBind(BaseModel):
    """
    Step 3: Client → Server
    Client confirms and provides thread ID
    """

    step: Literal["bind"] = "bind"
    thread: Optional[str] = None
    auth: Optional[str] = Field(None, description="Authentication token")


class LHSSeal(BaseModel):
    """
    Step 4: Server → Client
    Server acknowledges, handshake complete
    """

    step: Literal["seal"] = "seal"
    session_id: str
    thread: Optional[str] = None
    status: Literal["ready"] = "ready"


LHSMessage = LHSHello | LHSMirror | LHSBind | LHSSeal
