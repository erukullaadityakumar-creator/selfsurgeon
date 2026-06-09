"""
Shared in-memory registry for prompt versions.
This serves as the source of truth for the current production prompt
across the backend, the victim agent, and the healer.
"""

from dataclasses import dataclass
from typing import Dict, Any

@dataclass
class PromptState:
    version: str
    content: str

# The global state of the active production prompt
REGISTRY = {
    "active": PromptState(
        version="flawed_v1",
        content="" # Loaded from file on startup
    )
}

def get_current_prompt() -> Dict[str, Any]:
    return {
        "version": REGISTRY["active"].version,
        "content": REGISTRY["active"].content
    }

def set_current_prompt(version: str, content: str):
    REGISTRY["active"] = PromptState(version=version, content=content)
