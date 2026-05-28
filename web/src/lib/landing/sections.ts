/**
 * Seções da landing pública que o trainer pode ligar/desligar (Fase 3).
 *
 *   Fonte única consumida pelo editor, pelo schema e pela página pública.
 *   Mora em `trainers.landing_sections` (JSONB): { [key]: boolean }.
 *   Semântica: chave ausente OU true = visível. Só `false` esconde.
 *   Assim, trainers existentes (coluna '{}') veem tudo — backward compatible.
 *
 *   Hero, formulário e footer NÃO são togláveis (espinha dorsal do funil).
 */

export type LandingSectionKey =
    | 'credenciais'
    | 'metodo'
    | 'app'
    | 'depoimentos'
    | 'processo'
    | 'planos'
    | 'faq'

export interface LandingSectionDef {
    key: LandingSectionKey
    label: string
    description: string
}

export const LANDING_SECTION_DEFS: ReadonlyArray<LandingSectionDef> = [
    { key: 'credenciais', label: 'Credenciais', description: 'CREF e certificações' },
    { key: 'metodo', label: 'Método', description: 'Seu método + especializações' },
    { key: 'app', label: 'App próprio', description: 'Vitrine do app do aluno' },
    { key: 'depoimentos', label: 'Depoimentos', description: 'Prova social de alunos' },
    { key: 'processo', label: 'Como funciona', description: 'Passo a passo do processo' },
    { key: 'planos', label: 'Planos', description: 'Cards de preço' },
    { key: 'faq', label: 'Perguntas frequentes', description: 'FAQ' },
]

export type LandingSections = Partial<Record<LandingSectionKey, boolean>>

/** Visível por padrão; só esconde quando explicitamente `false`. */
export function isSectionVisible(sections: LandingSections | null | undefined, key: LandingSectionKey): boolean {
    return sections?.[key] !== false
}
