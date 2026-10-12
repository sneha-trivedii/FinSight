import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.core.config import settings
from backend.app.db.database import init_db
from backend.app.api.health import router as health_router
from backend.app.api.dashboard import router as dashboard_router
from backend.app.api.documents import router as documents_router
from backend.app.api.chat import router as chat_router
from backend.app.api.evaluation import router as evaluation_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("FinSight")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing FinSight backend...")
    # Initialize SQLite schema
    init_db()
    
    # Check Gemini API Key presence (never log secret)
    if settings.GEMINI_API_KEY:
        logger.info("GEMINI_API_KEY detected successfully.")
    else:
        logger.warning("WARNING: GEMINI_API_KEY is not configured in .env file.")
        
    logger.info(f"Using Gemini Model: {settings.GEMINI_MODEL}")
    logger.info(f"Using Embedding Model: {settings.EMBEDDING_MODEL}")
    yield
    logger.info("FinSight backend shutting down.")

app = FastAPI(
    title="FinSight Financial Document Intelligence Platform",
    description="Enterprise-grade financial intelligence engine with hybrid RAG, source citations, and RAGAS evaluation.",
    version=settings.VERSION,
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(health_router, prefix=settings.API_PREFIX)
app.include_router(dashboard_router, prefix=settings.API_PREFIX)
app.include_router(documents_router, prefix=settings.API_PREFIX)
app.include_router(chat_router, prefix=settings.API_PREFIX)
app.include_router(evaluation_router, prefix=settings.API_PREFIX)

@app.get("/")
def root():
    return {
        "app": "FinSight",
        "status": "operational",
        "docs_url": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
