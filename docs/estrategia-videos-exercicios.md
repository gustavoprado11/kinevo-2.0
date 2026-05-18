# Estratégia para Biblioteca de Vídeos de Exercícios

Documento de decisão sobre como disponibilizar a pasta "Vídeos exercícios" do Drive (~130 arquivos `.MOV`, ~5–7 GB) para todos os treinadores do Kinevo.

---

## 1. TL;DR

**Recomendação:** transcodificar os vídeos localmente para `.mp4` H.264 (720p, ~2 Mbps), subir num bucket público do Supabase Storage (`exercise-library-videos`), e referenciá-los em exercícios "do sistema" (`exercises.owner_id IS NULL`).

Isso reaproveita 100% da infra já existente — RLS de exercícios compartilhados, player mobile (`expo-av`), player web (`<video>`), tabela `trainer_exercise_videos` para overrides — e não introduz nenhum provider novo. Custo estimado: **R$ 0–30/mês** no primeiro ano. Migrar para Cloudflare/Bunny Stream só vira necessário se o tráfego ultrapassar ~50 GB/mês.

---

## 2. O que já existe no Kinevo (não é greenfield)

A descoberta-chave é que o produto **já está arquitetado para isso**. Eu não precisaria mudar nenhuma decisão de modelagem; basta popular dados.

Modelo de dados:

- `exercises.owner_id IS NULL` representa **exercícios do sistema** — biblioteca compartilhada entre todos os treinadores. RLS já permite leitura: `USING (owner_id IS NULL OR owner_id = current_trainer_id())`.
- `exercises.video_url` aceita URL direta (`.mp4`) ou URL do YouTube; o frontend detecta o tipo via `extractYouTubeId()` e `isDirectVideoUrl()`.
- Tabela `trainer_exercise_videos` (migration 092) permite que cada treinador faça **override** do vídeo de qualquer exercício, inclusive os do sistema — útil quando o treinador prefere o próprio demonstrativo.
- Bucket Supabase Storage `trainer-videos` já existe (público, com paths por `auth.uid()`).

Frontend:

- Mobile (`mobile/app/exercises/[id].tsx`, `training-room.tsx`, etc.) usa `expo-av` para reproduzir `.mp4` direto e WebView para YouTube.
- Web (`web/src/components/programs/...`) já consome `exercise.video_url` em vários componentes (picker, training room, library panel, superset card).

Conclusão: o trabalho é **popular dados + um pipeline de import**, não construir feature.

---

## 3. Pasta do Drive analisada

A pasta `1P1aVtYuXSmkCbg15Zn5amtqYF-TDJRTF` ("Vídeos exercícios", owner `damianilucas23@gmail.com`) tem aproximadamente 130 arquivos com as seguintes características:

- Formato: `.MOV` (QuickTime, `video/quicktime`)
- Tamanho médio: ~40 MB por vídeo
- Tamanho total estimado: ~5–7 GB
- Duração média: provavelmente 15–30s (vídeos curtos de demonstração)
- Nomes seguem o padrão do nome do exercício, por exemplo `SUPINO RETO DB.mov`, `HIP THRUST UNI.MOV`, `STIFF BB.MOV`, `WALL DRILL 1 TROCA ALTERNADA.mov`

Dois problemas práticos com `.MOV` que precisam ser resolvidos antes da publicação:

1. **Android não toca `.MOV` confiavelmente** — o container QuickTime não é universalmente suportado em players nativos. Mesmo arquivos `.MOV` com codec H.264 dentro precisam ser remuxados para `.mp4` para garantir compatibilidade.
2. **Tamanho** — vídeos gravados em iPhone normalmente saem em ProRes ou HEVC pesado. Transcodificar para H.264 720p ~2 Mbps deve reduzir 60–80% do tamanho sem perda visível para vídeos curtos de demonstração.

---

## 4. Comparação de opções

| Opção | Custo/mês | Streaming adaptativo | Player mobile | Aderência stack | Veredito |
|---|---|---|---|---|---|
| Drive como CDN (link direto) | R$ 0 | Não | Ruim (rate-limit, requer auth) | Externo | **Não usar** |
| YouTube unlisted | R$ 0 | Sim | WebView (clunky) | Externo, com branding | Backup aceitável |
| Vimeo Pro | R$ 35–100 | Sim | Bom | Externo | OK mas pago e fora da stack |
| **Supabase Storage** (bucket público) | **R$ 0–30** | Não (single quality) | Excelente (`expo-av`) | **Total — mesma stack** | **Recomendado para o volume atual** |
| Cloudflare Stream | R$ 25–80 | Sim (HLS) | Excelente | Provider novo | Migrar depois se escalar |
| Bunny Stream | R$ 15–50 | Sim (HLS) | Excelente | Provider novo | Alternativa mais barata ao Cloudflare |

Notas de custo do Supabase Storage:

- Free tier inclui 1 GB de storage + 5 GB de egress/mês no plano Free; no Pro são 100 GB de storage + 250 GB de egress.
- 5–7 GB de vídeos cabem no Free; o custo aparece pelo **egress**, não pelo armazenamento.
- Estimativa de egress: 50 treinadores × 5 plays/dia × 4 MB (vídeo transcodificado) × 30 dias ≈ **30 GB/mês**, dentro do plano Pro sem custo adicional.
- Se cada treinador também prescreve para 10 alunos que veem os vídeos, o egress pode ir a ~200–300 GB/mês. Ainda assim fica dentro do Pro ou custa poucos dólares extras.

---

## 5. Arquitetura recomendada

```
┌─────────────────┐         ┌──────────────────────┐         ┌─────────────────┐
│ Pasta Drive     │         │ Pipeline de import   │         │ Supabase        │
│ "Vídeos exerc." │  ─────▶ │ (script Node local)  │ ──────▶ │ Storage         │
│ ~130 .MOV       │         │ • baixa arquivo      │         │ exercise-       │
└─────────────────┘         │ • ffmpeg → .mp4 720p │         │ library-videos  │
                            │ • gera thumbnail     │         │ (público read)  │
                            │ • match com nome     │         └──────┬──────────┘
                            │ • upsert no DB       │                │
                            └──────────────────────┘                │ URL pública
                                       │                            ▼
                                       │ INSERT/UPDATE       ┌─────────────────┐
                                       ▼                     │ exercises       │
                                ┌─────────────────┐          │ owner_id = NULL │
                                │ public.exercises│ ◀────────│ video_url       │
                                │ owner_id IS NULL│          │ thumbnail_url   │
                                └─────────────────┘          └─────────────────┘
                                       │                            │
                                       │ RLS: visível para todos    │
                                       ▼                            ▼
                              ┌──────────────────┐         ┌────────────────────┐
                              │ Mobile (expo-av) │         │ Web (<video> HTML5)│
                              └──────────────────┘         └────────────────────┘
```

Pontos-chave:

- **Bucket novo, separado do `trainer-videos`**: `exercise-library-videos`, público de leitura, escrita só via service-role. Não misturar com vídeos pessoais de treinadores evita confusão de policies.
- **Path convencionado**: `exercise-library-videos/{slug-do-exercicio}.mp4` e `.../thumbnails/{slug}.jpg`.
- **Idempotência do pipeline**: usa o `id` do arquivo do Drive como chave única em metadata, para reexecuções não duplicarem.
- **Override por treinador continua funcionando**: se um treinador subir o próprio vídeo, `trainer_exercise_videos` toma precedência no UI (lógica já está em `web/src/app/exercises/page.tsx`).

---

## 6. Plano de execução

### Etapa 1 — Preparar infra (estimado: meio dia)

1. Criar migration `134_exercise_library_videos_bucket.sql` com:
   - `INSERT INTO storage.buckets ('exercise-library-videos', 'exercise-library-videos', true)`.
   - Policy de SELECT pública (autenticados leem; o `public=true` libera leitura via `/storage/v1/object/public`).
   - Policy de INSERT/UPDATE/DELETE só para `service_role`.
2. Adicionar coluna `exercises.video_source_drive_id TEXT UNIQUE` para idempotência do import.

### Etapa 2 — Pipeline de import (estimado: 1 dia)

Script em `web/scripts/import-drive-videos.ts` (ou diretório novo `scripts/`):

1. Autenticar Drive API com a conta dona da pasta.
2. Listar `parentId = '1P1aVtYuXSmkCbg15Zn5amtqYF-TDJRTF'` com paginação.
3. Para cada arquivo:
   - Baixar via `drive.files.get({ alt: 'media' })` para `/tmp`.
   - `ffmpeg -i in.MOV -vf "scale=-2:720" -c:v libx264 -preset slow -crf 23 -c:a aac -b:a 96k -movflags +faststart out.mp4`.
   - Gerar thumb: `ffmpeg -ss 00:00:01 -i out.mp4 -vframes 1 -vf "scale=640:-2" thumb.jpg`.
   - Upload de ambos para `exercise-library-videos/` via service-role client.
   - Calcular nome limpo (de `SUPINO RETO DB.mov` para `Supino Reto com Halteres`, por exemplo) — pode usar regra simples + revisão humana.
   - `UPSERT` em `exercises` matching por `name` e `owner_id IS NULL`. Se não existir, criar com `is_archived=true` para revisão antes de publicar.
4. Salvar log de execução em `tmp/import-log.json` para auditoria.

### Etapa 3 — Curadoria (estimado: meio dia)

- Você (Lucas, sócio) abre a lista de exercícios criados/atualizados num review interno.
- Para cada um: confirma nome, atribui `muscle_groups[]`, `equipment`, `category_id`, `difficulty_level`. A grande maioria já existe no catálogo do sistema (o repo tem `063_ai_curated_exercises.sql` com 72 exercícios curados).
- Tira `is_archived=true` quando estiver bom.

### Etapa 4 — Publicação (5 minutos)

- Como `owner_id IS NULL`, todos os treinadores enxergam imediatamente após o commit.
- Nenhuma mudança de cliente é necessária — players já estão prontos.

### Etapa 5 — Monitoramento (contínuo)

- Acompanhar no Supabase dashboard o egress mensal por 60 dias.
- Se passar de ~150 GB/mês de forma consistente, avaliar Bunny Stream (mais barato) ou Cloudflare Stream (melhor UX em rede lenta).

---

## 7. Riscos e mitigações

**Risco: nomes do Drive não baterem com `exercises.name` existentes.** Mitigação: gerar relatório de match (exact / fuzzy / no-match) antes de aplicar; revisar manualmente os "no-match" e "fuzzy". O Drive tem ~130 itens, é tratável.

**Risco: copyright/uso comercial dos vídeos.** Os arquivos são do `damianilucas23@gmail.com` — confirmar que ele autoriza uso comercial dentro do produto Kinevo. Idealmente registrar isso por escrito (e-mail ou contrato de cessão).

**Risco: vídeos gravados na vertical (9:16) ficarem ruins no player horizontal.** Mitigação: padronizar `object-fit: contain` no `<video>` web e `resizeMode="contain"` no `expo-av`; deixar fundo preto.

**Risco: egress do Supabase explodir quando crescer.** Mitigação: migration path para Cloudflare/Bunny Stream documentada — basta trocar `video_url` (mesmas URLs públicas, lógica de player não muda).

**Risco: arquivo do Drive ser deletado pelo dono.** Mitigação: depois do import, os vídeos vivem no Supabase. Drive vira backup, não fonte de verdade.

---

## 8. O que NÃO recomendo (e por quê)

**Embed direto do Drive (`drive.google.com/file/d/.../preview`).** O Drive não foi feito para servir tráfego — tem rate limits agressivos, exige autenticação Google, e o player tem branding/menu do Google. Inviável em produção.

**YouTube unlisted como solução primária.** Funciona, mas: (a) em React Native exige WebView, que é mais pesado que `expo-av`; (b) mostra "Vídeos sugeridos" e branding do YouTube no fim do clipe; (c) sujeita a políticas externas. Aceitável como fallback se o treinador subir o próprio vídeo no YouTube, mas não para a biblioteca oficial.

**Manter `.MOV` original.** Garantia de problema em Android e em redes lentas. Transcodificar é não-negociável.

---

## 9. Próximos passos práticos

1. Validar com Lucas Damiani a autorização de uso comercial dos vídeos.
2. Aprovar este documento ou apontar ajustes.
3. Eu posso, no próximo passo, escrever a migration do bucket + o script de import + um relatório de match nome-para-exercício para você revisar antes de qualquer execução real.
