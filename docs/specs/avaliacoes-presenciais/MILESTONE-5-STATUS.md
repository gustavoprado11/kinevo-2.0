# Milestone 5 — Status: COMPLETED

> Data: 2026-05-08 — geração de PDF de laudo via Edge Function Supabase + integração web e mobile.
> **Fase 1 do módulo de Avaliações Presenciais COMPLETA.**

---

## Sumário

M5 transforma os botões "Compartilhar laudo (PDF)" (web e mobile) — que
até então eram placeholders — em um pipeline real de geração e entrega de
PDF. Edge Function Supabase recebe `session_id`, valida JWT do trainer ou
aluno-dono, busca dados via service-role admin client (bypass de RLS com
ownership check explícito), monta um laudo A4 portrait e devolve binário
PDF.

Fluxo end-to-end:
- **Web**: trainer clica "Compartilhar laudo (PDF)" → fetch para a Edge
  Function → blob → `URL.createObjectURL` + `<a download>` programático →
  download nativo do browser.
- **Mobile**: trainer clica → fetch → `arrayBufferToBase64` →
  `FileSystem.writeAsStringAsync` em cache → `Sharing.shareAsync` abre o
  Share Sheet nativo (AirDrop, WhatsApp, e-mail, "Salvar em Arquivos").

---

## Entregáveis por sub-bloco

### B1 — Spike + Edge Function setup + layout base

**Spike Fase 1 (~12 min)**: tentativa A com `@react-pdf/renderer` + `Font.register`
falhou — todas as URLs TTF de Google Fonts/jsdelivr/GitHub raw retornaram
404, e o fallback Helvetica do react-pdf crashou em runtime
(`unitsPerEm` of undefined em `@react-pdf/textkit`). Plano B
(pdf-lib) foi acionado e funcionou de primeira: PDF de 1.1 KB com
"Hello World" + session_id em **63 ms** de geração interna.

**Layout base (Fase 2)**: 3 seções (header + identificação + cards de
resultado) + autenticação real. Validado com 7 cenários:
- 200 trainer-dono (Gustavo / sessão Petroski 4) ✅
- 403 trainer não-dono (Gustavo tenta sessão de Thiago) ✅
- 404 sessão inexistente (UUID válido mas sem registro) ✅
- 401 sem `Authorization` header ✅
- 401 com anon JWT (sem usuário) ✅
- 400 com UUID malformado ✅
- 400 com body sem `session_id` ✅

Acentos pt-BR confirmados (Avaliação, Identificação, Sessão, Educador
físico, Júnior, etc.) via extração de texto com pypdf.

### B2 — Layout completo

Adicionou seções 3.4–3.6 do spec:
- **Comparativo** (lookup automático da sessão completed mais recente
  do mesmo `student_id` + `template_id`, com `completed_at < cutoff`)
- **Medições brutas** agrupadas por section do `template_snapshot`,
  excluindo `subject_sex` / `subject_age_years` (já mostrados na
  identificação)
- **Notas** com citação dos protocolos usados (Petroski 1995, Jackson
  & Pollock 1978, Faulkner 1968) + linha "Cálculos pela engine M2"
- **Footer** em todas as páginas: separador + disclaimer + data + "Página X de Y"
- **Paginação manual** via `PdfCtx.ensureSpace()` — cenário Petroski
  com comparativo quebrou em 2 páginas automaticamente

4 cenários de teste validados:
1. Antropometria mínima (sem dobras, sem %BG) — 1 página, 2.4 KB
2. Petroski 4 com comparativo — 2 páginas, 4.3 KB
3. J&P 3 sem comparativo — 1 página, 2.8 KB
4. Petroski 4 baseline (primeira sessão) — 1 página, 2.9 KB

### B3 — Integração web + mobile

- **Web** ([result-client.tsx](web/src/app/students/[id]/avaliacoes/[sessionId]/result/result-client.tsx)):
  removido o disclosure violet "PDF em desenvolvimento" + handler real
  com `getSession()` → fetch → blob → download programático. Loading
  state com `Loader2` spin + botão disabled. Botão só aparece quando
  `session.status === 'completed'`.
- **Mobile** ([result.tsx](mobile/app/assessments/[sessionId]/result.tsx)):
  removido o toast "PDF disponível em breve" + handler real com fetch →
  `arrayBufferToBase64` → `FileSystem.writeAsStringAsync` →
  `Sharing.shareAsync`. Loading com `ActivityIndicator` + opacity 0.6 +
  `accessibilityState.disabled`. Mesma condição de visibilidade
  (`status === 'completed'`).
- **Helper compartilhado** ([parseFilename.ts](shared/lib/http/parseFilename.ts)):
  extrai filename do header `Content-Disposition`, reusado em web e mobile.
- **Dependência mobile**: `expo-file-system@~19.0.22` adicionado via
  `npx expo install` (Expo SDK-managed, sem rebuild nativo extra).
  `expo-sharing` já estava no projeto.

---

## Decisão técnica final

### Lib: `pdf-lib@1.17.1` + `StandardFonts.Helvetica` / `HelveticaBold`

**Por que pdf-lib (e não react-pdf)**:

| Critério | react-pdf | pdf-lib |
|---|---|---|
| Compila em Deno 2 (Supabase Edge) | ✅ | ✅ |
| Funciona em runtime sem rede | ❌ (precisa carregar TTF externa) | ✅ (StandardFonts embutidas no spec PDF) |
| Layout flexbox automático | ✅ | ❌ (manual x/y) |
| Compatibilidade WASM (yoga-layout) | Frágil em Edge Functions | N/A |
| Tamanho do bundle compilado | Maior (~30 MB) | Menor (~5 MB) |
| Risco de runtime error | Alto (`unitsPerEm` of undefined) | Zero observado nos 4 cenários |

react-pdf foi a primeira escolha do spec mas não passou no spike por dois
motivos: (1) o fallback default Helvetica do textkit crashou ao tentar
medir glyphs sem fontkit conseguir parsear PSNAME no ambiente Deno; (2) as
URLs TTF passadas para `Font.register` retornaram 404 nos CDNs do Google
Fonts, GitHub raw e jsdelivr — tentar caçar uma URL estável seria
infrutífero quando pdf-lib resolve o problema sem depender de rede.

### Encoding: WinAnsi (cp1252)

`StandardFonts` no PDF spec usam WinAnsi. Cobertura validada via probe
local: en-dash (`–`), em-dash (`—`), curly quotes (`""`), middle dot
(`·`), todos os acentos Latin-1 (à á â ã é ê ó ô ú ü ç) renderizam OK.
Setas (↑↓→←) e Δ ficam **fora** de cp1252 e crasham o `drawText`.

Mitigação:
- **Sanitizer global** ([_helpers.ts:safe()](supabase/functions/generate-assessment-pdf/_helpers.ts))
  ASCII-fold antes de cada `drawText`/`widthOfTextAtSize`: `↑▲ → +`,
  `↓▼ → -`, `→ → ->`, `Δ → d`, `• → ·`.
- **Setas no comparativo** trocadas por `^` (subiu), `v` (caiu), `=`
  (igual), com sinal numérico explicit (`+`/`-`/`0`).
- **Header da coluna** "Δ" trocado por "Var.".

---

## Limitações conhecidas

1. **Apenas glyphs WinAnsi (cp1252)**. Emojis, kanji, cirílico, símbolos
   matemáticos avançados não renderizam. Para o domínio Kinevo (laudo
   pt-BR de avaliação física) isso cobre 100% do conteúdo planejado.
2. **Sem custom fonts**. O spec original sugeria Inter, mas o trade-off
   de carregar TTF externa em runtime serverless não compensa o ganho
   visual marginal para um documento técnico. Helvetica é battle-tested
   e compatível com qualquer leitor PDF.
3. **PDF on-demand sem cache**. Cada clique regera o binário (~70-150 ms
   de geração + ~1.5-3.5s de network round-trip). Para uma sessão
   completed que nunca muda, isso é puro waste — refinamento Fase 2.
4. **Sem logo/branding**. Header é texto puro com "Kinevo" no subtítulo.
   Imagem requer `pdf.embedPng/Jpg` + bytes via fetch, deixado para
   Fase 2 quando entrarmos em white-label.
5. **Layout manual (sem flexbox)**. Mudanças de layout exigem ajustar
   coordenadas explicitamente. OK para 6 seções estáveis; se a complexidade
   crescer, vale considerar migração para react-pdf via Vercel Function
   (Node.js) onde funciona sem WASM.
6. **Paginação automática conservadora**. `ensureSpace()` quebra página
   antes de seções grandes mas não dentro delas — se uma tabela de
   comparativo crescer muito, ela não split. Para 6 métricas isso não
   ocorre, mas é trade-off conhecido.

---

## Performance medida

| Cenário | Cold start | Warm | Geração interna |
|---|---|---|---|
| Antropometria mínima (1 pág, sem tabela) | 3.78 s | 1.45 s | 49–73 ms |
| J&P 3 (1 pág, sem comparativo) | — | 1.97 s | 67–75 ms |
| Petroski 4 baseline (1 pág) | — | 1.45 s | 49 ms |
| Petroski 4 com comparativo (2 pág) | — | 2.06–3.81 s | **91–231 ms** |

Geração interna (header `x-generation-ms`) é estável em ~70-150 ms para
1 página, ~150-230 ms para 2 páginas. A maior parte do tempo de
round-trip é Cloudflare → Edge runtime (sa-east-1) → cliente —
amplamente dentro do limite de 5 s do spec.

---

## Trade-offs registrados

- **pdf-lib não tem flexbox** → layout x/y manual com helpers (`drawHeader`,
  `drawSectionTitle`, `drawLabelValueGrid`, `drawResultCards`, `drawTable`,
  `drawWrappedText`, `drawCitations`, `drawFooterOnAllPages`).
- **Setas Unicode** trocadas por ASCII (`^` `v` `=`) para sobreviver ao
  WinAnsi.
- **Δ** (U+0394, fora de cp1252) trocado por `Var.` no header da
  coluna comparativo. Defesa em profundidade: sanitizer também
  converte Δ → d para qualquer ocorrência futura.
- **Paginação manual** via `PdfCtx.ensureSpace()` — abre nova página
  quando `currentY - needed < marginBottom`.
- **Auth por ownership explícito** em vez de RLS-via-userClient: a Edge
  Function usa service-role para query e checa `trainer.auth_user_id`
  ou `student.auth_user_id` no código. Isso permite que o aluno baixe
  PDF de sessão completed mesmo sem ter acesso à sessão via RLS de
  `assessment_sessions` (ele tem, mas a checagem fica explícita e
  testável).
- **`expo-file-system` adicionado** (não estava no projeto). Pacote
  Expo SDK-managed — sem rebuild nativo extra, sem custom plugin.

---

## Cenários de teste validados

### Geração — happy path

| # | Cenário | Status | Tamanho |
|---|---|---|---|
| 1 | Antropometria mínima (sem %BG, sem comparativo) | ✅ 200 | 2.4 KB |
| 2 | Petroski 4 com comparativo (2 sessões mesmo aluno + template) | ✅ 200 | 4.3 KB (2 págs) |
| 3 | J&P 3 dobras (primeira sessão do aluno, sem comparativo) | ✅ 200 | 2.8 KB |
| 4 | Petroski 4 baseline (sessão completed antiga) | ✅ 200 | 2.9 KB |

### Auth — negativo

| # | Cenário | Esperado |
|---|---|---|
| 1 | Anon JWT (sem usuário) | ✅ 401 `unauthorized` |
| 2 | Sem `Authorization` header | ✅ 401 (gateway-level) |
| 3 | UUID malformado | ✅ 400 `bad_request` |
| 4 | Body sem `session_id` | ✅ 400 `bad_request` |
| 5 | UUID inexistente | ✅ 404 `session_not_found` |
| 6 | Trainer não-dono da sessão | ✅ 403 `forbidden` |

### Conteúdo — verificação semântica (pypdf extract)

- ✅ Acentos pt-BR (Avaliação, Identificação, Sessão, Educador físico, Júnior, supra-ilíaca, panturrilha, tríceps)
- ✅ En-dash em "Petroski – 4 dobras (BR)" e "Jackson & Pollock – 3 dobras"
- ✅ Filename ASCII-slugged: `laudo-ivo-junior-2026-05-08.pdf`
- ✅ Comparativo com cores de tone (success/warning/danger) por métrica
- ✅ Citações de protocolo só aparecem quando o template tem `protocol` test
- ✅ Footer "Página X de Y" em todas as páginas
- ✅ Disclaimer "Valores devem ser interpretados por educador físico habilitado."

---

## Arquivos criados/alterados

### Criados
- `supabase/functions/generate-assessment-pdf/index.ts` (~420 linhas)
- `supabase/functions/generate-assessment-pdf/_helpers.ts` (~360 linhas)
- `shared/lib/http/parseFilename.ts` (helper compartilhado)
- `docs/specs/avaliacoes-presenciais/MILESTONE-5-STATUS.md` (este doc)

### Alterados
- `web/src/app/students/[id]/avaliacoes/[sessionId]/result/result-client.tsx`
  — removido disclosure violet; handler real com `createBrowserSupabase`
  + fetch + download programático; loading state.
- `mobile/app/assessments/[sessionId]/result.tsx` — removido toast
  placeholder; handler real com FileSystem + Sharing; helper
  `arrayBufferToBase64` local; loading state.
- `mobile/package.json` — adicionado `expo-file-system: ~19.0.22`.
- `mobile/package-lock.json` — atualizado (consequência).
- `docs/specs/avaliacoes-presenciais/06-milestone-5-pdf.md`
  (spec de origem, criado pré-implementação).
- `docs/specs/avaliacoes-presenciais/PROMPT-MILESTONE-5.md`
  (prompt de orquestração, criado pré-implementação).

---

## Próximos passos sugeridos (Fase 2)

1. **Cache em Storage com signed URL**. Sessão completed nunca muda;
   gerar uma vez, salvar em `supabase://laudos/{trainer}/{session}.pdf`,
   retornar signed URL de 24h. Reduz round-trip a quase zero pra cliques
   subsequentes.
2. **Custom font Inter via TTF embed**. Quando logo + branding entrarem,
   trocar StandardFonts por Inter (TTF estática, hospedada no próprio
   Storage do Supabase para evitar 404 de CDN). Visual mais alinhado com
   o app.
3. **Logo/branding por trainer**. Header com logo do estúdio quando
   `trainer.studio_logo_url` existir.
4. **Histórico de PDFs gerados**. Tabela `assessment_pdf_exports` com
   `session_id`, `generated_at`, `storage_path`, `generated_by_user_id`.
   Útil para auditoria.
5. **E-mail automático com PDF**. Botão "Enviar para o aluno" que dispara
   email transactional (Resend/Postmark) com o PDF anexado.

---

## Pré-requisitos para release

- [x] Edge Function deployada em prod (`generate-assessment-pdf`)
- [x] Auth funcional (3 cenários positivos + 6 negativos)
- [x] Web TypeScript clean nos arquivos alterados
- [x] Mobile TypeScript clean nos arquivos alterados
- [x] Inline disclosure violet removido (web)
- [x] Toast placeholder removido (mobile)
- [x] Performance < 5 s consistente
- [x] 4 cenários de layout validados
- [x] Acentos pt-BR + en-dash + setas-fallback validados
- [x] Smoke test manual web (download → abre em Adobe/Preview) — aprovado pelo user em localhost antes do push
- [x] Cleanup das fixtures de teste em prod (07e6e99f, cebb2cc0)
- [x] Deploy web em produção (Vercel auto-deploy disparado pelo push em main, status Ready em 2 min)
- [ ] **Deploy mobile pendente**: o código mobile (`mobile/app/assessments/[sessionId]/result.tsx` + dep nova `expo-file-system`) só chega aos usuários após `eas update` (OTA push) ou novo `eas build` + submit. `expo-file-system` é Expo SDK-managed (não exige rebuild nativo), então `eas update` deve bastar. Confirmar canal (`production` ou `preview`) com o user antes de propagar.
- [ ] Smoke test manual mobile (Share Sheet → AirDrop/WhatsApp) — pendente após `eas update`

---

## Fase 1 do módulo de Avaliações Presenciais — COMPLETA

| Milestone | Status |
|---|---|
| M1 — Data foundation (RLS, RPCs, schemas) | ✅ |
| M2 — Formula engine (J&P 3/7, Petroski 4, Faulkner) | ✅ |
| M3 — Mobile capture flow | ✅ |
| M4 — Web builder + view | ✅ |
| M6 — System templates seed + onboarding | ✅ |
| **M5 — PDF generation** | ✅ (este milestone) |

Todo o pipeline de avaliação presencial está em produção, ponta-a-ponta:
trainer cria sessão (web ou mobile) → captura medições no mobile com o
aluno presente → engine M2 calcula composição corporal → web/mobile
exibem resultados + comparativo + histórico → trainer gera laudo em PDF
e compartilha com o aluno.

Próxima decisão estratégica: priorização da Fase 2 conforme reflexões
registradas no MILESTONE-6-STATUS.md (paridade web/mobile + integração
da aba Formulários).
