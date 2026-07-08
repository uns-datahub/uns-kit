from uns_kit.core.config_schema import strict_object
from uns_kit.database.schema import databases_config_schema

# Extend this schema with project-specific configuration sections.
project_extras_schema = strict_object(
    {
        "databases": databases_config_schema,
    }
)
