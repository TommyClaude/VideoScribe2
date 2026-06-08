// AI settings (API keys + endpoints). Kept OUT of the project file and stored
// only in localStorage so keys are never embedded/committed. Everything is
// optional — the app works fully with no keys set.

import { create } from "zustand";

export interface AiSettings {
  anthropicKey: string;
  scriptModel: string;
  imageEndpoint: string;
  imageKey: string;
  ttsEndpoint: string;
  ttsKey: string;
}

export const DEFAULT_SETTINGS: AiSettings = {
  anthropicKey: "",
  scriptModel: "claude-sonnet-4-6",
  imageEndpoint: "",
  imageKey: "",
  ttsEndpoint: "",
  ttsKey: "",
};

const KEY = "scribely-ai-settings";

function load(): AiSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS };
}

interface SettingsState {
  settings: AiSettings;
  update: (patch: Partial<AiSettings>) => void;
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: load(),
  update: (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* quota / disabled */
    }
  },
}));
