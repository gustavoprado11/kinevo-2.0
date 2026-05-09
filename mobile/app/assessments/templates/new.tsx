import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { AssessmentBuilderScreen } from '../../../components/trainer/assessments/builder/AssessmentBuilderScreen';

// M10A — rota Expo Router. Aceita ?id=<uuid> (edit) ou nenhum param (criação).
// Ex.: /assessments/templates/new            → criação
//      /assessments/templates/new?id=abc...  → edição
//
// Decidimos rota query-param (vs nested [id]) porque mantém UX consistente
// no mobile sem precisar de mais um nível de path. Edit deep-link via web
// share aponta pra essa mesma rota com ?id=.
export default function NewAssessmentTemplateScreen() {
    const { id } = useLocalSearchParams<{ id?: string }>();
    return <AssessmentBuilderScreen templateId={id ?? null} />;
}
