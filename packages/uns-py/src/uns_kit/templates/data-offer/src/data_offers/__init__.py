# Data-offer modules live here. Keep one file per offer, mirroring the TypeScript layout.
from .demo_coils import demo_coils_offer, demo_coils_schema
from .demo_export import demo_export_offer, demo_export_schema

__all__ = [
    "demo_coils_offer",
    "demo_coils_schema",
    "demo_export_offer",
    "demo_export_schema",
]
