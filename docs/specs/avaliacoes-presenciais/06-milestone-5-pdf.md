# Milestone 5 — PDF generation

**Pré-requisitos:** ler `00-visao-geral.md` e os 5 STATUS docs anteriores (M1–M4 + M6). Trio M1+M2+M3 + M4 + M6 estão em main. Único milestone restante da Fase 1.

**Goal:** entregar **geração real de PDF do laudo de avaliação presencial**. Hoje, os botões "Compartilhar laudo (PDF)" tanto no web quanto no mobile são placeholders. Trainer real precisa entregar laudo formal pro aluno — esse é o último item bloqueador da Fase 1.

**Plataforma:** Supabase Edge Function (Deno) + integração web + integração mobile.

**Dura:** 5-8 dias úteis.

**Branch:** sem branch — direto em main, sem commit/push até validação.

---

## 1. Por que M5 é qualitativamente diferente

M1, M2, M3, M4, M6 entregaram fluxo end-to-end mas **dentro do app**. M5 entrega o **artefato exportado** que sai do app:

- PDF é o "produto final" que trainer entrega pro aluno (e-mail, WhatsApp, impressão)
- Layout precisa parecer profissional (não "screenshot do app")
- Fontes, cores, hierarquia — tudo em A4 com qualidade de impressão
- Edge Function é tecnologia nova no projeto — **risco técnico real** de descobrir limitação de runtime, fonts, ou tempo de execução

Por isso M5 é tratado com extra cuidado: spike técnico no B1 antes de comprometer com layout completo no B2.

---

## 2. Decisões técnicas críticas

### 2.1 Server-side via Edge Function (não client-side)

**Decisão:** PDF gerado em Edge Function Supabase com `react-pdf` via Deno.

Razões:
- Mesmo PDF em web e mobile (consistência total)
- Controle de versão do template centralizado
- Lógica de cálculo não exposta no client
- Fontes customizadas carregadas do servidor (sem dor de embed)

Alternativas rejeitadas:
- ❌ jsPDF client-side: difícil garantir consistência web vs mobile, layout limitado
- ❌ html-to-pdf via window.print: depende do browser do trainer, sem branding consistente
- ❌ Puppeteer/Chrome headless: pesado demais pra Edge Functions (limite de memória/tempo)

### 2.2 react-pdf (não Puppeteer)

`@react-pdf/renderer` gera PDF binário direto via componentes React-like. Compatível com Deno em Edge Functions com a versão certa.

⚠️ **Risco no B1:** confirmar que `@react-pdf/renderer` roda em Deno Edge Function da Supabase. Se não rodar (incompatibilidade de runtime), considerar alternativas:
- `pdf-lib` (mais low-level, suporte Deno melhor)
- Render server-side em Node.js separado (Vercel function, Railway, etc.)

### 2.3 Geração on-demand (sem armazenar)

**Decisão fase 1:** PDF gerado quando o trainer clica "Compartilhar laudo", retornado como binário direto. Não armazenar em Storage.

Razões:
- Simplifica: sem cache, sem cleanup, sem URLs assinadas
- PDF é determinístico (sessão completed não muda — pode regerar com mesmo resultado)
- Storage cost zero
- Latência aceitável (~2-3s pra gerar)

Refinamento futuro (Fase 2 ou se virar gargalo):
- Cachear em Storage com signed URL de 24h
- Webhook que regenera PDF se sessão for atualizada

### 2.4 Autorização

Edge Function autenticada via JWT do trainer. Service role lê banco mas valida internamente:
- `assessment_sessions.trainer_id = auth.uid()` (via current_trainer_id helper) OU
- `assessment_sessions.student_id = auth.uid()` (via current_student_id) AND `status='completed'`

Se nenhum, 403 forbidden. Mesmo padrão dos RPCs existentes.

### 2.5 Entrega no mobile

`expo-sharing` (já no projeto provavelmente — verificar no Bloco A). Recebe Blob/Uint8Array, salva em cache temporário, abre Share API nativo (AirDrop, WhatsApp, e-mail, etc.). User escolhe destino.

Alternativa fallback: download via `expo-file-system` + abertura via OS.

### 2.6 Entrega no web

Browser download nativo: response com `Content-Type: application/pdf` + `Content-Disposition: attachment; filename="..."`. Trainer recebe download direto, abre em qualquer leitor.

---

## 3. Layout do PDF — seções obrigatórias

A4 portrait, márgens 2cm, fonte sans-serif (Inter ou Helvetica fallback).

### 3.1 Header
- Logo Kinevo (esquerda, ~40px height)
- Título "Laudo de Avaliação Física" (direita ou centro)
- Linha separadora

### 3.2 Identificação
- Nome do aluno (destaque, bold)
- Sexo, idade na sessão
- Nome do trainer
- Data da sessão (formato pt-BR)
- Protocolo usado (ex: "Petroski 4 dobras")

### 3.3 Resultados principais
Grid com cards lado a lado:
- IMC + classificação (ex: "22.4 — Peso normal")
- RCQ + classificação (ex: "0.85 — Risco moderado")
- % Gordura corporal + classificação Pollock & Wilmore (se houver)
- Massa magra (kg)
- Massa gorda (kg)
- Densidade corporal (se houver)

### 3.4 Comparativo (se houver sessão anterior)
Tabela com 4 colunas: Métrica | Anterior (data) | Atual (data) | Δ
Linhas: peso, IMC, RCQ, %BG, massa magra, massa gorda
Setas/cores indicam tendência (verde se melhorou na direção esperada)

### 3.5 Medições brutas
Lista das medições individuais (peso 75kg, altura 1.78m, dobra tríceps 12mm, etc.)
Útil para auditoria, recomputação manual, validação cruzada

### 3.6 Footer
- "Cálculos realizados pela engine Kinevo M2"
- Citação dos protocolos usados (Pollock & Wilmore 1990, Jackson & Pollock 1978/1980, etc.)
- Disclaimer: "Valores devem ser interpretados por educador físico habilitado."
- Página X de Y
- Data de geração do PDF

---

## 4. Sub-blocos sugeridos (B1 a B3)

### B1 — Spike + Edge Function setup + layout base (3-4 dias)

⚠️ **Crítico — fazer spike técnico ANTES de comprometer com escopo:**

1. Criar Edge Function `supabase/functions/generate-assessment-pdf/index.ts`
2. Confirmar `@react-pdf/renderer` ou `pdf-lib` roda em Deno do Supabase
3. Layout mínimo: só header + identificação + resultados principais
4. Endpoint retorna binário PDF com auth via JWT
5. Validação de RLS interna
6. Deploy via `supabase functions deploy generate-assessment-pdf`

**Critério de saída do B1:** trainer faz request via curl com JWT válido, recebe PDF de ~30KB com header + 1 seção.

Se `@react-pdf/renderer` não funcionar em Deno, **PARAR** e me chamar — vamos discutir alternativas (pdf-lib, ou render Node em Vercel function separada).

### B2 — Layout completo + comparativo (1-2 dias)

- Adicionar todas as seções do item 3
- Comparativo com sessão anterior (se houver — fallback gracioso)
- Medições brutas
- Footer com citações
- Polish visual: alignment, spacing, hierarquia
- Tests com cenários: com/sem comparativo, com/sem protocol, todos os 4 protocolos

### B3 — Integração web + mobile + status doc + commit (1-2 dias)

- **Web:** `web/src/app/students/[id]/avaliacoes/[sessionId]/result/result-client.tsx` botão "Compartilhar laudo (PDF)" chama Edge Function via fetch, recebe blob, dispara download via `URL.createObjectURL`
- **Mobile:** `mobile/app/assessments/[sessionId]/result.tsx` botão chama Edge Function, salva via `expo-file-system` em cache, abre via `expo-sharing`
- Loading states em ambos (request demora ~2-3s)
- Error handling: toast claro se falhar
- Inline disclosure do M4 ("PDF em desenvolvimento") — REMOVER agora
- `MILESTONE-5-STATUS.md` final

---

## 5. Acceptance criteria

- ✅ Edge Function deployada em prod
- ✅ Trainer no web clica "Compartilhar laudo" → recebe PDF download em <5s
- ✅ Trainer no mobile clica "Compartilhar laudo" → Share API abre com PDF anexado
- ✅ Aluno também pode (sessão completed) — autorização correta
- ✅ Outro trainer NÃO pode (403)
- ✅ PDF tem todas as 6 seções
- ✅ PDF gerado pra Petroski 4 mostra %BG calculado pela engine M2
- ✅ Comparativo aparece quando há sessão anterior do mesmo template
- ✅ Comparativo NÃO aparece (mas não quebra) quando é primeira sessão
- ✅ Inline disclosure de "PDF em desenvolvimento" removido
- ✅ TypeScript zero novos erros
- ✅ Sem nova dep no client (web/mobile só fazem fetch/sharing)
- ✅ MILESTONE-5-STATUS.md final

---

## 6. Riscos e cuidados

| Risco | Mitigação |
|---|---|
| `@react-pdf/renderer` não roda em Deno Edge Function | Spike no B1 antes de comprometer com escopo. Se falhar: pdf-lib ou Vercel function separada |
| Tempo de geração >5s (Edge timeout) | PDF leve (sem imagens pesadas), sem fontes externas |
| Fontes customizadas não carregam | Fallback para Helvetica/Times nativo do PDF (suportado universalmente) |
| Mobile expo-sharing não está no projeto | Verificar no Bloco A; se ausente, adicionar (já é dep comum) |
| Layout quebra em sessão sem comparativo | Branch lógico — se não há sessão anterior, pular seção |
| Cache de Edge Function deployada vs versão atualizada | `supabase functions deploy --no-verify-jwt` ou similar para flush |
| User clica botão duas vezes em sequência | Disable do botão durante request + spinner |
| RLS bypass via service role | Edge Function valida explicitamente trainer/student id antes de gerar |
| PDF muito grande pra mobile compartilhar | A4 com 1-2 páginas tipicamente <100KB — sem problema |

---

## 7. Fora de escopo

- ❌ Templates customizáveis de PDF por trainer (Fase 2)
- ❌ Logo do estúdio/marca branca (Fase 2)
- ❌ Múltiplos idiomas (pt-BR fixo)
- ❌ E-mail automático com PDF (trainer compartilha manualmente)
- ❌ Histórico de PDFs gerados (Fase 2)
- ❌ Assinatura digital do trainer (Fase 2)
- ❌ QR code com link para versão online (Fase 2)

---

## 8. Validação manual antes de pushar

1. **Spike B1**: curl com JWT, recebe PDF, abre em Adobe/Preview, conteúdo OK
2. **Web happy path**: criar sessão Petroski 4 (via mobile ou direto SQL), finalizar via mobile, abrir resultado no web, clicar "Compartilhar laudo", baixar, abrir
3. **Mobile happy path**: mesmo cenário, mas botão no mobile, Share API abre, escolher "Salvar em Arquivos" ou compartilhar via WhatsApp
4. **Aluno acessa**: logar como aluno (Marina), abrir avaliação concluída, baixar PDF — trainer e aluno recebem mesmo PDF
5. **Outro trainer 403**: tentar baixar PDF de sessão de outro trainer → 403, toast de erro
6. **Sem comparativo**: sessão única do aluno → PDF gerado sem seção comparativo (não quebra)
7. **Com comparativo**: 2 sessões do mesmo aluno + template → comparativo presente
8. **Performance**: tempo de geração <5s consistente (timing via DevTools)
