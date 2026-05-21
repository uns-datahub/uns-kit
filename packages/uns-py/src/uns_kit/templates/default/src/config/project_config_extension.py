from uns_kit.core import strict_object
from uns_kit.database import databases_config_schema

# Extend this schema with project-specific configuration sections.
project_extras_schema = strict_object(
    {
        "databases": databases_config_schema,
    }
)
