// A lógica vive em shared/lib/assessment-computed.ts (FONTE ÚNICA). Antes este
// arquivo e mobile/lib/assessmentComputed.ts eram cópias-espelho que driftaram
// (M10 — ex.: detectProtocol divergiu). Re-export para não tocar nos imports.
export * from '@kinevo/shared/lib/assessment-computed'
