# ⚡ KINEVO — Mini Landing Page para Captação de Leads
> **Product Requirements Document (PRD) v1.0 — Confidencial**

| | |
|---|---|
| Versão | 1.0 |
| Status | Planejamento — Implementar após validação do módulo de prescrição |
| Autor | Gustavo — Fundador Kinevo |
| Dependência | Módulo de Forms (já existente em produção) |
| Data | Fevereiro 2026 |

---

## 1. Visão Geral

### 1.1 O Problema

Todo treinador que trabalha online precisa de um link na bio do Instagram que capture leads. O fluxo atual do mercado é manual e fragmentado:

```
Instagram → Linktree/Link na Bio
  → Google Forms ou Typeform
    → Lead chega no e-mail ou planilha
      → Treinador copia dados manualmente para sua ferramenta de gestão
        → Convida aluno para o app
```

Cada etapa é uma ferramenta diferente, um custo separado e uma oportunidade de perder o lead no caminho. O treinador usa 4-5 ferramentas para fazer algo que deveria ser simples.

### 1.2 A Oportunidade

O Kinevo já tem os dois componentes que resolvem esse problema: perfil do treinador e módulo de formulários (Forms). Falta apenas uma camada pública que conecte os dois — uma página acessível sem login, otimizada para conversão, que transforma visitante em lead e lead em aluno dentro do mesmo sistema.

### 1.3 A Proposta de Valor

> *"Seu link da bio vira aluno em 2 cliques — sem Google Forms, sem planilha, sem copiar e colar."*

O diferencial não é a landing page em si. É o fato de que o lead capturado entra diretamente no fluxo de gestão do treinador no Kinevo — sem etapa manual.

### 1.4 Personas

| Persona | Dor Atual | Ganho com o Módulo |
|---|---|---|
| Treinador online (1-30 alunos) | 4-5 ferramentas para captar um lead | Um link, um formulário, lead direto no Kinevo |
| Treinador presencial querendo crescer online | Não sabe criar landing page | Página profissional em 5 minutos |
| Lead/potencial aluno | Formulários longos e genéricos | Experiência fluida, resposta rápida via WhatsApp |

---

## 2. Funcionalidades

### 2.1 Página Pública do Treinador

URL pública acessível sem login: `kinevo.app/p/[slug-do-treinador]`

O slug é gerado automaticamente a partir do nome do treinador (ex: `kinevo.app/p/gustavo-prado`) e pode ser personalizado nas configurações.

**Seções da página:**

**Hero**
- Foto de perfil (já existe no Kinevo)
- Nome do treinador
- Título/especialidade (novo campo: "Personal Trainer · Hipertrofia e Emagrecimento")
- Descrição curta (novo campo: até 280 caracteres)

**Serviços**
- Lista de até 4 serviços com nome, descrição curta e CTA individual
- Cada serviço pode ter CTA diferente: formulário de captação OU link direto para WhatsApp
- Exemplos: "Consultoria Online", "Planilha de Treino", "Mentoria Presencial"

**CTA Principal**
- Botão de destaque configurável: "Quero minha consultoria" → abre formulário OU WhatsApp
- Link do WhatsApp com mensagem pré-configurada pelo treinador

**Rodapé**
- "Gerenciado com Kinevo" — growth orgânico discreto
- Links para redes sociais (Instagram, YouTube — campos opcionais)

### 2.2 Formulário de Captação Integrado

Ao clicar no CTA, o visitante preenche um formulário. Este formulário é criado usando o **módulo de Forms já existente no Kinevo** — sem reescrever nada.

**Fluxo do formulário:**
1. Visitante preenche: nome, e-mail, WhatsApp, objetivo, como conheceu o treinador
2. Submissão cria automaticamente um registro em `form_submissions` (já existe)
3. Notificação em tempo real para o treinador (via `student_inbox_items` — já existe)
4. Treinador recebe alerta: "Novo lead: [Nome] quer [Serviço]"
5. Com 1 clique, treinador convida o lead como aluno no Kinevo

**Campos do formulário padrão** (editáveis pelo treinador via módulo de Forms existente):
- Nome completo *
- E-mail *
- WhatsApp *
- Objetivo principal (seleção: hipertrofia / emagrecimento / performance / saúde)
- Frequência disponível (seleção: 2x / 3x / 4x / 5x+ por semana)
- Como conheceu o treinador
- Mensagem livre (opcional)

### 2.3 Integração WhatsApp

Dois pontos de integração:

**CTA direto para WhatsApp** — botão que abre `wa.me/[número]?text=[mensagem-pre-configurada]`. O treinador configura a mensagem padrão: "Olá [nome do treinador]! Vi seu perfil e tenho interesse na consultoria."

**Pós-formulário** — após submeter o formulário, o aluno vê a opção: "Quer agilizar? Fale diretamente no WhatsApp." Link opcional, configurável pelo treinador.

### 2.4 Painel de Leads

Nova seção em `Configurações → Minha Página → Leads` com:
- Lista de leads capturados (nome, serviço de interesse, data, status)
- Status: Novo / Contatado / Convertido / Descartado
- Botão "Converter em aluno" — pré-preenche o convite com dados do lead
- Botão "Enviar WhatsApp" — abre WhatsApp com número do lead

---

## 3. Configuração pelo Treinador

### 3.1 Localização

`Configurações → Minha Página` — nova seção nas configurações do treinador.

### 3.2 Campos de Configuração

**Perfil público:**
- Slug personalizado (ex: `gustavo-prado`) — validação de unicidade
- Título/especialidade (ex: "Personal Trainer · Corrida e Fortalecimento")
- Bio curta (até 280 caracteres)
- Links de redes sociais (Instagram, YouTube, TikTok)

**Serviços (até 4):**
- Nome do serviço
- Descrição curta
- Tipo de CTA: formulário de captação OU link WhatsApp direto
- Formulário vinculado (seleciona entre os forms existentes do treinador)

**WhatsApp:**
- Número com DDD (ex: 31999999999)
- Mensagem pré-configurada para o CTA direto
- Ativar/desativar botão WhatsApp pós-formulário

**Aparência:**
- Cor de destaque (uma cor — aplicada nos botões e acentos)
- Página ativa/inativa (toggle)

### 3.3 Preview em Tempo Real

A tela de configuração mostra um preview da página ao lado dos campos — o treinador vê como fica enquanto edita, sem precisar abrir a URL pública.

---

## 4. Arquitetura Técnica

### 4.1 Banco de Dados

**Nova tabela: `trainer_pages`**

```sql
CREATE TABLE public.trainer_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL UNIQUE REFERENCES public.trainers(id) ON DELETE CASCADE,

  -- Identidade pública
  slug TEXT NOT NULL UNIQUE,
  specialty TEXT,                    -- "Personal Trainer · Hipertrofia"
  bio TEXT CHECK (char_length(bio) <= 280),
  accent_color TEXT DEFAULT '#7C3AED', -- Violet Kinevo como padrão

  -- Contato
  whatsapp_number TEXT,
  whatsapp_message TEXT DEFAULT 'Olá! Vi seu perfil e tenho interesse na consultoria.',

  -- Redes sociais
  instagram_url TEXT,
  youtube_url TEXT,
  tiktok_url TEXT,

  -- Serviços (JSONB — até 4 itens)
  services JSONB DEFAULT '[]'::jsonb,
  -- Formato: [{ "name": "Consultoria Online", "description": "...", "cta_type": "form|whatsapp", "form_template_id": "uuid" }]

  -- Controle
  is_active BOOLEAN NOT NULL DEFAULT false,
  page_views INTEGER NOT NULL DEFAULT 0,
  leads_count INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Nova coluna em `form_submissions`:**

```sql
ALTER TABLE public.form_submissions
  ADD COLUMN source_page_slug TEXT,      -- De qual página veio o lead
  ADD COLUMN lead_status TEXT DEFAULT 'new'
    CHECK (lead_status IN ('new', 'contacted', 'converted', 'discarded'));
```

### 4.2 Rotas

```
/p/[slug]                    ← Página pública (sem auth)
/p/[slug]/[service-slug]     ← Serviço específico (deep link)

/settings/page               ← Configuração da página (autenticado)
/settings/page/leads         ← Painel de leads (autenticado)
```

### 4.3 Integração com Módulo de Forms Existente

O formulário de captação reutiliza completamente a infraestrutura existente:
- `form_templates` — o treinador cria ou seleciona um form existente
- `form_submissions` — submissões do lead são armazenadas normalmente
- `student_inbox_items` — notificação para o treinador (type: `new_lead`)

**Zero reescrita do módulo de Forms.** A landing page é apenas uma nova superfície de entrada para um sistema que já existe.

### 4.4 Página Pública — Rendering

A rota `/p/[slug]` é um **Server Component estático** com ISR (Incremental Static Regeneration):
- Revalida a cada 60 segundos
- Sem autenticação necessária
- SEO-friendly (meta tags com nome, bio e foto do treinador)
- Open Graph para preview no WhatsApp e redes sociais

```typescript
// app/p/[slug]/page.tsx
export const revalidate = 60

export async function generateMetadata({ params }) {
  const page = await getTrainerPage(params.slug)
  return {
    title: `${page.trainer.name} — ${page.specialty}`,
    description: page.bio,
    openGraph: { images: [page.trainer.avatar_url] }
  }
}
```

---

## 5. Crescimento Orgânico

### 5.1 "Powered by Kinevo"

Rodapé discreto em todas as páginas públicas: `Crie sua página grátis · Kinevo`

Link para página de cadastro do Kinevo com UTM: `?utm_source=trainer-page&utm_medium=footer&utm_campaign=[slug]`

Cada treinador com página ativa é um canal de aquisição passivo.

### 5.2 Rastreamento de Conversão

Para o treinador:
- Visualizações da página (page_views)
- Leads capturados (leads_count)
- Taxa de conversão (leads / views)
- Leads convertidos em alunos pagantes

Para o Kinevo (interno):
- Quantos novos treinadores vieram via footer de páginas existentes
- Qual treinador gera mais leads (benchmark anônimo futuro)

---

## 6. Métricas de Sucesso

### 6.1 Adoção pelo Treinador

| Métrica | Meta em 90 dias |
|---|---|
| Treinadores com página ativa | > 70% dos ativos no Kinevo |
| Tempo médio para configurar a página | < 10 minutos |
| Treinadores que receberam ao menos 1 lead | > 50% dos com página ativa |

### 6.2 Conversão de Leads

| Métrica | Meta |
|---|---|
| Taxa de conversão visitante → lead | > 15% |
| Taxa de conversão lead → aluno Kinevo | > 30% |
| Tempo médio lead → convite enviado pelo treinador | < 24 horas |

### 6.3 Crescimento Orgânico do Kinevo

| Métrica | Meta em 90 dias |
|---|---|
| Novos treinadores via footer das páginas | > 10% dos novos cadastros |
| Páginas indexadas no Google | > 80% das páginas ativas |

---

## 7. Roadmap de Implementação

### Fase 1 — MVP (Semanas 1-3)

> **Objetivo:** Treinador tem página pública funcional com formulário e WhatsApp
> **Critério de sucesso:** Treinador consegue colocar o link da página na bio do Instagram e receber leads no Kinevo

| Tarefa | Estimativa |
|---|---|
| Migração: tabela `trainer_pages` + coluna em `form_submissions` | 1 dia |
| Rota pública `/p/[slug]` com Server Component + ISR | 2 dias |
| Tela de configuração `/settings/page` | 3 dias |
| Integração com módulo de Forms existente | 1 dia |
| Notificação de novo lead via `student_inbox_items` | 1 dia |
| Open Graph / SEO meta tags | 0.5 dia |
| Testes com 2-3 treinadores beta | 1 semana |

### Fase 2 — Painel de Leads (Semanas 4-5)

> **Objetivo:** Treinador gerencia leads e converte em alunos com 1 clique

| Tarefa | Estimativa |
|---|---|
| Painel `/settings/page/leads` com lista e status | 2 dias |
| Botão "Converter em aluno" com pré-preenchimento | 1 dia |
| Analytics básico (views, leads, conversão) | 1 dia |
| "Powered by Kinevo" no rodapé + UTM tracking | 0.5 dia |

### Fase 3 — Crescimento (Semanas 6-8)

> **Objetivo:** A página vira canal de aquisição para o Kinevo

| Tarefa | Estimativa |
|---|---|
| Slug personalizado com validação de unicidade | 1 dia |
| Preview em tempo real na tela de configuração | 2 dias |
| Indexação Google (sitemap dinâmico) | 1 dia |
| Dashboard de conversão para o treinador | 2 dias |
| Domínio custom (ex: `treinador.seudominio.com`) | Fase futura |

---

## 8. O Que Não Fazer na V1

| Funcionalidade | Por quê não agora |
|---|---|
| Editor visual drag-and-drop | Escopo de produto inteiro — 2-3 meses |
| Múltiplas páginas por treinador | Complexidade desnecessária — 1 página resolve 90% dos casos |
| Pagamento integrado na landing page | Stripe Connect já existe para isso — criar fluxo separado gera inconsistência |
| Domínio custom | Infraestrutura complexa (DNS, SSL) — Fase 3 ou posterior |
| Analytics avançado (heatmap, gravação de sessão) | Ferramentas externas fazem melhor (Hotjar, PostHog) |
| Templates visuais múltiplos | Uma página bem feita supera 10 templates mediocres |

---

## 9. Pré-requisitos para Iniciar

- [ ] Módulo de prescrição validado com ao menos 3-5 treinadores beta
- [ ] Módulo de Forms estável em produção (sem bugs conhecidos)
- [ ] Definir slug padrão e política de slugs (reservados, profanos, duplicados)
- [ ] Definir política de moderação (página com conteúdo inadequado)
- [ ] Confirmar que ISR funciona na infraestrutura de deploy atual (Vercel/similar)

---

## 10. Decisões em Aberto

| Decisão | Opções | Recomendação |
|---|---|---|
| URL da página pública | `kinevo.app/p/slug` vs `slug.kinevo.app` | `/p/slug` na v1 — subdomínio na v2 |
| Formulário padrão | Criar um form padrão ou exigir que o treinador crie o seu | Form padrão pré-criado no onboarding — treinador pode customizar depois |
| Moderação de conteúdo | Automática (filtro de palavras) ou manual (denúncia) | Denúncia na v1 — automático na v2 |
| "Powered by Kinevo" | Obrigatório ou opcional (plano pago remove) | Obrigatório na v1 — removível em plano futuro |
| Limite de serviços | 4 fixo ou configurável | 4 fixo na v1 — suficiente para 95% dos casos |

---

*⚡ Kinevo — Mini Landing Page para Captação de Leads | PRD v1.0 | Fevereiro 2026 | Confidencial*
