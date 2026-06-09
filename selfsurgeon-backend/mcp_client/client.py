"""
Legacy MCP client wrapper.

The current local demo does not require MCP. This adapter remains available for
earlier Phoenix prototype compatibility and future integration work.
"""

from __future__ import annotations

import asyncio
import json
import shutil
from contextlib import suppress
from typing import Any, Optional

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from config import settings


class MCPError(Exception):
    """MCP communication error."""


class MCPClient:
    """Client for the optional legacy Phoenix MCP server."""

    def __init__(self, phoenix_host: str | None = None):
        self.phoenix_host = phoenix_host or settings.PHOENIX_HOST
        self.session: Optional[ClientSession] = None
        self._stdio_cm = None
        self._session_cm = None
        self.tools: list[dict] = []

    async def connect(self):
        """Start MCP server process and initialize a session."""
        if not settings.MCP_ENABLED:
            raise MCPError("MCP is disabled")
        if not shutil.which(settings.MCP_COMMAND):
            raise MCPError(f"MCP command not found on PATH: {settings.MCP_COMMAND}")

        args = list(settings.MCP_ARGS) + ["--baseUrl", self.phoenix_host]
        if settings.PHOENIX_API_KEY:
            args += ["--apiKey", settings.PHOENIX_API_KEY]

        server = StdioServerParameters(command=settings.MCP_COMMAND, args=args)
        self._stdio_cm = stdio_client(server)
        read, write = await self._stdio_cm.__aenter__()
        self._session_cm = ClientSession(read, write)
        self.session = await self._session_cm.__aenter__()
        await self.session.initialize()
        tools_response = await self.session.list_tools()
        self.tools = [tool.model_dump() for tool in tools_response.tools]
        print(f"[MCP] Connected. Available tools: {[t['name'] for t in self.tools]}")

    async def call_tool(self, tool_name: str, params: dict) -> dict:
        """Call an MCP tool by name with parameters."""
        if self.session is None:
            await self.connect()
        assert self.session is not None
        try:
            response = await self.session.call_tool(tool_name, params)
        except Exception as exc:
            raise MCPError(f"Tool {tool_name} failed: {exc}") from exc
        return self._parse_tool_result(response.model_dump())

    def _parse_tool_result(self, response: dict) -> dict:
        content = response.get("content", [])
        for item in content:
            if item.get("type") == "text":
                try:
                    return json.loads(item["text"])
                except json.JSONDecodeError:
                    return {"text": item["text"]}
        return response

    async def disconnect(self):
        """Clean up MCP session and process."""
        if self._session_cm:
            with suppress(Exception):
                await self._session_cm.__aexit__(None, None, None)
        if self._stdio_cm:
            with suppress(Exception):
                await self._stdio_cm.__aexit__(None, None, None)
        self.session = None


_mcp_client: Optional[MCPClient] = None


async def get_mcp_client() -> MCPClient:
    """Get or create MCP client singleton."""
    global _mcp_client
    if _mcp_client is None:
        _mcp_client = MCPClient()
        await _mcp_client.connect()
    return _mcp_client


async def close_mcp_client() -> None:
    global _mcp_client
    if _mcp_client is not None:
        await _mcp_client.disconnect()
        _mcp_client = None
