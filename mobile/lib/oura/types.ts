// Oura — tipos do client mobile.
// Modelo B (server-side): o app NÃO guarda tokens; só dispara as edge functions
// e lê o status de wearable_connections. Spec: mobile/specs/active/oura-integration.md

export interface OuraAuthorizationResult {
  code: string | null;
  cancelled: boolean;
  error?: string;
}

export interface OuraExchangeResponse {
  ok: boolean;
  external_user_id?: string | null;
  counts?: { sleep: number; readiness: number; activity: number };
  error?: string;
}

export interface OuraSyncResponse {
  ok: boolean;
  counts?: { sleep: number; readiness: number; activity: number };
  error?: string;
}
