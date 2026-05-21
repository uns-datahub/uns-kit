from uns_kit.core import (
    boolean_schema,
    host_value_schema,
    integer_schema,
    secret_value_schema,
    strict_object,
    string_schema,
)

project_extras_schema = strict_object(
    {
        "pg": strict_object(
            {
                "user": string_schema(min_length=1, description="pg.user is required"),
                "host": host_value_schema,
                "port": integer_schema(exclusive_minimum=0, default=5432),
                "ssl": boolean_schema(default=False),
                "database": string_schema(min_length=1, description="pg.database is required"),
                "isPoolConnection": boolean_schema(default=False),
                "password": secret_value_schema,
            },
            required=["user", "host", "database"],
        ),
        "caddy": strict_object(
            {
                "adminUrl": string_schema(fmt="uri"),
                "proxyHost": string_schema(fmt="uri"),
            },
            required=["adminUrl", "proxyHost"],
        ),
    }
)
