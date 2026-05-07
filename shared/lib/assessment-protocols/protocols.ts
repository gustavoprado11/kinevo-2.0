// ============================================================================
// Kinevo — Assessment protocols: registry
// ============================================================================
// Static metadata about each supported protocol: required skinfold sites
// per sex, whether it computes density (vs. %BF directly), and the
// canonical citation.
// ============================================================================

import type { ProtocolId, Sex, SkinfoldSite } from './types';

export interface ProtocolDefinition {
    id: ProtocolId;
    name_pt: string;
    description_pt: string;
    required_sites: { sex: Sex; sites: SkinfoldSite[] }[];
    computes_density: boolean;
    source_citation: string;
}

export const PROTOCOLS: Record<ProtocolId, ProtocolDefinition> = {
    jackson_pollock_3: {
        id: 'jackson_pollock_3',
        name_pt: 'Jackson & Pollock — 3 dobras',
        description_pt:
            'Equação generalizada de 3 dobras. Sites variam por sexo. '
            + 'Consagrada para população adulta sem condição clínica especial.',
        required_sites: [
            { sex: 'male', sites: ['chest', 'abdomen', 'thigh'] },
            { sex: 'female', sites: ['triceps', 'suprailiac', 'thigh'] },
        ],
        computes_density: true,
        source_citation:
            'Jackson AS, Pollock ML. Br J Nutr 1978; 40(3):497-504. '
            + 'Jackson AS, Pollock ML, Ward A. Med Sci Sports Exerc 1980; 12(3):175-181.',
    },
    jackson_pollock_7: {
        id: 'jackson_pollock_7',
        name_pt: 'Jackson & Pollock — 7 dobras',
        description_pt:
            'Equação generalizada de 7 dobras. Sites idênticos para ambos os sexos. '
            + 'Considerada padrão-ouro entre os protocolos de dobras na literatura clássica.',
        required_sites: [
            {
                sex: 'male',
                sites: ['chest', 'abdomen', 'thigh', 'triceps', 'subscapular', 'suprailiac', 'midaxillary'],
            },
            {
                sex: 'female',
                sites: ['chest', 'abdomen', 'thigh', 'triceps', 'subscapular', 'suprailiac', 'midaxillary'],
            },
        ],
        computes_density: true,
        source_citation:
            'Jackson AS, Pollock ML. Br J Nutr 1978; 40(3):497-504. '
            + 'Jackson AS, Pollock ML, Ward A. Med Sci Sports Exerc 1980; 12(3):175-181.',
    },
    petroski_4: {
        id: 'petroski_4',
        name_pt: 'Petroski — 4 dobras',
        description_pt:
            'Equação validada para população adulta brasileira. '
            + 'Versão pura sem peso/estatura — ver MILESTONE-2-STATUS.md.',
        required_sites: [
            { sex: 'male', sites: ['subscapular', 'triceps', 'suprailiac', 'calf'] },
            { sex: 'female', sites: ['subscapular', 'triceps', 'suprailiac', 'calf'] },
        ],
        computes_density: true,
        source_citation:
            'Petroski EL. Tese de Doutorado, UFSM, 1995.',
    },
    faulkner_4: {
        id: 'faulkner_4',
        name_pt: 'Faulkner — 4 dobras',
        description_pt:
            'Equação simples de 4 dobras que retorna %BG diretamente. '
            + 'Adequada para população geral; menos precisa em atletas.',
        required_sites: [
            { sex: 'male', sites: ['triceps', 'subscapular', 'suprailiac', 'abdomen'] },
            { sex: 'female', sites: ['triceps', 'subscapular', 'suprailiac', 'abdomen'] },
        ],
        computes_density: false,
        source_citation:
            'Faulkner JA. In: Falls H (ed). Exercise Physiology. Academic Press, 1968.',
    },
};
