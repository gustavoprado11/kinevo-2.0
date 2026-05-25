# Import dos vídeos de exercícios do Lucas

Pipeline para puxar os ~143 vídeos `.MOV` da pasta do Drive, transcodificar para `.mp4` 720p H.264, subir no Supabase Storage e popular `exercises.video_url`.

## Pré-requisitos

- `ffmpeg` instalado (`brew install ffmpeg` no macOS)
- Migrations aplicadas: `135` (bucket + `video_source_drive_id`) e `136` (adiciona o grupo `Agilidade/Drill` — os demais usados pelas atribuições já existem no catálogo)
- Service-role key do Supabase (NÃO commitar — usar variável de ambiente local)
- Pasta do Drive baixada localmente: no Drive, botão direito na pasta "Vídeos exercícios" → Download. Descompacta o ZIP num diretório.

## Arquivos neste diretório

- `drive_videos_manifest.json` — lista de 143 vídeos do Drive com `drive_id`, `raw_title`, tamanho. Gerado por `normalize_drive_manifest.py`.
- `normalize_drive_manifest.py` — regenera o manifest a partir de um TSV bruto se quiser reexecutar (não é necessário no fluxo normal).
- `import-exercise-library-videos.mjs` — pipeline principal de import.
- `decisions.json` — decisões já aprovadas (17 UPDATE_existing + 126 NEW).
- `decisions.example.json` — modelo (referência).
- `muscle_group_assignments.json` — mapeamento drive_id → grupos musculares aprovado pelo usuário.
- `post_import_muscle_groups.sql` — SQL a rodar DEPOIS do pipeline pra linkar exercícios aos grupos.

## Fluxo

### 1. Aplicar as migrations

```bash
cd supabase
supabase db push --linked
# ou rodar individualmente:
psql "$DATABASE_URL" -f migrations/135_exercise_library_videos_bucket.sql
psql "$DATABASE_URL" -f migrations/136_muscle_groups_for_athletic_library.sql
```

### 2. decisions.json (já está pronto)

Não precisa editar — eu já gerei com base nas suas aprovações. Inspeciona se quiser:

```bash
jq '._summary' web/scripts/decisions.json
# { "total": 143, "update_existing": 17, "new": 126, "skip": 0 }
```

### 3. Baixar a pasta do Drive

Vá no Drive, clica com botão direito em "Vídeos exercícios" → Download. Vai gerar um ZIP. Descompacta:

```bash
unzip ~/Downloads/Vídeos\ exercícios-*.zip -d ~/Downloads/videos-lucas
```

### 4. Rodar dry-run

```bash
export SUPABASE_URL="https://lylksbtgrihzepbteest.supabase.co"
export SUPABASE_SERVICE_KEY="..."   # pega no painel do Supabase, Settings → API

cd web

# Dry-run primeiro pra ver o plano sem mexer em nada
node scripts/import-exercise-library-videos.mjs \
  --input-dir="$HOME/Downloads/videos-lucas/Vídeos exercícios" \
  --manifest=scripts/drive_videos_manifest.json \
  --decisions=scripts/decisions.json \
  --dry-run
```

Saída esperada: lista do que seria processado e o que seria SKIPed. Confere se cada `drive_id` foi reconhecido.

### 5. Executar para valer

```bash
node scripts/import-exercise-library-videos.mjs \
  --input-dir="$HOME/Downloads/videos-lucas/Vídeos exercícios" \
  --manifest=scripts/drive_videos_manifest.json \
  --decisions=scripts/decisions.json \
  --concurrency=2
```

O processamento leva ~10–15 minutos no total (ffmpeg é o gargalo). Concorrência 2 é bom equilíbrio entre CPU e disco; aumenta se a máquina aguentar.

O log final fica em `scripts/import-log-<timestamp>.json` com sucesso/falha por arquivo.

### 6. Linkar muscle_groups aos exercícios novos

Depois que o pipeline rodou, os 126 exercícios `NEW` existem mas ainda não estão associados aos grupos musculares. Rode o SQL:

```bash
psql "$DATABASE_URL" -f web/scripts/post_import_muscle_groups.sql
```

Isso faz INSERTs em `exercise_muscle_groups` (idempotente via `ON CONFLICT DO NOTHING`). Atribuições conforme aprovação (`muscle_group_assignments.json`):

- Glúteo (36) · Quadríceps (26) · Costas (20) · Posterior de Coxa (19) · Peito (11)
- Mobilidade (9) · Ombros (6) · Pliometria (6) · Lombar (6) · Agilidade/Drill (5)
- Potência (5) · Abdominais (4) · Tríceps (1) · Panturrilha (1)

(Muitos exercícios têm múltiplos grupos: Terra = Posterior de Coxa + Glúteo + Lombar; Afundo = Quadríceps + Glúteo; etc.)

### 7. Revisar e publicar

Os 126 exercícios criados como `NEW` entram com `is_archived=true`. Abre o admin, confirma nome / equipment / category, e tira o `is_archived` quando estiver bom pra publicar.

```sql
SELECT
  e.name,
  array_agg(mg.name ORDER BY mg.name) AS grupos
FROM exercises e
LEFT JOIN exercise_muscle_groups emg ON emg.exercise_id = e.id
LEFT JOIN muscle_groups mg ON mg.id = emg.muscle_group_id
WHERE e.owner_id IS NULL
  AND e.video_source_drive_id IS NOT NULL
  AND e.is_archived = true
GROUP BY e.id, e.name
ORDER BY e.name;
```

## Comandos úteis

```bash
# Reprocessar 1 arquivo específico (testar)
node scripts/import-exercise-library-videos.mjs \
  --input-dir=... --manifest=... --decisions=... \
  --only=1ArwquR2KxBgM5yMrMy_qwhmkjvxjAtHa --force

# Forçar reprocessamento de tudo (útil se a primeira tentativa quebrou no meio)
node scripts/import-exercise-library-videos.mjs ... --force
```

## Como o pipeline é idempotente

- `exercises.video_source_drive_id` é UNIQUE; o script faz `SELECT … WHERE video_source_drive_id = ?` antes de processar.
- Storage usa `upsert: true`, então re-uploads sobrescrevem o objeto sem erro.
- Reexecuções saltam vídeos já importados, a menos que `--force` seja passado.

## Rollback

Se algo der errado:

```sql
-- Reverter exercícios novos (criados pelo pipeline)
DELETE FROM exercises
WHERE owner_id IS NULL
  AND video_source_drive_id IS NOT NULL
  AND is_archived = true;

-- Reverter overrides (volta pro YouTube): vai precisar do backup do video_url anterior.
-- Recomendo salvar um snapshot antes de rodar a etapa 5:
\copy (SELECT id, name, video_url FROM exercises WHERE owner_id IS NULL) TO 'pre-import-snapshot.csv' CSV HEADER;
```

Limpa o bucket pelo painel do Supabase ou:

```bash
# Listar objetos
curl -X GET "$SUPABASE_URL/storage/v1/object/list/exercise-library-videos" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY"
```

## Onde tudo isso vai parar

- Vídeos: `https://lylksbtgrihzepbteest.supabase.co/storage/v1/object/public/exercise-library-videos/<slug>.mp4`
- Thumbs: `…/exercise-library-videos/thumbnails/<slug>.jpg`
- Frontend mobile (`mobile/app/exercises/[id].tsx`) e web (`web/src/components/programs/...`) já consomem `exercise.video_url` direto. Não precisa mudar código.
