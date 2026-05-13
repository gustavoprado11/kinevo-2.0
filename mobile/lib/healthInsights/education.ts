// Fase 14d — Conteúdo educativo inline por métrica.
// Hardcoded como source of truth — copy revisado.
// Marcação `**negrito**` é parseada pelo renderer (EduCard).

export type MetricKind = 'sleep' | 'hr_resting' | 'steps' | 'hrv';

export interface MetricEducation {
  title: string;
  body: string;
  idealRange: string;
}

export const EDUCATION: Record<MetricKind, MetricEducation> = {
  sleep: {
    title: 'O que é eficiência do sono?',
    body:
      'É a proporção do tempo na cama que você realmente dormiu. **Acima de 85%** é considerado bom. Eficiência baixa pode indicar despertares frequentes ou dificuldade pra começar a dormir.',
    idealRange: '85%+',
  },
  hr_resting: {
    title: 'Por que o HR de repouso importa?',
    body:
      'É um indicador de fitness cardiorrespiratório. **Atletas costumam ter 40-60bpm**. Quando cai com o tempo, mostra que seu coração ficou mais eficiente. Variações grandes (5+ bpm) podem indicar estresse, fadiga ou doença.',
    idealRange: '40-60bpm pra atletas, 60-80bpm pra adultos',
  },
  steps: {
    title: 'Quantos passos devo dar por dia?',
    body:
      'A recomendação clássica de **10.000 passos/dia** veio de uma campanha de marketing japonesa nos anos 60. Estudos mais recentes mostram benefícios reais a partir de 7.000-8.000 passos/dia. Mais que isso continua ajudando, mas com retorno decrescente.',
    idealRange: '7.000-10.000 passos/dia',
  },
  hrv: {
    title: 'O que é HRV?',
    body:
      'Variabilidade da Frequência Cardíaca é a variação entre batimentos cardíacos. **Mais alta = sistema nervoso recuperado.** Cai com estresse, sobre-treinamento, sono ruim ou álcool. Cada pessoa tem sua faixa — comparar consigo mesmo, não com outros.',
    idealRange: 'Faixa pessoal, varia 20-100+ms entre pessoas',
  },
};
