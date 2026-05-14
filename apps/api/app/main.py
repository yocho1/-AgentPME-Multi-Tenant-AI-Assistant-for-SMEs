"""
FastAPI main application entry point.

This module initializes the FastAPI application with:
- CORS middleware for frontend communication
- Structured logging
- API routers for all endpoints
- Health check endpoint
- Exception handlers
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

import sentry_sdk
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import configure_logging, get_logger

# Configure logging first
configure_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan context manager.
    
    Handles startup and shutdown events:
    - Startup: Initialize connections (DB, AI clients, etc.)
    - Shutdown: Cleanup resources
    """
    logger.info(
        "Starting AgentPME API",
        app_name=settings.app_name,
        environment=settings.app_env,
        debug=settings.app_debug,
    )
    
    # Initialize Sentry if DSN is configured
    if settings.sentry_dsn:
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            traces_sample_rate=1.0 if settings.is_development else 0.1,
        )
        logger.info("Sentry initialized")
    
    # TODO: Initialize Supabase connection pool
    # TODO: Warm up AI model connections
    
    yield  # Application runs here
    
    # Shutdown cleanup
    logger.info("Shutting down AgentPME API")
    # TODO: Close connections, cleanup resources


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    description="""
    FastAPI AI Backend for AgentPME — Multi-tenant B2B SaaS AI Platform.
    
    This service handles all AI-heavy operations:
    - Claude API streaming via SSE
    - LangGraph multi-agent orchestration
    - PDF processing and chunking
    - OpenAI embeddings generation
    - WhatsApp webhook handling
    - n8n workflow triggers
    """,
    version="1.0.0",
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
    openapi_url="/openapi.json" if settings.is_development else None,
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", status_code=status.HTTP_200_OK, tags=["Health"])
async def health_check() -> dict:
    """
    Health check endpoint for load balancers and monitoring.
    
    Returns:
        - status: "healthy" if all systems operational
        - version: API version
        - environment: Current environment (development/staging/production)
    """
    return {
        "status": "healthy",
        "version": "1.0.0",
        "environment": settings.app_env,
        "services": {
            "api": "up",
            # TODO: Add health checks for Supabase, AI providers
            # "supabase": "up",
            # "anthropic": "up",
            # "openai": "up",
        },
    }


@app.get("/", status_code=status.HTTP_200_OK, include_in_schema=False)
async def root() -> dict:
    """Root endpoint with API information."""
    return {
        "name": settings.app_name,
        "version": "1.0.0",
        "documentation": "/docs" if settings.is_development else None,
        "health": "/health",
    }


# Global exception handlers
@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception) -> JSONResponse:
    """Handle unexpected exceptions gracefully."""
    logger.exception("Unhandled exception", exc_info=exc, path=request.url.path)
    
    if settings.is_development:
        # Show full error details in development
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "Internal server error",
                "detail": str(exc),
                "type": type(exc).__name__,
            },
        )
    
    # Generic error in production (security)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "Internal server error"},
    )


# Import and include API routers
from app.api.v1 import router as v1_router

app.include_router(v1_router, prefix="/api/v1")


# Additional non-versioned routes for direct access
@app.get("/api/health", status_code=status.HTTP_200_OK, include_in_schema=False)
async def health_redirect() -> dict:
    """Redirect /api/health to the versioned endpoint."""
    return {"status": "healthy", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.is_development,
        log_level=settings.log_level,
    )
