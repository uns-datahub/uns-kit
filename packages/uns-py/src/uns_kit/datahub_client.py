from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Mapping, Optional

from .auth_client import AuthClient


@dataclass(frozen=True)
class LastValueResult:
    topic: str
    value: Any
    values: Optional[dict[str, Any]]
    uom: Optional[str]
    timestamp: Optional[str]
    data_group: Optional[str]
    age_ms: Optional[float]
    source: str

    @staticmethod
    def from_mapping(value: Mapping[str, Any]) -> "LastValueResult":
        raw_values = value.get("values")
        return LastValueResult(
            topic=str(value.get("topic") or ""),
            value=value.get("value"),
            values=dict(raw_values) if isinstance(raw_values, Mapping) else None,
            uom=value.get("uom") if isinstance(value.get("uom"), str) else None,
            timestamp=value.get("timestamp") if isinstance(value.get("timestamp"), str) else None,
            data_group=value.get("dataGroup") if isinstance(value.get("dataGroup"), str) else None,
            age_ms=float(value["ageMs"]) if isinstance(value.get("ageMs"), (int, float)) else None,
            source=str(value.get("source") or "miss"),
        )

    @property
    def hit(self) -> bool:
        return self.source == "cache"

    def to_dict(self) -> dict[str, Any]:
        return {
            "topic": self.topic,
            "value": self.value,
            "values": self.values,
            "uom": self.uom,
            "timestamp": self.timestamp,
            "dataGroup": self.data_group,
            "ageMs": self.age_ms,
            "source": self.source,
        }

class LastValueClientError(RuntimeError):
    def __init__(self, message: str, *, status_code: Optional[int] = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class UnsClient:
    def __init__(
        self,
        base_url: str,
        *,
        api_base_path: str = "/api",
        token: Optional[str] = None,
        auth_client: Optional[AuthClient] = None,
        timeout: float = 10.0,
    ) -> None:
        self.api_base_path = self._normalize_base_path(api_base_path)
        stripped_base_url = base_url.rstrip("/")
        if self.api_base_path and stripped_base_url.endswith(self.api_base_path):
            self.api_url = stripped_base_url
            self.base_url = stripped_base_url[: -len(self.api_base_path)].rstrip("/")
        else:
            self.base_url = stripped_base_url
            self.api_url = f"{stripped_base_url}{self.api_base_path}"
        self.access_token = token
        self.timeout = timeout
        self.auth_client = auth_client
        self._opener = urllib.request.build_opener()

    def set_token(self, token: Optional[str]) -> None:
        self.access_token = token

    def ensure_token(self) -> None:
        if self.access_token:
            return
        try:
            if self.auth_client is None:
                self.auth_client = AuthClient.create()
            self.access_token = self.auth_client.get_access_token()

        except Exception as exc:
            raise RuntimeError("No access token available, please login again.") from exc

    def get(self, endpoint: str, params: Optional[dict[str, Any]] = None, *, base_url: Optional[str] = None, authorize: bool = True) -> dict[str, Any]:
        if authorize:
            self.ensure_token()
        query = urllib.parse.urlencode(params or {})
        suffix = f"?{query}" if query else ""
        return self._request_json(
            "GET",
            f"{self._build_url(endpoint, base_url=base_url)}{suffix}",
            token=self.access_token if authorize else None,
        )

    def post(self, endpoint: str, data: Optional[dict[str, Any]] = None, *, base_url: Optional[str] = None, authorize: bool = True) -> dict[str, Any]:
        if authorize:
            self.ensure_token()
        return self._request_json(
            "POST",
            self._build_url(endpoint, base_url=base_url),
            body=data or {},
            token=self.access_token if authorize else None,
        )

    def last_value(self, topics: str | list[str], *, token: Optional[str] = None) -> Optional[dict[str, dict[str, Any]]]:
        topic_list = [topics] if isinstance(topics, str) else topics
        if not topic_list:
            raise ValueError("topics must contain at least one topic.")
        if len(topic_list) > 500:
            raise ValueError("Maximum 500 topics per request.")
        effective_token = token
        if effective_token is None:
            self.ensure_token()
            effective_token = self.access_token
        try:
            payload = self._request_json(
                "POST",
                self._build_url("/batch/last"),
                body={"topics": topic_list},
                token=effective_token,
            )
        except LastValueClientError as exc:
            if exc.status_code == 404:
                return None
            raise
        raw_results = payload.get("results")
        if not isinstance(raw_results, list):
            raise LastValueClientError("Last-value response did not include a results array.")
        results = [
            LastValueResult.from_mapping(item)
            for item in raw_results
            if isinstance(item, Mapping)
        ]
        return {result.topic: result.to_dict() for result in results}

    def _request_json(
        self,
        method: str,
        url: str,
        *,
        body: Optional[dict[str, Any]] = None,
        token: Optional[str] = None,
    ) -> dict[str, Any]:
        data = None if body is None else json.dumps(body).encode("utf-8")
        request = urllib.request.Request(
            url,
            data=data,
            method=method,
            headers={
                "Accept": "application/json",
                **({"Content-Type": "application/json"} if data is not None else {}),
                **({"Authorization": f"Bearer {token}"} if token else {}),
            },
        )
        try:
            with self._opener.open(request, timeout=self.timeout) as response:
                decoded = response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            message = exc.read().decode("utf-8", errors="replace")
            raise LastValueClientError(
                f"UNS request failed with HTTP {exc.code}: {message}",
                status_code=exc.code,
            ) from exc
        except urllib.error.URLError as exc:
            raise LastValueClientError(f"UNS request failed: {exc.reason}") from exc

        if not decoded:
            return {}
        try:
            parsed = json.loads(decoded)
        except json.JSONDecodeError as exc:
            raise LastValueClientError("UNS response was not valid JSON.") from exc
        if not isinstance(parsed, dict):
            raise LastValueClientError("UNS response must be a JSON object.")
        return parsed

    def _build_url(self, endpoint: str, *, base_url: Optional[str] = None) -> str:
        if endpoint.startswith("http://") or endpoint.startswith("https://"):
            return endpoint
        root = (base_url or self.api_url).rstrip("/")
        path = endpoint if endpoint.startswith("/") else f"/{endpoint}"
        if base_url is None and self.api_base_path and (
            path == self.api_base_path or path.startswith(f"{self.api_base_path}/")
        ):
            path = path[len(self.api_base_path):] or "/"
        return f"{root}{path}"

    @staticmethod
    def _normalize_base_path(value: str) -> str:
        stripped = value.strip()
        if not stripped:
            return ""
        return stripped if stripped.startswith("/") else f"/{stripped}"
