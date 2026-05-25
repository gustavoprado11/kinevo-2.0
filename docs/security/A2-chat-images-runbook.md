# A2 — Fechar exposição das imagens do chat (bucket público → privado + signed URLs)

**Severidade:** ALTO (PII — fotos privadas trainer↔aluno acessíveis por qualquer um com a URL)
**Status:** Fundação aplicada (não-quebrável). Flip final pendente de release do mobile.

## Problema

O bucket de storage `messages` é `public = true` e `messages.image_url` guarda a **URL pública completa**. URLs no formato `/storage/v1/object/public/messages/{student_id}/{arquivo}` **ignoram RLS** — qualquer pessoa (sem login) com a URL lê a foto. Mitigante: o nome do arquivo é UUID aleatório gerado no servidor, então não é enumerável; o risco é vazamento/compartilhamento da URL.

## Por que é faseado

Fechar o bucket é quebra dura:
1. Todas as `image_url` públicas históricas viram 404.
2. Apps mobile **já instalados** leem `image_url` direto como URL e não sabem gerar signed URL.

Logo: shippar clientes que usam signed URLs → forçar update do mobile → só então virar o bucket.

## Fase 1 — Fundação (FEITO, aplicado em prod, não-quebrável)

- **Migration `163_messages_image_signed_url_foundation.sql`** (aplicada):
  - Corrige a policy morta `messages_owner_select` (storage.objects) — antes comparava a pasta com `auth.uid()`, mas a pasta é `student_id`; agora resolve `student_id → aluno dono OU coach`. Sem efeito enquanto o bucket é público; deixa o flip pronto.
  - Adiciona `messages.image_path` (path do objeto) e faz backfill a partir das `image_url` existentes.
- **App (dual-write):** uploads agora gravam `image_path` junto com `image_url`:
  - Web: `web/src/app/messages/actions.ts`
  - Mobile: `mobile/hooks/useTrainerChat.ts`
- **Tipos:** `shared/types/database.ts` atualizado com `image_path` no bloco `messages`.

Nada quebra: bucket segue público, `image_url` segue funcionando para todos os clientes.

## Fase 2 — Leitura via signed URL (a fazer, ainda com bucket público)

Objetivo: novos clientes (web + mobile) param de depender da URL pública e passam a renderizar via signed URL gerada a partir de `image_path`.

1. Helper de leitura que, dado um registro de mensagem, prefere `image_path` → `createSignedUrl('messages', image_path, 3600)`; fallback para `image_url` (mensagens antigas sem path, embora o backfill já cubra a maioria).
   - Signed URL funciona mesmo em bucket público — pode shippar antes do flip.
2. Web: gerar signed URLs no server (Server Component / action que lista mensagens) — já roda com a sessão do usuário, então a policy de SELECT corrigida autoriza.
3. Mobile: gerar signed URL no client via `supabase.storage.from('messages').createSignedUrl(...)`.
4. **Forçar atualização mínima do app** (min supported version) para garantir que não há cliente lendo `image_url` cru depois do flip.

## Fase 3 — Flip final (a fazer, APÓS Fase 2 + update forçado)

1. Confirmar via analytics/telemetria que praticamente não há clientes em versão pré-Fase-2.
2. Virar o bucket: `UPDATE storage.buckets SET public = false WHERE id = 'messages';`
   (ou via dashboard). A partir daqui a policy `messages_owner_select` (já corrigida) passa a valer.
3. Verificar: aluno e coach conseguem ver imagens; terceiro sem sessão recebe 403; URLs públicas antigas deixam de resolver (esperado — clientes novos usam signed URL via `image_path`).
4. (Opcional) limpar `image_url` das linhas que já têm `image_path`, deixando só o path.

## Checklist de verificação pós-flip

- [ ] Aluno A vê as próprias imagens do chat (signed URL ok).
- [ ] Coach do aluno A vê as imagens do aluno A.
- [ ] Aluno B (outro) NÃO acessa imagem do aluno A nem com a URL pública antiga.
- [ ] Requisição anônima ao caminho público antigo → 403/404.
- [ ] Upload novo (web e mobile) grava `image_path` e renderiza via signed URL.
