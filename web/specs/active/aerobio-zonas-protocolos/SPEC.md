# Prescrição aeróbia completa — Pacote 1+2: Intensidade estruturada por zonas + Protocolos intervalados nomeados

## Status
- [x] Rascunho
- [x] Em implementação
- [ ] Concluída

## Contexto
A frente "treinos aeróbios exclusivos" (migration 268) tornou o aeróbio sessão de primeira classe,
mas a prescrição do bloco continua rasa: a intensidade é TEXTO LIVRE ("Zona 2, RPE 6, 130bpm") que o
app não entende, e o modo intervalado é só work/rest × rounds sem identidade de protocolo. Um coach
de verdade prescreve por zonas resolvidas para o aluno (FCmáx) e usa protocolos nomeados (Tabata,
4×4 norueguês). Este pacote estrutura os dois.

## Objetivo
1. **Intensidade estruturada**: o bloco aeróbio ganha um alvo tipado — Zona (Z1–Z5), faixa de FC
   (bpm), RPE (1–10) ou Pace (min/km) — e as zonas são resolvidas por aluno via FCmáx
   (`students.max_heart_rate_bpm`, nova coluna; sem FCmáx → exibe %FCmáx).
2. **Protocolos intervalados nomeados**: presets de um clique no modo intervalado (Tabata,
   HIIT 15/15, HIIT 30/30, HIIT 40/20, 4×4 norueguês) que preenchem work/rest/rounds + intensidade
   sugerida — espelho dos presets de método da força.

## Escopo

### Incluído
- Migration 269: `students.max_heart_rate_bpm INT NULL` (CHECK 100–230). Campo editável no form de
  edição do aluno (web).
- `CardioConfig.intensity_target?: { type: 'zone'|'hr'|'rpe'|'pace', zone?, hr_min_bpm?,
  hr_max_bpm?, rpe?, pace_min_per_km? }` e `CardioConfig.protocol_key?: string` — tudo no
  `item_config` JSONB (sem migration nas tabelas de treino).
- **String derivada**: quando o alvo estruturado é definido, o builder grava também o
  `intensity` (texto) resolvido — "Zona 2 · 134–156 bpm" (com FCmáx) ou "Zona 2 · 60–70% FCmáx"
  (sem/template). TODAS as superfícies existentes que já exibem `intensity` (mobile CardioCard,
  sala de treino, histórico, SessionDetailSheet, preview) funcionam sem mudança.
- Shared: `shared/lib/cardio/zones.ts` (zonas Z1–Z5 canônicas, resolveZoneBpm, formatIntensityTarget)
  e `shared/lib/cardio/interval-protocols.ts` (presets com label/descrição/works/rounds/alvo sugerido).
- Web `CardioItemCard`: seletor de tipo de alvo (Livre | Zona | FC | RPE | Pace) + chips Z1–Z5 com
  faixa resolvida; no Intervalado, chips de protocolo (editar números depois limpa o protocolo).
- FCmáx no contexto do builder: `CardioStudentHrContext` (React context) provido pelos builders em
  contexto de aluno (edit-assigned e criação com studentContext); páginas buscam
  `max_heart_rate_bpm` do aluno.
- MCP: `kinevo_add_cardio_to_session` ganha `protocol`, `zone`, `hr_min_bpm`/`hr_max_bpm`,
  `target_rpe`, `pace_min_per_km`; resolve a string com a FCmáx do aluno (programas atribuídos);
  `cardio_config` do update idem; `kinevo_list_training_methods` passa a listar os protocolos
  aeróbios; instruções do servidor atualizadas.
- IA canvas: `render_program` aceita `zone`/`rpe`/`protocol` no objeto cardio; prompt ensina.
- Mobile: CardioCard mostra o nome do protocolo no intervalado; JSON do set_log inclui
  `intensity_target`/`protocol_key` (histórico preserva).

### Excluído (pacotes futuros)
- Fases de aquecimento/desaquecimento DENTRO do bloco intervalado; intensidade por fase.
- Feedback ao vivo "na zona / fora da zona" com FC do Watch (exige trabalho no Watch + device).
- Progressão semanal automática; volume aeróbio nos dashboards; match com Strava.
- Resolução de % → bpm no momento do ASSIGN de template (a string do template segue em %FCmáx;
  o treinador edita o atribuído para resolver — documentado como limitação v1).

## Zonas canônicas (fonte única em shared)
| Zona | %FCmáx | Nome |
|---|---|---|
| Z1 | 50–60% | Recuperação |
| Z2 | 60–70% | Base aeróbia |
| Z3 | 70–80% | Aeróbio moderado |
| Z4 | 80–90% | Limiar |
| Z5 | 90–100% | VO2max |

## Protocolos (fonte única em shared)
| key | Label | work/rest × rounds | Alvo sugerido |
|---|---|---|---|
| tabata | Tabata | 20s/10s × 8 | RPE 9 |
| hiit_15_15 | HIIT 15/15 | 15s/15s × 20 | Z5 |
| hiit_30_30 | HIIT 30/30 | 30s/30s × 10 | Z4 |
| hiit_40_20 | HIIT 40/20 | 40s/20s × 10 | Z4 |
| norwegian_4x4 | 4×4 Norueguês | 4min/3min × 4 | Z4 |

## Comportamento Esperado

### Fluxo do treinador (web)
1. No bloco aeróbio, escolhe o tipo de alvo: Livre (texto, como hoje), Zona, FC, RPE ou Pace.
2. Zona: chips Z1–Z5; ao lado, a faixa resolvida ("134–156 bpm" se o aluno tem FCmáx; senão
   "60–70% FCmáx" + hint para definir a FCmáx no perfil do aluno).
3. Intervalado: linha de protocolos; clicar preenche números + alvo sugerido; editar números
   manualmente remove o selo do protocolo (números valem).
4. O aluno vê no app exatamente a string resolvida (ex.: "Tabata · 20s/10s × 8 · RPE 9").

### Fluxo técnico
1. `intensity_target`/`protocol_key` vivem no `item_config`; `intensity` (string) é DERIVADA no
   save do builder/MCP — display permanece retrocompatível em todas as superfícies.
2. Zonas resolvem com `students.max_heart_rate_bpm`; null → formato %.
3. RPCs de árvore (268) já propagam `item_config` — nenhuma RPC muda.

## Critérios de Aceite
- [ ] Bloco com alvo Zona persiste `intensity_target` + string resolvida no `item_config`.
- [ ] Aluno COM FCmáx → faixa em bpm; SEM FCmáx → % FCmáx (builder e MCP).
- [ ] Protocolo preenche números + alvo e é exibido por nome no web e no app do aluno.
- [ ] Editar work/rest/rounds após escolher protocolo limpa o `protocol_key`.
- [ ] Blocos antigos (só `intensity` texto) seguem exibindo e editáveis (tipo "Livre").
- [ ] MCP cria bloco com zona resolvida por aluno; `list_training_methods` lista protocolos.
- [ ] Sem novos erros de TypeScript (web + mobile); retrocompatível.

## Edge Cases
- FCmáx fora de 100–230 → CHECK rejeita; form valida.
- `intensity_target` sem FCmáx em programa atribuído → string em %FCmáx (não quebra).
- Protocolo escolhido e DEPOIS modo trocado para Contínuo → protocolo/intervals limpos da UI
  (config preserva `intervals` como hoje; protocol_key limpo).
- Config legado com `intensity` texto + novo alvo definido → alvo vence e reescreve a string.

## Testes Requeridos
### Lógica pura (unitários)
- [ ] `resolveZoneBpm`: zonas 1–5 com FCmáx 190; arredondamento.
- [ ] `formatIntensityTarget`: zone com/sem FCmáx, hr, rpe, pace.
- [ ] Protocolos: shape íntegro (work/rest/rounds > 0, keys únicos).
