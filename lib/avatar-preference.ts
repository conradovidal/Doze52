"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AvatarPreference = "photo" | "icon";

type AvatarPreferenceState = {
  preference: AvatarPreference;
  setPreference: (preference: AvatarPreference) => void;
};

export const useAvatarPreference = create<AvatarPreferenceState>()(
  persist(
    (set) => ({
      preference: "photo",
      setPreference: (preference) => set({ preference }),
    }),
    { name: "doze52-avatar-preference" }
  )
);
