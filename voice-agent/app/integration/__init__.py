"""Integration package init"""

from app.integration.his_client import HISClient, HISAPIError

__all__ = [
    "HISClient",
    "HISAPIError",
]
