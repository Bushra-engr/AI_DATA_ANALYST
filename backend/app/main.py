from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from app.routes.auth import router as auth_router
from app.routes.data_upload import router as data_router
from app.routes.analysis import router as analysis_router
from app.routes.analyst_router import router as analyst_router

app = FastAPI(
    title="AI DATA ANALYST",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"]
)

# 1. Routers
app.include_router(auth_router)
app.include_router(data_router)
app.include_router(analysis_router)
app.include_router(analyst_router)

# 2. Frontend Directories Path Setup
# Adjust the path to where your frontend index.html, css, and js folders live
BASE_DIR = Path(__file__).resolve().parents[2] # Project root

# Mount CSS and JS folders as static
if (BASE_DIR / "css").exists():
    app.mount("/css", StaticFiles(directory=str(BASE_DIR / "css")), name="css")

if (BASE_DIR / "js").exists():
    app.mount("/js", StaticFiles(directory=str(BASE_DIR / "js")), name="js")

# 3. Serve Frontend Directly on "/" (Root URL)
@app.get("/")
async def serve_frontend():
    index_file = BASE_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "index.html not found in project root"}

# 4. Health Check API
@app.get("/health")
def health_check():
    return {
        "success": True,
        "message": "OK"
    }