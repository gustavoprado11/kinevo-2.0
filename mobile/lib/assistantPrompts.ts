/**
 * Prompts iniciais do Assistente: o chip mostra um rótulo curto, mas ao tocar
 * o campo recebe um prompt OTIMIZADO (instrução mais completa e específica), que
 * gera uma resposta melhor e o treinador ainda pode editar antes de enviar.
 */
export interface StarterPrompt {
    /** Texto curto exibido no chip/botão. */
    label: string;
    /** Prompt otimizado que vai para o campo de texto. */
    prompt: string;
}

/** Prompts do estado vazio do chat. */
export const CHAT_STARTERS: StarterPrompt[] = [
    {
        label: 'Quem precisa de atenção?',
        prompt:
            'Quais alunos precisam de atenção agora? Leve em conta quem está sem treinar há vários dias, com adesão baixa, programa perto de vencer ou pagamento pendente — e me diga a próxima ação recomendada para cada um.',
    },
    {
        label: 'Como está a aderência e o financeiro?',
        prompt:
            'Me dê um panorama da semana: a aderência dos meus alunos e a saúde financeira do mês (receita, novos contratos, cancelamentos e cobranças pendentes). Destaque o que precisa de ação.',
    },
    {
        label: 'Gerar programa para um aluno',
        prompt:
            'Quero montar um programa de treino para um aluno. Me ajude do começo: pergunte de qual aluno se trata, o objetivo, a frequência semanal e a duração, e então proponha a estrutura.',
    },
];

/** Sugestões da Home Assistente (chips acima do composer). */
export const HOME_SUGGESTIONS: StarterPrompt[] = [
    CHAT_STARTERS[0],
    {
        label: 'Gerar programa',
        prompt: CHAT_STARTERS[2].prompt,
    },
    {
        label: 'Resumo financeiro',
        prompt:
            'Me dê um resumo financeiro do mês: receita recorrente, novos contratos, cancelamentos e cobranças em atraso, com sugestões do que cobrar ou ajustar.',
    },
];

/** Resolve um rótulo de chip para o prompt otimizado (fallback: o próprio texto). */
export function optimizePrompt(label: string): string {
    const all = [...CHAT_STARTERS, ...HOME_SUGGESTIONS];
    return all.find((p) => p.label === label)?.prompt ?? label;
}
