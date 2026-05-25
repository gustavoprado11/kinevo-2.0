#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Import Lucas Damiani's exercise demo videos into the Kinevo exercise library.
 *
 * Flow per Drive file:
 *   1. Look up the file in --manifest (Drive ID, raw_title, drive download path).
 *   2. Look up the decision in --decisions (UPDATE_existing | NEW | SKIP).
 *   3. ffmpeg → .mp4 720p H.264 ~2 Mbps + thumbnail (first frame).
 *   4. Upload mp4 + thumb to Supabase Storage bucket `exercise-library-videos`.
 *   5. For UPDATE_existing decisions: UPDATE exercises SET video_url, thumbnail_url,
 *      video_source_drive_id WHERE id = matched_exercise_id.
 *      For NEW decisions: INSERT a row with owner_id=NULL, is_archived=true,
 *      name=cleaned title, video_url, thumbnail_url, video_source_drive_id.
 *
 * The import is idempotent: rerunning skips files whose video_source_drive_id
 * already exists in the exercises table (unless --force is passed).
 *
 * Drive download: this script does NOT call the Drive API directly. Download
 * the folder via the Drive UI (Right click → Download → unzip) and pass
 *     --input-dir=/path/to/Vídeos\ exercícios
 * The script matches each Drive ID by reading the manifest produced by
 * 01_normalize_and_dedupe.py (which captured the raw_title as-is).
 *
 * Required env:
 *   SUPABASE_URL            e.g. https://lylksbtgrihzepbteest.supabase.co
 *   SUPABASE_SERVICE_KEY    service-role key (used only locally; never commit)
 *
 * Required CLI args:
 *   --input-dir=<path>      Local directory with the downloaded .MOV files
 *   --manifest=<path>       drive_videos.json (output of 01_normalize_and_dedupe.py)
 *   --decisions=<path>      decisions.json (your approvals — see schema below)
 *
 * Optional:
 *   --dry-run               Plan only — no transcoding, uploads, or DB writes
 *   --force                 Re-process files already imported
 *   --only=<drive_id>       Process a single Drive ID (useful for retries)
 *   --concurrency=2         Parallel transcodes (default 2 — ffmpeg is CPU-bound)
 *
 * decisions.json schema:
 *   {
 *     "approvals": [
 *       { "drive_id": "1ArwquR2Kx...", "action": "UPDATE_existing", "exercise_id": "2b6d5137-..." },
 *       { "drive_id": "1tP00bwfi_...", "action": "NEW", "name": "Afundo 1KB Rack" },
 *       { "drive_id": "1XYZ...",        "action": "SKIP" }
 *     ]
 *   }
 *
 * If a Drive ID is missing from decisions.json, the script SKIPs it and logs.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ----------------------------------------------------------------------------
// CLI
// ----------------------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/)
    return m ? [m[1], m[2] ?? true] : []
  }),
)
const required = ['input-dir', 'manifest', 'decisions']
for (const k of required) {
  if (!args[k]) {
    console.error(`Missing required --${k}`)
    process.exit(2)
  }
}
const INPUT_DIR = path.resolve(args['input-dir'])
const MANIFEST = path.resolve(args.manifest)
const DECISIONS = path.resolve(args.decisions)
const DRY_RUN = !!args['dry-run']
const FORCE = !!args.force
const ONLY = typeof args.only === 'string' ? args.only : null
const CONCURRENCY = Math.max(1, parseInt(args.concurrency ?? '2', 10))

const TMP_DIR_OVERRIDE = typeof args['tmp-dir'] === 'string' ? args['tmp-dir'] : null

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in env')
  process.exit(2)
}
const BUCKET = 'exercise-library-videos'

const supa = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
// macOS HFS+/APFS normalizes filenames to NFD (decomposed Unicode) and stores
// '/' as ':' internally. The Drive manifest captures titles as NFC with '/'.
// This normalization makes the comparison work in both directions.
function normalizeForMatch(s) {
  return s
    .normalize('NFC')          // Unify Unicode form (so "Í" == "I+acento")
    .replace(/[:]/g, '/')      // macOS stores '/' as ':' — undo it
    .replace(/["']/g, '')      // Drop quotes (some files have stray quotes)
    .replace(/\s+/g, ' ')      // Collapse whitespace
    .trim()
    .toLowerCase()
}

// Aggressive normalization for files where the Drive ZIP mangled special
// characters ('/', '"', etc.) — strips everything that isn't a letter or digit
// and collapses to a comparable token sequence.
function aggressiveNormalize(s) {
  return s
    .normalize('NFC')
    .replace(/\.(mov|MOV)$/i, '')     // strip .mov extension
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ') // keep only letters, digits, spaces
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function slugify(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args])
    let stderr = ''
    p.stderr.on('data', (d) => (stderr += d.toString()))
    p.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${stderr}`)),
    )
  })
}

async function transcode(srcMov, outMp4, outThumb) {
  // 720p H.264, 2 Mbps, faststart, AAC 96k
  await runFfmpeg([
    '-i', srcMov,
    '-vf', 'scale=-2:720',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '23',
    '-c:a', 'aac', '-b:a', '96k',
    '-movflags', '+faststart',
    outMp4,
  ])
  await runFfmpeg([
    '-ss', '00:00:00.5',
    '-i', outMp4,
    '-vframes', '1',
    '-vf', 'scale=640:-2',
    '-q:v', '4',
    outThumb,
  ])
}

async function uploadFile(localPath, storagePath, contentType) {
  const buf = await fs.readFile(localPath)
  const { error } = await supa.storage.from(BUCKET).upload(storagePath, buf, {
    contentType,
    upsert: true,
    cacheControl: '31536000', // 1 year — files keyed by hash, safe to cache long
  })
  if (error) throw new Error(`upload ${storagePath}: ${error.message}`)
  const { data } = supa.storage.from(BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}

async function alreadyImported(driveId) {
  const { data, error } = await supa
    .from('exercises')
    .select('id, name, video_url')
    .eq('video_source_drive_id', driveId)
    .maybeSingle()
  if (error && error.code !== 'PGRST116') throw error
  return data ?? null
}

async function upsertExercise({ action, driveId, exerciseId, name, videoUrl, thumbnailUrl }) {
  if (action === 'UPDATE_existing') {
    if (!exerciseId) throw new Error('UPDATE_existing requires exercise_id')
    const { error } = await supa
      .from('exercises')
      .update({
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        video_source_drive_id: driveId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', exerciseId)
    if (error) throw error
    return { mode: 'updated', id: exerciseId }
  }
  if (action === 'NEW') {
    if (!name) throw new Error('NEW requires name')
    const { data, error } = await supa
      .from('exercises')
      .insert({
        owner_id: null,
        name,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        video_source_drive_id: driveId,
        is_archived: true, // requires manual review before publication
      })
      .select('id')
      .single()
    if (error) throw error
    return { mode: 'inserted', id: data.id }
  }
  throw new Error(`Unknown action: ${action}`)
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
async function main() {
  const manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8'))
  const decisions = JSON.parse(await fs.readFile(DECISIONS, 'utf8'))
  const decByDriveId = new Map(decisions.approvals.map((d) => [d.drive_id, d]))

  const inputFiles = await fs.readdir(INPUT_DIR)
  // Build TWO indexes: strict (normalized) and loose (aggressive — alphanumeric only).
  const localByKey = new Map()
  const localByLooseKey = new Map()
  for (const f of inputFiles) {
    localByKey.set(normalizeForMatch(f), path.join(INPUT_DIR, f))
    const looseKey = aggressiveNormalize(f)
    if (!localByLooseKey.has(looseKey)) {
      localByLooseKey.set(looseKey, path.join(INPUT_DIR, f))
    }
  }

  if (DRY_RUN) {
    console.log(`[debug] indexed ${localByKey.size} files from ${INPUT_DIR}`)
  }

  const tmpBase = TMP_DIR_OVERRIDE
    ? (await fs.mkdir(TMP_DIR_OVERRIDE, { recursive: true }), TMP_DIR_OVERRIDE)
    : os.tmpdir()
  const tmpDir = await fs.mkdtemp(path.join(tmpBase, 'kinevo-import-'))
  console.log(`tmpdir: ${tmpDir}`)

  const work = manifest.filter((m) => (ONLY ? m.drive_id === ONLY : true))
  const queue = [...work]
  const results = []
  const errors = []

  async function worker(workerId) {
    while (queue.length) {
      const item = queue.shift()
      if (!item) return
      const tag = `[${item.drive_id.slice(0, 8)}…]`
      try {
        const decision = decByDriveId.get(item.drive_id)
        if (!decision) {
          console.log(`${tag} SKIP — no decision in decisions.json`)
          results.push({ drive_id: item.drive_id, status: 'skipped_no_decision' })
          continue
        }
        if (decision.action === 'SKIP') {
          console.log(`${tag} SKIP — decision=SKIP`)
          results.push({ drive_id: item.drive_id, status: 'skipped_by_decision' })
          continue
        }

        if (!FORCE) {
          const existing = await alreadyImported(item.drive_id)
          if (existing) {
            console.log(`${tag} skip — already imported (${existing.id})`)
            results.push({ drive_id: item.drive_id, status: 'already_imported', id: existing.id })
            continue
          }
        }

        let src = localByKey.get(normalizeForMatch(item.raw_title))
        if (!src) {
          // Fallback: try loose match (strip all special chars). Useful when the
          // Drive ZIP mangled '/' or other reserved characters.
          src = localByLooseKey.get(aggressiveNormalize(item.raw_title))
          if (src) {
            console.log(`${tag} loose-match: "${item.raw_title}" -> ${path.basename(src)}`)
          }
        }
        if (!src) {
          throw new Error(
            `local file not found: "${item.raw_title}" in ${INPUT_DIR}. ` +
              `Make sure the Drive folder was unzipped without renames.`,
          )
        }

        const slug = slugify(decision.name || item.normalized_name) + '-' + item.drive_id.slice(0, 6)
        const mp4Path = path.join(tmpDir, `${slug}.mp4`)
        const thumbPath = path.join(tmpDir, `${slug}.jpg`)

        if (DRY_RUN) {
          console.log(`${tag} DRY: would process ${item.raw_title} -> ${decision.action}`)
          results.push({ drive_id: item.drive_id, status: 'dry_run', decision })
          continue
        }

        try {
          console.log(`${tag} transcoding ${item.raw_title}…`)
          await transcode(src, mp4Path, thumbPath)

          console.log(`${tag} uploading…`)
          const videoUrl = await uploadFile(mp4Path, `${slug}.mp4`, 'video/mp4')
          const thumbUrl = await uploadFile(thumbPath, `thumbnails/${slug}.jpg`, 'image/jpeg')

          const dbResult = await upsertExercise({
            action: decision.action,
            driveId: item.drive_id,
            exerciseId: decision.exercise_id,
            name: decision.name,
            videoUrl,
            thumbnailUrl: thumbUrl,
          })
          console.log(`${tag} ${dbResult.mode} → ${dbResult.id}`)
          results.push({
            drive_id: item.drive_id,
            status: 'ok',
            mode: dbResult.mode,
            exercise_id: dbResult.id,
            video_url: videoUrl,
          })
        } finally {
          // Always cleanup local temp files, even on error, to keep disk pressure low.
          await fs.unlink(mp4Path).catch(() => {})
          await fs.unlink(thumbPath).catch(() => {})
        }
      } catch (err) {
        console.error(`${tag} ERROR:`, err.message)
        errors.push({ drive_id: item.drive_id, error: err.message })
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i))
  await Promise.all(workers)

  const reportPath = path.join(
    path.dirname(MANIFEST),
    `import-log-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  )
  await fs.writeFile(reportPath, JSON.stringify({ results, errors }, null, 2))

  console.log('\n========================================')
  console.log(`Total: ${results.length} processed, ${errors.length} errors`)
  console.log(`Report: ${reportPath}`)
  if (errors.length > 0) process.exit(1)
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
