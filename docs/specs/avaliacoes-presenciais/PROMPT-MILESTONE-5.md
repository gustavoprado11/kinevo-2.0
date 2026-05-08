# PROMPT — Milestone 5: PDF generation (Avaliações Presenciais)

> Cole este prompt no Claude Code. M1, M2, M3, M4 e M6 já estão em main.
> Este é o ÚLTIMO milestone da Fase 1.

---

Você vai implementar o **Milestone 5 — PDF generation** do módulo de
Avaliações Presenciais do Kinevo. Hoje os botões "Compartilhar laudo (PDF)"
em web e mobile são placeholders. Esse milestone faz eles funcionarem de
verdade — gerando PDF profissional via Edge Function Supabase.

⚠️ **Risco técnico:** este é o primeiro Edge Function do projeto que gera
binário PDF. Há possibilidade real de incompatibilidade de runtime. Por
isso B1 começa com SPIKE técnico antes de comprometer com escopo completo.

## Antes de começar

1. Leia, na ordem:
   - `docs/specs/avaliacoes-presenciais/00-visao-geral.md`
   - `docs/specs/avaliacoes-presenciais/06-milestone-5-pdf.md` (a spec
     completa deste milestone)
   - `docs/specs/avaliacoes-presenciais/MILESTONE-1-STATUS.md` (RLS, RPCs)
   - `docs/specs/avaliacoes-presenciais/MILESTONE-3-STATUS.md` (engine M2
     output schema, computed_metrics estrutura)

2. Examine arquivos existentes:
   - `supabase/functions/` (já há Edge Functions? estrutura?)
   - `web/src/app/students/[id]/avaliacoes/[sessionId]/result/result-client.tsx`
     (botão placeholder atual)
   - `mobile/app/assessments/[sessionId]/result.tsx` (botão placeholder atual)

3. Confirme entendimento:
   - PDF server-side via Edge Function (não client-side)
   - `@react-pdf/renderer` é primeira opção; pdf-lib é fallback
   - SPIKE B1 antes de comprometer com layout completo
   - PDF on-demand sem cache (gerar a cada clique)

4. Se algo for ambíguo, **PARE e pergunte**. Não invente.

## Workflow

- **Sem branch.** Direto em main.
- **Sem `git commit` nem `git push` durante desenvolvimento.** Eu autorizo.
- **DIVIDIDO em 3 sub-blocos** (B1 → B2 → B3) com paradas obrigatórias.

═══════════════════════════════════════════════════════════════════════
BLOCO A — DIAGNÓSTICO (read-only)
═══════════════════════════════════════════════════════════════════════

Execute e reporte:

1. `git status --short` (limpo, exceto cosméticos pré-existentes)
2. `git log --oneline -5` (último: `e93a661 feat(assessments): M6 templates seed`)
3. `ls supabase/functions/ 2>/dev/null` — Edge Functions já existem?
4. Se sim: `cat supabase/functions/<alguma>/index.ts | head -40` para
   pattern do projeto
5. Verificar se Supabase CLI está instalada e funcional:
   `npx supabase --version`
6. Ver se há configuração de Edge Functions em `supabase/config.toml`
7. Procurar deps de PDF já no projeto:
   `grep -E '"@react-pdf|"pdf-lib|"pdfkit|"jspdf' web/package.json mobile/package.json`
8. Procurar expo-sharing no mobile:
   `grep -E '"expo-sharing|"expo-file-system' mobile/package.json`
9. Ver botões placeholder atuais:
   - `head -100 web/src/app/students/[id]/avaliacoes/[sessionId]/result/result-client.tsx`
   - Procurar handler de "Compartilhar laudo" no mobile
10. Confirmar Supabase Edge Function runtime (Deno version):
    `npx supabase functions --help` ou docs

PARE e me reporte. Foco especial em:
- Padrão de Edge Functions no projeto (se houver)
- Versão Deno do Supabase
- expo-sharing presente ou precisa adicionar
- Padrão de auth nas Edge Functions existentes

═══════════════════════════════════════════════════════════════════════
BLOCO B1 — SPIKE TÉCNICO + EDGE FUNCTION SETUP + LAYOUT BASE
═══════════════════════════════════════════════════════════════════════

Só execute depois da minha aprovação do diagnóstico.

⚠️ **Este é o sub-bloco mais arriscado.** Faça em duas fases internas:

### Fase 1 — Spike (~1 dia)

1. Criar Edge Function `supabase/functions/generate-assessment-pdf/index.ts`
2. Tentar import: `import { Document, Page, Text, View, StyleSheet, renderToBuffer } from 'npm:@react-pdf/renderer'`
3. Se NÃO compilar / NÃO rodar em Deno:
   - Tentar pdf-lib: `import { PDFDocument } from 'npm:pdf-lib'`
   - Se também falhar: PARAR e me chamar — vamos discutir alternativas
4. Renderizar PDF mínimo: só "Hello World" + nome do aluno
5. Deploy: `npx supabase functions deploy generate-assessment-pdf`
6. Testar via curl com JWT válido:
   ```
   curl -X POST https://lylksbtgrihzepbteest.supabase.co/functions/v1/generate-assessment-pdf \
     -H "Authorization: Bearer <JWT>" \
     -H "Content-Type: application/json" \
     -d '{"session_id": "<uuid>"}' \
     --output test.pdf
   ```
7. Abrir test.pdf — confirmar que gera PDF válido

**Critério de saída da Fase 1:** PDF de 1KB+ é gerado e abre em Adobe/Preview.

Se Fase 1 falhar, PARE e me chame. NÃO prossiga com escopo maior se a
infraestrutura não está sólida.

### Fase 2 — Layout base (1-2 dias)

Apenas após Fase 1 funcionar:

1. Adicionar autenticação via JWT:
   - Decode JWT, extrair user_id
   - Validar que user é trainer dono da sessão OU student dono em sessão completed
   - Se não, retornar 403
2. Buscar dados da sessão via supabase admin client:
   - assessment_sessions (status, computed_metrics, dates, etc)
   - student (nome, sexo, idade)
   - trainer (nome)
   - measurements (todas)
   - template_snapshot (para listar protocolos usados)
3. Layout base do PDF (apenas seções 3.1, 3.2, 3.3 da spec):
   - Header com "Laudo de Avaliação Física"
   - Identificação (aluno, trainer, data, protocolo)
   - Resultados principais (IMC, RCQ, %BG cards)
4. Retornar binário com headers corretos:
   - `Content-Type: application/pdf`
   - `Content-Disposition: attachment; filename="laudo-{aluno-slug}-{date}.pdf"`

**Critério de saída B1:** PDF com 1 página, 3 seções, dados reais da sessão,
auth funcionando (testado com JWT do trainer dono e de outro trainer).

PARE e reporte com:
- PDF de exemplo (anexar ou descrever conteúdo)
- Output do deploy
- Confirmação de auth (test com 2 trainers diferentes)
- Decisão técnica final: react-pdf OU pdf-lib OU outro

═══════════════════════════════════════════════════════════════════════
BLOCO B2 — LAYOUT COMPLETO + COMPARATIVO
═══════════════════════════════════════════════════════════════════════

Só execute depois da aprovação do B1.

Implementar:
- Adicionar seções restantes (3.4, 3.5, 3.6 da spec):
  - Comparativo com sessão anterior (se houver — fallback gracioso)
  - Medições brutas
  - Footer com citações + página X de Y
- Polish visual: alignment, spacing, hierarquia, fontes consistentes
- Cores Kinevo (light theme do PDF — sem dark mode em PDF):
  - Primary text: #1D1D1F
  - Secondary: #6E6E73
  - Accent (presencial): #7c3aed (igual mobile)
  - Highlight (saudável): #16a34a
  - Warning (acima do ideal): #f59e0b
  - Danger (alto risco): #ef4444
- Test cenários:
  - Antropometria mínima (sem dobras, sem %BG)
  - Petroski 4 dobras (com %BG)
  - Com sessão anterior (comparativo presente)
  - Sem sessão anterior (sem comparativo)

Verificações:
- PDF abre em Adobe Reader, Preview Mac, Chrome viewer
- Todas as métricas computed renderizadas quando presentes
- Fallback gracioso para campos vazios

PARE e reporte com PDF de cada cenário (4 PDFs).

═══════════════════════════════════════════════════════════════════════
BLOCO B3 — INTEGRAÇÃO WEB + MOBILE + STATUS DOC + COMMIT
═══════════════════════════════════════════════════════════════════════

Só execute depois da aprovação do B2.

### Web

Em `web/src/app/students/[id]/avaliacoes/[sessionId]/result/result-client.tsx`:
- Substituir o handler placeholder (que mostra inline disclosure + toast)
  por chamada real à Edge Function
- `fetch(supabase.functions.url + '/generate-assessment-pdf', { method: 'POST', body: { session_id }, headers: { Authorization: Bearer JWT } })`
- Receber blob, criar URL via `URL.createObjectURL`, disparar download
  via `<a download>` programático
- Loading state: spinner no botão durante request (~2-3s)
- Error handling: toast claro se falhar
- **REMOVER inline disclosure persistente** ("PDF em desenvolvimento")

### Mobile

Em `mobile/app/assessments/[sessionId]/result.tsx`:
- Adicionar `expo-sharing` se não estiver no projeto
- Handler chama Edge Function, recebe binário
- Salvar via `expo-file-system` em cache temporário
- Abrir Share API via `expo-sharing.shareAsync`
- Loading state + error handling consistentes

### Status doc

`docs/specs/avaliacoes-presenciais/MILESTONE-5-STATUS.md` cobrindo:
- Sumário B1+B2+B3
- Decisão técnica final (qual lib usada, por quê)
- Performance medida (tempo médio de geração)
- Cenários de teste validados
- Limitações conhecidas
- "Fase 1 do módulo de Avaliações Presenciais COMPLETA"

PARE e reporte com:
- Lista de arquivos criados/alterados
- Confirmação de remoção do disclosure
- Performance medida (tempo de download web e tempo até Share Sheet mobile)
- Screenshots ou descrições do flow

═══════════════════════════════════════════════════════════════════════
BLOCO C — VALIDAÇÃO MANUAL + COMMIT + PUSH
═══════════════════════════════════════════════════════════════════════

Eu vou:
1. Revisar o código aqui
2. Testar via curl com JWT real (autorizo via MCP se precisar)
3. Pedir user pra fazer smoke test web e mobile
4. Aprovar commit + push

═══════════════════════════════════════════════════════════════════════
GATILHOS PARA PARAR E PERGUNTAR
═══════════════════════════════════════════════════════════════════════

- `@react-pdf/renderer` não compilar em Deno (PARAR no Spike B1)
- pdf-lib também falhar (PARAR — alternativas seriam Vercel function ou
  Cloudflare Worker)
- Edge Function timeout em geração simples
- Fontes customizadas não carregarem
- expo-sharing exigir nova dep não autorizada
- Performance >5s consistentemente
- RLS / auth duvidoso (segurança crítica aqui — info do aluno)

═══════════════════════════════════════════════════════════════════════
ORDEM RECOMENDADA
═══════════════════════════════════════════════════════════════════════

1. BLOCO A → reportar → aguardar aprovação
2. BLOCO B1 Fase 1 (Spike) → reportar → aguardar aprovação
3. BLOCO B1 Fase 2 (Layout base) → reportar → aguardar aprovação
4. BLOCO B2 (Layout completo) → reportar (com PDFs de exemplo) → aguardar aprovação
5. BLOCO B3 (Integração) → reportar → aguardar aprovação
6. BLOCO C (validação manual + commit + push)

NÃO commit, NÃO push até autorização explícita após smoke test.

COMECE PELO BLOCO A.
