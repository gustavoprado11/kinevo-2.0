# Carteira Kinevo (Asaas) — Setup passo a passo

Este guia é para o Gustavo (não-dev) ativar a Carteira Kinevo do zero, em **sandbox** primeiro e depois em **produção**. Cada bloco tem o que fazer, qual comando rodar, e o que esperar.

> **Pré-requisito único**: você já tem CNPJ Kinevo aberto e uma conta no Asaas associada a ele.

---

## Visão geral em 7 passos

1. **Ativar Marketplace** na conta Asaas (1 ticket pro suporte).
2. **Pegar API key** e **walletId** da conta principal.
3. **Configurar variáveis de ambiente** (`.env.local` em dev, Vercel em prod).
4. **Aplicar migration 132** no Supabase.
5. **Cadastrar webhook URL** no painel Asaas.
6. **Rodar smoke test** (script que valida tudo automaticamente).
7. **Beta com 1 treinador real** (você mesmo) antes de abrir pra base.

Tempo total estimado: **2-3 horas de trabalho seu**, em 1-2 dias (espera-se Asaas aprovar Marketplace em <24h).

---

## Passo 1 — Habilitar Marketplace na conta Asaas

A funcionalidade de "criar subcontas via API" às vezes precisa ser habilitada manualmente pelo Asaas. **Faça isso primeiro**, pois pode levar até 24h.

**Como verificar se já está habilitado:**
1. Entre em https://www.asaas.com (production) ou https://sandbox.asaas.com (sandbox).
2. Menu lateral → **Integrações** → **Subcontas**.
3. Se aparecer a opção "Criar subconta" + tabela de subcontas → **já está habilitado**, pula pro passo 2.
4. Se não aparecer ou aparecer mensagem "entre em contato com o suporte" → **siga o script abaixo**.

**Script pro suporte (copia, cola, envia via chat ou email `atendimento@asaas.com`):**

> Olá,
> Sou Gustavo Prado, titular do CNPJ XX.XXX.XXX/0001-XX (Kinevo). Preciso habilitar a funcionalidade de **Marketplace / Subcontas via API** na minha conta, tanto sandbox quanto produção.
>
> Caso de uso: SaaS para personal trainers. Cada treinador terá sua própria subconta Asaas (uma por trainer, criada via API com KYC delegado a vocês). O dinheiro entra direto na subconta de cada treinador, e ele saca via PIX out (transferência) quando quiser.
>
> Volume esperado nos primeiros 12 meses: ~1.000 treinadores ativos, ticket médio ~R$ 250, GMV estimado R$ 24M/ano.
>
> Podem me confirmar que a funcionalidade está habilitada e me passar os recursos / limites do contrato? Obrigado.

**Espera-se**: resposta em até 24h úteis confirmando a ativação.

---

## Passo 2 — Pegar API key e walletId (Sandbox primeiro)

> **Sempre comece em sandbox.** Trocamos pra produção só no Passo 7.

1. Entre em https://sandbox.asaas.com.
2. Crie uma conta de teste se ainda não tiver (pode usar email pessoal, sandbox aceita).
3. Menu lateral → **Integrações** → **API**.
4. Clique em **Gerar nova API Key** se ainda não houver. Copie o valor (algo como `$aact_YTU5YTE0M2M2N...`).
5. Na mesma tela, copie também o **walletId** (UUID, ex: `abc12345-6789-...`).

**Salve em local seguro** — você vai usar nos próximos passos. Estas duas strings são as credenciais da conta **principal** Kinevo (o "marketplace operator").

---

## Passo 3 — Configurar variáveis de ambiente

### 3.1 Gerar as duas chaves locais (encryption + webhook)

No terminal do seu Mac:

```bash
# Chave de criptografia das apiKeys de subconta (AES-256 — 32 bytes)
openssl rand -base64 32
# → cole o resultado em ASAAS_ENCRYPTION_KEY abaixo

# Token compartilhado com o webhook Asaas
openssl rand -hex 32
# → cole o resultado em ASAAS_WEBHOOK_TOKEN abaixo
```

> **Guarde ambos em um cofre de senhas (1Password, Bitwarden, etc).**
> Se você perder a `ASAAS_ENCRYPTION_KEY`, **perde acesso às apiKeys de TODOS os treinadores** — não tem como recuperar.

### 3.2 Criar `web/.env.local` (desenvolvimento)

No diretório `web/` do projeto, crie um arquivo `.env.local` com:

```env
# --- Já existentes (mantenha como está) ---
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
STRIPE_SECRET_KEY=...
# ... outras vars do seu .env atual ...

# --- Novas para Carteira Kinevo (Asaas) ---
ASAAS_ENV=sandbox
ASAAS_MAIN_API_KEY=$aact_YTU5YTE0M2M2N...   # do passo 2
ASAAS_KINEVO_WALLET_ID=abc12345-6789-...     # do passo 2
ASAAS_WEBHOOK_TOKEN=cole-aqui-o-openssl-rand-hex-32
ASAAS_ENCRYPTION_KEY=cole-aqui-o-openssl-rand-base64-32
KINEVO_TAKE_RATE_PCT=0
```

### 3.3 Para produção (depois do beta)

Quando chegar no passo 7, repita o mesmo processo em **app.asaas.com** (produção) e cadastre as variáveis no Vercel:

```bash
cd web
npx vercel env add ASAAS_ENV         # cole "production"
npx vercel env add ASAAS_MAIN_API_KEY # cole a API key de prod
npx vercel env add ASAAS_KINEVO_WALLET_ID
npx vercel env add ASAAS_WEBHOOK_TOKEN
npx vercel env add ASAAS_ENCRYPTION_KEY
npx vercel env add KINEVO_TAKE_RATE_PCT  # cole "0" inicialmente
```

> Comece com **take rate 0%**. Cobre só a mensalidade SaaS. Take rate entra depois de validar adoção.

---

## Passo 4 — Aplicar a migration no Supabase

A migration `supabase/migrations/132_asaas_wallet.sql` cria 3 tabelas novas e estende 3 existentes. **É 100% aditiva** — não toca em nada que já funciona.

### 4.1 Em dev (Supabase local ou projeto separado)

```bash
# Se você tem Supabase CLI configurado:
cd /Users/gustavoprado/kinevo
supabase db push

# Ou via psql conectado direto (placeholder — troque SUA_SENHA e SEU_PROJETO):
export DATABASE_URL="postgresql://postgres:SUA_SENHA@db.SEU_PROJETO.supabase.co:5432/postgres" # placeholder
psql "$DATABASE_URL" -f supabase/migrations/132_asaas_wallet.sql
```

### 4.2 Conferir que as tabelas foram criadas

```bash
psql "..." -c "\\dt trainer_payment_accounts pix_keys payouts"
```

Esperado: 3 linhas, todas existindo.

### 4.3 Regenerar tipos TypeScript

```bash
cd /Users/gustavoprado/kinevo
SUPABASE_PROJECT_REF=seu-project-ref npm run gen:types
```

Isso atualiza `shared/types/database.ts` com as novas tabelas.

---

## Passo 5 — Cadastrar webhook URL no painel Asaas

1. Em sandbox.asaas.com (depois em app.asaas.com pra prod), menu lateral → **Integrações → Webhooks**.
2. **Adicionar webhook**:
   - **URL**: `https://www.kinevoapp.com/api/webhooks/asaas` (use `www.` — sem ele a Vercel redireciona e o Asaas não segue redirect).
   - Em dev local, use https://NGROK_OR_LOCAL_TUNNEL.ngrok.io/api/webhooks/asaas — vamos rodar `ngrok` localmente.
   - **Token de acesso**: cole o `ASAAS_WEBHOOK_TOKEN` que você gerou no passo 3.1.
   - **Eventos**: marque TODOS de Payment, Transfer e Account.
3. Salve. O Asaas faz um ping de teste — deve responder 200.

### Dev local com ngrok

Em uma janela de terminal:

```bash
brew install ngrok           # se ainda não tiver
ngrok http 3000              # expõe seu localhost:3000
# → copie o https://abc123.ngrok-free.app
```

Cadastre `https://abc123.ngrok-free.app/api/webhooks/asaas` como URL de webhook no painel sandbox.

---

## Passo 6 — Smoke test (validação automatizada)

O script `scripts/asaas-smoke-test.ts` faz o ciclo completo end-to-end em sandbox:

1. Cria uma subconta de treinador fake.
2. Cria um customer (aluno) dentro dela.
3. Cria uma cobrança PIX de R$ 1,00.
4. Simula o pagamento pelo aluno (Asaas oferece endpoint de simulação).
5. Confere que o webhook chegou (lê do banco).
6. Cria uma chave PIX e solicita saque.
7. Confere que o saque foi para "processing".
8. Imprime ✅ ou ❌ em cada etapa.

```bash
cd /Users/gustavoprado/kinevo/web
npm run dev   # em uma janela (Next.js + ngrok configurado)
```

Em outra janela:

```bash
cd /Users/gustavoprado/kinevo/web
npx tsx scripts/asaas-smoke-test.ts
```

Se todas as 8 etapas marcarem ✅, **a Carteira está funcionando**. Se algo der ❌, o script mostra o passo + payload do erro do Asaas — encaminhe pra mim que eu corrijo.

> O script `scripts/asaas-smoke-test.ts` está pronto no projeto. Não precisa editar nada.

---

## Passo 7 — Go-live em produção

Faça **APENAS DEPOIS** do smoke test ✅ em sandbox.

1. **Em app.asaas.com (produção)**, repita os passos 2 (gerar API key + walletId) e 5 (cadastrar webhook URL — desta vez `https://www.kinevoapp.com/api/webhooks/asaas`).
2. **No Vercel**, configure as 5 envs de produção (passo 3.3).
3. **Aplique a migration 132** no Supabase **de produção** (mesmo comando do passo 4, apontando para o projeto de prod).
4. **Faça deploy**:
   ```bash
   git push origin feat/asaas-wallet
   # → abra um PR pra main; após review, merge.
   # → Vercel faz deploy automático em ~2 min.
   ```
5. **Smoke test em produção com a SUA própria conta**:
   - Ative sua Carteira Kinevo no painel (vai aparecer "Ativar Carteira").
   - Crie uma cobrança PIX de R$ 1,00 pra você mesmo (use um aluno de teste).
   - Pague pelo seu app de banco.
   - Confira que o webhook atualizou.
   - Saque R$ 1,00 pra sua chave PIX.
6. **Se tudo funcionou, convide 5 treinadores beta** (de preferência amigos próximos) e observe por 1-2 semanas antes de abrir pra base inteira.

---

## Troubleshooting

### "Asaas did not return apiKey on account creation"
A conta principal não está em modo Marketplace. Volte ao passo 1.

### "ASAAS_ENCRYPTION_KEY must decode to 32 bytes"
Você gerou com `openssl rand -hex 32` (errado). Gere com `openssl rand -base64 32`.

### Webhook não chega
- URL com `www.` (sem ele a Vercel redireciona e Asaas não segue).
- Token de acesso bate exatamente com `ASAAS_WEBHOOK_TOKEN` (sem espaços).
- Em dev: ngrok rodando + URL ngrok cadastrada.

### "Carteira não ativada" (409)
O treinador ainda não fez onboarding ou está em status diferente de `approved`. Use `POST /api/wallet/sync` pra forçar refresh.

### KYC do treinador travado em `awaiting`
SLA do Asaas é 1-3 dias úteis. Se passar disso, peça pra ele entrar em contato com o suporte do Asaas (não tem como Kinevo destravar — análise é deles).

---

## Próximos passos pós go-live

Depois que a Carteira estiver em produção e estável:

- **UI mobile da Carteira** (Expo screens).
- **Anamnese acoplada ao plano** (FK trainer_plans.anamnesis_template_id).
- **Páginas de venda públicas** (`/p/[slug]` com checkout embutido).
- **Dashboard financeiro** (MRR, churn, ticket médio).
- **NF-e automática** via eNotas ou Migrate.
- **Antecipação D+0 opt-in** (Asaas tem endpoint, é só plugar).

Tudo isso está mapeado em `Carteira_Kinevo_Solo_Plano_Execucao.docx` na raiz do projeto.
