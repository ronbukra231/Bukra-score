"""
Audit Trail — append-only. Historical events are never edited: a new score
never rewrites what an old recommendation showed at the time it was made.
"""

from services.simulator import accounting
from services.simulator.config import METHODOLOGY_VERSION


def log(state: dict, event_type: str, explanation: str, *, actor_type: str = "system",
       actor_id: str = "system", recommendation_id=None, transaction_id=None,
       before: dict = None, after: dict = None, source_data_timestamp=None,
       metadata: dict = None) -> dict:
    event = {
        "id": accounting.new_id("aud"), "portfolioId": state["portfolio"]["id"],
        "eventType": event_type, "actorType": actor_type, "actorId": actor_id,
        "eventTimestamp": accounting.now_iso(), "explanation": explanation,
        "methodologyVersion": METHODOLOGY_VERSION,
        "recommendationId": recommendation_id, "transactionId": transaction_id,
        "beforeState": before or {}, "afterState": after or {},
        "sourceDataTimestamp": source_data_timestamp, "metadata": metadata or {},
    }
    state["auditEvents"].append(event)
    return event
