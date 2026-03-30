# [TÍTULO DA SPEC]

## Status
- [ ] Rascunho
- [ ] Em implementação
- [ ] Concluída

## Contexto
Por que essa mudança é necessária? Qual dor resolve?

## Objetivo
O que deve ser alcançado ao final da implementação?

## Escopo

### Incluído
- (lista do que está dentro do escopo)

### Excluído
- (lista do que NÃO faz parte dessa spec)

## Arquivos Afetados
Lista dos arquivos que provavelmente precisam ser modificados.
(Se você não tem certeza, indique "Investigar" e o executor fará a análise)

## Comportamento Esperado
Descrição detalhada de como o sistema deve se comportar após a implementação.

### Fluxo do Usuário
1. Passo a passo do que o usuário faz/vê

### Fluxo Técnico
1. O que acontece por baixo dos panos

## Critérios de Aceite
- [ ] Critério 1
- [ ] Critério 2
- [ ] Sem novos erros de TypeScript
- [ ] Retrocompatível com funcionalidades existentes
- [ ] Testado no fluxo principal

## Restrições Técnicas
- Seguir convenções documentadas no CLAUDE.md
- Mudanças cirúrgicas — não reescrever código que já funciona
- Manter padrões existentes de naming e estrutura

## Edge Cases
- Caso 1: o que acontece se...
- Caso 2: e quando...

## Testes Requeridos

Priorize testes por camada de retorno:

### Lógica Pura (unitários — obrigatório)
Funções utilitárias, cálculos, resolvers, helpers, validações.
Sem DOM, sem mocks complexos.
- [ ] (listar funções a testar com cenários)

### Server Actions / Queries (quando houver escrita no banco — recomendado)
Ações que envolvem CRUD, integrações externas, ou lógica de negócio.
Mockar Supabase client e dependências externas.
- [ ] (listar actions a testar com cenários)

### Componentes (apenas fluxos críticos de receita — opcional)
Happy path e edge cases de componentes que impactam pagamento, prescrição ou experiência core.
- [ ] (listar componentes a testar com cenários)

> **Não testar:** páginas inteiras, layout, navegação, componentes puramente visuais.

## Referências
- Links, screenshots, conversas relevantes

## Notas de Implementação
(Preenchido pelo executor durante/após a implementação)
