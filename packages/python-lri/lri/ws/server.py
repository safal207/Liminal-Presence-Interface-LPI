"""
LRI WebSocket Server with LHS Protocol
"""

import asyncio
import json
import uuid
from typing import Callable, Optional
import websockets
from websockets.server import WebSocketServerProtocol

from ..types import LCE
from .types import LHSHello, LHSMirror, LHSBind, LHSSeal, Encoding


class LRIWSServer:
    """WebSocket server with LHS (Liminal Handshake Sequence) protocol"""

    def __init__(
        self,
        host: str = "127.0.0.1",
        port: int = 8765,
        encoding: Encoding = "json",
        features: Optional[list[str]] = None,
    ):
        self.host = host
        self.port = port
        self.encoding = encoding
        self.features = features or ["ltp", "lss"]
        self.server: Optional[websockets.WebSocketServer] = None
        self.sessions: dict[str, dict] = {}
        self.on_message: Optional[Callable] = None

    async def start(self):
        """Start the WebSocket server"""
        self.server = await websockets.serve(
            self._handle_connection, self.host, self.port
        )
        print(f"[LRI WS] Server started on ws://{self.host}:{self.port}")

    async def _handle_connection(self, websocket: WebSocketServerProtocol):
        """Handle new WebSocket connection with LHS handshake"""
        session_id = str(uuid.uuid4())
        thread_id: Optional[str] = None

        try:
            # Step 1: Receive Hello from client
            hello_msg = await websocket.recv()
            hello = LHSHello.model_validate_json(hello_msg)
            print(f"[LRI WS] Received hello: {hello.encodings}")

            # Step 2: Send Mirror to client
            encoding = hello.encodings[0] if hello.encodings else "json"
            mirror = LHSMirror(
                encoding=encoding,
                features=self.features,
                server_id=f"lri-server-{session_id[:8]}",
            )
            await websocket.send(mirror.model_dump_json())
            print(f"[LRI WS] Sent mirror: encoding={encoding}")

            # Step 3: Receive Bind from client
            bind_msg = await websocket.recv()
            bind = LHSBind.model_validate_json(bind_msg)
            thread_id = bind.thread
            print(f"[LRI WS] Received bind: thread={thread_id}")

            # Step 4: Send Seal to client
            seal = LHSSeal(
                session_id=session_id, thread=thread_id, status="ready"
            )
            await websocket.send(seal.model_dump_json())
            print(f"[LRI WS] Handshake complete: session={session_id}")

            # Store session
            self.sessions[session_id] = {
                "thread": thread_id,
                "encoding": encoding,
                "websocket": websocket,
            }

            # Handle messages
            async for message in websocket:
                try:
                    # Parse LCE message
                    lce_data = json.loads(message)
                    lce = LCE.model_validate(lce_data)

                    # Call message handler
                    if self.on_message:
                        await self.on_message(lce, session_id, thread_id)

                except Exception as e:
                    print(f"[LRI WS] Error handling message: {e}")

        except websockets.exceptions.ConnectionClosed:
            print(f"[LRI WS] Connection closed: session={session_id}")
        finally:
            # Cleanup session
            if session_id in self.sessions:
                del self.sessions[session_id]

    async def send(self, session_id: str, lce: LCE):
        """Send LCE message to specific session"""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")

        websocket = session["websocket"]
        message = lce.model_dump_json()
        await websocket.send(message)

    async def stop(self):
        """Stop the server"""
        if self.server:
            self.server.close()
            await self.server.wait_closed()
            print("[LRI WS] Server stopped")
