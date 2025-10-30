import json
from pathlib import Path
from config import STATE_FILE

def load_state() -> dict:
    path = Path(STATE_FILE)
    if path.exists():
        try:
            return json.loads(path.read_text())
        except:
            pass
    return {"current_unit": 0, "current_lesson": 0, "scores": []}

def save_state(state: dict):
    Path(STATE_FILE).write_text(json.dumps(state, indent=2))

def get_learner_profile(state: dict) -> dict:
    scores = state.get("scores", [])
    avg_score = sum(scores) / len(scores) if scores else 0
    level = "advanced" if avg_score >= 80 else "intermediate" if avg_score >= 60 else "beginner"
    
    return {
        "level": level,
        "last_score": scores[-1] if scores else 0,
        "average_score": avg_score
    }