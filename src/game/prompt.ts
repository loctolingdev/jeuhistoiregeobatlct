import { create } from "zustand";

/** Texte d'interaction affiché en bas de l'écran (« E — Parler à… »). */
export const usePrompt = create<{ text: string | null }>(() => ({ text: null }));
