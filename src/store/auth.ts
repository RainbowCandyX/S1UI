import { create } from "zustand";

interface AuthState {
  hostname: string;
  connected: boolean;
  userMeta?: {
    email?: string;
    full_name?: string;
    scope?: string;
  };
  setConnected: (hostname: string, meta?: AuthState["userMeta"]) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  hostname: "",
  connected: false,
  userMeta: undefined,
  setConnected: (hostname, meta) =>
    set({ hostname, connected: true, userMeta: meta }),
  logout: () => set({ hostname: "", connected: false, userMeta: undefined }),
}));
