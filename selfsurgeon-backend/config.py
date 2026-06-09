"""
Configuration management. Load from environment variables.
"""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Legacy Phoenix integration settings (not required for local SQLite demo)
    PHOENIX_HOST: str = "http://localhost:6006"
    PHOENIX_API_KEY: str | None = None

    # Google Gemini
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_MODEL_PRO: str = "gemini-2.5-pro"
    USE_GEMINI_ROUTER: bool = False

    # Agent Settings
    PROJECT_NAME: str = "selfsurgeon-victim"
    FAILURE_THRESHOLD: float = 0.8
    IMPROVEMENT_THRESHOLD: float = 0.05
    SURGERY_INTERVAL_MINUTES: int = 5

    # Prompt Registry / Datasets
    PROMPT_REGISTRY_NAME: str = "router_system_prompt"
    SURGERY_DATASET: str = "selfsurgeon_surgeries"
    FAILURE_DATASET: str = "router_failure_cases"

    # API
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    PORT: int | None = None  # Render-provided port
    CORS_ORIGINS: list[str] = Field(default_factory=lambda: ["*"])

    # Legacy MCP integration settings (not required for local SQLite demo)
    MCP_COMMAND: str = "npx"
    MCP_ARGS: list[str] = Field(default_factory=lambda: ["-y", "@arizeai/phoenix-mcp@latest"])
    MCP_ENABLED: bool = True

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
