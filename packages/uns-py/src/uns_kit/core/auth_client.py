from __future__ import annotations

import base64
import getpass
import json
import time
import urllib.error
import urllib.request
from http.cookiejar import CookieJar
from pathlib import Path
from typing import Any, Optional

from .config_file import ConfigFile
from .secure_store import SecureStore, SecureStoreFactory


class AuthClient:
    def __init__(
        self,
        rest_base: str,
        *,
        email: Optional[str] = None,
        password: Optional[str] = None,
        store: Optional[SecureStore] = None,
        timeout: float = 10.0,
    ) -> None:
        self.rest_base = rest_base.rstrip("/")
        self.namespace = f"uns-auth:{self.rest_base}"
        self.email = email
        self.password = password
        self.timeout = timeout
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.store = store or SecureStoreFactory.create(self.namespace)
        self._cookies = CookieJar()
        self._opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self._cookies))

    @classmethod
    def create(
        cls,
        config_path: Optional[Path | str] = None,
        *,
        timeout: float = 10.0,
    ) -> "AuthClient":
        cfg = ConfigFile.load_config(config_path)
        uns = cfg.get("uns") if isinstance(cfg.get("uns"), dict) else {}
        rest_base = uns.get("rest")
        if not isinstance(rest_base, str) or not rest_base:
            raise ValueError("config.uns.rest is not set")
        email = uns.get("email") if isinstance(uns.get("email"), str) else None
        password = uns.get("password") if isinstance(uns.get("password"), str) else None
        return cls(rest_base, email=email, password=password, timeout=timeout)

    def get_access_token(self) -> str:
        if self.access_token is None:
            self.access_token = self.store.get("accessToken")
        if self.refresh_token is None:
            self.refresh_token = self.store.get("refreshToken")

        if self.access_token and not self.is_expired(self.access_token):
            return self.access_token

        if self.refresh_token:
            try:
                return self.refresh_access_token()
            except Exception:
                pass

        if self.email and self.password:
            tokens = self.login(self.email, self.password)
            return tokens["accessToken"]

        email, password = self.prompt_credentials()
        tokens = self.login(email, password)
        return tokens["accessToken"]

    def login(self, email: str, password: str) -> dict[str, Any]:
        response = self._request_json(
            "POST",
            self._endpoint("auth/login"),
            body={"email": email, "password": password},
        )
        access_token = response.get("accessToken")
        refresh_token = self._read_refresh_token_cookie()
        if not isinstance(access_token, str) or not refresh_token:
            raise RuntimeError("Login response missing tokens")
        self.email = email
        self.password = password
        self.access_token = access_token
        self.refresh_token = refresh_token
        self._persist_tokens(access_token, refresh_token)
        return {
            **response,
            "accessToken": access_token,
            "refreshToken": refresh_token,
        }

    def refresh_access_token(self) -> str:
        if not self.refresh_token:
            raise RuntimeError("No refresh token available")
        response = self._request_json(
            "POST",
            self._endpoint("auth/refresh"),
            headers={"Cookie": f"RefreshToken={self.refresh_token}"},
        )
        access_token = response.get("accessToken")
        if not isinstance(access_token, str):
            raise RuntimeError("Refresh response missing accessToken")
        self.access_token = access_token
        self.refresh_token = self._read_refresh_token_cookie() or self.refresh_token
        if self.refresh_token:
            self._persist_tokens(self.access_token, self.refresh_token)
        return access_token

    def clear_tokens(self) -> None:
        self.access_token = None
        self.refresh_token = None
        self.store.delete("accessToken")
        self.store.delete("refreshToken")

    @staticmethod
    def is_expired(token: str, skew_seconds: int = 30) -> bool:
        try:
            segments = token.split(".")
            if len(segments) < 2:
                return True
            payload_segment = segments[1]
            padding = "=" * (-len(payload_segment) % 4)
            decoded = base64.urlsafe_b64decode(f"{payload_segment}{padding}".encode("ascii"))
            payload = json.loads(decoded.decode("utf-8"))
            exp = payload.get("exp")
            if not isinstance(exp, (int, float)):
                return True
            return float(exp) <= time.time() + skew_seconds
        except Exception:
            return True

    @staticmethod
    def prompt_credentials() -> tuple[str, str]:
        email = input("Email: ").strip()
        password = getpass.getpass("Password: ").strip()
        return email, password

    def _endpoint(self, tail: str) -> str:
        return f"{self.rest_base}/{tail.lstrip('/')}"

    def _request_json(
        self,
        method: str,
        url: str,
        *,
        body: Optional[dict[str, Any]] = None,
        headers: Optional[dict[str, str]] = None,
    ) -> dict[str, Any]:
        data = None if body is None else json.dumps(body).encode("utf-8")
        request = urllib.request.Request(
            url,
            data=data,
            method=method,
            headers={
                "Accept": "application/json",
                **({"Content-Type": "application/json"} if data is not None else {}),
                **(headers or {}),
            },
        )
        try:
            with self._opener.open(request, timeout=self.timeout) as response:
                decoded = response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f"{method} {url} failed: {exc.code} {exc.reason}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"{method} {url} failed: {exc.reason}") from exc

        if not decoded:
            return {}
        parsed = json.loads(decoded)
        if not isinstance(parsed, dict):
            raise RuntimeError("Auth response must be a JSON object")
        return parsed

    def _read_refresh_token_cookie(self) -> Optional[str]:
        for cookie in self._cookies:
            if cookie.name in {"RefreshToken", "rt"}:
                return cookie.value
        return None

    def _persist_tokens(self, access_token: str, refresh_token: str) -> None:
        self.store.set("accessToken", access_token)
        self.store.set("refreshToken", refresh_token)
