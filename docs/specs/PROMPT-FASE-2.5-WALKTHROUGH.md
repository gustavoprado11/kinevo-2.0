# Prompt para Claude Code — Walk-through manual da Fase 2.5 (3 perfis contrastantes)

Copie o bloco abaixo e cole no Claude Code (rodando a partir da raiz do repo `~/kinevo`).

---

Leia, nesta ordem:

1. `docs/specs/06-fase-2.5-prescricao-inteligente.md` — §4 (regras de domínio) e §5.6 (rules-validator). O foco desta sessão é **comparar 3 programas gerados e verificar aderência às regras §4.1–4.8**.
2. `docs/specs/logs/fase-2.5-execucao.md` — §9 (row canônica `25aaaa74`) e §6 (follow-ups #17 e #20).
3. `docs/specs/logs/fase-2.5.1-execucao.md` — §3 (evidência da route mobile funcionando via curl Bearer).

## Contexto

A Fase 2.5 entregou smart-v2 com regras §4 codificadas e rules-validator pós-geração. A Fase 2.5.1 confirmou que a route mobile também passa pelo pipeline. Falta o **walk-through manual** do Gustavo para confirmar que, na prática, **três alunos com perfis contrastantes recebem programas significativamente diferentes** (§4.6 da spec).

Esta sessão **não altera código**. É validação observacional:

1. Disparar 3 gerações via curl Bearer contra a route mobile (`/api/prescription/generate`) no servidor local.
2. Ler as 3 rows resultantes em `prescription_generations`.
3. Comparar os 3 programas **lado a lado** no log, mostrando:
   - Split escolhido por aluno (deve variar conforme §4.5).
   - Exercícios selecionados (deve haver diferença clara entre perfis).
   - Volume por grupo muscular (iniciante < intermediário < avançado, §4.4).
   - Séries por exercício (compostos ≤4; acessórios respeitam cap por nível §4.1).
   - Features contextuais presentes no prompt layer 3 (anamnese, performance, aderência).
4. Registrar no log qualquer violação de regra encontrada.

## Alunos alvo (trainer `7aec3555-600c-4e7c-966e-028116921683`)

| Perfil | Nome | student_id | Nível | Dias | Duração |
|---|---|---|---|---|---|
| Iniciante | Fernanda Lemos | `7cb93d97-0e63-4c47-9c99-869e66f27699` | beginner | 3x | 60min |
| Intermediário | Alysson Lanza | `bbe3c04a-72cd-437e-8faa-46615b2ff9e2` | intermediate | 5x | 60min |
| Avançado | Gustavo Prado (test) | `51c2b3f9-b387-4691-9b34-db6eccc7a646` | advanced | 5x | 60min |

Todos com `goal=hypertrophy`. Isola a dimensão **nível** (iniciante vs intermediário vs avançado) + **frequência** (3x vs 5x) — o split deve variar segundo §4.5:

- 3x iniciante → AB repetido (A-B-A).
- 5x intermediário → Upper/Lower A/B ou PPL+1.
- 5x avançado → PPL+UL ou bro-split.

## Antes de executar

Produza um **plano curto** cobrindo:

### A. Pré-checks

- Confirmar que o dev server (`npm run dev` em `web/`) está rodando em `localhost:3000`. Se não estiver, instruir o Gustavo a iniciar. **Não inicie você o servidor** — ele precisa ficar running durante toda a sessão.
- Re-extrair JWT válido via Chrome MCP (padrão já validado na 2.5.1: `sb-lylksbtgrihzepbteest-auth-token` no localStorage, email `gustavoprado11@hotmail.com`, projeto `lylksbtgrihzepbteest`).
- Confirmar via query simples que os 3 student_ids ainda existem e pertencem ao trainer correto:
  ```sql
  SELECT id, name FROM students
  WHERE id IN ('7cb93d97-0e63-4c47-9c99-869e66f27699','bbe3c04a-72cd-437e-8faa-46615b2ff9e2','51c2b3f9-b387-4691-9b34-db6eccc7a646')
    AND coach_id = '7aec3555-600c-4e7c-966e-028116921683';
  ```

### B. Rate-limit

A route aplica rate-limit 5/min e 20/dia por trainer. Gerar 3 em sequência está dentro da janela, mas se você já disparou qualquer geração hoje (dia 2026-04-20), considere:

- Query `SELECT COUNT(*) FROM prescription_generations WHERE trainer_id='7aec3555-600c-4e7c-966e-028116921683' AND created_at > now() - interval '1 day'`.
- Se ≥17, pause e reporte — fica perto do cap diário, melhor esperar ou pedir bump temporário.
- Se ≥18, não execute; reporte.

### C. Execução dos 3 curls

Disparo sequencial, com pausa de ~2s entre chamadas (evita 5/min + dá margem pra telemetria persistir). Script sugerido:

```bash
JWT="$(cat /tmp/kvn-jwt.txt)"  # tokem reconstruído do char-code pipeline
BASE="http://localhost:3000/api/prescription/generate"

for SID in 7cb93d97-0e63-4c47-9c99-869e66f27699 bbe3c04a-72cd-437e-8faa-46615b2ff9e2 51c2b3f9-b387-4691-9b34-db6eccc7a646; do
  echo "== $SID =="
  curl -sS -X POST "$BASE" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d "{\"studentId\":\"$SID\"}" \
    -w "\nHTTP %{http_code} — %{time_total}s\n"
  sleep 2
done
```

Capturar as 3 `generationId` retornadas.

### D. Leitura e comparação no DB

Query consolidada, uma linha por geração:

```sql
SELECT 
  pg.id,
  s.name AS student_name,
  spp.training_level,
  pg.ai_source,
  pg.prompt_version,
  pg.model_used,
  pg.cost_usd,
  pg.retry_count,
  pg.rules_violations_count,
  pg.rules_violations_json,
  pg.output_snapshot->>'split_type' AS split_type,
  jsonb_array_length(pg.output_snapshot->'workouts') AS n_workouts,
  (SELECT array_agg(DISTINCT elem->>'group_muscle') 
   FROM jsonb_array_elements(pg.output_snapshot->'workouts') wk,
        jsonb_array_elements(wk->'exercises') elem) AS muscle_groups_touched,
  pg.input_snapshot->'enriched_context'->>'stagnated_exercises' AS stagnated,
  pg.input_snapshot->'enriched_context'->'adherence'->>'bucket' AS adherence_bucket
FROM prescription_generations pg
JOIN students s ON s.id = pg.student_id
LEFT JOIN student_prescription_profiles spp ON spp.student_id = s.id
WHERE pg.id IN ('<gen_iniciante>','<gen_intermediario>','<gen_avancado>')
ORDER BY spp.training_level;
```

**Ajuste os path do JSON** se `output_snapshot` usar outras chaves (olhe a row canônica `25aaaa74` primeiro pra confirmar shape).

### E. Análise comparativa a registrar no log

Produza uma tabela markdown com, por aluno:

- Split escolhido (e se bate com §4.5).
- Nº de workouts.
- Volume semanal total (somar séries de todos workouts por grupo muscular).
- Volume por grupo — comparar com os ranges §4.4 (iniciante 8–12, intermediário 12–18, avançado 16–22).
- Exercícios com 4 séries por treino (confirmar §4.3 — máximo um por grupo muscular por treino).
- Lista de violations retornadas pelo rules-validator (errors vs warnings).
- Presença de features contextuais: `stagnated_exercises`, `adherence.bucket`, `trainer_observations`.

### F. Verificação de variabilidade (§4.6)

Para provar que os 3 programas são **significativamente diferentes**, e não variações cosméticas:

- Extrair o **conjunto** de exercise_ids únicos de cada programa.
- Calcular Jaccard similarity entre pares (iniciante∩intermediário, intermediário∩avançado, iniciante∩avançado).
- Valor esperado: <0.6 em todos os pares (exercícios compostos podem repetir; total deve divergir).
- Se algum par >0.8, flag como "baixa variabilidade — follow-up".

Script Python/bash direto:
```sql
-- Exercise ID sets
SELECT pg.id,
       array_agg(DISTINCT elem->>'exercise_id') AS exercise_ids
FROM prescription_generations pg,
     jsonb_array_elements(pg.output_snapshot->'workouts') wk,
     jsonb_array_elements(wk->'exercises') elem
WHERE pg.id IN ('<gen1>','<gen2>','<gen3>')
GROUP BY pg.id;
```

Jaccard calculado no bash com `jq` ou Python inline.

### G. Output final

Criar `docs/specs/logs/fase-2.5-walkthrough-3-perfis.md` com:

- §1 Contexto: objetivo + alunos.
- §2 Execução: 3 curls, status, tempo, generationId.
- §3 Comparação consolidada: tabela markdown com os campos de E.
- §4 Variabilidade: matriz Jaccard + veredicto.
- §5 Aderência às regras §4: checklist de cada regra (4.1 a 4.8) marcando ✓ / ✗ / N/A por programa, com evidência.
- §6 Violations registradas pelo rules-validator: tabela por geração (code, severity, corrected?).
- §7 Follow-ups: qualquer violação recorrente ou gap de contexto observado.
- §8 Veredicto final: "Fase 2.5 validada end-to-end com 3 perfis reais" OU "Validação parcial — pendências: …".

## Se algo falhar

- Curl com 4xx/5xx: pare e reporte status, body, e logs do dev server.
- Row não aparecer no DB: pode ser rate-limit consumido (checar `rules_violations_count` e erro na response). Reporte.
- Rules-validator acusar erros (severity `error`, não warning): isso **é** bug que precisa investigação — não feche o walk-through com OK, reporte.
- Jaccard >0.8 em algum par: não é falha crítica, mas registre como follow-up de baixa variabilidade.

## Regras desta sessão

- **Não altere código**, nem de produção nem de testes. Só leitura + curl + SQL + escrita do log.
- Não use git.
- Strings user-facing em pt-BR; código/comentários em inglês.
- Plano primeiro, aguarde aprovação antes de executar os curls.

Comece produzindo o plano.
