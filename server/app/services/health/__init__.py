"""Facade — preserves `from app.services.health import collect_health` import path.

The monolithic 284-line health.py has been split per SRP:
- checks/database.py, cache.py, whatsapp.py, workspace.py  (each <70 lines, single probe)
- endpoints.py  (inventory, cached)
- aggregator.py (composition + logging)
- constants.py  (shared table list + timing)
"""

from .aggregator import collect_checks, collect_health, get_check
from .endpoints import collect_endpoints

__all__ = ["collect_checks", "collect_endpoints", "collect_health", "get_check"]
