const normalizeSegment = (value) => value.trim().replace(/^\/+|\/+$/g, "");
export function buildUnsIdentityPath(...segments) {
    return segments
        .map((segment) => normalizeSegment(String(segment ?? "")))
        .filter((segment) => segment.length > 0)
        .join("/");
}
export function buildUnsRoutePath(...segments) {
    return `/${buildUnsIdentityPath(...segments)}`.replace(/\/{2,}/g, "/");
}
//# sourceMappingURL=uns-path.js.map