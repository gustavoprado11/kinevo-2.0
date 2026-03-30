# Correção de Testes Quebrados — Módulo Prescription

## Status
- [x] Rascunho
- [x] Em implementação
- [x] Concluída

## Contexto

Ao rodar `npx vitest run` no repositório web, 2 testes pré-existentes no módulo `prescription/` falham:

1. **Missing `constants` module** — um teste importa um módulo `constants` que não existe ou foi movido/renomeado
2. **No-suite error** — um arquivo de teste está vazio ou mal estruturado (sem `describe`/`it` blocks)

Esses testes já estavam quebrados antes da implementação de vídeos custom — não são regressões, mas precisam ser corrigidos para que o `vitest run` rode 100% limpo.

## Objetivo

Fazer todos os testes do módulo `prescription/` passarem, garantindo que o `vitest run` no repo web finalize com zero falhas.

## Escopo

### Incluído
- Diagnosticar e corrigir o erro de módulo `constants` ausente
- Diagnosticar e corrigir o erro de suite vazia (no-suite)
- Garantir que os testes corrigidos validem lógica real (não simplesmente deletar os testes)

### Excluído
- Escrever novos testes para o módulo de prescrição além dos já existentes
- Refatorar o motor de prescrição IA
- Alterar lógica de negócio do módulo

## Arquivos Afetados

> **Investigar:** Localizar os arquivos de teste que falham dentro do diretório `prescription/`. Pontos de partida:
> - Buscar arquivos `*.test.ts` ou `*.spec.ts` dentro de pastas relacionadas a `prescription` no repo web
> - Rodar `npx vitest run` e analisar o stack trace das 2 falhas para identificar os arquivos exatos
> - Verificar se o módulo `constants` foi renomeado, movido ou refatorado em algum commit recente

## Comportamento Esperado

### Diagnóstico

1. Rodar `npx vitest run` e capturar o output completo das falhas
2. Para cada falha, identificar:
   - Arquivo de teste que falha
   - Módulo/importação que está quebrado
   - Causa raiz (arquivo movido? renomeado? deletado? export removido?)

### Correção

**Cenário A — Módulo `constants` foi movido/renomeado:**
- Atualizar o import no arquivo de teste para apontar pro path correto

**Cenário B — Módulo `constants` foi deletado e a lógica migrou pra outro lugar:**
- Atualizar o teste para importar do novo local
- Verificar se os valores/funções testados ainda existem; se mudaram, adaptar os assertions

**Cenário C — Arquivo de teste vazio (no-suite):**
- Se o teste foi esvaziado intencionalmente (feature refatorada): deletar o arquivo
- Se o teste deveria ter conteúdo: reconstruir os testes baseado na lógica atual do módulo que ele deveria testar

### Resultado Final

- `npx vitest run` no repo web: **todas as suites passando, zero falhas**

## Critérios de Aceite

- [ ] As 2 falhas pré-existentes no módulo `prescription/` estão corrigidas
- [ ] `npx vitest run` finaliza com zero falhas no repo web
- [ ] Testes corrigidos validam lógica real (não são stubs vazios)
- [ ] Nenhum teste de outros módulos foi afetado
- [ ] Sem novos erros de TypeScript

## Restrições Técnicas

- Seguir convenções documentadas no `CLAUDE.md`
- Mudanças cirúrgicas — corrigir apenas o necessário para os testes passarem
- Não alterar lógica de negócio do motor de prescrição
- Se um teste referencia lógica que não existe mais, adaptar o teste à lógica atual — não inventar lógica nova pra satisfazer o teste antigo
- Manter o padrão de mocks e estrutura de testes estabelecido na spec anterior (Supabase mocks em helpers reutilizáveis se aplicável)

## Edge Cases

- Se o módulo `constants` foi intencionalmente inlined (valores movidos para dentro das funções), o teste pode precisar ser reescrito para testar a função diretamente em vez de testar constantes exportadas
- Se o arquivo no-suite era um placeholder pra testes futuros, deletar e registrar nas Notas de Implementação o motivo

## Referências

- Output do `npx vitest run` mostrando as falhas
- Histórico git do módulo `prescription/` para entender quando as mudanças quebraram os testes (`git log --oneline -- '**/prescription/**'`)

## Testes Requeridos

### Lógica Pura (unitários — obrigatório)
Não há novos testes a criar — o objetivo é corrigir os existentes.
- [ ] Testes corrigidos passam e validam a lógica atual do módulo

### Server Actions / Queries
Não se aplica a esta spec.

### Componentes
Não se aplica a esta spec.

## Notas de Implementação

### Diagnóstico

**Falha 1 — `rules-engine.test.ts`:**
- Causa raiz: `require('../constants')` na linha 639 falha em ambiente ESM do Vitest
- O módulo `constants.ts` existe e exporta `calcExercisesPerWorkout` normalmente
- Além disso, o arquivo usava padrão custom `assert`/`section` sem `describe`/`it`, causando "No test suite found" parcial

**Falha 2 — `generate-program-e2e.test.ts`:**
- Causa raiz: arquivo inteiro usa padrão custom `assert`/`section` sem nenhum `describe`/`it`
- Vitest corretamente rejeita: "No test suite found in file"
- Ambos os arquivos foram originalmente escritos para rodar com `npx tsx` direto

### Correção aplicada

Ambos os arquivos foram convertidos de padrão custom `assert`/`section`/`process.exit` para padrão Vitest nativo (`describe`/`it`/`expect`):

- `require('../constants')` → `import { calcExercisesPerWorkout } from '../constants'`
- Cada `section(...)` → `describe(...)`
- Cada bloco `{ assert(...) }` → `it(..., () => { expect(...) })`
- Removidos: contadores `passed`/`failed`, funções `assert`/`section`, bloco `process.exit`
- Todas as mesmas validações de lógica real foram preservadas (volume, restrições, PPL+, prompt builder, etc.)

### Resultado

- `npx vitest run`: **5 suites, 68 testes, zero falhas**
- Nenhum teste de outros módulos afetado
- Nenhum erro novo de TypeScript