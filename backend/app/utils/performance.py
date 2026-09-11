from datetime import datetime

PRIORITY_WEIGHTS = {
    "Low": 1,
    "Medium": 2,
    "High": 3,
    "Urgent": 5,
}


def get_task_weight(task):
    """Returns the numeric weight of a task based on its weight or priority."""
    if hasattr(task, "weight") and task.weight:
        try:
            return int(task.weight)
        except (ValueError, TypeError):
            pass
    priority = getattr(task, "priority", None) or "Medium"
    return PRIORITY_WEIGHTS.get(priority, 2)


def is_task_overdue(task):
    """Checks whether a task is overdue."""
    if not task:
        return False
    status = getattr(task, "status", None)
    archived = getattr(task, "archived", False)
    if archived or status in ("Completed", "Archived"):
        return False
    deadline = getattr(task, "deadline", None)
    if not deadline:
        return False
    if isinstance(deadline, str):
        try:
            deadline = datetime.fromisoformat(deadline.replace("Z", "+00:00"))
        except Exception:
            return False
    now = datetime.utcnow()
    # Normalize naive/aware if needed
    if hasattr(deadline, "tzinfo") and deadline.tzinfo is not None:
        deadline = deadline.replace(tzinfo=None)
    return deadline < now


def calculate_weighted_performance(tasks):
    """Calculates weighted performance metrics for a collection of tasks.
    
    Formula:
    - Each task contributes according to its priority weight:
        * Low = 1 pt
        * Medium = 2 pts
        * High = 3 pts
        * Urgent / Critical = 5 pts
    - Completion Score (50% max): (Completed Weight / Assigned Weight) * 50
    - On-Time Score (30% max): (On-Time Completed Weight / Completed Weight) * 30
    - Productivity/Quality Score (20% max): min(100, (Completed Weight / Assigned Weight) * 100) * 0.20
    - Final Score: 0 to 100
    """
    valid_tasks = [t for t in tasks if not getattr(t, "deleted", False)]
    total_count = len(valid_tasks)

    assigned_weight = sum(get_task_weight(t) for t in valid_tasks)
    
    completed_tasks = [t for t in valid_tasks if getattr(t, "status", None) == "Completed"]
    completed_weight = sum(get_task_weight(t) for t in completed_tasks)

    on_time_tasks = [t for t in completed_tasks if getattr(t, "completed_on_time", False) is True]
    on_time_weight = sum(get_task_weight(t) for t in on_time_tasks)

    late_tasks = [t for t in completed_tasks if getattr(t, "completed_on_time", False) is False]
    late_weight = sum(get_task_weight(t) for t in late_tasks)

    pending_tasks = [t for t in valid_tasks if getattr(t, "status", None) in ("Pending", "In Progress", "Submitted")]
    overdue_tasks = [t for t in valid_tasks if is_task_overdue(t)]
    overdue_weight = sum(get_task_weight(t) for t in overdue_tasks)

    productivity_pct = round((completed_weight / assigned_weight) * 100) if assigned_weight > 0 else 0
    on_time_rate = round((on_time_weight / completed_weight) * 100) if completed_weight > 0 else 0

    completion_score = (completed_weight / assigned_weight) * 50 if assigned_weight > 0 else 0
    on_time_score = (on_time_weight / completed_weight) * 30 if completed_weight > 0 else 0
    productivity_score = min(productivity_pct, 100) * 0.20

    raw_score = completion_score + on_time_score + productivity_score
    score = max(0, min(100, round(raw_score)))

    if score >= 90:
        classification = "Outstanding"
    elif score >= 80:
        classification = "Excellent"
    elif score >= 70:
        classification = "Good"
    elif score >= 60:
        classification = "Satisfactory"
    else:
        classification = "Needs Improvement"

    return {
        "assigned": total_count,
        "assigned_weight": assigned_weight,
        "completed": len(completed_tasks),
        "completed_weight": completed_weight,
        "on_time": len(on_time_tasks),
        "on_time_weight": on_time_weight,
        "late": len(late_tasks),
        "late_weight": late_weight,
        "pending": len(pending_tasks),
        "overdue": len(overdue_tasks),
        "overdue_weight": overdue_weight,
        "productivity": productivity_pct,
        "on_time_rate": on_time_rate,
        "completion_score": round(completion_score, 1),
        "on_time_score": round(on_time_score, 1),
        "productivity_score": round(productivity_score, 1),
        "score": score,
        "classification": classification,
    }
