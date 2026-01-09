import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional

LOG_FILE = Path("backend/logs/audit.log")


def log_event(
    *,
    question: str,
    status: str,
    refusal_reason: str,
    num_sources: int,
    top_similarity: Optional[float],
    source_types: List[str],
    model: str,
):
    """
    Writes a single audit log entry.
    This function MUST be called exactly once per user question.
    """

    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "question": question,
        "status": status,
        "refusal_reason": refusal_reason,
        "num_sources": num_sources,
        "top_similarity": top_similarity,
        "source_types": source_types,
        "model": model,
    }

    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")