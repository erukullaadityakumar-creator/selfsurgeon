"""
SelfSurgeon background agent entry point.

Use this file for demos and deployment. It delegates to selfsurgeon_loop.py but
keeps the product framing clear: the agent runs independently of Streamlit.
"""

import asyncio

from selfsurgeon_loop import main


if __name__ == "__main__":
    asyncio.run(main())
