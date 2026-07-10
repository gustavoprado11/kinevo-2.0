# Auditoria — Formulários e Avaliações (web + mobile)
**Data:** 10/jul/2026 · **Escopo:** funcionalidade de Formulários (anamnese/check-in/survey/feedback) e Avaliações Físicas Presenciais, nas duas plataformas + backend (RPCs, RLS, cron, MCP, PDF). **Método:** leitura de código ponta-a-ponta + verificação no banco de produção (`lylksbtgrihzepbteest`). Nenhum código foi alterado.

---

## Contexto de uso em produção (crucial para priorizar)

| Métrica | Valor |
|---|---|
| Templates de formulário | 17 (6 anamnese, 5 check-in, 1 survey, 5 assessment) |
| Submissões de formulário | **40 (26 enviadas)** — feature **VIVA** |
| Sessões de avaliação | **0** |
| Medições de avaliação | **0** |
| Avaliações finalizadas | **0** |

> **Formulários são usados de verdade** → bugs ali têm impacto vivo.
> **Avaliações Físicas têm ZERO uso em produção** → o módulo inteiro (web + mobile + MCP + PDF + fórmulas) está construído mas **nunca foi exercitado**. Seus bugs são **latentes**, porém vários são **garantidos no primeiro uso real**. Recomendação forte: corrigir C2/H5 **antes** de promover a feature.

**Fundação sã (verificado no banco):** RLS ativo nas 7 tabelas; isolamento de tenant consistente; RPCs `SECURITY DEFINER` com guarda de posse; sobrecargas `p_trainer_id` (migr 201/202) presentes em prod → superfície MCP corretamente ligada; fórmulas científicas corretas e citadas.

---

## CRÍTICOS

### C1 · [VIVO] Sala de Treino web — formulário pré/pós-treino com campo obrigatório **sempre** falha
- **Arquivo:** `web/src/components/training-room/workout-form-inline.tsx:41-43,164,181-208,257-286` + `web/src/actions/training-room/submit-workout-form.ts:25` vs RPC `submit_inline_form` em `supabase/migrations/078_form_triggers_and_schedules.sql:409-461`
- **O quê:** o componente grava a resposta **crua** (`answers[qid] = "texto" | 5 | ["a"]`) e envia `p_answers_json: { answers }`. A RPC espera a resposta **encapsulada**: texto/single_choice via `v_answer->>'value'`, scale via `v_answer ? 'value'`, photo via `v_answer->'files'`. Aplicados a escalar puro, retornam NULL/false → a RPC lança `Required field empty` / `Required scale value missing`. O mobile faz certo (`FormFieldRenderer` embrulha em `{type,value}`), então o defeito é exclusivo do web.
- **Bônus no mesmo arquivo:** `single_choice` (`:181-208`) **não tem onClick/onChange** — a opção nem é selecionável. E `options` é tipado `string[]` (`:23`) mas os templates gravam `{value,label}` → renderização/comparação erradas para forms não-sistema.
- **Repro:** treinador usa o "Check-in Semanal" (tem scale/single_choice obrigatórios) como gatilho de programa → Sala de Treino web → Iniciar → preenche → "Enviar e continuar" → erro cru em inglês, não submete.
- **Confiança:** Alta (rastreado do input até os operadores JSONB da RPC).

### C2 · [LATENTE, garantido no 1º uso] Save de medições de avaliação **não é idempotente** → duplicatas no banco
- **Arquivo:** RPC `save_assessment_measurements` em `supabase/migrations/122_assessments_phase1.sql:365-382` (loop **INSERT-only**, sem delete/replace) + sobrecarga idêntica em `202_assessment_mcp_trainer_id.sql:101-118`.
  - **Web:** `web/src/app/students/[id]/avaliacoes/[sessionId]/capture/capture-client.tsx:132` envia o **array inteiro** (hidratado de `initialMeasurements`, linhas já persistidas) no finalize; `web/src/actions/assessments/create-session.ts:72-81` grava `subject_sex`/`subject_age_years` na criação.
  - **Mobile:** `mobile/stores/assessmentDraftStore.ts:217` (`replaceMeasurementsForTest`) remove as medições antigas **só do draft local**; `mobile/hooks/useAssessmentSessionLifecycle.ts:90-129` reenvia as novas → o servidor mantém as antigas (órfãs) + insere as novas.
- **O quê / impacto:**
  1. **Web:** `subject_sex` e `subject_age_years` **duplicados em 100% das sessões concluídas** (uma na criação, outra no finalize). Retry de finalize após falha parcial (`capture-client.tsx:189-206`, draft não é limpo) → **todas** as medições reinseridas (multi-tentativa vira 6 linhas em vez de 3).
  2. **Mobile:** re-medir um teste já sincronizado deixa 2× linhas `is_selected=true` para a mesma `metric_key` — quebra o invariante "um valor selecionado por métrica".
  - `computed_metrics` (manchete) **continua correto** (calculado no client, dedup por `test_id`), mas a tabela `assessment_measurements` corrompe. O PDF de "Medições brutas" (`supabase/functions/generate-assessment-pdf/index.ts:389-395`) mascara pegando a **primeira** ocorrência por chave → pode exibir valor **desatualizado**; a preview web (`assessment-computed.ts:pickNumeric`, last-write-wins) pega a **última** → web e PDF divergem quando há duplicata.
- **Confiança:** Alta (RPC INSERT-only confirmada; call-sites rastreados). **Ainda não há dados corrompidos em prod** (`dup_selected_groups = 0`, 0 sessões) — é latente, mas dispara no primeiro uso real com correção de medida.
- **Correção-raiz sugerida:** a RPC deveria reconciliar (delete-by-key ou upsert), OU os clients devem desmarcar/limpar antes de reenviar. O padrão certo já existe em `kinevo_correct_assessment` (`web/src/lib/mcp/tools/assessments.ts:249-275`: unselect + nova tentativa) — replicar essa lógica.

---

## ALTOS

### H1 · [VIVO] "Criar com IA" quebrado para a categoria `feedback`
- **Arquivo:** `web/src/actions/forms/generate-form-with-ai.ts:490-493` vs `web/src/app/forms/templates/new/builder-client.tsx:143-148`
- **O quê:** o guard aceita só `['anamnese','checkin','survey']`; o card "Feedback do programa" existe no builder → gerar sempre retorna "Categoria inválida.". O tipo e o `buildHeuristicDraft` já suportam `feedback` — falta só o guard.
- **Confiança:** Alta.

### H2 · [VIVO parcial] `multi_choice` é tipo **meio-implementado** — paridade client↔servidor quebrada + perda de opções no builder
- **Arquivos:** RPCs `submit_form_submission` (`027:245-291`) e `submit_inline_form` (`078:416-461`) **sem ramo `multi_choice`** → caem no ELSE que exige `answer->>'value'`; o client mobile grava `{type,values:[]}` (`mobile/components/forms/FormFieldRenderer.tsx:128`) e valida por `values.length` (`FormRenderer.tsx:194`). Builder web `QUESTION_TYPES` (`builder-client.tsx:105`) e mobile (`FormBuilderModal.tsx:54-59`) **não têm** multi_choice; `questionsToSchema` (`builder-client.tsx:191-201`) **descarta `options`** ao salvar uma pergunta multi_choice.
- **O quê / impacto:**
  - **Vivo:** editar/clonar templates de sistema que contêm multi_choice ("Reavaliação Periódica", "Feedback do Programa" — `066`/`062`) salva o clone **sem opções** → perguntas inutilizáveis.
  - **Latente:** um multi_choice **obrigatório** num form de auto-preenchimento faria o client aceitar e a RPC **travar o envio** ("campo vazio"). Hoje não dispara porque nenhum builder cria multi_choice e os de sistema são opcionais (verificado no banco: `required_unhandled_by_rpc = []`).
- **Confiança:** Alta (perda de opções); Alta (gap da RPC).

### H3 · [VIVO] Cron de agendamento — drift sistemático de cadência e do dia da semana
- **Arquivo:** `web/src/app/api/cron/process-form-schedules/route.ts:18,24,174,195-214`; schema `078:67-81`
- **O quê:** `computeNextDue(freq, new Date())` ancora o próximo envio no **instante do processamento** (~08:00:0X). No ciclo seguinte, o cron dispara às 08:00:00 (< 08:00:0X) → `next_due <= now` falso → **pula o dia**. "Diário" vira **a cada 2 dias**; "semanal" vira **8 dias** com o dia andando **+1/semana**. Não há ancoragem a dia-da-semana/dia-do-mês (impossível "toda segunda").
- **Confiança:** Alta.

### H4 · [LATENTE] Bleed de estado entre steps do wizard de captura web (falta React `key`)
- **Arquivo:** `capture-client.tsx:247` (`{stepRender.content}` sem `key`) + `MeasurementWizardWeb.tsx:104` + seeding mount-only em `NumericUnitInputWeb.tsx:43-48`
- **O quê:** steps consecutivos do mesmo tipo reusam a instância React e preservam o `rawValue`; o valor inicial só é semeado no mount → o próximo step herda o valor digitado no anterior. Em bilateral, o auto-commit (`capture-client.tsx:298-322`) **grava silenciosamente** o valor vazado na `metric_key` errada.
- **Repro:** template "Antropometria mínima" (peso→estatura→cintura→quadril, todos numeric_unit): digitar 80,5 no peso → estatura aparece pré-preenchida com 80,5.
- **Confiança:** Alta.

### H5 · [LATENTE] Templates de avaliação criados no builder **não computam IMC nem composição corporal** (falha silenciosa)
- **Arquivo:** `web/src/components/assessments/builder/test-catalog.ts:124-131,276` (altura `height_cm` em `cm`) + `web/src/lib/assessment-computed.ts:131-133` (`pickHeightM` só aceita `height`/`height_m`) + `shared/lib/assessment-protocols/formulas.ts:42-47` (`bmi` rejeita altura > 3) + `capture-client.tsx:149` (guard exige `height`)
- **O quê:** o builder emite `height_cm`; `bmi(peso, 175)` lança erro (>3) → IMC vira `null`; o guard de finalize nunca reconhece `height_cm` → `calculateBodyComposition` **nunca roda** → sem % gordura/massa magra. Templates de **sistema** usam `height_m`/`m` (`123:63,78`) e funcionam → confirma que a divergência está no catálogo do builder.
- **Confiança:** Alta.

### H6 · [LATENTE] Tabela de comparação de resultados ordena por `scheduled_at` (não `completed_at`)
- **Arquivo:** `web/src/components/assessments/view/result-comparison-table.tsx:42,56-58` + RPC `get_assessment_sessions` (`122:215,228`, `ORDER BY scheduled_at DESC NULLS LAST`)
- **O quê:** sessões "começar agora" têm `scheduled_at=NULL` e afundam na lista; a tabela assume "mais recente primeiro" e não re-ordena → rotula a sessão **antiga** como "Atual", com deltas invertidos (setas de tendência erradas). O sparkline e o PDF usam `completed_at` (corretos) — só a tabela erra.
- **Confiança:** Alta.

---

## MÉDIOS

- **M1 · [VIVO] Excluir template com respostas falha silenciosamente.** FK `form_submissions.form_template_id` é `ON DELETE RESTRICT` (`026:71`); `templates-client.tsx:189-200` só remove da lista `if (result.success)` e **não mostra erro** → parece "não deleta".
- **M2 · [VIVO, edge] Colisão de `value` em opções de single_choice.** `builder-client.tsx:302,321,335-341`: `opt_${len+1}` sem reindex após remover → add→remove→add gera dois `opt_3`. Visualização marca as duas como selecionadas.
- **M3 · [VIVO] Editar/reenviar feedback duplica inbox + push.** RPC `send_submission_feedback` (`027:381`) **sempre INSERT**; `submission-detail-sheet.tsx:456-475` permite "Editar feedback" e reenviar → cada reenvio = novo item + novo push.
- **M4 · [VIVO] Labels de pergunta/opção vazios não validados** (client nem server). `builder-client.tsx:362-370`, `create/update-form-template.ts` só checam título + `questions.length>0`. Aluno recebe perguntas sem enunciado.
- **M5 · [VIVO] Desativar um template mata o schedule permanentemente.** `process-form-schedules/route.ts:58-72` faz `is_active=false` no schedule; reativar o template não ressuscita. Idem aluno não encontrado.
- **M6 · [VIVO] Insights de check-in recorrente nunca disparam.** `generate-insights/route.ts:734,811` lê `row.answers_json` e itera o topo, mas o shape real é aninhado (`{...,answers:{qid:{value}}}`) → nunca alcança o valor. O teste de referência usa shape achatado (falsa confiança). O payoff dos forms recorrentes (detecção de sono ruim/estresse) **não ocorre**.
- **M7 · [risco] Cron sem `.limit()`/paginação, processamento serial** (`route.ts:20-24,38-185`) → após outage, acúmulo pode estourar o timeout do function (sem perda de dado, mas atraso de 1 dia).
- **M8 · [LATENTE] single_choice de sistema com `options` como string → "Invalid option".** RPC compara `opt->>'value'` (assume objeto); 13 perguntas single_choice de sistema guardam opções como string (verificado no banco). Nenhuma required+submetida hoje → latente. `078:422-430`/`027:251-259`.
- **M9 · [LATENTE] `numeric_unit` só confirma no Enter; "Próximo" desabilitado sem affordance; edição sem Enter é descartada.** `NumericUnitInputWeb.tsx:90-95` + `capture-client.tsx:263-282`. Único input sem botão "Confirmar".
- **M10 · [manutenção] Cópias `assessment-computed` web↔mobile são "espelho" manual.** `web/src/lib/assessment-computed.ts:1-3` admite "drift detectado". Hoje os exports são idênticos e `pickNumeric` bate (172 vs 233 linhas, diferença cosmética), mas o padrão de cópia literal convida divergência futura da lógica de cálculo.
- **M11 · [VIVO no caminho MCP] Templates de avaliação são "enviáveis" como formulário de auto-preenchimento.** `kinevo_send_form`/`kinevo_list_form_templates` (`web/src/lib/mcp/tools/forms.ts:37,75`) incluem `category='assessment'`; `assign_form_to_students` não filtra categoria. Templates de avaliação usam `sections` (não `questions`), então o aluno receberia um form **vazio/quebrado**. O web `/forms` já exclui assessment; o gap é o caminho do assistente/MCP.

---

## BAIXOS

- **B1 · Categoria `feedback` rotulada como "Pesquisa"** (fallback `CATEGORY_CONFIG.survey`) — `templates-client.tsx:109-114`, `forms-dashboard-client.tsx:92-96`.
- **B2 · Editor de escala não valida min/max** (`builder-client.tsx:924-938`): min≥max obrigatório → aluno nunca submete; campo vazio → 0.
- **B3 · `trainer.id` interpolado em `.or()` do PostgREST** (`forms/page.tsx:14`, `templates/page.tsx:15`, `templates/new/page.tsx:22`) — não explorável hoje (UUID de sessão), mas inconsistente com a convenção de duas-queries do próprio time (`update-form-template.ts:41-58`).
- **B4 · Fuso:** cron `0 8 * * *` UTC = **05:00 BRT** → forms recorrentes e push "Nova avaliação" chegam ~5h da manhã (`vercel.json:16-19`).
- **B5 · Falha parcial pode deixar `student_inbox_items` órfão** (inbox inserido, submission draft falha — `route.ts:99-146`).
- **B6 · `monthly` via `setMonth` sofre overflow** (dia 31 → mar/03); TOCTOU de idempotência (baixo, sem guard de unicidade); `last_sent_at` atualizado mesmo sem enviar.
- **B7 · `revalidatePath` aponta `/forms` em vez de `/avaliacoes`** (`finalize-session.ts:39`, `cancel-session.ts:70`, `update-template.ts:108`). Mitigado por `router.refresh()`.
- **B8 · Checklist mostra 0% durante `in_progress`** — captura web só persiste no finalize (`session-checklist-card.tsx:29-46`); progresso invisível entre dispositivos.
- **B9 · PDF de "Medições brutas" mostra a tentativa #1** (ignora `is_selected`) — `generate-assessment-pdf/index.ts:389-395`.
- **B10 · Foto:** a resposta guarda `path` (permanente, re-assinável) **e** `url` (signed URL de 1h) — `mobile/app/inbox/[id].tsx:292-301`. Se o visualizador usar `url`, a foto quebra após 1h; se re-assinar pelo `path`, ok (não confirmado no viewer; só 1 pergunta de foto, opcional, em prod).

---

## Formulários mobile — achados adicionais (app do aluno + treinador)

> Nuance de alcance: o botão "Enviar" nativo do mobile exige template do próprio treinador (`027:58`), então os templates de **sistema** chegam ao aluno via clonagem/web/recorrente — mas o caminho de **submit** mobile está quebrado para eles do mesmo jeito.

### H7 · [LATENTE, alto risco] `single_choice` com opções em **string** (templates de sistema) é rejeitado pela RPC mesmo preenchido
- **Arquivo:** `mobile/app/inbox/[id].tsx:238-240` + `FormFieldRenderer.tsx:94` vs `027_forms_inbox_phase2_rpcs.sql:251-259`; seeds `066_system_form_templates.sql:39,46,60,74,137,158,179,186,200,269,276,283,290`
- **O quê:** o client normaliza opções-string para `{value:"opt_N"}` e envia `value:"opt_N"`; a RPC valida com `opt->>'value' = v_answer->>'value'`, mas para uma opção que é **string** JSON, `opt->>'value'` é **NULL** → nenhuma casa → `RAISE 'Invalid option for field'`. Os 3 templates de sistema (Check-in Semanal, Reavaliação Periódica, Feedback) têm `single_choice` **obrigatório** com opções em string.
- **Verificação em produção (minha):** **nenhuma** submissão obrigatória de single_choice com opções-string foi enviada até hoje (`sc_required_submitted_opt_shape = 89 objeto / 0 string`); só 4 submissões vieram de templates de sistema (com opções-objeto). Ou seja: **contrato quebrado, mas ainda sem falha real em prod** — landmine que dispara quando um treinador clonar/atribuir um desses check-ins de sistema. 13 perguntas single_choice de sistema guardam opções como string hoje.
- **Confiança:** Alta (contrato) · Média (alcance — latente por ora). **Substitui/eleva o M8.**

### H8 · [VIVO se houver foto] Treinador não vê as fotos enviadas pelo aluno (shape objeto tratado como string + URL de 1h)
- **Arquivo:** `mobile/components/trainer/forms/AnswerRenderer.tsx:8,164-183` vs `mobile/app/inbox/[id].tsx:292-302`
- **O quê:** o aluno grava `files` como array de **objetos** `{path,url,width,height}` (url = signed URL de 1h); o `AnswerRenderer` tipa `files: string[]` e faz `source={{uri}}` com o objeto → imagem não carrega; e mesmo lendo `.url`, expira em 1h. `get_form_submission_detail` devolve `answers_json` cru (`053:142`).
- **Confiança:** Alta. (Só 1 pergunta de foto, opcional, em prod → prevalência baixa.)

### H9 · [VIVO, perda de dados] Anexar foto **descarta** as respostas de texto/escolha já digitadas
- **Arquivo:** `mobile/components/forms/FormRenderer.tsx:88-94,97-117` + `mobile/app/inbox/[id].tsx:249,292`
- **O quê:** texto/escolha/escala só atualizam o state interno do `FormRenderer`; a foto atualiza o `inbox.answers` → muda a referência de `initialAnswers` → o `useEffect` **reseta todo o state** para `initialAnswers`, descartando o que foi digitado antes da foto. O autosave persiste a versão reduzida.
- **Repro:** preencher 4 campos de texto, depois selecionar uma foto → os 4 textos somem da tela e do payload.
- **Confiança:** Média-Alta (mecanismo claro em duas fontes de verdade separadas; não executado no device). Prevalência baixa (exige form com texto + foto; só há 1 foto opcional em prod), mas é perda de dado silenciosa.

### M12 · [VIVO] "Envio recorrente" no mobile grava `trainer_id = auth uid` → falha silenciosa + toast enganoso
- **Arquivo:** `mobile/components/trainer/forms/AssignFormModal.tsx:118-130`
- **O quê:** o upsert em `form_schedules` usa `trainer_id: user.id` (auth uid), mas `form_schedules.trainer_id` referencia `trainers(id)` e a policy exige `= current_trainer_id()` (= `trainers.id`, ≠ auth.uid). O upsert **sempre falha**; como está no `try`, cai no `catch` → `toast.error("Falha ao enviar formulário")` — mesmo o `assign_form_to_students` já tendo entregue o form. Nenhuma recorrência é criada e o treinador acha que falhou tudo.
- **Confiança:** Alta.

### M13 · [LATENTE] `photo` obrigatória bloqueia o envio mesmo com a foto já enviada (mobile)
- **Arquivo:** `mobile/components/forms/FormRenderer.tsx:191-198`
- **O quê:** a validação client só considera preenchido quem tem `value`/`values`; a foto fica em `files` → `Alert("Campo obrigatório")` e `return`, mesmo com upload feito. A RPC aceitaria (checa `files`), mas o fluxo nunca chega lá. Criável no builder (photo + toggle obrigatória); nenhum template shipado usa → latente.
- **Confiança:** Alta.

### M14 · [VIVO] Mensagens de erro da RPC vazam inglês + id interno da pergunta ao aluno
- **Arquivo:** `mobile/app/inbox/[id].tsx:332-341`
- **O quê:** só `Required field missing:` é mapeado; as demais (`Required field empty`, `Invalid option for field: ci02`, `Scale value out of range`, `Required photo missing`) passam cruas para o `Alert`, expondo id interno.
- **Confiança:** Alta.

### B11 · Labels de escala (min/max) somem para o treinador (snake_case × camelCase)
- **Arquivo:** `QuestionEditor.tsx:332,351` (grava `min_label`/`max_label`) vs `AnswerRenderer.tsx:150-157` (lê `minLabel`/`maxLabel`). O `FormFieldRenderer` do aluno nem renderiza labels de escala.

### Multi_choice — manifestação VIVA (complementa H2)
Além do gap da RPC (H2), os `multi_choice` **opcionais** já shipados nos 3 templates de sistema (066 ra07/fb09/fb10) ficam **invisíveis**: o `AnswerRenderer` do treinador não tem `case "multi_choice"` → mostra "—"; a revisão do aluno lê `answer.value` → "—". Os valores ficam salvos em `values` mas ninguém vê.

---

## O que está SÃO (contrapeso)

- **Segurança/RLS:** RLS ativo nas 7 tabelas; RPCs `SECURITY DEFINER` revalidam posse (`coach_id`/`trainer_id`); auth do cron **fail-closed** com comparação em tempo constante (`cron-auth.ts:14-29`); isolamento de tenant no agendamento; aluno arquivado (`coach_id=NULL`) para o schedule corretamente.
- **Fórmulas:** Siri (495/D−450), Brozek, Jackson-Pollock 3/7, Petroski 4 (inc. forma log feminina), Faulkner, IMC, RCQ — **corretas e citadas** (`shared/lib/assessment-protocols/formulas.ts`), validadas por revisão independente dupla. Guardas de input eager (rejeita altura em cm, densidade ≤ 0).
- **MCP:** superfície ligada corretamente — sobrecargas `p_trainer_id` (201/202) presentes em prod; rate-limit por minuto/dia (`forms.ts:29`); ownership validado no core; `kinevo_correct_assessment` usa o padrão **correto** (unselect + nova tentativa).
- **Caminho feliz dos formulários:** atribuir→submeter→feedback sólido; `schema_snapshot_json` congelado corretamente no momento da atribuição (versionamento imune a edição posterior do template); skip de duplicatas funciona.
- **Fluxo do aluno (mobile):** shape do submit correto (`{answers:{qid:{value|values|files}}}`); upload de foto bate com a policy de storage (`students/{auth_uid}/submissions/{submission_id}/...`); draft recovery local.
- **Avaliação:** edição/cancel/finalize de sessão já concluída corretamente bloqueados; route params como Promise (Next 15) corretos.
- **Reenvio/idempotência (mobile):** a RPC bloqueia com `Submission is not in draft status`; a UI desabilita o form quando `status ≠ draft` e trava o botão por `isSubmitting`, navegando para fora após sucesso.
- **Check-in de treino não trava o treino:** `submit_inline_form` tem os mesmos bugs de validação, mas os handlers capturam o erro e seguem o treino com aviso genérico (`mobile/app/workout/[id].tsx:591-604`).
- **Tipos consistentes:** `short_text`/`long_text`/`scale`/`single_choice` de opções-**objeto** batem client↔RPC.

---

## Ordem de correção sugerida

1. **C1** — Sala de Treino web (bug vivo que quebra submissão de check-in pré/pós).
2. **Contrato de respostas (afeta forms de sistema, mais usados):** H7 (single_choice string), a manifestação viva de multi_choice, H8/H9 (fotos: treinador não vê + perda de respostas ao anexar). Idealmente unificar o contrato de validação/render dos tipos (`value`/`values`/`files`) entre client e RPC.
3. **Antes de promover Avaliações (0 uso hoje):** C2 (save idempotente), H5 (height_cm), H4 (key no wizard), H6 (ordenação), M9 (confirm do numeric).
4. **Formulários vivos:** H1 (IA feedback), H2 (opções multi_choice no clone), M1/M3/M4/M6/M12/M14 (delete silencioso, feedback duplicado, labels vazios, insights, recorrente mobile, mensagens de erro).
5. **Confiabilidade do recorrente:** H3 (drift do cron), M5 (desativação permanente), M7 (lote).
6. **Higiene:** M10, M11, M13, B1-B11.

> **Cobertura (todas profundas):** Formulários web · Formulários mobile (aluno + treinador) · agendamentos/cron/forms-de-treino · Avaliações web · Avaliações mobile · backend/MCP/fórmulas/banco. Verificação cruzada no banco de produção. Nenhum arquivo foi alterado.
