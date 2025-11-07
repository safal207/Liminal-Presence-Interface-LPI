"""
Example: WebSocket Server and Client with LHS Protocol

Demonstrates:
- WebSocket server with LHS handshake
- WebSocket client with LHS handshake
- LCE message exchange
- LTP signing
- LSS coherence tracking
- CBOR encoding
"""

import asyncio
from lri import LCE, Intent, Policy, ws, ltp, LSS, cbor


async def run_server():
    """Run WebSocket server"""
    # Create server
    server = ws.LRIWSServer(host="127.0.0.1", port=8765)

    # Create LSS for coherence tracking
    lss = LSS()

    # Message handler
    async def on_message(lce: LCE, session_id: str, thread_id: str):
        print(f"[Server] Received: {lce.intent.type} from session={session_id}")

        # Store in LSS
        if thread_id:
            lss.store(thread_id, lce)
            session_data = lss.get_session(thread_id)
            if session_data:
                print(f"[Server] Coherence: {session_data['coherence']:.2f}")

        # Send response
        response = LCE(
            v=1,
            intent=Intent(type="tell", goal="Response from server"),
            policy=Policy(consent="private"),
        )
        await server.send(session_id, response)

    server.on_message = on_message

    # Start server
    await server.start()
    print("[Server] Waiting for connections...")

    # Keep running
    await asyncio.Future()


async def run_client():
    """Run WebSocket client"""
    # Wait for server to start
    await asyncio.sleep(1)

    # Create client
    client = ws.LRIWSClient(
        url="ws://127.0.0.1:8765",
        thread_id="example-thread-123",
    )

    # Connect and perform handshake
    await client.connect()

    # Generate keys for LTP signing
    private_key, public_key = ltp.generate_keys()

    # Create and send messages
    for i in range(3):
        lce = LCE(
            v=1,
            intent=Intent(type="ask" if i % 2 == 0 else "tell", goal=f"Message {i+1}"),
            policy=Policy(consent="private"),
        )

        # Sign with LTP
        signed = ltp.sign(lce, private_key)
        print(f"[Client] Sending signed message {i+1}")

        # Send
        await client.send(lce)

        # Receive response
        response = await client.receive()
        print(f"[Client] Received: {response.intent.type}")

        # Verify signature
        is_valid = ltp.verify(signed, public_key)
        print(f"[Client] Signature valid: {is_valid}")

        # CBOR encoding demo
        sizes = cbor.compare_sizes(lce)
        print(f"[Client] Size comparison: JSON={sizes['json']}B, CBOR={sizes['cbor']}B, Savings={sizes['savings_percent']}%")

        await asyncio.sleep(0.5)

    # Close connection
    await client.close()


async def main():
    """Run server and client"""
    # Run server in background
    server_task = asyncio.create_task(run_server())

    # Run client
    try:
        await run_client()
    except KeyboardInterrupt:
        print("\\nShutting down...")
    finally:
        server_task.cancel()


if __name__ == "__main__":
    asyncio.run(main())
