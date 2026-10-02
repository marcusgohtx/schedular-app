export interface ScheduleEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  color?: string | null;
  day: number;
}

export interface ScheduleDraft {
  name: string;
  startDate: Date;
  days: number;
  snapInterval: number;
  events: ScheduleEvent[];
  updatedAt: Date;
}

export interface SerializedScheduleEvent
  extends Omit<ScheduleEvent, "startTime" | "endTime"> {
  startTime: string;
  endTime: string;
}

export interface SerializedScheduleDraft
  extends Omit<ScheduleDraft, "startDate" | "updatedAt" | "events"> {
  startDate: string;
  updatedAt: string;
  events: SerializedScheduleEvent[];
}

export interface SchedularPreferences {
  autosaveEnabled: boolean;
  visibleStartHour: number;
  visibleEndHour: number;
}
