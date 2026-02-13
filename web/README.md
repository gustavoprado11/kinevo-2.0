# Kinevo 2.0 — Web (Treinadores)

Aplicação web para treinadores gerenciarem alunos e prescreverem treinos.

## Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Supabase** (Auth + Database)

## Setup

### 1. Configurar variáveis de ambiente

Copie o arquivo de exemplo e preencha com suas credenciais do Supabase:

```bash
cp .env.example .env.local
```

Edite `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key

# IA (Forms)
OPENAI_API_KEY=sua-openai-api-key
OPENAI_FORMS_MODEL=gpt-4o-mini
FORMS_AI_LLM_ENABLED=true
OPENAI_FORMS_TIMEOUT_MS=12000
```

Notas de configuração de IA:

- `FORMS_AI_LLM_ENABLED=true` ativa chamada ao modelo; com `false`, o sistema usa fallback heurístico local.
- `OPENAI_FORMS_TIMEOUT_MS` define timeout da chamada ao modelo (3000 a 30000 ms).
- Se a OpenAI estiver indisponível, a tela continua funcionando com fallback heurístico.

### 2. Instalar dependências

```bash
npm install
```

### 3. Executar o banco de dados

Antes de rodar a aplicação, execute o schema no Supabase:

1. Acesse o SQL Editor do seu projeto Supabase
2. Cole e execute o conteúdo de `../supabase/migrations/001_initial_schema.sql`

### 4. Criar um usuário de teste

No Supabase Dashboard:

1. Vá em **Authentication → Users**
2. Clique em **Add user → Create new user**
3. Preencha email e senha

> ⚠️ Na primeira vez que o treinador logar, o sistema criará automaticamente o registro na tabela `trainers`.

### 5. Rodar o projeto

```bash
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

## Estrutura do Projeto

```
src/
├── app/
│   ├── login/page.tsx        # Tela de login
│   ├── dashboard/
│   │   ├── page.tsx          # Dashboard (server component)
│   │   └── dashboard-client.tsx  # Dashboard (client component)
│   └── students/
│       └── [id]/page.tsx     # Detalhes do aluno (placeholder)
├── components/
│   └── student-modal.tsx     # Modal de criação de aluno
├── lib/
│   └── supabase/
│       ├── client.ts         # Cliente para componentes client
│       ├── server.ts         # Cliente para componentes server
│       └── middleware.ts     # Helper para middleware
└── middleware.ts             # Proteção de rotas
```

## Fluxo de Autenticação

1. Usuário acessa qualquer rota protegida
2. Middleware verifica se há sessão válida
3. Se não autenticado → redireciona para `/login`
4. Após login → redireciona para `/dashboard`

## Funcionalidades Implementadas

- ✅ Login com email/senha
- ✅ Proteção de rotas
- ✅ Dashboard do treinador
- ✅ Listagem de alunos
- ✅ Criação de alunos
- ✅ Logout

## Próximos Passos

- [ ] Biblioteca de exercícios
- [ ] Builder de programas de treino
- [ ] Atribuição de programas a alunos
- [ ] Histórico de treinos
