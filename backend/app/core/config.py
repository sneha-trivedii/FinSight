import os
from pathlib import Path
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load .env file from project root
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
load_dotenv(dotenv_path=ROOT_DIR / ".env")

class Settings(BaseSettings):
    PROJECT_NAME: str = "FinSight"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    
    # Gemini Configuration
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "models/gemini-embedding-001")
    
    # Paths
    BASE_DIR: Path = ROOT_DIR
    DATA_DIR: Path = ROOT_DIR / os.getenv("DATA_DIR", "data")
    STORAGE_DIR: Path = ROOT_DIR / os.getenv("STORAGE_DIR", "storage")
    UPLOAD_DIR: Path = STORAGE_DIR / "uploads"
    INDEX_DIR: Path = STORAGE_DIR / "indexes"
    DB_PATH: Path = STORAGE_DIR / "finsight.db"
    
    # Retrieval Tuning
    CHUNK_SIZE: int = 600
    CHUNK_OVERLAP: int = 100
    TOP_K_DENSE: int = 10
    TOP_K_BM25: int = 10
    TOP_K_HYBRID: int = 5
    RRF_K: int = 60
    DENSE_WEIGHT: float = 0.6
    BM25_WEIGHT: float = 0.4
    
    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

# Ensure directories exist
settings.STORAGE_DIR.mkdir(parents=True, exist_ok=True)
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.INDEX_DIR.mkdir(parents=True, exist_ok=True)
