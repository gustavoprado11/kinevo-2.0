// ============================================================================
// Shared HTTP helpers
// ============================================================================
// Extract a filename from a Content-Disposition response header. Supports the
// common `attachment; filename="foo.pdf"` form (and tolerates whitespace).
// Returns null when the header is missing or doesn't carry a filename.
// ============================================================================

export function parseFilenameFromHeader(header: string | null): string | null {
    if (!header) return null;
    const match = header.match(/filename\s*=\s*"([^"]+)"/i)
        ?? header.match(/filename\s*=\s*([^;]+)/i);
    if (!match) return null;
    return match[1].trim() || null;
}
