"""
Phoenix MCP integration diagnostic.

This is intentionally strict. If this script cannot reach the official Phoenix
MCP server and discover useful live tools, the SelfSurgeon loop is not ready to
claim real Phoenix integration.
"""

import asyncio
import os
import shutil
import sys
from typing import Any

from dotenv import load_dotenv


load_dotenv()


def _require(value: str | None, name: str) -> str:
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


def _tool_names(tools_response: Any) -> list[str]:
    tools = getattr(tools_response, "tools", tools_response)
    return [getattr(tool, "name", "") for tool in tools if getattr(tool, "name", "")]


async def main() -> int:
    phoenix_host = _require(
        os.getenv("ARIZE_PHOENIX_HOST") or os.getenv("PHOENIX_HOST"),
        "ARIZE_PHOENIX_HOST",
    )
    api_key = os.getenv("ARIZE_API_KEY")

    if not shutil.which("node") or not shutil.which("npx"):
        print("FAIL: Node.js and npx are required for @arizeai/phoenix-mcp.")
        return 2

    try:
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client
    except ImportError:
        print("FAIL: Python package 'mcp' is not installed.")
        print("Install it with: pip install mcp")
        return 2

    args = ["-y", "@arizeai/phoenix-mcp@latest", "--baseUrl", phoenix_host]
    if api_key and api_key not in {"your_arize_key_if_cloud", "your_key_here"}:
        args.extend(["--apiKey", api_key])

    print(f"Phoenix host: {phoenix_host}")
    print("Starting Phoenix MCP server through npx...")

    server = StdioServerParameters(command="npx", args=args)

    try:
        async with stdio_client(server) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                tools_response = await session.list_tools()
                names = sorted(_tool_names(tools_response))

                if not names:
                    print("FAIL: MCP connected, but exposed zero tools.")
                    return 1

                print(f"OK: MCP exposed {len(names)} tools.")
                for name in names:
                    print(f"  - {name}")

                lower_names = [name.lower() for name in names]
                required_capabilities = {
                    "trace_or_span": ("trace", "span"),
                    "dataset": ("dataset",),
                    "prompt": ("prompt",),
                    "experiment": ("experiment",),
                }

                missing = []
                for label, needles in required_capabilities.items():
                    if not any(any(needle in name for needle in needles) for name in lower_names):
                        missing.append(label)

                if missing:
                    print()
                    print("FAIL: MCP is reachable, but key capabilities are missing:")
                    for label in missing:
                        print(f"  - {label}")
                    print("SelfSurgeon cannot be production-grade until these are available.")
                    return 1

                print()
                print("PASS: Phoenix MCP has the capabilities SelfSurgeon needs.")
                print("Next: run victim_agent.py and verify real failed traces in Phoenix.")
                return 0

    except Exception as exc:
        print(f"FAIL: Could not complete Phoenix MCP diagnostic: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
