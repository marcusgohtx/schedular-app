import {
  type ScheduleDraft,
  type ScheduleEvent,
  type SerializedScheduleDraft,
  type SerializedScheduleEvent,
} from "../types";

const DEFAULT_DAYS = 3;
const DEFAULT_SNAP_INTERVAL = 15;

function startOfLocalDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

export function createDefaultDraft(): ScheduleDraft {
  return {
    name: "My Schedule",
    startDate: startOfLocalDay(new Date()),
    days: DEFAULT_DAYS,
    snapInterval: DEFAULT_SNAP_INTERVAL,
    events: [],
    updatedAt: new Date(),
  };
}

export function serializeScheduleEvent(
  event: ScheduleEvent
): SerializedScheduleEvent {
  return {
    ...event,
    startTime: event.startTime.toISOString(),
    endTime: event.endTime.toISOString(),
  };
}

export function deserializeScheduleEvent(
  event: SerializedScheduleEvent
): ScheduleEvent {
  return {
    ...event,
    startTime: new Date(event.startTime),
    endTime: new Date(event.endTime),
  };
}

export function serializeDraft(draft: ScheduleDraft): SerializedScheduleDraft {
  return {
    ...draft,
    startDate: draft.startDate.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
    events: draft.events.map(serializeScheduleEvent),
  };
}

export function deserializeDraft(
  draft: SerializedScheduleDraft
): ScheduleDraft {
  return {
    ...draft,
    startDate: new Date(draft.startDate),
    updatedAt: new Date(draft.updatedAt),
    events: draft.events.map(deserializeScheduleEvent),
  };
}
