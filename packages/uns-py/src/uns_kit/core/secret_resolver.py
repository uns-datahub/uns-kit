from __future__ import annotations

import copy
import os
import socket
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, Mapping, Optional, Sequence

INFISICAL_TOKEN_FILE = "/run/secrets/infisical_token"
INFISICAL_PROJECT_ID_FILE = "/run/secrets/infisical_project_id"
INFISICAL_SITE_URL_FILE = "/run/secrets/infisical_site_url"
INFISICAL_TOKEN_FILE_ALT = "/var/lib/uns/secrets/infisical_token"
INFISICAL_PROJECT_ID_FILE_ALT = "/var/lib/uns/secrets/infisical_project_id"
INFISICAL_SITE_URL_FILE_ALT = "/var/lib/uns/secrets/infisical_site_url"


SecretFetcher = Callable[[str, str, str, str, str], Optional[str]]
ExternalHostResolver = Callable[[str], Optional[str]]
MissingSecretCallback = Callable[[Mapping[str, Any], str], None]
MissingHostCallback = Callable[[Mapping[str, Any]], None]


@dataclass
class InfisicalResolverOptions:
    fetch_secret: Optional[SecretFetcher] = None
    token: Optional[str] = None
    site_url: Optional[str] = None
    environment: Optional[str] = None
    project_id: Optional[str] = None
    secret_type: str = "shared"
    cache: bool = True


@dataclass
class HostResolverOptions:
    env: Optional[Mapping[str, str]] = None
    external_hosts: Optional[Mapping[str, Optional[str]]] = None
    resolve_external: Optional[ExternalHostResolver] = None
    on_missing_host: Optional[MissingHostCallback] = None


@dataclass
class SecretResolverOptions:
    env: Optional[Mapping[str, str]] = None
    infisical: Optional[InfisicalResolverOptions] = None
    on_missing_secret: Optional[MissingSecretCallback] = None
    hosts: Optional[HostResolverOptions] = None


_env_cache: Dict[str, Optional[str]] = {}
_infisical_cache: Dict[str, Optional[str]] = {}
_default_infisical_fetcher_cache: Dict[str, SecretFetcher] = {}


def clear_secret_resolver_caches() -> None:
    _env_cache.clear()
    _infisical_cache.clear()
    _default_infisical_fetcher_cache.clear()


def resolve_infisical_config(
    options: Optional[InfisicalResolverOptions] = None,
) -> Dict[str, Optional[str]]:
    return {
        "token": _resolve_infisical_token(options),
        "projectId": _resolve_infisical_project_id(options),
        "siteUrl": _resolve_infisical_site_url(options),
    }


def resolve_config_secrets(
    config: Mapping[str, Any],
    options: Optional[SecretResolverOptions] = None,
) -> Dict[str, Any]:
    effective_options = options or SecretResolverOptions()
    working = copy.deepcopy(dict(config))
    return _resolve_node(working, effective_options)


def _resolve_node(node: Any, options: SecretResolverOptions) -> Any:
    if _is_secret_placeholder(node):
        return _resolve_secret_value(node, options)

    if _is_host_placeholder(node):
        return _resolve_host_value(node, options.hosts)

    if isinstance(node, list):
        return [_resolve_node(item, options) for item in node]

    if isinstance(node, dict):
        keys = list(node.keys())
        for key in keys:
            current = node[key]
            if _is_secret_placeholder(current):
                resolved = _resolve_secret_value(current, options)
                if resolved is None:
                    del node[key]
                else:
                    node[key] = resolved
                continue

            if _is_host_placeholder(current):
                resolved = _resolve_host_value(current, options.hosts)
                if resolved is None:
                    del node[key]
                else:
                    node[key] = resolved
                continue

            node[key] = _resolve_node(current, options)
        return node

    return node


def _is_secret_placeholder(value: Any) -> bool:
    return (
        isinstance(value, dict)
        and value.get("provider") in {"env", "infisical"}
        and isinstance(value.get("key"), str)
    )


def _is_host_placeholder(value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    provider = value.get("provider")
    return provider in {"inline", "external", "system"}


def _resolve_secret_value(
    placeholder: Mapping[str, Any],
    options: SecretResolverOptions,
) -> Optional[str]:
    provider = placeholder.get("provider")
    if provider == "env":
        return _resolve_env_secret(placeholder, options)
    if provider == "infisical":
        return _resolve_infisical_secret(placeholder, options)
    raise ValueError(f"Unsupported secret provider: {provider!r}")


def _resolve_host_value(
    placeholder: Mapping[str, Any],
    options: Optional[HostResolverOptions],
) -> Optional[str]:
    effective_options = options or HostResolverOptions()
    provider = placeholder.get("provider")

    if provider == "inline":
        value = placeholder.get("value")
        if isinstance(value, str) and value:
            return value
        raise ValueError("Inline host placeholder requires a non-empty 'value'.")

    if provider == "external":
        key = placeholder.get("key")
        if not isinstance(key, str) or not key:
            raise ValueError("External host placeholder requires a non-empty 'key'.")

        resolved: Optional[str] = None
        if effective_options.resolve_external:
            resolved = effective_options.resolve_external(key)
        if resolved is None and effective_options.external_hosts:
            resolved = effective_options.external_hosts.get(key)
        if resolved is None:
            env_map = effective_options.env or os.environ
            resolved = env_map.get(key)

        if resolved is None:
            default = placeholder.get("default")
            optional = bool(placeholder.get("optional"))
            if isinstance(default, str):
                return default
            if optional:
                return None
            if effective_options.on_missing_host:
                effective_options.on_missing_host(placeholder)
            raise ValueError(f"External host '{key}' could not be resolved.")
        return resolved

    if provider == "system":
        return _resolve_system_host(placeholder, effective_options)

    raise ValueError(f"Unsupported host provider: {provider!r}")


def _resolve_system_host(
    placeholder: Mapping[str, Any],
    options: HostResolverOptions,
) -> Optional[str]:
    family = placeholder.get("family") or "IPv4"
    interface_name = placeholder.get("interfaceName")
    optional = bool(placeholder.get("optional"))
    default = placeholder.get("default")

    resolved: Optional[str] = None
    try:
        if family == "IPv6":
            # If no interface callback exists, this best-effort fallback mirrors
            # TS behavior of returning the first non-empty non-loopback address.
            s = socket.socket(socket.AF_INET6, socket.SOCK_DGRAM)
            s.connect(("2001:4860:4860::8888", 80))
            resolved = s.getsockname()[0]
            s.close()
        else:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            resolved = s.getsockname()[0]
            s.close()
    except Exception:
        resolved = None

    if resolved:
        return resolved

    if isinstance(default, str):
        return default
    if optional:
        return None
    if options.on_missing_host:
        options.on_missing_host(placeholder)
    target = f"interface '{interface_name}'" if isinstance(interface_name, str) else "available interfaces"
    raise ValueError(f"System host lookup failed for {target} (family {family}).")


def _resolve_env_secret(
    placeholder: Mapping[str, Any],
    options: SecretResolverOptions,
) -> Optional[str]:
    key = placeholder.get("key")
    if not isinstance(key, str) or not key:
        raise ValueError("env placeholder requires a non-empty 'key'.")

    if key in _env_cache:
        return _env_cache[key]

    env_map = options.env or os.environ
    value = env_map.get(key)

    if value is None:
        default = placeholder.get("default")
        optional = bool(placeholder.get("optional"))
        if isinstance(default, str):
            _env_cache[key] = default
            return default
        if optional:
            _env_cache[key] = None
            return None
        if options.on_missing_secret:
            options.on_missing_secret(placeholder, "env")
        raise ValueError(f"Required environment variable '{key}' is not set.")

    _env_cache[key] = value
    return value


def _resolve_infisical_secret(
    placeholder: Mapping[str, Any],
    options: SecretResolverOptions,
) -> Optional[str]:
    infisical_options = options.infisical or InfisicalResolverOptions()
    fetcher = _get_infisical_fetcher(infisical_options)

    path = placeholder.get("path")
    key = placeholder.get("key")
    if not isinstance(path, str) or not path:
        raise ValueError("infisical placeholder requires a non-empty 'path'.")
    if not isinstance(key, str) or not key:
        raise ValueError("infisical placeholder requires a non-empty 'key'.")

    environment = (
        placeholder.get("environment")
        or infisical_options.environment
        or os.environ.get("INFISICAL_ENVIRONMENT")
    )
    project_id = placeholder.get("projectId") or _resolve_infisical_project_id(infisical_options)
    secret_type = infisical_options.secret_type or "shared"

    cache_key = f"{path}|{key}|{environment}|{project_id}|{secret_type}"
    use_cache = infisical_options.cache is not False
    cached = _infisical_cache.get(cache_key) if use_cache else None

    if fetcher is None:
        if cached is not None:
            print(
                f"Infisical fetcher unavailable; using cached secret for {path}:{key}."
            )
            return cached
        fallback = _fallback_placeholder_value(placeholder)
        print(
            f"Infisical fetcher unavailable; returning "
            f"{'undefined' if fallback is None else 'default'} for {path}:{key}."
        )
        if fallback is None and not bool(placeholder.get("optional")) and options.on_missing_secret:
            options.on_missing_secret(placeholder, "infisical")
        return fallback

    if not isinstance(environment, str) or not environment:
        raise ValueError(
            f"Infisical secret '{path}:{key}' is missing an environment. "
            "Set it on the placeholder, pass InfisicalResolverOptions.environment, "
            "or define INFISICAL_ENVIRONMENT."
        )

    if not isinstance(project_id, str) or not project_id:
        raise ValueError(
            f"Infisical secret '{path}:{key}' is missing a project id. "
            "Set it on the placeholder, pass InfisicalResolverOptions.project_id, "
            "define INFISICAL_PROJECT_ID, or provide /run/secrets/infisical_project_id "
            "(also /var/lib/uns/secrets/infisical_project_id)."
        )

    if cached is not None:
        return cached

    try:
        secret = fetcher(path, key, environment, project_id, secret_type)
        if secret is None:
            fallback = _fallback_placeholder_value(placeholder)
            if fallback is None and not bool(placeholder.get("optional")):
                if options.on_missing_secret:
                    options.on_missing_secret(placeholder, "infisical")
                raise ValueError(f"Secret '{path}:{key}' not found in Infisical.")
            secret = fallback
    except Exception as error:
        if cached is not None:
            print(
                f"Infisical fetch failed ({error}); using cached secret for {path}:{key}."
            )
            return cached

        fallback = _fallback_placeholder_value(placeholder)
        print(
            f"Infisical fetch failed ({error}); returning "
            f"{'undefined' if fallback is None else 'default'} for {path}:{key}."
        )
        if fallback is None and not bool(placeholder.get("optional")):
            if options.on_missing_secret:
                options.on_missing_secret(placeholder, "infisical")
            raise ValueError(
                f"Failed to fetch Infisical secret {path}:{key}: {error}"
            ) from error
        secret = fallback

    if use_cache:
        _infisical_cache[cache_key] = secret
    return secret


def _fallback_placeholder_value(placeholder: Mapping[str, Any]) -> Optional[str]:
    default = placeholder.get("default")
    if isinstance(default, str):
        return default
    if bool(placeholder.get("optional")):
        return None
    return None


def _get_infisical_fetcher(
    options: InfisicalResolverOptions,
) -> Optional[SecretFetcher]:
    if options.fetch_secret:
        return options.fetch_secret

    token = _resolve_infisical_token(options)
    if not token:
        return None

    site_url = _resolve_infisical_site_url(options) or "https://app.infisical.com"
    cache_key = f"{token}::{site_url}"
    if cache_key in _default_infisical_fetcher_cache:
        return _default_infisical_fetcher_cache[cache_key]

    fetcher = _create_default_infisical_fetcher(token, site_url)
    _default_infisical_fetcher_cache[cache_key] = fetcher
    return fetcher


def _create_default_infisical_fetcher(token: str, site_url: str) -> SecretFetcher:
    try:
        from infisical_sdk import InfisicalSDKClient  # type: ignore
    except Exception as error:
        raise ValueError(
            "Failed to initialize Infisical SDK. Install 'infisicalsdk' or provide "
            "InfisicalResolverOptions.fetch_secret."
        ) from error

    client = InfisicalSDKClient(host=site_url, token=token)

    def fetch(path: str, key: str, environment: str, project_id: str, _type: str) -> Optional[str]:
        # Type is currently accepted for parity with uns-core options.
        response = client.secrets.get_secret_by_name(
            secret_name=key,
            project_id=project_id,
            environment_slug=environment,
            secret_path=path,
            include_imports=True,
            expand_secret_references=True,
            view_secret_value=True,
        )

        secret_value = _extract_secret_value(response)
        if secret_value is None:
            return None
        return str(secret_value)

    return fetch


def _extract_secret_value(response: Any) -> Optional[str]:
    candidates: Sequence[str] = ("secretValue", "secret_value", "value")
    for field in candidates:
        if hasattr(response, field):
            value = getattr(response, field)
            if value is not None:
                return str(value)

    if isinstance(response, Mapping):
        for field in candidates:
            value = response.get(field)
            if value is not None:
                return str(value)

    # Some SDK responses wrap the secret object in "secret".
    if hasattr(response, "secret"):
        wrapped = getattr(response, "secret")
        return _extract_secret_value(wrapped)
    if isinstance(response, Mapping) and isinstance(response.get("secret"), Mapping):
        return _extract_secret_value(response.get("secret"))
    return None


def _resolve_infisical_token(options: Optional[InfisicalResolverOptions]) -> Optional[str]:
    candidate = (
        (options.token if options else None)
        or os.environ.get("INFISICAL_TOKEN")
        or os.environ.get("INFISICAL_PERSONAL_TOKEN")
        or _read_secret_file(INFISICAL_TOKEN_FILE)
        or _read_secret_file(INFISICAL_TOKEN_FILE_ALT)
    )
    return _normalize_secret_value(candidate)


def _resolve_infisical_site_url(options: Optional[InfisicalResolverOptions]) -> Optional[str]:
    candidate = (
        (options.site_url if options else None)
        or os.environ.get("INFISICAL_SITE_URL")
        or _read_secret_file(INFISICAL_SITE_URL_FILE)
        or _read_secret_file(INFISICAL_SITE_URL_FILE_ALT)
    )
    return _normalize_secret_value(candidate)


def _resolve_infisical_project_id(options: Optional[InfisicalResolverOptions]) -> Optional[str]:
    candidate = (
        (options.project_id if options else None)
        or os.environ.get("INFISICAL_PROJECT_ID")
        or _read_secret_file(INFISICAL_PROJECT_ID_FILE)
        or _read_secret_file(INFISICAL_PROJECT_ID_FILE_ALT)
    )
    return _normalize_secret_value(candidate)


def _normalize_secret_value(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed if trimmed else None


def _read_secret_file(file_path: str) -> Optional[str]:
    p = Path(file_path)
    if not p.exists():
        return None
    try:
        return p.read_text(encoding="utf-8")
    except Exception as error:
        raise ValueError(
            f"Failed to read Infisical secret file '{file_path}': {error}"
        ) from error
