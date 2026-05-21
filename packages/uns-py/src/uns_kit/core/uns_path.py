from __future__ import annotations


def _normalize_segment(value: str) -> str:
    return str(value or "").strip().strip("/")


def build_uns_identity_path(*segments: str) -> str:
    return "/".join(
        segment
        for segment in (_normalize_segment(str(value)) for value in segments)
        if segment
    )


def build_uns_route_path(*segments: str) -> str:
    return f"/{build_uns_identity_path(*segments)}".replace("//", "/")
