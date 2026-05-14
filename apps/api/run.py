#!/usr/bin/env python3
"""
Development server runner with auto-reload.

Usage:
    python run.py              # Run with auto-reload
    python run.py --prod       # Run production mode
    python run.py --port 8080  # Custom port
"""

import argparse
import sys

import uvicorn


def main() -> None:
    """Parse arguments and run the server."""
    parser = argparse.ArgumentParser(description="AgentPME API Server")
    parser.add_argument(
        "--prod", "--production",
        action="store_true",
        help="Run in production mode (no reload)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port to listen on (default: 8000)"
    )
    parser.add_argument(
        "--host",
        default="0.0.0.0",
        help="Host to bind to (default: 0.0.0.0)"
    )
    
    args = parser.parse_args()
    
    # Determine environment from args
    reload = not args.prod
    log_level = "info" if args.prod else "debug"
    
    print(f"🚀 Starting AgentPME API")
    print(f"   Mode: {'production' if args.prod else 'development'}")
    print(f"   Host: {args.host}:{args.port}")
    print(f"   Reload: {reload}")
    print(f"   Docs: http://{args.host}:{args.port}/docs\n")
    
    try:
        uvicorn.run(
            "app.main:app",
            host=args.host,
            port=args.port,
            reload=reload,
            log_level=log_level,
            use_colors=True,
        )
    except KeyboardInterrupt:
        print("\n👋 Shutting down gracefully...")
        sys.exit(0)


if __name__ == "__main__":
    main()
