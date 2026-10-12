import uvicorn
from backend.app.core.config import settings

if __name__ == "__main__":
    print(f"Starting FinSight Backend on http://127.0.0.1:8000 ...")
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
