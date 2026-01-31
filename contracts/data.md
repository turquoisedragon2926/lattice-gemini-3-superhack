# Lattice — Canonical Data Contract

This document defines the single data format that **all producers and consumers** in Lattice must use. Three systems produce data in this format, and four systems consume it.

## Producers

1. **Kaggle Ingest** — raw NFL tracking CSVs → canonical format (the ground truth)
2. **Forward Simulation (Gemini)** — given state at frame `t`, predicts frames `t+1..t+h` per player
3. **Video Extractor** — given a video/image, extracts player positions into canonical format

## Consumers

1. **Holographic Renderer** — Three.js scene, reads positions/orientations/teams per frame
2. **Playback Engine** — steps through frames, detects events
3. **Prediction Engine** — reads current state, produces predicted frames
4. **Stats Module** — computes per-frame analytics from positions/velocities

---

## Coordinate System

- **x**: 0–120 yards, along the long axis of the field. 0 and 120 are the back of each endzone. Always normalized so the offense moves in the **positive x direction** (toward x=120).
- **y**: 0–53.3 yards, along the short axis (sideline to sideline).
- **orientation** (`o`): 0–360 degrees. 0 = facing right (positive x). Clockwise.
- **direction** (`dir`): 0–360 degrees. Direction of movement. Same convention as orientation.
- **Frame rate**: 10 Hz (one frame every 0.1 seconds).

When `playDirection == 'left'` in the raw Kaggle data, coordinates are flipped during ingest:
```
x = 120 - x
y = 53.3 - y
orientation = (orientation + 180) % 360
direction = (direction + 180) % 360
```

---

## Canonical JSON: Play Data

This is the shape served by the API and consumed by all frontend modules. It is also the shape that the forward simulation and video extractor must produce.

```jsonc
{
  "gameId": 2022091200,
  "playId": 64,

  // Play metadata (optional for synthetic sources)
  "meta": {
    "quarter": 1,
    "down": 2,
    "yardsToGo": 7,
    "offense": "DEN",
    "defense": "SEA",
    "description": "R.Wilson pass short left to C.Sutton..."
  },

  "frameCount": 87,

  // frameId (string) -> event name. Only frames with events are listed.
  "events": {
    "12": "ball_snap",
    "34": "pass_forward",
    "51": "pass_arrived"
  },

  // nflId (string) -> player identity. "ball" key for the football.
  "players": {
    "35459": { "name": "K.Jackson", "team": "home", "jersey": 22, "position": "SS" },
    "ball":  { "name": "Football",  "team": "ball" }
  },

  // Ordered array of frames. Each frame is one 0.1s snapshot.
  "frames": [
    {
      "id": 1,
      // nflId -> [x, y]
      "positions": {
        "35459": [51.06, 28.55],
        "ball":  [60.0,  26.3]
      },
      // nflId -> [vx, vy] in yards/sec (derived: vx = s * cos(dir), vy = s * sin(dir))
      "velocities": {
        "35459": [0.67, 0.27]
      },
      // nflId -> orientation in degrees
      "orientations": {
        "35459": 246.17
      }
    }
    // ... more frames
  ],

  // Which system produced this data
  "source": "kaggle"  // "kaggle" | "gemini" | "video"
}
```

---

## Forward Simulation Output

When the prediction engine runs at pause frame `t`, it produces a **partial play** in the same shape:

```jsonc
{
  "gameId": 2022091200,
  "playId": 64,
  "frameCount": 20,         // predicted horizon (e.g. 2 seconds = 20 frames)
  "players": { /* same player map as the source play */ },
  "frames": [
    {
      "id": 35,              // continues from the pause frame
      "positions": { "35459": [52.1, 29.0], "ball": [61.2, 26.5] },
      "velocities": { "35459": [1.1, 0.45] },
      "orientations": { "35459": 250.0 }
    }
    // ... frames 36..54
  ],
  "source": "gemini"
}
```

The renderer overlays these as dotted/dashed splines alongside the ground truth. The `source` field distinguishes real from predicted.

### Gemini Prompt Contract

When sending state to Gemini, use this compact representation:

```jsonc
{
  "gameId": 2022091200,
  "playId": 64,
  "frameId": 34,            // current frame
  "horizon": 20,            // how many frames to predict
  "state": {
    // nflId -> { position, velocity, orientation, team, position_abbr }
    "35459": {
      "pos": [51.06, 28.55],
      "vel": [0.67, 0.27],
      "ori": 246.17,
      "team": "home",
      "role": "SS"
    },
    "ball": {
      "pos": [60.0, 26.3],
      "vel": [5.2, -1.1]
    }
  }
}
```

Response must be an array of frames in the canonical `frames` format above.

---

## Video Extractor Output

Given a video or image, the extractor produces a synthetic play in the same canonical shape. Since player identity may be uncertain:

- `nflId` keys can be synthetic (e.g. `"v_1"`, `"v_2"`, ...) if real IDs are unknown
- `players` map should include `team` and `jersey` when detectable
- `meta` fields are optional
- Single-image extraction produces `frameCount: 1`

```jsonc
{
  "gameId": null,            // unknown
  "playId": null,
  "frameCount": 1,
  "players": {
    "v_1": { "name": "Unknown", "team": "home", "jersey": 12 },
    "v_2": { "name": "Unknown", "team": "away", "jersey": 54 }
  },
  "frames": [
    {
      "id": 1,
      "positions": { "v_1": [45.0, 26.7], "v_2": [42.3, 30.1] },
      "velocities": {},
      "orientations": {}
    }
  ],
  "source": "video"
}
```

---

## SQLite Schema (ingest layer)

The API server reads from this DB and assembles the canonical JSON above.

```sql
CREATE TABLE games (
  game_id INTEGER PRIMARY KEY, season INTEGER, week INTEGER,
  game_date TEXT, home_team TEXT, away_team TEXT,
  home_score INTEGER, away_score INTEGER, stadium TEXT
);

CREATE TABLE players (
  nfl_id INTEGER PRIMARY KEY, display_name TEXT,
  position TEXT, jersey_number INTEGER, height TEXT, weight INTEGER
);

CREATE TABLE plays (
  game_id INTEGER, play_id INTEGER,
  quarter INTEGER, down INTEGER, yards_to_go INTEGER,
  yardline_side TEXT, yardline_number INTEGER,
  play_direction TEXT, offense_team TEXT, defense_team TEXT,
  play_result INTEGER, description TEXT, frame_count INTEGER,
  PRIMARY KEY (game_id, play_id)
);

CREATE TABLE frames (
  game_id INTEGER, play_id INTEGER, frame_id INTEGER,
  nfl_id INTEGER,
  x REAL, y REAL,
  speed REAL, accel REAL, vx REAL, vy REAL,
  orientation REAL, direction REAL,
  team TEXT,
  jersey_number INTEGER, display_name TEXT,
  event TEXT,
  source TEXT DEFAULT 'kaggle',
  PRIMARY KEY (game_id, play_id, frame_id, nfl_id)
);

CREATE INDEX idx_frames_play ON frames(game_id, play_id);
CREATE INDEX idx_frames_player ON frames(nfl_id, game_id);
```

---

## Event Types

Events appear on individual frames. Common values from the Kaggle data:

| Event | Meaning |
|-------|---------|
| `huddle_break_offense` | Offense breaks huddle |
| `line_set` | Players set at line of scrimmage |
| `shift` | Pre-snap shift |
| `man_in_motion` | Player goes in motion |
| `ball_snap` | Snap |
| `pass_forward` | QB throws |
| `pass_arrived` | Ball arrives at target |
| `pass_outcome_caught` | Catch |
| `pass_outcome_incomplete` | Incompletion |
| `run` | Handoff / rush |
| `tackle` | Ball carrier tackled |
| `out_of_bounds` | Runner goes OOB |
| `touchdown` | TD scored |
| `first_contact` | First defensive contact |

---

## API Endpoints

| Method | Path | Returns |
|--------|------|---------|
| GET | `/api/games?season=&week=` | List of games (browse index) |
| GET | `/api/games/:gameId/plays` | List of plays for a game (id, quarter, down, description) |
| GET | `/api/plays/:gameId/:playId` | Full canonical play JSON (the big one above) |
| GET | `/api/players/:nflId` | Player detail |
