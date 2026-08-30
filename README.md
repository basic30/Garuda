# AegisSpill GIS — Marine Oil Spill Detection, Drift Tracking & Vessel Attribution System

An end-to-end operational platform for marine oil spill detection from SAR satellite imagery, Lagrangian drift forecasting, backward origin tracing, and explainable vessel attribution using historical & live AIS data.

---

## 🌟 Key Features

1. **SAR Satellite Segmentation**: PyTorch U-Net with ResNet34 encoder trained on actual dataset SAR imagery.
2. **Post-Processing & Geometry**: Connected-component noise filtering, Shapely polygon extraction, projected area calculation in **EPSG:3857** square kilometers.
3. **Real Environmental Forcing**: Real-time atmospheric wind ($u_{10m}, v_{10m}$) and surface ocean current ($u_{\text{curr}}, v_{\text{curr}}$) vectors.
4. **Lagrangian Forward Drift Simulation**: Computes +6h, +12h, +24h, and +48h forecast envelopes with turbulent diffusion.
5. **Lagrangian Backward Origin Simulation**: Traces reverse trajectories (-24h window) to calculate probable spill origin envelopes.
6. **Explainable Vessel Ranking**: Algorithmic multi-factor scoring ($S = w_1 S_{\text{prox}} + w_2 S_{\text{temp}} + w_3 S_{\text{traj}} + w_4 S_{\text{behavior}} + w_5 S_{\text{gap}}$) returning transparent audit factors.
7. **Live AISstream.io Integration**: Secure WebSocket client receiving live marine vessel tracks.
8. **Interactive Web Dashboard**: React + Leaflet GIS frontend with dark glassmorphic UI, dynamic layer toggles, and live status indicators.

---

## 🏗 System Architecture

```
oil_spill_system/
├── backend/
│   └── app/
│       ├── main.py                     # FastAPI application entrypoint
│       ├── api/                        # REST API routers (incidents, vessels)
│       ├── services/                   # Business logic (geometry, drift, AIS, ranking)
│       ├── models/                     # SQLAlchemy Incident ORM model
│       └── schemas/                    # Pydantic schemas
├── ml/
│   ├── src/
│   │   ├── verify_environment.py       # Environment check script
│   │   ├── inspect_dataset.py          # Dataset inspection script
│   │   ├── validate_dataset.py         # Pair matching & corruption validator
│   │   ├── preprocess.py               # Image scaling & mask interpolation
│   │   ├── split_dataset.py            # Reproducible 70/15/15 train/val/test split
│   │   ├── dataset.py                  # PyTorch Dataset & DataLoader
│   │   ├── model.py                    # U-Net segmentation model
│   │   ├── losses.py                   # Combined BCE + Dice Loss
│   │   ├── metrics.py                  # IoU, Dice, Precision, Recall metrics
│   │   ├── train.py                    # Model training loop & checkpointing
│   │   ├── evaluate.py                 # Touch-once test evaluation
│   │   └── inference.py                # Prediction & post-processing pipeline
│   └── checkpoints/                    # Saved model checkpoints (best_model.pth)
├── frontend/                           # React + Vite + Leaflet GIS Dashboard
├── outputs/                            # Geometry, masks, and forecast GeoJSON outputs
├── results/                            # Metrics JSON, plots, and sample overlay images
├── .env                                # Environment variables (AISstream key)
└── requirements.txt                    # Python dependencies
```

---

## ⚡ Quickstart Guide

### 1. Backend & ML Setup

```bash
# Clone or navigate to project directory
cd c:\Users\snaha\Desktop\test

# Install dependencies
pip install -r requirements.txt

# Run environment check
python ml/src/verify_environment.py

# Run dataset inspection & validation
python ml/src/inspect_dataset.py
python ml/src/validate_dataset.py

# Train PyTorch U-Net Model
python ml/src/train.py

# Evaluate on test set
python ml/src/evaluate.py

# Start FastAPI Backend Server
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

### 2. Frontend Setup

```bash
# Navigate to frontend folder
cd frontend

# Install node packages
npm install

# Start Vite dev server
npm run dev
```

Open `http://localhost:5173/` in your browser to access the AegisSpill GIS Web Dashboard.

---

## 📊 Evaluation Results

| Metric | Result |
| :--- | :--- |
| **Total Images & Masks Inspected** | **8,070** pairs |
| **Validation Status** | **PASSED** (0 missing, 0 corrupt) |
| **Touch-Once Test IoU** | **0.2666** |
| **Touch-Once Test Dice (F1)** | **0.4210** |
| **Test Recall** | **0.9974** |
| **Top Suspect Vessel** | `PACIFIC EXPLORER` (**86.9%** confidence score) |

---

## 📜 Scientific Limitations & Disclaimer

- Vessel suspect scores represent probabilistic attribution confidence based on proximity, trajectory alignment, speed drop, and AIS gap anomalies. Scores should be used as advisory intelligence alongside physical sampling and naval inspection.
