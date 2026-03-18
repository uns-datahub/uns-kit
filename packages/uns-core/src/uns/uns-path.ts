const normalizeSegment = (value: string): string => value.trim().replace(/^\/+|\/+$/g, "");

export function buildUnsIdentityPath(...segments: string[]): string {
  return segments
    .map((segment) => normalizeSegment(String(segment ?? "")))
    .filter((segment) => segment.length > 0)
    .join("/");
}

export function buildUnsRoutePath(...segments: string[]): string {
  return `/${buildUnsIdentityPath(...segments)}`.replace(/\/{2,}/g, "/");
}
