'use client';

import React, { useState, useRef, useCallback, useEffectEvent } from 'react';
import { ScheduleEvent } from '../../types';
import { generateId, formatTime, snapToGrid } from '../../_lib/utils';

interface TimelineProps {
  days: number;
  startDate: Date;
  events: ScheduleEvent[];
  snapInterval?: number; // Snap interval in minutes (default 15)
  visibleStartHour?: number;
  visibleEndHour?: number;
  onEventCreate: (event: Partial<ScheduleEvent>) => void;
  onEventUpdate: (eventId: string, updates: Partial<ScheduleEvent>) => void;
  onEventDelete: (eventId: string) => void;
  onMultiEventDelete?: (eventIds: string[]) => void;
  onMultiEventUpdate?: (updates: { eventId: string; updates: Partial<ScheduleEvent> }[]) => void;
}

interface DragState {
  isDragging: boolean;
  eventId: string | null;
  dragType: 'move' | 'resize-top' | 'resize-bottom' | 'multi-select' | 'multi-move' | 'create-event' | null;
  startX: number;
  startY: number;
  originalDay: number;
  originalStartTime: Date;
  originalEndTime: Date;
  isCtrlPressed: boolean;
  originalPositions?: { [eventId: string]: { day: number; startTime: Date; endTime: Date } };
  hasCopied?: boolean; // Track if we've already created a copy during this drag
}

interface SelectionBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isSelecting: boolean;
}

function createInitialDragState(): DragState {
  return {
    isDragging: false,
    eventId: null,
    dragType: null,
    startX: 0,
    startY: 0,
    originalDay: 0,
    originalStartTime: new Date(),
    originalEndTime: new Date(),
    isCtrlPressed: false,
    originalPositions: undefined,
    hasCopied: false,
  };
}

export default function Timeline({
  days,
  startDate,
  events,
  snapInterval = 15, // Default to 15 minutes
  visibleStartHour = 0,
  visibleEndHour = 24,
  onEventCreate,
  onEventUpdate,
  onEventDelete,
  onMultiEventDelete,
  onMultiEventUpdate
}: TimelineProps) {
  const headerHeight = 48;
  const timeColumnWidth = 64;
  const dayColumnWidth = 192;
  const hourHeight = 60;
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [colorPickerEventId, setColorPickerEventId] = useState<string | null>(null);
  const [creatingEvent, setCreatingEvent] = useState<Partial<ScheduleEvent> | null>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox>({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    isSelecting: false
  });
  const [dragState, setDragState] = useState<DragState>({
    ...createInitialDragState(),
  });
  const timelineRef = useRef<HTMLDivElement>(null);

  // Predefined color palette for events
  const eventColors = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#22c55e', // green
    '#f59e0b', // amber
    '#a855f7', // purple
    '#06b6d4', // cyan
    '#ec4899', // pink
    '#84cc16', // lime
    '#f97316', // orange
    '#6366f1', // indigo
    '#14b8a6', // teal
    '#8b5cf6'  // violet
  ];

  const hours = Array.from(
    { length: Math.max(1, visibleEndHour - visibleStartHour) },
    (_, i) => visibleStartHour + i
  );
  const daysArray = Array.from({ length: days }, (_, i) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    return date;
  });
  const startDateAtMidnightTime = new Date(startDate).setHours(0, 0, 0, 0);

  const getEventDayIndex = useCallback((event: Pick<ScheduleEvent, 'startTime'>) => {
    const eventDate = new Date(event.startTime);
    eventDate.setHours(0, 0, 0, 0);

    return Math.round(
      (eventDate.getTime() - startDateAtMidnightTime) / (1000 * 60 * 60 * 24)
    );
  }, [startDateAtMidnightTime]);

  const getTimeFromPosition = useCallback((y: number): { hour: number; minute: number } => {
    const visibleMinutes = Math.max(
      0,
      Math.min((visibleEndHour - visibleStartHour) * hourHeight - 1, y)
    );
    const totalMinutes =
      visibleStartHour * 60 + (visibleMinutes / hourHeight) * 60;
    const hour = Math.floor(totalMinutes / 60);
    const minute = Math.floor(totalMinutes % 60);

    const snappedMinute = snapToGrid(minute, snapInterval);

    return {
      hour: Math.max(0, Math.min(23, hour)),
      minute: snappedMinute
    };
  }, [hourHeight, snapInterval, visibleEndHour, visibleStartHour]);

  const getDayFromPosition = useCallback((x: number): number => {
    if (!timelineRef.current) return 0;

    if (x < timeColumnWidth) return 0;

    const dayIndex = Math.floor((x - timeColumnWidth) / dayColumnWidth);
    return Math.max(0, Math.min(days - 1, dayIndex));
  }, [dayColumnWidth, days, timeColumnWidth]);

  const getEventPosition = useCallback((event: ScheduleEvent) => {
    const startHour = event.startTime.getHours() + (event.startTime.getMinutes() / 60);
    const endHour = event.endTime.getHours() + (event.endTime.getMinutes() / 60);
    const eventDayIndex = getEventDayIndex(event);

    return {
      left: timeColumnWidth + (eventDayIndex * dayColumnWidth) + 4,
      top: (startHour - visibleStartHour) * hourHeight + headerHeight,
      width: dayColumnWidth - 8,
      height: (endHour - startHour) * hourHeight
    };
  }, [dayColumnWidth, getEventDayIndex, headerHeight, hourHeight, timeColumnWidth, visibleStartHour]);

  const getEventsInSelectionBox = useCallback(() => {
    const box = {
      left: Math.min(selectionBox.startX, selectionBox.currentX),
      top: Math.min(selectionBox.startY, selectionBox.currentY),
      right: Math.max(selectionBox.startX, selectionBox.currentX),
      bottom: Math.max(selectionBox.startY, selectionBox.currentY)
    };

    return events.filter(event => {
      const eventPos = getEventPosition(event);

      return (
        eventPos.left < box.right &&
        eventPos.left + eventPos.width > box.left &&
        eventPos.top < box.bottom &&
        eventPos.top + eventPos.height > box.top
      );
    }).map(event => event.id);
  }, [selectionBox, events, getEventPosition]);

  const handleGridMouseDown = (e: React.MouseEvent, dayIndex: number, hour: number, minute: number = 0) => {
    if (dragState.isDragging || selectionBox.isSelecting) return;

    // Don't create event if shift is pressed (rectangle selection mode)
    if (e.shiftKey) return;

    // If events are currently selected, deselect them instead of creating a new event
    if (selectedEvents.length > 0) {
      setSelectedEvents([]);
      return;
    }

    // Check if there's an existing event at this exact position
    const clickTime = new Date(daysArray[dayIndex]);
    clickTime.setHours(hour, minute, 0, 0);

    const eventsAtPosition = events.filter(event => {
      if (getEventDayIndex(event) !== dayIndex) return false;
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      return clickTime >= eventStart && clickTime < eventEnd;
    });

    // If there's an event at this position, don't create a new one
    if (eventsAtPosition.length > 0) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;

    // For drag creation, use exact cursor position
    // For click-only, we'll snap to hour in handleGridClick
    const eventStartTime = new Date(daysArray[dayIndex]);
    eventStartTime.setHours(hour, minute, 0, 0);

    const eventEndTime = new Date(eventStartTime);
    eventEndTime.setTime(eventStartTime.getTime() + (60 * 60 * 1000)); // Add 1 hour (will be adjusted for click-only)

    // Create the new event data for potential drag creation
    const newEventData: Partial<ScheduleEvent> = {
      id: generateId(),
      title: 'New Event',
      startTime: eventStartTime,
      endTime: eventEndTime,
      day: dayIndex,
      color: '#3b82f6'
    };

    setCreatingEvent(newEventData);
    setDragState({
      isDragging: false, // Will be set to true in handleMouseMove if user drags
      eventId: newEventData.id || null,
      dragType: 'create-event',
      startX: e.clientX,
      startY: e.clientY,
      originalDay: dayIndex,
      originalStartTime: eventStartTime,
      originalEndTime: eventEndTime,
      isCtrlPressed: false
    });
  };

  const handleGridClick = useCallback(() => {
    // This will be called on mouse up if no drag occurred
    if (dragState.dragType === 'create-event' && !dragState.isDragging && creatingEvent) {
      // For click-only, snap to hour marks and create 1-hour event
      const startTime = new Date(creatingEvent.startTime!);
      const hour = startTime.getHours();

      const snappedStartTime = new Date(startTime);
      snappedStartTime.setHours(hour, 0, 0, 0);

      const snappedEndTime = new Date(snappedStartTime);
      snappedEndTime.setTime(snappedStartTime.getTime() + (60 * 60 * 1000)); // 1 hour

      const snappedEvent = {
        ...creatingEvent,
        startTime: snappedStartTime,
        endTime: snappedEndTime
      };

      onEventCreate(snappedEvent);
      setCreatingEvent(null);
      setDragState(createInitialDragState());
    }
  }, [creatingEvent, dragState.dragType, dragState.isDragging, onEventCreate]);

  const handleBackgroundMouseDown = (e: React.MouseEvent) => {
    // Only start rectangle selection if holding Shift key
    if (!e.shiftKey) return;

    // Prevent text selection during rectangle selection
    e.preventDefault();

    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;

    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;

    setSelectionBox({
      startX,
      startY,
      currentX: startX,
      currentY: startY,
      isSelecting: true
    });

    setSelectedEvents([]);
  };

  const handleMouseDown = (e: React.MouseEvent, event: ScheduleEvent, dragType: 'move' | 'resize-top' | 'resize-bottom') => {
    e.stopPropagation();

    const isCtrlPressed = e.ctrlKey || e.metaKey;

    // Don't create copy on mousedown - wait for actual drag to start
    // Ctrl+click without drag should still allow multi-select

    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Handle multi-selection - check if we have multiple events selected and this event is one of them
    if (selectedEvents.length > 1 && selectedEvents.includes(event.id) && dragType === 'move') {
      // Store original positions of all selected events
      const originalPositions: { [eventId: string]: { day: number; startTime: Date; endTime: Date } } = {};
      selectedEvents.forEach(eventId => {
        const selectedEvent = events.find(e => e.id === eventId);
        if (selectedEvent) {
          originalPositions[eventId] = {
            day: getEventDayIndex(selectedEvent),
            startTime: new Date(selectedEvent.startTime),
            endTime: new Date(selectedEvent.endTime)
          };
        }
      });

      setDragState({
        isDragging: true,
        eventId: event.id,
        dragType: 'multi-move',
        startX: e.clientX - rect.left,
        startY: e.clientY - rect.top,
        originalDay: getEventDayIndex(event),
        originalStartTime: new Date(event.startTime),
        originalEndTime: new Date(event.endTime),
        isCtrlPressed,
        originalPositions,
        hasCopied: false
      });
      return;
    }

    setDragState({
      isDragging: true,
      eventId: event.id,
      dragType,
      startX: e.clientX - rect.left,
      startY: e.clientY - rect.top,
      originalDay: getEventDayIndex(event),
      originalStartTime: new Date(event.startTime),
      originalEndTime: new Date(event.endTime),
      isCtrlPressed,
      hasCopied: false
    });
  };

  const handleMouseMove = useEffectEvent((e: MouseEvent) => {
    // Prevent text selection during drag operations
    if (selectionBox.isSelecting || dragState.isDragging || dragState.dragType === 'create-event') {
      e.preventDefault();
    }

    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;

    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    // Handle event creation drag
    if (dragState.dragType === 'create-event' && creatingEvent) {
      const dragDistance = Math.abs(currentX - dragState.startX) + Math.abs(currentY - dragState.startY);

      if (!dragState.isDragging && dragDistance > 5) {
        // Start dragging after a minimum distance to distinguish from click
        setDragState(prev => ({ ...prev, isDragging: true }));
      }

      if (dragState.isDragging) {
        const dayIndex = Math.max(
          0,
          Math.min(days - 1, Math.floor((currentX - timeColumnWidth) / dayColumnWidth))
        );
        const { hour, minute } = getTimeFromPosition(currentY - headerHeight);

        const newEndTime = new Date(daysArray[dayIndex]);
        newEndTime.setHours(hour, minute, 0, 0);

        // Ensure end time is after start time
        const startTime = new Date(dragState.originalStartTime);
        if (newEndTime <= startTime) {
          newEndTime.setTime(startTime.getTime() + (snapInterval * 60 * 1000));
        }

        setCreatingEvent(prev => prev ? {
          ...prev,
          endTime: newEndTime,
          day: dayIndex
        } : null);
      }
      return;
    }

    // Handle selection box
    if (selectionBox.isSelecting) {
      setSelectionBox(prev => ({
        ...prev,
        currentX,
        currentY
      }));

      const eventsInBox = getEventsInSelectionBox();
      setSelectedEvents(eventsInBox);
      return;
    }

    // Handle dragging
    if (!dragState.isDragging || !dragState.eventId) return;

    const event = events.find(e => e.id === dragState.eventId);
    if (!event) return;

    // Handle Ctrl+drag copying - create copy on first drag movement
    if (dragState.isCtrlPressed && dragState.dragType === 'move' && !dragState.hasCopied) {
      const copiedEvent: Partial<ScheduleEvent> = {
        id: generateId(),
        title: event.title,
        startTime: new Date(event.startTime),
        endTime: new Date(event.endTime),
        day: getEventDayIndex(event),
        color: event.color
      };

      onEventCreate(copiedEvent);

      // Mark that we've created a copy to avoid creating multiple copies during this drag
      setDragState(prev => ({ ...prev, hasCopied: true }));
      return; // Don't move the original event when copying
    }

    if (dragState.dragType === 'multi-move' && dragState.originalPositions) {
      // Move all selected events together using offset from initial click position
      const deltaX = currentX - dragState.startX;
      const deltaY = currentY - dragState.startY;

      // Calculate new position based on original position + delta
      const originalEventTop =
        ((dragState.originalStartTime.getHours() - visibleStartHour) +
          dragState.originalStartTime.getMinutes() / 60) *
          hourHeight +
        headerHeight;
      const newY = originalEventTop + deltaY;

      const originalEventLeft = timeColumnWidth + (dragState.originalDay * dayColumnWidth);
      const newX = originalEventLeft + deltaX;

      const newDay = getDayFromPosition(newX);
      const { hour, minute } = getTimeFromPosition(newY - headerHeight);

      // Calculate delta from the original position of the dragged event
      const targetTime = hour * 60 + minute;
      const originalTime = dragState.originalStartTime.getHours() * 60 + dragState.originalStartTime.getMinutes();
      const timeDelta = targetTime - originalTime;
      const dayDelta = newDay - dragState.originalDay;

      // Apply the same delta to all selected events using their original positions
      if (onMultiEventUpdate) {
        // Use batch update for better performance
        const updates: { eventId: string; updates: Partial<ScheduleEvent> }[] = [];

        selectedEvents.forEach(eventId => {
          const originalPos = dragState.originalPositions![eventId];
          if (!originalPos) {
            return;
          }

          const newEventDay = Math.max(0, Math.min(days - 1, originalPos.day + dayDelta));

          const originalEventMinutes = originalPos.startTime.getHours() * 60 + originalPos.startTime.getMinutes();
          const duration = originalPos.endTime.getTime() - originalPos.startTime.getTime();

          const newStartMinutes = originalEventMinutes + timeDelta;
          const newStartTime = new Date(daysArray[newEventDay]);
          newStartTime.setHours(0, 0, 0, 0);
          newStartTime.setMinutes(newStartMinutes);

          const newEndTime = new Date(newStartTime.getTime() + duration);

          // Validate time bounds
          if (newStartTime.getHours() >= 0 && newStartTime.getHours() <= 23 &&
              newEndTime.getHours() >= 0 && newEndTime.getHours() <= 23) {
            updates.push({
              eventId,
              updates: {
                day: newEventDay,
                startTime: newStartTime,
                endTime: newEndTime
              }
            });
          }
        });

        if (updates.length > 0) {
          onMultiEventUpdate(updates);
        }
      } else {
        // Fallback to individual updates
        selectedEvents.forEach(eventId => {
          const originalPos = dragState.originalPositions![eventId];
          if (!originalPos) return;

          const newEventDay = Math.max(0, Math.min(days - 1, originalPos.day + dayDelta));

          const originalEventMinutes = originalPos.startTime.getHours() * 60 + originalPos.startTime.getMinutes();
          const duration = originalPos.endTime.getTime() - originalPos.startTime.getTime();

          const newStartMinutes = originalEventMinutes + timeDelta;
          const newStartTime = new Date(daysArray[newEventDay]);
          newStartTime.setHours(0, 0, 0, 0);
          newStartTime.setMinutes(newStartMinutes);

          const newEndTime = new Date(newStartTime.getTime() + duration);

          // Validate time bounds
          if (newStartTime.getHours() >= 0 && newStartTime.getHours() <= 23 &&
              newEndTime.getHours() >= 0 && newEndTime.getHours() <= 23) {
            onEventUpdate(eventId, {
              day: newEventDay,
              startTime: newStartTime,
              endTime: newEndTime
            });
          }
        });
      }
    } else if (dragState.dragType === 'move') {
      // Move single event using offset from initial click position
      const deltaX = currentX - dragState.startX;
      const deltaY = currentY - dragState.startY;

      // Calculate new position based on original position + delta
      const originalEventTop =
        ((dragState.originalStartTime.getHours() - visibleStartHour) +
          dragState.originalStartTime.getMinutes() / 60) *
          hourHeight +
        headerHeight;
      const newY = originalEventTop + deltaY;

      const dayTolerance = dayColumnWidth * 0.25;
      let newDay = dragState.originalDay;

      if (deltaX > dayTolerance) {
        newDay = Math.min(days - 1, dragState.originalDay + Math.floor((deltaX - dayTolerance) / dayColumnWidth) + 1);
      } else if (deltaX < -dayTolerance) {
        newDay = Math.max(0, dragState.originalDay + Math.ceil((deltaX + dayTolerance) / dayColumnWidth) - 1);
      }

      const { hour, minute } = getTimeFromPosition(newY - headerHeight);

      const originalDuration = dragState.originalEndTime.getTime() - dragState.originalStartTime.getTime();

      const newStartTime = new Date(daysArray[newDay]);
      newStartTime.setHours(hour, minute, 0, 0);

      const newEndTime = new Date(newStartTime.getTime() + originalDuration);

      onEventUpdate(dragState.eventId, {
        day: newDay,
        startTime: newStartTime,
        endTime: newEndTime
      });
    } else if (dragState.dragType === 'resize-top') {
      const { hour, minute } = getTimeFromPosition(currentY - headerHeight);

      const eventDayIndex = getEventDayIndex(event);
      const newStartTime = new Date(daysArray[eventDayIndex]);
      newStartTime.setHours(hour, minute, 0, 0);

      if (newStartTime.getTime() < event.endTime.getTime()) {
        onEventUpdate(dragState.eventId, {
          startTime: newStartTime
        });
      }
    } else if (dragState.dragType === 'resize-bottom') {
      const { hour, minute } = getTimeFromPosition(currentY - headerHeight);

      const eventDayIndex = getEventDayIndex(event);
      const newEndTime = new Date(daysArray[eventDayIndex]);
      newEndTime.setHours(hour, minute, 0, 0);

      if (newEndTime.getTime() > event.startTime.getTime()) {
        onEventUpdate(dragState.eventId, {
          endTime: newEndTime
        });
      }
    }
  });

  const handleMouseUp = useEffectEvent(() => {
    if (selectionBox.isSelecting) {
      setSelectionBox(prev => ({ ...prev, isSelecting: false }));
    }

    // Handle event creation completion
    if (dragState.dragType === 'create-event' && creatingEvent) {
      if (dragState.isDragging) {
        // Drag completed - create event with custom duration
        onEventCreate(creatingEvent);
      } else {
        // Click only - create 1-hour event at hour mark
        handleGridClick();
      }

      setCreatingEvent(null);
      setDragState(createInitialDragState());
      return;
    }

    if (dragState.isDragging) {
      setDragState(createInitialDragState());
    }
  });

  React.useEffect(() => {
    if (dragState.isDragging || selectionBox.isSelecting || dragState.dragType === 'create-event') {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState.isDragging, dragState.dragType, selectionBox.isSelecting]);

  // Keyboard event handler for deleting selected events
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedEvents.length > 0 && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        if (onMultiEventDelete && selectedEvents.length > 1) {
          // Use multi-delete for better performance when deleting multiple events
          onMultiEventDelete([...selectedEvents]);
        } else {
          // Fallback to individual deletes
          selectedEvents.forEach(eventId => onEventDelete(eventId));
        }
        setSelectedEvents([]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedEvents, onEventDelete, onMultiEventDelete]);

  // Handle clicking outside to cancel event editing and color picker
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editingEventId && !(e.target as Element)?.closest('.event-edit-input')) {
        setEditingEventId(null);
      }
      if (colorPickerEventId && !(e.target as Element)?.closest('.color-picker-container')) {
        setColorPickerEventId(null);
      }
    };

    if (editingEventId || colorPickerEventId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [editingEventId, colorPickerEventId]);

  const handleEventClick = (e: React.MouseEvent, event: ScheduleEvent) => {
    e.stopPropagation();
    if (dragState.isDragging || selectionBox.isSelecting) return;

    if (e.ctrlKey || e.metaKey) {
      // Multi-select with Ctrl/Cmd
      setSelectedEvents(prev =>
        prev.includes(event.id)
          ? prev.filter(id => id !== event.id)
          : [...prev, event.id]
      );
    } else {
      // Single select
      setSelectedEvents(prev =>
        prev.includes(event.id) && prev.length === 1 ? [] : [event.id]
      );
    }
  };

  const getEventStyle = (event: ScheduleEvent) => {
    const startHour = event.startTime.getHours() + (event.startTime.getMinutes() / 60);
    const endHour = event.endTime.getHours() + (event.endTime.getMinutes() / 60);
    const duration = endHour - startHour;
    const startMinutes = event.startTime.getHours() * 60 + event.startTime.getMinutes();

    const isDragging = dragState.isDragging && (
      dragState.eventId === event.id ||
      (dragState.dragType === 'multi-move' && selectedEvents.includes(event.id))
    );
    const isSelected = selectedEvents.includes(event.id);
    const baseZIndex = 100 + startMinutes;

    const displayHeight = duration * 60;

    return {
      position: 'absolute' as const,
      top: `${(startHour - visibleStartHour) * hourHeight}px`,
      height: `${displayHeight}px`,
      left: '4px',
      right: '4px',
      backgroundColor: event.color || '#3b82f6',
      borderRadius: '4px',
      padding: '4px',
      fontSize: '12px',
      color: 'white',
      cursor: isDragging ? 'grabbing' : 'grab',
      zIndex: isDragging ? 5000 : isSelected ? 4000 + startMinutes : baseZIndex,
      border: isDragging || isSelected
        ? '3px solid rgba(17, 24, 39, 0.98)'
        : '2px solid rgba(17, 24, 39, 0.92)',
      opacity: isDragging ? 0.9 : 1,
      transform: isDragging ? 'scale(1.02)' : 'none',
      transition: isDragging ? 'none' : 'all 0.2s ease',
      boxShadow: isDragging
        ? '0 10px 28px rgba(0, 0, 0, 0.28)'
        : isSelected
          ? '0 4px 12px rgba(0, 0, 0, 0.22)'
          : '0 2px 6px rgba(0, 0, 0, 0.12)',
      userSelect: 'none' as const,
      overflow: 'visible' as const,
    };
  };

  const isEventVisible = (event: ScheduleEvent) => {
    const eventStart = event.startTime.getHours() + (event.startTime.getMinutes() / 60);
    const eventEnd = event.endTime.getHours() + (event.endTime.getMinutes() / 60);

    return eventEnd > visibleStartHour && eventStart < visibleEndHour;
  };

  const getSelectionBoxStyle = () => {
    if (!selectionBox.isSelecting) return { display: 'none' };

    const left = Math.min(selectionBox.startX, selectionBox.currentX);
    const top = Math.min(selectionBox.startY, selectionBox.currentY);
    const width = Math.abs(selectionBox.currentX - selectionBox.startX);
    const height = Math.abs(selectionBox.currentY - selectionBox.startY);

    return {
      position: 'absolute' as const,
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      border: '2px dashed #3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      pointerEvents: 'none' as const,
      zIndex: 6000,
    };
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Schedule Timeline</h2>
          {selectedEvents.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-600 font-medium">
                {selectedEvents.length} selected
              </span>
              <button
                onClick={() => {
                  if (onMultiEventDelete && selectedEvents.length > 1) {
                    onMultiEventDelete([...selectedEvents]);
                  } else {
                    selectedEvents.forEach(eventId => onEventDelete(eventId));
                  }
                  setSelectedEvents([]);
                }}
                className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
              >
                Delete Selected
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Timeline Grid */}
      <div className="overflow-auto select-none" style={{ height: '600px' }}>
        <div
          ref={timelineRef}
          className="flex min-w-max relative select-none"
          onMouseDown={handleBackgroundMouseDown}
          style={{ userSelect: 'none' }}
        >
          {/* Selection box */}
          <div style={getSelectionBoxStyle()} />

          {/* Time Column */}
          <div className="time-column w-16 bg-gray-50 border-r border-gray-200 relative z-10">
            <div className="h-12 border-b border-gray-200 sticky top-0 bg-gray-50 z-30"></div>
            {hours.map((hour) => (
              <div
                key={hour}
                className="h-15 border-b-2 border-gray-500 flex items-start justify-center pt-1 text-xs text-gray-600"
                style={{ height: `${hourHeight}px` }}
              >
                {formatTime(new Date(2024, 0, 1, hour))}
              </div>
            ))}
          </div>

          {/* Days Columns */}
          {daysArray.map((date, dayIndex) => (
            <div key={dayIndex} className="flex-shrink-0 w-48 border-r border-gray-200">
              {/* Day Header */}
              <div className="h-12 bg-gray-50 border-b border-gray-200 flex items-center justify-center sticky top-0 z-20">
                <div className="text-center">
                  <div className="text-xs text-gray-500">
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className="text-sm font-semibold text-gray-800">
                    {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </div>

              {/* Day Column with Hours */}
              <div className="relative overflow-hidden">
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className={`border-b-2 border-gray-500 cursor-pointer relative transition-colors ${
                      !dragState.isDragging && !selectionBox.isSelecting ? 'hover:bg-blue-50' : ''
                    }`}
                    style={{ height: `${hourHeight}px` }}
                    onMouseDown={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const y = e.clientY - rect.top;
                      const minute = snapToGrid((y / hourHeight) * 60, snapInterval);
                      handleGridMouseDown(e, dayIndex, hour, minute);
                    }}
                  >
                    {/* Dynamic grid lines based on snap interval */}
                    {Array.from({ length: Math.floor(60 / snapInterval) - 1 }, (_, i) => (
                      <div
                        key={i}
                        className="absolute top-0 left-0 right-0 h-px bg-gray-300"
                        style={{ top: `${((i + 1) * snapInterval / 60) * hourHeight}px` }}
                      />
                    ))}
                  </div>
                ))}

                {/* Preview event being created */}
                {creatingEvent && getEventDayIndex(creatingEvent as ScheduleEvent) === dayIndex && (
                  <div
                    style={{
                      ...getEventStyle(creatingEvent as ScheduleEvent),
                      opacity: 0.7,
                      border: '2px dashed #3b82f6',
                      backgroundColor: 'rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    <div className="px-2 py-1 text-xs text-blue-800">
                      {creatingEvent.title}
                    </div>
                  </div>
                )}

                {/* Events for this day */}
                {events
                  .filter((event) => getEventDayIndex(event) === dayIndex && isEventVisible(event))
                  .sort((leftEvent, rightEvent) => {
                    const leftStartMinutes =
                      leftEvent.startTime.getHours() * 60 +
                      leftEvent.startTime.getMinutes();
                    const rightStartMinutes =
                      rightEvent.startTime.getHours() * 60 +
                      rightEvent.startTime.getMinutes();

                    if (leftStartMinutes !== rightStartMinutes) {
                      return leftStartMinutes - rightStartMinutes;
                    }

                    return leftEvent.endTime.getTime() - rightEvent.endTime.getTime();
                  })
                  .map((event) => (
                    <div
                      key={event.id}
                      style={getEventStyle(event)}
                      onClick={(e) => handleEventClick(e, event)}
                    >
                      {/* Top resize handle */}
                      <div
                        className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-black hover:bg-opacity-20 rounded-t"
                        style={{ zIndex: 15 }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleMouseDown(e, event, 'resize-top');
                        }}
                      />

                      {/* Event content with drag handling */}
                      <div
                        className="relative group px-2 py-1"
                        style={{
                          cursor: 'grab',
                          zIndex: 10, // Higher than resize handles to capture all clicks
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          overflow: 'hidden',
                          borderRadius: '2px',
                        }}
                        onMouseDown={(e) => {
                          if (editingEventId === event.id || colorPickerEventId === event.id) {
                            return;
                          }
                          const target = e.target as HTMLElement;

                          // Check if we're clicking near the edges for resize functionality
                          const rect = e.currentTarget.getBoundingClientRect();
                          const y = e.clientY - rect.top;
                          const isNearTop = y <= 8;
                          const isNearBottom = y >= rect.height - 8;

                          if (isNearTop) {
                            // Delegate to top resize handle
                            handleMouseDown(e, event, 'resize-top');
                            return;
                          }

                          if (isNearBottom) {
                            // Delegate to bottom resize handle
                            handleMouseDown(e, event, 'resize-bottom');
                            return;
                          }

                          // Don't drag when clicking on interactive elements
                          if (target.tagName === 'BUTTON' ||
                              target.closest('button') ||
                              target.closest('.color-picker-container')) {
                            return;
                          }

                          // Handle drag for the main area
                          handleMouseDown(e, event, 'move');
                        }}
                      >
                        <div className="flex items-start gap-1 min-w-0">
                          <input
                            ref={(el) => {
                              if (el && editingEventId === event.id) {
                                setTimeout(() => {
                                  el.focus();
                                  el.select();
                                }, 0);
                              }
                            }}
                            type="text"
                            value={event.title}
                            onChange={(e) => {
                              onEventUpdate(event.id, { title: e.target.value });
                            }}
                            onBlur={() => setEditingEventId(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === 'Escape') {
                                setEditingEventId(null);
                                e.currentTarget.blur();
                              }
                              e.stopPropagation();
                            }}
                            onMouseDown={(e) => {
                              if (editingEventId === event.id) {
                                e.stopPropagation(); // Only stop propagation when editing
                              }
                            }}
                            className={`event-edit-input font-medium truncate border border-transparent rounded w-full transition-all duration-200 min-w-0 text-white ${
                              editingEventId === event.id
                                ? 'bg-white bg-opacity-20 focus:border-white focus:border-opacity-50 px-1 py-0 cursor-text'
                                : 'bg-transparent px-0 py-0 cursor-default'
                            }`}
                            style={{
                              lineHeight: '1.2',
                              backgroundColor: editingEventId === event.id ? 'rgba(255,255,255,0.2)' : 'transparent',
                              pointerEvents: editingEventId === event.id ? 'auto' : 'none'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              // Don't allow direct clicking to edit - only via pencil icon
                            }}
                            readOnly={editingEventId !== event.id}
                          />
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setEditingEventId(event.id);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="flex-shrink-0 opacity-0 group-hover:opacity-70 hover:opacity-100 text-white p-0.5 rounded transition-all duration-200"
                            type="button"
                            aria-label="Edit event title"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setColorPickerEventId(colorPickerEventId === event.id ? null : event.id);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="flex-shrink-0 opacity-0 group-hover:opacity-70 hover:opacity-100 text-white p-0.5 rounded transition-all duration-200"
                            type="button"
                            aria-label="Change event color"
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-5.51-4.49-10-9-10zM6.5 12c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5S18.33 12 17.5 12z"/>
                            </svg>
                          </button>
                        </div>
                        <div className="text-xs opacity-90 mt-1">
                          {formatTime(event.startTime)} - {formatTime(event.endTime)}
                        </div>

                        {/* Color picker */}
                        {colorPickerEventId === event.id && (
                          <div className="color-picker-container absolute top-full left-2 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-2 z-50">
                            <div className="grid grid-cols-4 gap-1">
                              {eventColors.map((color) => (
                                <button
                                  key={color}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onEventUpdate(event.id, { color });
                                    setColorPickerEventId(null);
                                  }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${
                                    (event.color || '#3b82f6') === color
                                      ? 'border-gray-600 ring-2 ring-gray-400'
                                      : 'border-gray-300 hover:border-gray-400'
                                  }`}
                                  style={{ backgroundColor: color }}
                                  aria-label={`Change color to ${color}`}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Bottom resize handle */}
                      <div
                        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-black hover:bg-opacity-20 rounded-b"
                        style={{ zIndex: 15 }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleMouseDown(e, event, 'resize-bottom');
                        }}
                      />

                      {/* Delete button */}
                      {selectedEvents.includes(event.id) && selectedEvents.length === 1 && !dragState.isDragging && (
                        <button
                          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 z-40"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventDelete(event.id);
                            setSelectedEvents([]);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          X
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
