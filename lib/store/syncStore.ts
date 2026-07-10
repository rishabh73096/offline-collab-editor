import { create } from "zustand";

export type SyncStatus = "offline" | "connecting" | "syncing" | "synced" | "error";

interface SyncState {
  status: SyncStatus;
  setStatus: (status: SyncStatus) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: "offline",
  setStatus: (status) => set({ status }),
}));
