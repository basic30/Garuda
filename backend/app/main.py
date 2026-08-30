import os
import sys
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.app.api.incidents import router as incidents_router
from backend.app.api.vessels import router as vessels_router
from backend.app.api.detection import router as detection_router
from backend.app.services.live_ais_service import connect_to_aisstream, get_connection_status

app = FastAPI(
    title="Marine Oil Spill Detection, Drift Tracking & Vessel Attribution System API",
    version="1.0.0",
    description="End-to-end API for satellite SAR oil spill detection, drift forecasting, backward origin tracing, and explainable vessel ranking."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(incidents_router, prefix="/api")
app.include_router(vessels_router, prefix="/api")
app.include_router(detection_router, prefix="/api")

# Serve outputs static directory
if os.path.exists("outputs"):
    app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")

# Serve results static directory
if os.path.exists("results"):
    app.mount("/results", StaticFiles(directory="results"), name="results")

# Serve data static directory
if os.path.exists("data"):
    app.mount("/data", StaticFiles(directory="data"), name="data")

# Serve images static directory
if os.path.exists("images"):
    app.mount("/images", StaticFiles(directory="images"), name="images")

@app.on_event("startup")
async def startup_event():
    print("Starting FastAPI Backend Server...", flush=True)
    api_key = os.getenv("AISSTREAM_API_KEY", "de5c8707bb4ff474749f531e11a09a6b1e850200")
    if api_key:
        print(f"Initializing background AISstream listener with API Key: {api_key[:8]}...", flush=True)
        asyncio.create_task(connect_to_aisstream(api_key))

@app.get("/")
def root():
    return {
        "system": "Marine Oil Spill Detection, Drift Tracking & Vessel Attribution API",
        "status": "OPERATIONAL",
        "aisstream_connected": get_connection_status()["connected"],
        "docs_url": "/docs"
    }

@app.get("/api/status")
def system_status():
    return {
        "api_status": "ONLINE",
        "model_checkpoint_exists": os.path.exists("ml/checkpoints/best_model.pth"),
        "aisstream_status": get_connection_status(),
        "environment": os.getenv("ENV", "development")
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
