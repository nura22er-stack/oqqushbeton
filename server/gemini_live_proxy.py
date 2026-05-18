from __future__ import annotations

import asyncio
import os
import signal

import websockets
from websockets.exceptions import ConnectionClosed


HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "3060"))
GEMINI_ENDPOINT = (
    "wss://generativelanguage.googleapis.com/ws/"
    "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"
)


async def relay(source, target) -> None:
    async for message in source:
        await target.send(message)


async def handle_client(client) -> None:
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        await client.close(1011, "Gemini API key is not configured")
        return

    upstream_url = f"{GEMINI_ENDPOINT}?key={api_key}"
    try:
        async with websockets.connect(
            upstream_url,
            max_size=16 * 1024 * 1024,
            max_queue=8,
            ping_interval=20,
            ping_timeout=20,
            compression=None,
        ) as upstream:
            client_to_upstream = asyncio.create_task(relay(client, upstream))
            upstream_to_client = asyncio.create_task(relay(upstream, client))
            done, pending = await asyncio.wait(
                {client_to_upstream, upstream_to_client},
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()
            for task in done:
                task.result()
    except ConnectionClosed:
        return
    except Exception as exc:
        print(f"Gemini Live proxy error: {exc}", flush=True)
        if not client.close_code:
            await client.close(1011, "Gemini Live proxy error")


async def main() -> None:
    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop_event.set)

    async with websockets.serve(
        handle_client,
        HOST,
        PORT,
        max_size=16 * 1024 * 1024,
        max_queue=8,
        ping_interval=20,
        ping_timeout=20,
        compression=None,
    ):
        print(f"Gemini Live proxy listening on {HOST}:{PORT}", flush=True)
        await stop_event.wait()


if __name__ == "__main__":
    asyncio.run(main())
