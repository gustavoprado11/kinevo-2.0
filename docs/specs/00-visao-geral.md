# Specs — Migração da Prescrição com IA para dentro do Construtor de Treinos

**Leia isto primeiro.** Este arquivo define contexto, decisões já tomadas, invariantes que valem para todas as fases, e a ordem sugerida de execução. Cada fase tem seu próprio arquivo com spec executiva para o Claude Code.

---

## 1. Contexto rápido

No Kinevo, treinadores prescrevem programas de treino a alunos pela web. Hoje existem **duas IAs** no produto, convivendo sem se falar:

- **Fluxo robusto `/students/[id]/prescribe`** — stepper completo (anamnese → análise → perguntas do agente → geração). Botão "Novo com IA" no dashboard do aluno (em dois cartões) leva o treinador pra cá. No fim, a saída é salva em `prescription_generations` e o usuário é redirecionado para `/program/new?source=prescription&generationId=...` onde o construtor aparece pré-populado.
- **Fluxo leve dentro do construtor** — um botão "Texto para Treino" (`FileText` icon) na barra de ações do `ProgramBuilderClient` abre o `AiPrescribePanel`: o treinador cola texto livre, `POST /api/prescription/parse-text` parseia, e os exercícios são adicionados ao treino ativo.

A meta é **unificar essas duas experiências dentro do construtor**, numa superfície única de IA, e aposentar a tela `/prescribe`.

## 2. Decisões já tomadas (não revisar)

As quatro decisões abaixo foram aprovadas pelo Gustavo em 16/abr/2026 e são premissa de todas as specs:

1. **Único ponto de entrada no dashboard.** Os dois botões "Novo com IA" hoje presentes em `student-detail-client.tsx` (linhas 532 e 686) são **removidos**. Dashboard passa a ter apenas "Criar Novo" / "+ Criar Novo", que abrem `/program/new` (vazio). Toda ação de IA acontece dentro do construtor.
2. **Streaming parcial** — o treinador deve ver os exercícios aparecendo em tempo real no canvas à medida que a IA gera. Implementação recomendada: **commits parciais por aula** (ver spec da Fase 1.5 para justificativa detalhada; não é streaming de bytes da LLM).
3. **"Texto para Treino" vira aba do painel de IA.** O `AiPrescribePanel` atual é consolidado como uma das abas do novo painel. O `BuilderViewMode 'ai_prescribe'` e o botão `FileText` separado na barra de ações são removidos.
4. **`/prescribe` vira redirect.** A rota `/students/[id]/prescribe/*` redireciona (301/308) para `/students/[id]/program/new?mode=ai` imediatamente. Não há dual-run.

## 3. Arquitetura alvo em uma frase

No construtor, um botão primário **"✨ Gerar com IA"** abre um painel lateral direito (~440px) com duas abas: **"A partir do aluno"** (o stepper do `/prescribe` atual) e **"A partir de texto"** (o `AiPrescribePanel` atual). Ao gerar, o canvas à esquerda é preenchido aula por aula em tempo real. Pós-geração, o painel se reduz a um botão "Ajustar com IA" (Fase 3) e ações por aula ficam disponíveis no menu de cada aula (Fase 4).

## 4. Invariantes que valem para todas as fases

Todas as specs respeitam as regras abaixo — se alguma fase parecer violar, **pare e reporte antes de executar**:

1. **Nenhuma mudança de schema de banco na Fase 1 ou 1.5.** Tabelas (`assigned_programs`, `assigned_workouts`, `workout_item_templates`, `prescription_generations`) permanecem como estão. Só as Fases 3 e 4 podem exigir migração, se necessário.
2. **Nada de refactor "while we're at it".** Se encontrar código feio vizinho ao que precisa mudar, deixe como está e abra uma task separada. Specs são cirúrgicas.
3. **Preserve o comportamento funcional do fluxo `/prescribe` atual.** A Fase 1 move a UI, mas os mesmos treinamentos que eram geráveis antes precisam ser geráveis depois — mesmo contexto, mesmos inputs, mesmo output salvo.
4. **`?source=prescription&generationId=...` continua funcionando.** Links/deeplinks existentes precisam abrir corretamente (o construtor vê o `generationId`, hidrata como hoje). Na nova UI, isso equivale a "pessoa veio de um deeplink com programa já gerado" — o painel abre no estado pós-geração.
5. **Feature flag `trainer.ai_prescriptions_enabled`** continua governando visibilidade do botão "Gerar com IA". Se `false`, painel e botão não aparecem.
6. **Testes.** Toda fase entrega testes: componentes com Vitest/RTL quando houver lógica; smoke e2e (Playwright se existir; senão, testes de integração em nível de client) pra garantir que o treinador gera um programa ponta a ponta.
7. **i18n.** Todas as strings user-facing em pt-BR. Se houver i18n infra no projeto, usar; senão, strings literais como hoje. Não introduzir i18n lib nesta migração.

## 5. Glossário de nomes

Os nomes abaixo são os **nomes-alvo** (vocês vão criar ou renomear para bater com eles). Onde eu escrevi "novo", significa arquivo a ser criado.

| Nome | Papel | Onde |
|---|---|---|
| `AiPrescriptionPanel` (novo) | Painel lateral principal de IA no construtor. Renderiza as abas. | `web/src/components/programs/ai-prescription-panel.tsx` |
| `AiPrescriptionPanelStudentTab` (novo) | Aba "A partir do aluno". Conteúdo migrado de `PrescribeClient`. | `web/src/components/programs/ai-prescription-panel/student-tab.tsx` |
| `AiPrescriptionPanelTextTab` (novo) | Aba "A partir de texto". Wrapper do `AiPrescribePanel` atual. | `web/src/components/programs/ai-prescription-panel/text-tab.tsx` |
| `usePrescriptionAgent` (novo hook) | Encapsula estado do stepper (profile → analyze → questions → generate) para ser reusado no painel. | `web/src/components/programs/ai-prescription-panel/use-prescription-agent.ts` |
| `AiPrescribePanel` (existente, renomear no Fim da Fase 2) | Painel leve de "Texto para Treino" atual. Permanece até Fase 2; lá vira conteúdo interno da `TextTab`. | `web/src/components/programs/ai-prescribe-panel.tsx` |
| `ProgramBuilderClient` | Já existe. Ganha o botão "Gerar com IA" e hospeda o `AiPrescriptionPanel`. | `web/src/components/programs/program-builder-client.tsx` |
| `PrescribeClient` | Já existe. Após Fase 1, fica orfão e a rota `/prescribe` vira redirect; pode ser deletado no fim da Fase 1 ou mantido como referência por 1 sprint. | `web/src/app/students/[id]/prescribe/prescribe-client.tsx` |

## 6. Ordem de execução das specs

| # | Spec | Depende de | Notas |
|---|---|---|---|
| 1 | `01-fase-1-embutir-painel-ia.md` | — | Coração do pedido. Fecha o migração de UI. |
| 2 | `02-fase-1.5-streaming-parcial.md` | Fase 1 | Pode ir junto na mesma PR se o timing ajudar; recomendo PR separada pra isolar risco. |
| 3 | `03-fase-2-unificar-texto-para-treino.md` | Fase 1 | Pode rodar em paralelo com Fase 1.5 (outro dev) pois mexem em partes diferentes. |
| 4 | `04-fase-3-ajustar-com-ia.md` | Fases 1 e 1.5 | Alto nível. Exige novas actions/tools. |
| 5 | `05-fase-4-ia-por-aula.md` | Fase 3 | Alto nível. Reusa infra de "Ajustar com IA". |

Specs 4 e 5 são **alto-nível** por desenho — o objetivo delas é capturar intenção e contratos, não passo-a-passo. Quando chegarmos lá, cada uma vira uma spec detalhada própria.

## 7. Como o Claude Code deve consumir cada spec

Cada arquivo de fase tem esta estrutura:

- **Objetivo & escopo** — o que faz e (igualmente importante) o que **não** faz.
- **Arquivos a tocar** — lista concreta com papel de cada um.
- **Passos de execução** — ordenados, com critérios de aceitação em cada passo.
- **Testes obrigatórios** — nada merge sem esses verdes.
- **Checklist final** — rodar antes de abrir PR.
- **Armadilhas conhecidas** — pontos onde o agente já sabe que o código é sutil.

Leia o arquivo inteiro antes de começar. Se algum passo quebrar uma invariante da seção 4 acima, pare e reporte.
