"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import Timeline from "./scheduler/Timeline";
import { TimeWindowSlider } from "./time-window-slider";
import { downloadIcsFile } from "../_lib/ics";
import {
  formatDateInputValue,
  generateId,
  parseDateInputValue,
} from "../_lib/utils";
import { useLocalScheduleDraft } from "../_hooks/useLocalScheduleDraft";
import type { ScheduleDraft, ScheduleEvent, SchedularPreferences } from "../types";

function LoadingState() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
        <p className="text-gray-600 mt-4">Loading local schedule...</p>
      </div>
    </div>
  );
}

function buildDraft(
  scheduleName: string,
  startDate: Date,
  days: number,
  snapInterval: number,
  events: ScheduleEvent[]
): ScheduleDraft {
  return {
    name: scheduleName.trim() || "My Schedule",
    startDate,
    days,
    snapInterval,
    events,
    updatedAt: new Date(),
  };
}

export function SchedularProjectPage() {
  const {
    storedDraft,
    preferences: storedPreferences,
    isLoading,
    error: storageError,
    saveDraft,
    savePreferences,
    resetDraft,
    clearError,
  } = useLocalScheduleDraft();
  const [scheduleName, setScheduleName] = useState("My Schedule");
  const [days, setDays] = useState(3);
  const [snapInterval, setSnapInterval] = useState(15);
  const [startDate, setStartDate] = useState(new Date());
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [preferences, setPreferences] = useState<SchedularPreferences>({
    autosaveEnabled: true,
    visibleStartHour: 6,
    visibleEndHour: 22,
  });
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showSavedConfirmation, setShowSavedConfirmation] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedConfirmationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const showSavedFeedback = useCallback(() => {
    setShowSavedConfirmation(true);

    if (savedConfirmationTimeoutRef.current) {
      clearTimeout(savedConfirmationTimeoutRef.current);
    }

    savedConfirmationTimeoutRef.current = setTimeout(() => {
      setShowSavedConfirmation(false);
    }, 3000);
  }, []);

  const applyDraft = useCallback((draft: ScheduleDraft) => {
    setScheduleName(draft.name);
    setDays(draft.days);
    setSnapInterval(draft.snapInterval);
    setStartDate(new Date(draft.startDate));
    setEvents(draft.events);
    setHasUnsavedChanges(false);
  }, []);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    applyDraft(storedDraft);
    setPreferences(storedPreferences);
  }, [applyDraft, isLoading, storedDraft, storedPreferences]);

  useEffect(() => {
    setPageError(storageError);
  }, [storageError]);

  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      if (savedConfirmationTimeoutRef.current) {
        clearTimeout(savedConfirmationTimeoutRef.current);
      }
    };
  }, []);

  const persistDraft = useCallback(
    (nextDraft: ScheduleDraft) => {
      const wasSaved = saveDraft(nextDraft);

      if (!wasSaved) {
        setPageError("This browser could not save your draft locally.");
        return false;
      }

      setHasUnsavedChanges(false);
      setPageError(null);
      clearError();
      showSavedFeedback();
      return true;
    },
    [clearError, saveDraft, showSavedFeedback]
  );

  const saveCurrentDraft = useCallback(() => {
    setSaving(true);

    try {
      const nextDraft = buildDraft(
        scheduleName,
        startDate,
        days,
        snapInterval,
        events
      );
      return persistDraft(nextDraft);
    } finally {
      setSaving(false);
    }
  }, [days, events, persistDraft, scheduleName, snapInterval, startDate]);

  useEffect(() => {
    if (!hasUnsavedChanges || !preferences.autosaveEnabled) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
      return;
    }

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      saveCurrentDraft();
    }, 1200);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [hasUnsavedChanges, preferences.autosaveEnabled, saveCurrentDraft]);

  const focusTitleInput = useCallback(() => {
    setIsEditingTitle(true);
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, []);

  const handleEventCreate = useCallback((newEvent: Partial<ScheduleEvent>) => {
    const event: ScheduleEvent = {
      id: newEvent.id ?? generateId(),
      title: newEvent.title ?? "New Event",
      startTime: newEvent.startTime ?? new Date(),
      endTime: newEvent.endTime ?? new Date(),
      day: newEvent.day ?? 0,
      color: newEvent.color || "#3b82f6",
    };
    setEvents((prevEvents) => [...prevEvents, event]);
    setHasUnsavedChanges(true);
  }, []);

  const handleDaysChange = (nextDays: number) => {
    if (nextDays >= days) {
      setDays(nextDays);
      setHasUnsavedChanges(true);
      return;
    }

    const eventsOutsideRange = events.filter((event) => event.day >= nextDays);

    if (
      eventsOutsideRange.length > 0 &&
      !window.confirm(
        `Reducing the schedule to ${nextDays} days will remove ${eventsOutsideRange.length} event(s) outside the new range. Continue?`
      )
    ) {
      return;
    }

    setDays(nextDays);
    setEvents((prevEvents) =>
      prevEvents.filter((event) => event.day < nextDays)
    );
    setHasUnsavedChanges(true);
  };

  const handleEventUpdate = useCallback(
    (eventId: string, updates: Partial<ScheduleEvent>) => {
      setEvents((prevEvents) =>
        prevEvents.map((event) =>
          event.id === eventId ? { ...event, ...updates } : event
        )
      );
      setHasUnsavedChanges(true);
    },
    []
  );

  const handleMultiEventUpdate = useCallback(
    (updates: { eventId: string; updates: Partial<ScheduleEvent> }[]) => {
      setEvents((prevEvents) => {
        const nextEvents = [...prevEvents];

        updates.forEach(({ eventId, updates: eventUpdates }) => {
          const eventIndex = nextEvents.findIndex((event) => event.id === eventId);

          if (eventIndex !== -1) {
            nextEvents[eventIndex] = {
              ...nextEvents[eventIndex],
              ...eventUpdates,
            };
          }
        });

        return nextEvents;
      });
      setHasUnsavedChanges(true);
    },
    []
  );

  const handleEventDelete = useCallback((eventId: string) => {
    setEvents((prevEvents) =>
      prevEvents.filter((event) => event.id !== eventId)
    );
    setHasUnsavedChanges(true);
  }, []);

  const handleMultiEventDelete = useCallback((eventIds: string[]) => {
    setEvents((prevEvents) =>
      prevEvents.filter((event) => !eventIds.includes(event.id))
    );
    setHasUnsavedChanges(true);
  }, []);

  const handleStartDateChange = (value: string) => {
    const nextStartDate = parseDateInputValue(value);

    if (!nextStartDate) {
      return;
    }

    if (nextStartDate.getTime() === startDate.getTime()) {
      return;
    }

    const nextEndDate = new Date(nextStartDate);
    nextEndDate.setDate(nextEndDate.getDate() + days - 1);
    nextEndDate.setHours(23, 59, 59, 999);

    const eventsOutsideRange = events.filter((event) => {
      const eventDate = new Date(event.startTime);
      eventDate.setHours(0, 0, 0, 0);

      return eventDate < nextStartDate || eventDate > nextEndDate;
    });

    if (
      eventsOutsideRange.length > 0 &&
      !window.confirm(
        `Changing the start date will remove ${eventsOutsideRange.length} event(s) outside the new range. Continue?`
      )
    ) {
      return;
    }

    setStartDate(nextStartDate);
    setEvents((prevEvents) =>
      prevEvents.filter((event) => {
        const eventDate = new Date(event.startTime);
        eventDate.setHours(0, 0, 0, 0);

        return eventDate >= nextStartDate && eventDate <= nextEndDate;
      })
    );
    setHasUnsavedChanges(true);
  };

  const handleAutosaveChange = (enabled: boolean) => {
    const nextPreferences = {
      ...preferences,
      autosaveEnabled: enabled,
    };
    const wasSaved = savePreferences(nextPreferences);

    setPreferences(nextPreferences);

    if (!wasSaved) {
      setPageError("This browser could not save your local preferences.");
      return;
    }

    if (!enabled) {
      setShowSavedConfirmation(false);
    }
    setPageError(null);
  };

  const handleVisibleHoursChange = (visibleStartHour: number, visibleEndHour: number) => {
    const nextPreferences = {
      ...preferences,
      visibleStartHour,
      visibleEndHour,
    };
    const wasSaved = savePreferences(nextPreferences);

    setPreferences(nextPreferences);

    if (!wasSaved) {
      setPageError("This browser could not save your local preferences.");
      return;
    }

    setPageError(null);
  };

  const handleResetDraft = () => {
    const shouldReset =
      !hasUnsavedChanges ||
      events.length === 0 ||
      window.confirm(
        "Start a new schedule? Your current working schedule will be replaced in this browser."
      );

    if (!shouldReset) {
      return;
    }

    const freshDraft = resetDraft();
    applyDraft(freshDraft);
    setPageError(null);
    showSavedFeedback();
  };

  const handleExport = () => {
    if (events.length === 0) {
      window.alert("Add at least one event before exporting.");
      return;
    }

    const nextDraft = buildDraft(scheduleName, startDate, days, snapInterval, events);
    persistDraft(nextDraft);
    downloadIcsFile(nextDraft);
  };

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="container mx-auto flex justify-between items-center gap-4">
          <div>
            <Link
              href="https://marcusgohtx.github.io/projects/"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Back to projects
            </Link>
            <p className="text-xl font-bold text-gray-800 mt-1">schedular</p>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-start gap-2 group" style={{ minHeight: "44px" }}>
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={scheduleName}
                    onChange={(event) => {
                      setScheduleName(event.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    onFocus={() => setIsEditingTitle(true)}
                    onBlur={() => setIsEditingTitle(false)}
                    className={`text-2xl font-bold text-gray-900 bg-transparent border border-transparent rounded-lg flex-shrink min-w-0 transition-all duration-200 ${
                      isEditingTitle
                        ? "focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 px-3 py-1"
                        : "px-0 py-1"
                    }`}
                    style={{ lineHeight: "1.2" }}
                    placeholder="Schedule Name"
                  />
                  <button
                    onClick={(event) => {
                      event.preventDefault();
                      focusTitleInput();
                    }}
                    className="flex-shrink-0 text-gray-500 hover:text-gray-700 p-1 rounded transition-colors duration-200 mt-1"
                    type="button"
                    aria-label="Edit schedule name"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                  </button>
                </div>
                <p className="text-gray-600 text-sm mt-1 min-h-5">
                  {hasUnsavedChanges && !saving && !showSavedConfirmation && (
                    <span className="text-amber-600">
                      Unsaved changes
                      {!preferences.autosaveEnabled && " (autosave off)"}
                    </span>
                  )}
                  {saving && <span className="text-blue-600">Saving locally...</span>}
                  {showSavedConfirmation && !saving && (
                    <span className="text-green-600">Saved in this browser</span>
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleResetDraft}
                  type="button"
                  className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  New Schedule
                </button>
                <button
                  onClick={saveCurrentDraft}
                  type="button"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Save Locally
                </button>
                <button
                  onClick={handleExport}
                  type="button"
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
                  disabled={events.length === 0}
                >
                  Download .ics
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label htmlFor="schedular-start-date" className="text-sm text-gray-600">
                  Start:
                </label>
                <input
                  id="schedular-start-date"
                  type="date"
                  value={formatDateInputValue(startDate)}
                  onChange={(event) => handleStartDateChange(event.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900"
                />
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="schedular-days" className="text-sm text-gray-600">
                  Days:
                </label>
                <select
                  id="schedular-days"
                  value={days}
                  onChange={(event) => handleDaysChange(Number(event.target.value))}
                  className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900"
                >
                  {Array.from({ length: 20 }, (_, index) => index + 1).map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-start gap-3">
                <span className="text-sm text-gray-600 pt-1">Show:</span>
                <TimeWindowSlider
                  startHour={preferences.visibleStartHour}
                  endHour={preferences.visibleEndHour}
                  onChange={handleVisibleHoursChange}
                />
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="schedular-snap" className="text-sm text-gray-600">
                  Snap:
                </label>
                <select
                  id="schedular-snap"
                  value={snapInterval}
                  onChange={(event) => {
                    setSnapInterval(Number(event.target.value));
                    setHasUnsavedChanges(true);
                  }}
                  className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900"
                >
                  <option value={60}>1 hour</option>
                  <option value={30}>30 min</option>
                  <option value={15}>15 min</option>
                  <option value={5}>5 min</option>
                </select>
              </div>

              <label className="text-sm text-gray-600 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={preferences.autosaveEnabled}
                  onChange={(event) => handleAutosaveChange(event.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                Autosave
              </label>
            </div>
          </div>
        </div>

        {pageError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-red-800">{pageError}</p>
              <button
                type="button"
                onClick={() => {
                  setPageError(null);
                  clearError();
                }}
                className="text-sm text-red-700 hover:text-red-900"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <Timeline
          days={days}
          startDate={startDate}
          events={events}
          snapInterval={snapInterval}
          visibleStartHour={preferences.visibleStartHour}
          visibleEndHour={preferences.visibleEndHour}
          onEventCreate={handleEventCreate}
          onEventUpdate={handleEventUpdate}
          onEventDelete={handleEventDelete}
          onMultiEventDelete={handleMultiEventDelete}
          onMultiEventUpdate={handleMultiEventUpdate}
        />

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">How to use</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>Click to add, drag to move, and drag edges to resize.</li>
              <li>Use Shift to box-select and Ctrl or Cmd plus drag to duplicate.</li>
              <li>Use the pencil and palette icons to rename and recolor.</li>
            </ul>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-2">
              Import into Google Calendar
            </h3>
            <ol className="text-sm text-green-800 space-y-1 list-decimal list-inside">
              <li>Click Download .ics after your schedule looks right.</li>
              <li>Open Google Calendar and choose Settings, then Import and export.</li>
              <li>Select the downloaded `.ics` file and import it into the calendar you want.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
