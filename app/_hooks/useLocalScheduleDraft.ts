"use client";

import { useCallback, useEffect, useState } from "react";

import {
  createDefaultDraft,
  deserializeDraft,
  serializeDraft,
} from "../_lib/schedule-data";
import type {
  ScheduleDraft,
  SchedularPreferences,
  SerializedScheduleDraft,
} from "../types";

const DRAFT_STORAGE_KEY = "schedular.mvp.draft.v1";
const PREFERENCES_STORAGE_KEY = "schedular.mvp.preferences.v1";

const DEFAULT_PREFERENCES: SchedularPreferences = {
  autosaveEnabled: true,
  visibleStartHour: 6,
  visibleEndHour: 22,
};
const MIN_VISIBLE_START_HOUR = 0;
const MAX_VISIBLE_START_HOUR = 6;
const MIN_VISIBLE_END_HOUR = 18;
const MAX_VISIBLE_END_HOUR = 24;

const LEGACY_VISIBLE_HOURS_PRESETS: Record<
  string,
  Pick<SchedularPreferences, "visibleStartHour" | "visibleEndHour">
> = {
  daytime: { visibleStartHour: 6, visibleEndHour: 22 },
  "compact-day": { visibleStartHour: 7, visibleEndHour: 21 },
  "business-hours": { visibleStartHour: 8, visibleEndHour: 18 },
  "full-day": { visibleStartHour: 0, visibleEndHour: 24 },
};

interface UseLocalScheduleDraftResult {
  storedDraft: ScheduleDraft;
  preferences: SchedularPreferences;
  isLoading: boolean;
  error: string | null;
  saveDraft: (draft: ScheduleDraft) => boolean;
  savePreferences: (preferences: SchedularPreferences) => boolean;
  resetDraft: () => ScheduleDraft;
  clearError: () => void;
}

export function useLocalScheduleDraft(): UseLocalScheduleDraftResult {
  const [storedDraft, setStoredDraft] = useState<ScheduleDraft>(createDefaultDraft);
  const [preferences, setPreferences] =
    useState<SchedularPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const rawDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      const rawPreferences = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);

      if (rawDraft) {
        const parsedDraft = JSON.parse(rawDraft) as SerializedScheduleDraft;
        setStoredDraft(deserializeDraft(parsedDraft));
      } else {
        setStoredDraft(createDefaultDraft());
      }

      if (rawPreferences) {
        const parsedPreferences = JSON.parse(rawPreferences) as Partial<
          SchedularPreferences & { visibleHoursPreset?: string }
        >;
        const legacyVisibleHours =
          typeof parsedPreferences.visibleHoursPreset === "string"
            ? LEGACY_VISIBLE_HOURS_PRESETS[parsedPreferences.visibleHoursPreset]
            : undefined;
        const visibleStartHour =
          typeof parsedPreferences.visibleStartHour === "number"
            ? parsedPreferences.visibleStartHour
            : legacyVisibleHours?.visibleStartHour ??
              DEFAULT_PREFERENCES.visibleStartHour;
        const visibleEndHour =
          typeof parsedPreferences.visibleEndHour === "number"
            ? parsedPreferences.visibleEndHour
            : legacyVisibleHours?.visibleEndHour ??
              DEFAULT_PREFERENCES.visibleEndHour;
        const normalizedVisibleStartHour = Math.max(
          MIN_VISIBLE_START_HOUR,
          Math.min(visibleStartHour, MAX_VISIBLE_START_HOUR)
        );
        const normalizedVisibleEndHour = Math.max(
          MIN_VISIBLE_END_HOUR,
          Math.min(MAX_VISIBLE_END_HOUR, visibleEndHour)
        );
        setPreferences({
          autosaveEnabled:
            typeof parsedPreferences.autosaveEnabled === "boolean"
              ? parsedPreferences.autosaveEnabled
              : true,
          visibleStartHour: normalizedVisibleStartHour,
          visibleEndHour: normalizedVisibleEndHour,
        });
      } else {
        setPreferences(DEFAULT_PREFERENCES);
      }

      setError(null);
    } catch {
      setStoredDraft(createDefaultDraft());
      setPreferences(DEFAULT_PREFERENCES);
      setError("Saved browser data could not be loaded. A fresh local draft was created.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveDraft = useCallback((draft: ScheduleDraft) => {
    try {
      window.localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify(serializeDraft(draft))
      );
      setStoredDraft(draft);
      setError(null);
      return true;
    } catch {
      setError("This browser could not save your draft locally.");
      return false;
    }
  }, []);

  const savePreferences = useCallback((nextPreferences: SchedularPreferences) => {
    try {
      window.localStorage.setItem(
        PREFERENCES_STORAGE_KEY,
        JSON.stringify(nextPreferences)
      );
      setPreferences(nextPreferences);
      setError(null);
      return true;
    } catch {
      setError("This browser could not save your local preferences.");
      return false;
    }
  }, []);

  const resetDraft = useCallback(() => {
    const nextDraft = createDefaultDraft();
    saveDraft(nextDraft);
    return nextDraft;
  }, [saveDraft]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    storedDraft,
    preferences,
    isLoading,
    error,
    saveDraft,
    savePreferences,
    resetDraft,
    clearError,
  };
}
