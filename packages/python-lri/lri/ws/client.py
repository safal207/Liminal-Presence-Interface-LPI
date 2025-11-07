"""
LRI WebSocket Client with LHS Protocol
"""

import json
from typing import Optional, Callable
import websockets

from ..types import LCE
from .types import LHSHello, LHSMirror, LHSBind, LHSSeal, Encoding


class LRIWSClient:
    """WebSocket client with LHS (Liminal Handshake Sequence) protocol"""

    def __init__(
        self,
        url: str,
        encodings: Optional[list[Encoding]] = None,
        features: Optional[list[str]] = None,
        thread_id: Optional[str] = None,
    ):
        self.url = url
        self.encodings = encodings or ["json", "cbor"]
        self.features = features or ["ltp", "lss"]
        self.thread_id = thread_id
        self.websocket: Optional[websockets.WebSocketClientProtocol] = None
        self.session_id: Optional[str] = None
        self.negotiated_encoding: Optional[Encoding] = None
        self.on_message: Optional[Callable] = None

    async def connect(self):
        """Connect to server and perform LHS handshake"""
        self.websocket = await websockets.connect(self.url)
        print(f"[LRI WS Client] Connected to {self.url}")

        # Step 1: Send Hello to server
        hello = LHSHello(
            encodings=self.encodings,
            features=self.features,
            client_id="python-lri-client",
        )
        await self.websocket.send(hello.model_dump_json())
        print(f"[LRI WS Client] Sent hello")

        # Step 2: Receive Mirror from server
        mirror_msg = await self.websocket.recv()
        mirror = LHSMirror.model_validate_json(mirror_msg)
        self.negotiated_encoding = mirror.encoding
        print(f"[LRI WS Client] Received mirror: encoding={mirror.encoding}")

        # Step 3: Send Bind to server
        bind = LHSBind(thread=self.thread_id)
        await self.websocket.send(bind.model_dump_json())
        print(f"[LRI WS Client] Sent bind")

        # Step 4: Receive Seal from server
        seal_msg = await self.websocket.recv()
        seal = LHSSeal.model_validate_json(seal_msg)
        self.session_id = seal.session_id
        print(f"[LRI WS Client] Handshake complete: session={self.session_id}")

    async def send(self, lce: LCE):
        """Send LCE message to server"""
        if not self.websocket:
            raise RuntimeError("Not connected. Call connect() first.")

        message = lce.model_dump_json()
        await self.websocket.send(message)

    async def receive(self) -> LCE:
        """Receive LCE message from server"""
        if not self.websocket:
            raise RuntimeError("Not connected. Call connect() first.")

        message = await self.websocket.recv()
        lce_data = json.loads(message)
        return LCE.model_validate(lce_data)

    async def listen(self):
        """Listen for incoming messages"""
        if not self.websocket:
            raise RuntimeError("Not connected. Call connect() first.")

        async for message in self.websocket:
            try:
                lce_data = json.loads(message)
                lce = LCE.model_validate(lce_data)

                if self.on_message:
                    await self.on_message(lce)
            except Exception as e:
                print(f"[LRI WS Client] Error handling message: {e}")

    async def close(self):
        """Close the connection"""
        if self.websocket:
            await self.websocket.close()
            print("[LRI WS Client] Connection closed")
