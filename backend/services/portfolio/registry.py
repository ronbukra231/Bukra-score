"""
Broker registry — which integrations exist and their rollout status.

status: "planned"   — designed for, not yet implemented
        "available" — adapter implemented and offered in the Portfolio Office
"""

SUPPORTED_BROKERS = [
    {"id": "ibkr",       "name": "Interactive Brokers", "region": "global", "status": "planned"},
    {"id": "schwab",     "name": "Charles Schwab",      "region": "us",     "status": "planned"},
    {"id": "fidelity",   "name": "Fidelity",            "region": "us",     "status": "planned"},
    {"id": "robinhood",  "name": "Robinhood",           "region": "us",     "status": "planned"},
    {"id": "trading212", "name": "Trading 212",         "region": "eu",     "status": "planned"},
    {"id": "meitav",     "name": "Meitav",              "region": "il",     "status": "planned"},
    {"id": "altshuler",  "name": "Altshuler Shaham",    "region": "il",     "status": "planned"},
    {"id": "ibi",        "name": "IBI",                 "region": "il",     "status": "planned"},
    {"id": "hapoalim",   "name": "Bank Hapoalim",       "region": "il",     "status": "planned"},
    {"id": "leumi",      "name": "Bank Leumi",          "region": "il",     "status": "planned"},
]

# adapter classes register here as they are implemented: {"ibkr": IBKRAdapter}
_ADAPTERS: dict = {}


def get_adapter(broker_id: str):
    """Instantiate the adapter for a broker, or None if not yet implemented."""
    cls = _ADAPTERS.get(broker_id)
    return cls() if cls else None


def connected_snapshots() -> list:
    """Snapshots from every connected broker. Empty until adapters land."""
    snapshots = []
    for broker in SUPPORTED_BROKERS:
        adapter = get_adapter(broker["id"])
        if adapter and adapter.is_connected():
            snapshots.append(adapter.fetch_snapshot())
    return snapshots
