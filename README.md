# Lattice

Holographic NFL play visualization with AI-powered prediction. Renders NFL tracking data as a futuristic 3D scene with forward simulation via Gemini.

## Prerequisites

- Python 3.9+ (with pip)
- Node.js 18+
- ~2GB disk for the SQLite database

## Setup

### 1. Download the data

Download the [NFL Big Data Bowl 2025](https://www.kaggle.com/datasets/marriottgiftmumba/nfl-big-data-bowl-2025/data) dataset and extract it to:

```
data/nfl-big-data-bowl-2025/
  games.csv
  players.csv
  plays.csv
  player_play.csv
  tracking_week_1.csv
  ...
  tracking_week_9.csv
```

### 2. Ingest data into SQLite

```bash
pip install -r scripts/requirements.txt
python scripts/ingest.py
```

This normalizes coordinates, computes velocities, and loads ~59M tracking frames into `data/lattice.db`.

### 3. Start the API server

```bash
cd server
npm install
npm run dev
```

Runs on `http://localhost:3000`. Serves play data, forward simulation, and video extraction endpoints.

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173`. Opens the holographic field renderer.

## Architecture

```
contracts/data.md        # Canonical data format (start here)
scripts/ingest.py        # CSV -> SQLite ingest pipeline
server/                  # Express API (better-sqlite3)
src/services/            # Forward sim + video extraction (mock + Gemini stubs)
frontend/                # React Three Fiber renderer (Vite + Zustand)
```

All data flows through a single canonical format defined in `contracts/data.md`. The same shape is used by the Kaggle ingest, forward simulation output, and video extraction output.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/games?season=&week=` | List games |
| GET | `/api/games/:gameId/plays` | List plays for a game |
| GET | `/api/plays/:gameId/:playId` | Full play data (canonical JSON) |
| GET | `/api/players/:nflId` | Player detail |
| POST | `/api/predict` | Forward simulation (mock) |
| POST | `/api/extract` | Video extraction (mock) |
