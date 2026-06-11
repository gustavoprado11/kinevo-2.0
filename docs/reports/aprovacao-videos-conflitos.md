# Aprovação caso-a-caso — Vídeos do Lucas vs. YouTube atual

Você pediu pra decidir, vídeo por vídeo, em quais casos a gente troca o YouTube atual pelo `.MOV` do Lucas e em quais a gente mantém o YouTube.

Resumo do cruzamento (143 vídeos no Drive × 432 exercícios do sistema):

| Categoria | Qtd | O que faz por padrão |
|---|---:|---|
| Conflito alta confiança (sim ≥ 0.70) | 13 | Espera sua decisão |
| Conflito provável (sim 0.45–0.70) | 38 | Espera sua decisão (várias são falso-positivo do fuzzy — marquei abaixo) |
| Sem match no catálogo (sim < 0.45) | 92 | Cria exercício novo (`owner_id IS NULL`, `is_archived=true` pra você aprovar antes de publicar) |

Como usar este documento: na coluna **Decisão** marque `LUCAS` se quer trocar pelo vídeo do Lucas ou `YOUTUBE` se quer manter o atual. Se não marcar nada, o default é **manter o YouTube** (mais seguro).

Quando você devolver com as decisões, eu rodo o pipeline (transcoda → sobe pro Supabase Storage → faz UPDATE no `video_url`).

---

## A. Conflito de alta confiança (13)

São casos onde o nome do arquivo e o nome do exercício no banco se referem claramente ao mesmo movimento.

| # | Arquivo no Drive | Exercício no Kinevo | YouTube atual | Decisão |
|--:|---|---|---|---|
| 1 | `AFUNDO.MOV` | Afundo | [shorts/qJAGG_1E5lw](https://www.youtube.com/shorts/qJAGG_1E5lw) | ☐ LUCAS ☐ YOUTUBE |
| 2 | `FLEXÃO DE BRAÇOS.MOV` | Flexão de Braços | [shorts/FFIO3CmkFds](https://www.youtube.com/shorts/FFIO3CmkFds) | ☐ LUCAS ☐ YOUTUBE |
| 3 | `STEP UP.MOV` | Step Up | [shorts/pc6v7rqWD9g](https://www.youtube.com/shorts/pc6v7rqWD9g) | ☐ LUCAS ☐ YOUTUBE |
| 4 | `SUPINO INCLINADO DB.mov` | Supino Inclinado com Halteres | [shorts/zQKc2wAc2ls](https://www.youtube.com/shorts/zQKc2wAc2ls) | ☐ LUCAS ☐ YOUTUBE |
| 5 | `SUPINO RETO DB.mov` | Supino Reto com Halteres | [shorts/igyle3RHbUM](https://www.youtube.com/shorts/igyle3RHbUM) | ☐ LUCAS ☐ YOUTUBE |
| 6 | `SUPINO RETO BB.mov` | Supino Reto com Barra | [shorts/jSFYlR43vnA](https://www.youtube.com/shorts/jSFYlR43vnA) | ☐ LUCAS ☐ YOUTUBE |
| 7 | `AFUNDO DB.MOV` | Afundo com Halteres | [watch?v=YTckSeZnQZo](https://www.youtube.com/watch?v=YTckSeZnQZo) | ☐ LUCAS ☐ YOUTUBE |
| 8 | `STIFF DB.MOV` | Stiff com Halteres | [shorts/BU_87JJzNA4](https://www.youtube.com/shorts/BU_87JJzNA4) | ☐ LUCAS ☐ YOUTUBE |
| 9 | `PRANCHA NA BOLA ISO.MOV` | Prancha Isométrica na Bola Suíça | [shorts/MscK5EhfwLE](https://www.youtube.com/shorts/MscK5EhfwLE) | ☐ LUCAS ☐ YOUTUBE |
| 10 | `STIFF UNI BB.MOV` | Stiff Unilateral *(genérico — Lucas é com barra)* | [shorts/qootC16Tc6w](https://www.youtube.com/shorts/qootC16Tc6w) | ☐ LUCAS ☐ YOUTUBE |
| 11 | `FLEXÃO DE JOELHO NA BOLA.mov` | Flexão de Joelhos na Bola Suíça | [shorts/n7SB8CwpCFs](https://www.youtube.com/shorts/n7SB8CwpCFs) | ☐ LUCAS ☐ YOUTUBE |
| 12 | `SUPINO INCLINADO BB.mov` | Supino Inclinado com Barra Reta | [shorts/U8m3zQYlRzs](https://www.youtube.com/shorts/U8m3zQYlRzs) | ☐ LUCAS ☐ YOUTUBE |
| 13 | `FLEXÃO DE BRAÇOS JOELHO.MOV` ⚠️ | Flexão de Braços *(é flexão de joelhos, exercício diferente)* | [shorts/FFIO3CmkFds](https://www.youtube.com/shorts/FFIO3CmkFds) | ☐ LUCAS ☐ YOUTUBE ☐ **NOVO** (criar exercício separado) |

⚠️ #13: o fuzzy bateu mas é movimento diferente — sugiro criar como exercício novo.

---

## B. Conflito provável (38)

Aqui o pg_trgm achou similaridade, mas muitos casos são **falso positivo** (palavras curtas como "UNI" ou "POLIA" causam match espúrio). Marquei minha leitura ao lado.

### B.1 — Provável MESMO exercício (8 casos)

| # | Arquivo Drive | Exercício Kinevo | YouTube atual | Decisão |
|--:|---|---|---|---|
| 14 | `CRUCIFIXO INCLINADO.mov` | Crucifixo Inclinado na Polia *(mas existe também "Crucifixo Inclinado com Halteres" no banco — o Lucas pode ser esse)* | [shorts/FteHJQw0KeU](https://www.youtube.com/shorts/FteHJQw0KeU) | ☐ LUCAS (qual exercício?) ☐ YOUTUBE |
| 15 | `PRANCHA NA BOLA DINÂMICA.mov` | Prancha Dinâmica *(banco não tem "na bola" — pode ser variação)* | [shorts/aXeVdfAaVRE](https://www.youtube.com/shorts/aXeVdfAaVRE) | ☐ LUCAS ☐ YOUTUBE ☐ NOVO |
| 16 | `STIFF UNI. DB.MOV` | Stiff Unilateral *(mesmo do #10, mas com halter em vez de barra)* | [shorts/qootC16Tc6w](https://www.youtube.com/shorts/qootC16Tc6w) | ☐ LUCAS ☐ YOUTUBE |
| 17 | `AFUNDO 2KB/DB .MOV` | Afundo com Halteres *(2 kettlebells/halteres no rack)* | [watch?v=YTckSeZnQZo](https://www.youtube.com/watch?v=YTckSeZnQZo) | ☐ LUCAS ☐ YOUTUBE |
| 18 | `STIFF BB.MOV` | Stiff Barra Livre | [shorts/6ZbS3jXheMw](https://www.youtube.com/shorts/6ZbS3jXheMw) | ☐ LUCAS ☐ YOUTUBE |
| 19 | `SUPINO INCLINADO COMBINADO (1+1+2).MOV` | Supino Inclinado com Halteres *(é variação combinada — sugiro NOVO)* | [shorts/zQKc2wAc2ls](https://www.youtube.com/shorts/zQKc2wAc2ls) | ☐ LUCAS ☐ YOUTUBE ☐ NOVO |
| 20 | `SUPINO INLCINADO ALTERNADO DB.mov` *(typo no nome)* | Supino Inclinado com Halteres *(é a versão alternada — sugiro NOVO)* | [shorts/zQKc2wAc2ls](https://www.youtube.com/shorts/zQKc2wAc2ls) | ☐ LUCAS ☐ YOUTUBE ☐ NOVO |
| 21 | `STEP UP C/ 2KB.MOV` | Step Up *(é Step Up com 2 KBs — variação)* | [shorts/pc6v7rqWD9g](https://www.youtube.com/shorts/pc6v7rqWD9g) | ☐ LUCAS ☐ YOUTUBE ☐ NOVO |

### B.2 — Provavelmente FALSO POSITIVO (30 casos — sugiro criar como exercício novo)

Estes vão virar exercícios NOVOS por padrão (sem mexer no YouTube atual). Se você discordar, marque "LUCAS no exercício X" e eu reaponto.

| # | Arquivo Drive | Match falso | Por que é falso |
|--:|---|---|---|
| 22 | `REMADA SAJ. UNI POLIA.mov` | Remada Unilateral na Polia Baixa | SAJ ≠ baixa |
| 23 | `FLEXÃO DE JOELHO NA BOLA SÓ EXC..mov` | Flexão de Joelhos na Bola Suíça | é variação excêntrica — separe |
| 24 | `SUPINO COMBINADO DB (1+1+2).MOV` | Supino Declinado com Halteres | nada a ver |
| 25 | `REMADA CURVADA UNI POLIA.MOV` | Remada Unilateral na Polia Baixa | curvada ≠ baixa |
| 26 | `REMADA SENTADO UNI POLIA.MOV` | Remada Unilateral na Polia Baixa | sentado ≠ baixa |
| 27 | `REMADA B.ATLETICA UNI POLIA.MOV` | Remada Unilateral na Polia Baixa | atlética ≠ baixa |
| 28 | `SUPINO ALTERNADO DB.mov` | Supino Inclinado com Halteres | alternado ≠ inclinado |
| 29 | `FLEXÃO DE JOELHO UNI. NA BOLA.MOV` | Flexão de Joelhos na Bola Suíça | unilateral ≠ bilateral |
| 30 | `REMADA SAJ. BIL POLIA.MOV` | Remada Unilateral na Polia Baixa | bil ≠ uni |
| 31 | `STEP UP TENSÃO.MOV` | Step Up | variação |
| 32 | `PONTE UNI.MOV` | Puxada unilateral | totalmente diferente |
| 33 | `REMADA CURVADA ALTERNADA KB/DB.MOV` | Remada Alta com Kettlebell | curvada ≠ alta |
| 34 | `REMADA CURVADA BIL POLIA.mov` | Remada Unilateral na Polia Baixa | bil ≠ uni |
| 35 | `PONTE ALTA UNI..MOV` | Bíceps Unilateral na Polia Alta | totalmente diferente |
| 36 | `FLEXÃO DE BRAÇOS A.R. C/ KB.MOV` | Flexão de Braços | variação A.R. com KB |
| 37 | `REMADA CURVADA KB/DB .MOV` | Remada Alta com Kettlebell | curvada ≠ alta |
| 38 | `REMADA CURVADA NA BB.MOV` | Remada Curvada com Barra Reta (Pegada Pronada) | **na verdade pode ser match — confirma?** |
| 39 | `DROP UNI.MOV` | Stiff Unilateral | DROP ≠ Stiff |
| 40 | `REMADA SENTADO BIL. POLIA.mov` | Remada Unilateral na Polia Baixa | bil ≠ uni, sentado ≠ baixa |
| 41 | `PRESS SAJ. UNI. DB.mov` | Leg Press 45 Unilateral | totalmente diferente |
| 42 | `SALTITOS UNI. .mov` | Stiff Unilateral | totalmente diferente |
| 43 | `REMADA SENTADO BIL SUPINADA POLIA.mov` | Remada Baixa unilateral supinada | bil ≠ uni |
| 44 | `PASSADA FRENTE UNI.MOV` | Puxada unilateral | passada ≠ puxada |
| 45 | `FLEXÃO DE JOELHO NO SLIDE.mov` | Flexão de Joelhos na Bola Suíça | slide ≠ bola |
| 46 | `REMADA SUSPENSA NA BB.MOV` | Remada Invertida Supinada na Barra | **pode ser match — confirma?** |
| 47 | `TERRA SUMÔ BB.MOV` | Stiff Sumô com Barra | terra ≠ stiff |
| 48 | `PRESS SAJ. ALTERNADO DB.mov` | Recuo Alternado com Halteres | press ≠ recuo |
| 49 | `PASSADA REVERSA UNILATERAL.MOV` | Puxada unilateral | passada ≠ puxada |
| 50 | `REMADA SENTADO UNI SUPINADA POLIA.mov` | Remada Baixa unilateral supinada | sentado ≠ baixa |
| 51 | `REMADA SENTADO BIL SUPINADA POLIA.mov` | Remada Baixa unilateral supinada | bil ≠ uni |

Casos **#38** (Remada Curvada na BB) e **#46** (Remada Suspensa na BB) me parecem possíveis matches reais — vale uma olhada sua.

---

## C. Exercícios NOVOS (92 — sem conflito)

Estes não bateram com nada no catálogo. Vão entrar como **exercícios do sistema novos** (`owner_id IS NULL`), porém com `is_archived=true` para você revisar antes de publicar. Lista completa em `outputs/video-import/drive_videos.json`.

Categorias por padrão de nome (só pra você sentir o volume):
- **AFUNDO / GLOBET / PASSADA / FRONT SQUAT / BACK SQUAT** (variações de squat e lunge não cadastradas) — ~20
- **HIP THRUST / TERRA / PONTE / STIFF** (variações de glúteo/posterior) — ~16
- **REMADA atlética / sentado / curvada / SAJ** (variações de remada) — ~10
- **FLEXÃO DE JOELHO / DEAD BUG / HOLLOWBODY / PRANCHA / SLAM BALL** (core/funcional) — ~12
- **WALL DRILL / SALTITOS / STEP DOWN / DROP / ANDAR / 90/90** (técnica de corrida / mobilidade) — ~12
- **ALONG / MOB / ARREMESSO DE MEDBALL / AVIÃO / PISTOL** (preparação e potência) — ~12
- **FLOORPRESS / PRESS SAJ / SUPINO** variações — ~10

---

## D. Como me devolver a aprovação

Opção 1 (rápida): responde aqui na conversa marcando os 13 da seção A + os 8 da B.1 (basta dizer "tudo LUCAS exceto #13" ou similar). Os 92 da seção C eu já trato como novos.

Opção 2 (granular): edita este arquivo direto e me devolve.

Depois disso eu rodo:
1. Migration do bucket `exercise-library-videos`.
2. Script de import (download Drive → ffmpeg → upload Supabase → UPDATE/INSERT em `exercises`).
3. Relatório final do que foi inserido/atualizado.
