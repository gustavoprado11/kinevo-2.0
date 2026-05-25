#!/usr/bin/env python3
"""
Reads drive_videos_raw.tsv, dedupes by file id, normalizes titles into a
candidate exercise name, and writes:
  - drive_videos.json: clean list of unique videos
  - drive_match_query.sql: a single SQL block to run via execute_sql for
    pg_trgm-based matching against public.exercises.
"""
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).parent
RAW = ROOT / "drive_videos_raw.tsv"
OUT_JSON = ROOT / "drive_videos.json"
OUT_SQL = ROOT / "drive_match_query.sql"

# Map abbreviations used in the Drive filenames to expanded Portuguese words.
# Applied AFTER stripping the .mov extension and as whole-word replacements.
ABBREV = {
    r"\bBB\b": "Barra",
    r"\bDB\b": "Halteres",
    r"\bKB\b": "Kettlebell",
    r"\bUNI\.?\b": "Unilateral",
    r"\bBIL\.?\b": "Bilateral",
    r"\bC/\b": "com",
    r"\bS/\b": "sem",
    r"\bALT\.?\b": "Alternado",
    r"\bALONG\.?\b": "Alongamento",
    r"\bMOB\.?\b": "Mobilidade",
    r"\bFLEX\.?\b": "Flexao",
    r"\bDIN\.?\b": "Dinamico",
    r"\bISO\b": "Isometrico",
    r"\bSAJ\.?\b": "SAJ",       # acronym not in current catalog; keep as-is
    r"\bCOORD\.?\b": "Coordenacao",
    r"\bPOS\.?\b": "Pos",
    r"\bBOX\b": "Box",
    r"\bAR\.?\b": "AR",
    r"\bA\.R\.\b": "AR",
    r"\bRR\b": "RR",
}

def normalize_title(raw):
    """Drop extension, expand abbreviations, normalize whitespace/case."""
    name = re.sub(r"\.MOV$|\.mov$", "", raw).strip()
    # Strip stray quotes
    name = name.replace('"', '')
    # Convert / inside terms like "KB/DB" to "/" — handle separately
    # Apply abbreviations
    for pat, sub in ABBREV.items():
        name = re.sub(pat, sub, name, flags=re.IGNORECASE)
    # Collapse multiple spaces, strip period ends
    name = re.sub(r"\s+", " ", name).strip(" .")
    return name

def main():
    seen = {}
    with RAW.open(encoding="utf-8") as f:
        for ln in f:
            ln = ln.rstrip("\n")
            if not ln.strip():
                continue
            parts = ln.split("\t")
            if len(parts) != 3:
                continue
            drive_id, raw_title, size = parts
            if drive_id in seen:
                continue
            seen[drive_id] = {
                "drive_id": drive_id,
                "raw_title": raw_title,
                "normalized_name": normalize_title(raw_title),
                "size_bytes": int(size),
            }

    items = list(seen.values())
    items.sort(key=lambda r: r["normalized_name"].lower())

    OUT_JSON.write_text(json.dumps(items, ensure_ascii=False, indent=2))
    print(f"[OK] {len(items)} unique videos written to {OUT_JSON.name}")
    total_gb = sum(r["size_bytes"] for r in items) / (1024 ** 3)
    print(f"     Total size: {total_gb:.2f} GiB")

    # Build SQL: temp values list of (drive_id, raw_title, normalized_name),
    # then fuzzy match server-side using pg_trgm + unaccent.
    def esc(s):
        return s.replace("'", "''")

    rows = ",\n  ".join(
        f"('{esc(r['drive_id'])}', '{esc(r['raw_title'])}', '{esc(r['normalized_name'])}')"
        for r in items
    )

    sql = f"""
WITH drive AS (
  SELECT *
  FROM (VALUES
  {rows}
  ) AS v(drive_id, raw_title, normalized_name)
),
ranked AS (
  SELECT
    d.drive_id,
    d.raw_title,
    d.normalized_name,
    e.id AS exercise_id,
    e.name AS exercise_name,
    CASE
      WHEN e.video_url ILIKE '%youtu%' THEN 'youtube'
      WHEN e.video_url IS NULL THEN 'none'
      ELSE 'other'
    END AS current_video_type,
    e.video_url AS current_video_url,
    similarity(
      unaccent(lower(d.normalized_name)),
      unaccent(lower(e.name))
    ) AS sim,
    ROW_NUMBER() OVER (
      PARTITION BY d.drive_id
      ORDER BY similarity(
        unaccent(lower(d.normalized_name)),
        unaccent(lower(e.name))
      ) DESC
    ) AS rn
  FROM drive d
  CROSS JOIN public.exercises e
  WHERE e.owner_id IS NULL
    AND similarity(
      unaccent(lower(d.normalized_name)),
      unaccent(lower(e.name))
    ) >= 0.20
)
SELECT
  drive_id,
  raw_title,
  normalized_name,
  exercise_id,
  exercise_name,
  current_video_type,
  current_video_url,
  ROUND(sim::numeric, 3) AS similarity_score,
  CASE
    WHEN sim >= 0.70 THEN 'auto_match'
    WHEN sim >= 0.45 THEN 'review_match'
    ELSE 'low_confidence'
  END AS match_class
FROM ranked
WHERE rn = 1
ORDER BY sim DESC;
""".strip() + "\n"

    OUT_SQL.write_text(sql)
    print(f"[OK] SQL written to {OUT_SQL.name} ({len(sql):,} bytes)")

if __name__ == "__main__":
    main()
