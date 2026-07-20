// Milestone "Converse com o Assistente IA" (checklist de primeiros passos).
// Chamado no primeiro turno bem-sucedido do workspace (/assistente) e do ⌘K.
//
// O /assistente não monta o OnboardingProvider (não usa AppLayout), então o
// store local começa em DEFAULT a cada load — o guard no espelho localStorage
// evita re-emitir o evento de funil a cada sessão; o merge OR do servidor
// garante que o milestone nunca regride.
export function markFirstAssistantChat(): void {
  try {
    const raw = localStorage.getItem('kinevo-onboarding')
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      const milestones = (parsed as { state?: { milestones?: Record<string, unknown> } })?.state?.milestones
      if (milestones?.first_assistant_chat === true) return
    }
    void import('@/stores/onboarding-store').then(({ useOnboardingStore }) => {
      useOnboardingStore.getState().completeMilestone('first_assistant_chat')
    })
  } catch {
    // onboarding jamais quebra o chat
  }
}
