// Backwards-compatible re-export.
//
// This module used to create its own Zustand store. When the assistant + messages
// panels were unified, `communication-store.ts` became the single source of truth
// for the panel's open/close state. Several files still import from this path
// (app-layout, command-palette, assistant-action-cards, etc.), so instead of a
// wide refactor we keep the import surface intact and alias the unified store.
//
// Having two independent stores caused a visible bug: layout read `isOpen` from
// one store while the panel rendered from the other, so opening the Assistant
// shrank the main view without ever mounting the panel.

export { useCommunicationStore as useAssistantChatStore } from './communication-store'
