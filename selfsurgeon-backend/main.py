"""
FastAPI application entry point.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router
from config import settings
from mcp_client.client import close_mcp_client


app = FastAPI(
    title="SelfSurgeon API",
    description="Autonomous agent self-healing with SQLite traces and a local prompt registry",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
async def root():
    return {"name": "SelfSurgeon API", "status": "ok"}


@app.on_event("startup")
async def startup():
    print("SelfSurgeon API starting...")


@app.on_event("shutdown")
async def shutdown():
    print("SelfSurgeon API shutting down...")
    await close_mcp_client()


if __name__ == "__main__":
    import uvicorn

    port = settings.PORT if settings.PORT else settings.API_PORT
    uvicorn.run("main:app", host=settings.API_HOST, port=port, reload=True)
