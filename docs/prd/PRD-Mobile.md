# PRD - Kinevo 2.0 (Mobile App)

**Versão:** 1.0
**Status:** Em Desenvolvimento
**Plataforma:** iOS (Principal) & Android
**Usuário Alvo:** Alunos (Students)

## 1. Visão do Produto
O aplicativo Kinevo Mobile é a interface de execução para o aluno. Enquanto o treinador prescreve na Web, o aluno usa o App para visualizar, executar e registrar os dados do treino, eliminando o uso de planilhas e PDFs. O foco é **usabilidade extrema** durante a prática de exercícios físicos (mãos suadas, ambiente de academia, pouco tempo).

## 2. Objetivos do MVP
1. Permitir que o aluno faça login seguro.
2. Exibir claramente o Programa de Treino ativo e os Treinos disponíveis (A, B, C).
3. Oferecer um "Player de Treino" fluido para registro de cargas, repetições e RPE.
4. Garantir que o aluno nunca perca dados, mesmo se a internet oscilar (Estratégia Offline-First leve).

---

## 3. Especificações Funcionais

### 3.1. Autenticação & Onboarding (Invited Access)

O acesso ao App é exclusivamente por convite. O treinador cadastra o aluno pelo sistema Web, que gera um e-mail e uma senha provisória. O aluno recebe as credenciais via WhatsApp.

#### 3.1.1. Login Inicial
* **Campos:** E-mail e Senha (credenciais provisórias recebidas do treinador).
* **Validação de Campos:** Se vazios, exibir Alert "Campos incompletos".
* **Erro de Login:** Mensagem clara e acionável (ex: "Credenciais inválidas. Verifique com seu treinador.").
* **Sem Cadastro:** Link "Ainda não tem acesso?" apontando para página de marketing/explicação do fluxo.
* **Sessão:** Token JWT persistido via SecureStore. Sessão mantida entre sessões do app (auto-refresh).

#### 3.1.2. Verificação de E-mail (Fluxo de Segurança Pós-Login)
Após o login bem-sucedido, o App verifica o campo `email_confirmed_at` do usuário no Supabase Auth.

* **Se `email_confirmed_at` IS NOT NULL:** Acesso liberado, redireciona para a Home.
* **Se `email_confirmed_at` IS NULL:** Acesso à Home **bloqueado**. O aluno é direcionado para o fluxo de verificação:

**Tela 1 - Confirmação de E-mail:**
* Exibe: "Este é o seu e-mail atual?" com o e-mail do aluno em destaque.
* **Opção A: "Sim, enviar código"**
    * Dispara o envio de OTP (código de 6 dígitos) para o e-mail via `supabase.auth.signInWithOtp()`.
    * Navega para a Tela de OTP.
* **Opção B: "Não, trocar e-mail"**
    * Abre campo para o aluno inserir o e-mail correto.
    * Atualiza o e-mail no Supabase Auth (`supabase.auth.updateUser()`) e na tabela `students`.
    * Após atualização, dispara o envio do OTP para o novo e-mail.
    * Navega para a Tela de OTP.

**Tela 2 - Input de OTP:**
* Input para digitar o código de 6 dígitos recebido no e-mail.
* Validação via `supabase.auth.verifyOtp()`.
* Link "Reenviar código" com cooldown de 60 segundos.
* **Sucesso:** `email_confirmed_at` é preenchido automaticamente pelo Supabase. Redireciona para a Home.
* **Erro:** Mensagem clara (ex: "Código inválido ou expirado. Tente novamente.").

#### 3.1.3. Fluxo Resumido
```
[Aluno recebe credenciais via WhatsApp]
        ↓
[Tela de Login] → (credenciais inválidas) → [Erro + orientação]
        ↓ (login OK)
[Verifica email_confirmed_at]
        ↓                          ↓
  (verificado)              (não verificado)
        ↓                          ↓
    [Home]              [Tela: Confirmar E-mail]
                           ↓                ↓
                    ("Sim, enviar")   ("Não, trocar")
                           ↓                ↓
                        [Envia OTP]   [Atualiza e-mail → Envia OTP]
                           ↓                ↓
                        [Tela de OTP] ←─────┘
                           ↓
                    (codigo valido)
                           ↓
                        [Home]
```

### 3.2. Home (Dashboard do Aluno)
* **Resumo:** Card principal mostrando o programa atual (ex: "Hipertrofia - Fase 1").
* **Lista de Treinos:** Carrossel ou lista vertical dos treinos disponíveis (A, B, C).
    * Cada card deve mostrar: Nome (Treino A), Foco (Peito e Tríceps), Duração estimada.
* **Navegação:** Tab Bar inferior com: `Home`, `Histórico`, `Perfil`.

### 3.3. Player de Treino (Core Feature)
Ao clicar em um treino, o aluno entra no modo "Execução".
* **Lista de Exercícios:** Exibição ordenada conforme prescrição.
* **Card de Exercício:**
    * Nome do exercício.
    * Link/Botão para vídeo demonstrativo (modal ou webview).
    * Observações técnicas do treinador.
* **Input de Séries (Logging):**
    * Campos para: `Carga (kg)`, `Reps Realizadas`, `RPE (0-10)`.
    * **Feature Chave - Histórico:** O campo de carga deve vir pré-preenchido com a carga usada na *última vez* que esse exercício foi feito.
    * **Check de Conclusão:** Checkbox ou botão para marcar a série como feita. Aciona timer de descanso (opcional).
* **Finalização:** Botão "Concluir Treino" que salva o sumário da sessão.

### 3.4. Histórico
* Lista cronológica de treinos realizados.
* Detalhe do treino: Data, duração e volume total levantado (opcional).

---

## 4. Requisitos Técnicos (Tech Stack)

* **Framework:** React Native (via Expo Managed Workflow).
* **Linguagem:** TypeScript (Strict mode).
* **Navegação:** Expo Router (File-based routing).
* **Estilização:** NativeWind (TailwindCSS) + Componentes acessíveis.
* **Backend:** Supabase (Auth & Database).
* **Gerenciamento de Estado:**
    * React Query (TanStack Query) para cache e sincronização de dados.
    * Context API / Zustand para estado global de sessão.
* **Ícones:** Lucide React Native ou Expo Vector Icons.

## 5. Diretrizes de UI/UX (Design System)

* **Tema:** Dark Mode por padrão (foco em economia de bateria e ambiente de academia).
* **Cores:**
    * Background: `bg-slate-950` (Quase preto).
    * Primary: `text-purple-500` / `bg-purple-600` (Ação).
    * Surface: `bg-slate-900` (Cards).
    * Text: `text-slate-50` (Títulos), `text-slate-400` (Labels).
* **Tipografia:** San Francisco (iOS System font), pesos variados para hierarquia.
* **Interações:**
    * Botões grandes (mínimo 44px de altura) para toque fácil.
    * Feedback tátil (Haptics) ao concluir uma série.

## 6. Estrutura de Dados (Referência Rápida)
*O App deve consumir os tipos gerados em `@kinevo/shared`.*
* `students`: Perfil do usuário.
* `assigned_programs`: Programa ativo.
* `workouts`: A rotina (A, B, C).
* `workout_items`: Os exercícios dentro da rotina.
* `workout_sessions`: O registro de um treino iniciado.
* `workout_logs`: O registro de cada série (carga/reps).

---