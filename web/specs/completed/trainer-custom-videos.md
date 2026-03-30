# Vídeos Custom de Treinadores

## Status
- [x] Rascunho
- [ ] Em implementação
- [ ] Concluída

## Contexto

Treinadores pediram a possibilidade de incluir seus próprios vídeos nos exercícios do Kinevo. Hoje, os exercícios possuem vídeos padrão do catálogo (campo `video_url` na tabela `exercises`), mas muitos treinadores querem mostrar **eles mesmos executando o movimento** para personalizar a experiência do aluno e reforçar sua autoridade profissional.

Essa feature permite que o treinador faça upload de um vídeo ou cole um link externo (YouTube, Vimeo, etc.) e vincule ao exercício. O vídeo custom **substitui** o vídeo padrão do catálogo para todos os alunos daquele treinador.

## Objetivo

Permitir que treinadores adicionem vídeos personalizados a qualquer exercício (do catálogo Kinevo ou custom) via dashboard web. O vídeo custom deve substituir o vídeo padrão em todas as superfícies onde o aluno visualiza o exercício (mobile app, Training Room web, preview de programa).

## Escopo

### Incluído
- Upload de vídeo direto para Supabase Storage (limite: 50MB por arquivo)
- Opção alternativa de colar URL externa (YouTube, Vimeo, links diretos)
- Vinculação do vídeo ao exercício na biblioteca do treinador (escopo global — vale para todos os alunos)
- Aplicável tanto a exercícios do catálogo Kinevo (434+) quanto a exercícios custom criados pelo treinador
- UI de upload/link no dashboard web
- Substituição do vídeo padrão em todas as superfícies do aluno
- Remoção/troca do vídeo custom pelo treinador

### Excluído
- Upload via mobile (Trainer Mode) — fase futura
- Vídeo custom por programa/aluno específico (override granular) — fase futura
- Transcodificação ou compressão server-side de vídeos
- Player custom — usar player nativo do browser/OS
- Moderação automática de conteúdo dos vídeos

## Arquivos Afetados

### Banco de Dados (Supabase)
- **Nova tabela `trainer_exercise_videos`** — armazena a relação treinador × exercício × vídeo
- **Supabase Storage** — novo bucket `trainer-videos` com RLS
- **Nova migration** para tabela e bucket

### Web Dashboard
- **Biblioteca de exercícios** — adicionar ação de "Adicionar vídeo" em cada card/linha de exercício
- **Componente de upload** — novo componente para upload de arquivo ou input de URL
- **Player de preview** — exibir vídeo custom na visualização do exercício
- **Training Room** — resolver vídeo custom ao exibir exercício para o aluno
- **Preview de programa** — idem

### Mobile App
- **Tela de execução do exercício** — resolver vídeo custom em vez do padrão
- **Tela de detalhes do exercício** — idem
- **Hook ou util de resolução de vídeo** — lógica centralizada

### Arquivos específicos: Investigar
> O executor deve analisar o codebase para identificar os arquivos exatos. Pontos de partida:
> - Tabela `exercises` e queries que buscam `video_url`
> - Componentes que renderizam vídeo de exercício (web e mobile)
> - Página da biblioteca de exercícios no dashboard
> - Training Room (web)
> - Telas de workout/execução (mobile)

## Comportamento Esperado

### Fluxo do Treinador (Web Dashboard)

1. Treinador acessa a **Biblioteca de Exercícios** no dashboard
2. Em qualquer exercício (catálogo ou custom), vê um ícone/botão **"Meu vídeo"** (ou similar)
3. Ao clicar, abre um modal/popover com duas opções:
   - **Upload de arquivo:** arrastar ou selecionar um arquivo de vídeo (formatos: MP4, MOV, WebM; limite: 50MB)
   - **Colar link:** input de texto para URL externa (YouTube, Vimeo, link direto)
4. Ao confirmar:
   - Se upload: arquivo vai para Supabase Storage (`trainer-videos/{trainer_id}/{exercise_id}/{filename}`)
   - Se link: URL é salva diretamente
   - Registro criado na tabela `trainer_exercise_videos`
5. O exercício agora mostra um **indicador visual** de que possui vídeo custom (ícone, badge, ou borda diferenciada)
6. Treinador pode:
   - **Visualizar** o vídeo custom (preview inline)
   - **Substituir** por outro vídeo/link
   - **Remover** o vídeo custom (volta ao vídeo padrão do catálogo)

### Fluxo do Aluno (Mobile App + Training Room Web)

1. Aluno abre um exercício que possui vídeo custom do seu treinador
2. O sistema resolve: `trainer_exercise_videos` para aquele treinador → se existir, usa o `video_url` custom; senão, usa o `video_url` padrão da tabela `exercises`
3. O vídeo custom é exibido **no mesmo player e posição** onde o vídeo padrão apareceria
4. O aluno não vê nenhuma indicação de que é um vídeo "custom" vs "padrão" — a experiência é transparente

### Fluxo Técnico

1. **Tabela `trainer_exercise_videos`:**
   ```sql
   CREATE TABLE trainer_exercise_videos (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
     video_type TEXT NOT NULL CHECK (video_type IN ('upload', 'external_url')),
     video_url TEXT NOT NULL,
     storage_path TEXT, -- preenchido apenas quando video_type = 'upload'
     original_filename TEXT,
     file_size_bytes BIGINT,
     created_at TIMESTAMPTZ DEFAULT now(),
     updated_at TIMESTAMPTZ DEFAULT now(),
     UNIQUE(trainer_id, exercise_id) -- um vídeo custom por treinador por exercício
   );
   ```

2. **RLS da tabela:**
   - Treinador pode SELECT/INSERT/UPDATE/DELETE apenas seus próprios registros (`trainer_id = auth.uid()`)
   - Aluno pode SELECT registros do seu treinador (`trainer_id = student.coach_id`)

3. **Supabase Storage — bucket `trainer-videos`:**
   - Estrutura: `{trainer_id}/{exercise_id}/{filename}`
   - RLS: treinador pode upload/delete nos seus paths; alunos podem read nos paths do seu treinador
   - Limite de upload: 50MB (validar client-side E via policy do bucket)

4. **Resolução de vídeo (função utilitária):**
   ```typescript
   // Pseudo-código da lógica de resolução
   function resolveExerciseVideoUrl(
     exercise: Exercise,
     trainerVideo: TrainerExerciseVideo | null
   ): string | null {
     if (trainerVideo?.video_url) return trainerVideo.video_url;
     return exercise.video_url;
   }
   ```
   Essa função deve ser usada em **todos** os pontos onde `exercise.video_url` é consumido.

5. **Query otimizada (exemplo):**
   ```sql
   SELECT e.*, tev.video_url AS custom_video_url, tev.video_type
   FROM exercises e
   LEFT JOIN trainer_exercise_videos tev
     ON tev.exercise_id = e.id
     AND tev.trainer_id = :trainer_id
   WHERE e.id = :exercise_id;
   ```

6. **Upload flow:**
   - Client valida: tipo de arquivo (MP4, MOV, WebM), tamanho (≤ 50MB)
   - Client faz upload direto para Supabase Storage via `supabase.storage.from('trainer-videos').upload()`
   - Obtém URL pública via `getPublicUrl()`
   - Insere/atualiza registro em `trainer_exercise_videos`
   - Se substituindo: deleta arquivo anterior do Storage antes do novo upload

7. **Link externo flow:**
   - Client valida formato da URL (aceitar YouTube, Vimeo, URLs diretas com extensão de vídeo)
   - Insere/atualiza registro com `video_type = 'external_url'`
   - Não usa Storage

## Critérios de Aceite

- [ ] Treinador consegue fazer upload de vídeo (MP4/MOV/WebM, ≤ 50MB) via dashboard
- [ ] Treinador consegue colar link externo (YouTube, Vimeo, URL direta) como alternativa
- [ ] Vídeo custom aparece vinculado ao exercício na biblioteca do treinador
- [ ] Indicador visual mostra quais exercícios têm vídeo custom
- [ ] Treinador consegue visualizar, substituir e remover o vídeo custom
- [ ] Aluno vê o vídeo custom no lugar do padrão no mobile app
- [ ] Aluno vê o vídeo custom no lugar do padrão na Training Room web
- [ ] Aluno vê o vídeo custom no preview de programa (se aplicável)
- [ ] Se o treinador remove o vídeo custom, o aluno volta a ver o vídeo padrão
- [ ] Upload valida tipo de arquivo e tamanho (client-side)
- [ ] RLS impede treinador de ver/editar vídeos de outro treinador
- [ ] RLS permite aluno ver apenas vídeos do seu treinador
- [ ] Arquivo anterior é deletado do Storage ao substituir
- [ ] Sem novos erros de TypeScript
- [ ] Retrocompatível com funcionalidades existentes
- [ ] Testado no fluxo principal (upload, link, visualização aluno, remoção)

## Restrições Técnicas

- Seguir convenções documentadas no `CLAUDE.md` de cada repositório
- Mudanças cirúrgicas — não reescrever código que já funciona
- Manter padrões existentes de naming e estrutura
- Upload direto para Supabase Storage (sem intermediário server-side)
- Usar o mesmo padrão de componentes e modais já existentes no dashboard
- No mobile: seguir Apple HIG (fundos neutros, cor como acento, sentence case)
- Resolução de vídeo deve ser centralizada em uma função/hook reutilizável — não espalhar `if/else` em cada componente

## Edge Cases

- **Exercício deletado:** `ON DELETE CASCADE` remove o registro de `trainer_exercise_videos` automaticamente
- **Treinador deletado:** `ON DELETE CASCADE` remove registros e arquivos devem ser limpos (considerar trigger ou policy de cleanup no Storage)
- **Aluno troca de treinador:** automaticamente passa a ver os vídeos do novo treinador (resolve via `coach_id` atual)
- **URL externa inválida ou offline:** player deve exibir fallback graceful (poster do exercício ou mensagem "Vídeo indisponível")
- **Upload falha no meio:** não criar registro na tabela; UI deve mostrar erro e permitir retry
- **Vídeo padrão do catálogo não existe:** se o exercício não tem `video_url` E não tem vídeo custom, não mostrar player
- **Formatos não suportados:** validação client-side deve rejeitar com mensagem clara antes do upload
- **Arquivo excede 50MB:** rejeitar client-side com mensagem clara antes de tentar upload

## Referências

- Supabase Storage: padrão já usado no projeto para fotos de avaliação (bucket existente como referência)
- Tabela `exercises` — campo `video_url` atual
- Relação treinador-aluno via `coach_id` na tabela de perfis/students

## Notas de Implementação

_(Preenchido pelo executor durante/após a implementação)_