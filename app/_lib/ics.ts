import type { ScheduleDraft } from "../types";
import { slugify } from "./utils";

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatUtcDateTime(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function formatLocalDateTime(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  const seconds = `${date.getSeconds()}`.padStart(2, "0");

  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

function foldLine(line: string) {
  const maxLength = 74;

  if (line.length <= maxLength) {
    return line;
  }

  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < line.length) {
    const segment = line.slice(cursor, cursor + maxLength);
    chunks.push(cursor === 0 ? segment : ` ${segment}`);
    cursor += maxLength;
  }

  return chunks.join("\r\n");
}

export function buildIcsFile(draft: ScheduleDraft) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const dtStamp = formatUtcDateTime(new Date());

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Marcus Goh//Schedular//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    foldLine(`X-WR-CALNAME:${escapeIcsText(draft.name)}`),
    `X-WR-TIMEZONE:${timeZone}`,
  ];

  draft.events.forEach((event) => {
    lines.push("BEGIN:VEVENT");
    lines.push(foldLine(`UID:${event.id}@schedular.local`));
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(`DTSTART;TZID=${timeZone}:${formatLocalDateTime(event.startTime)}`);
    lines.push(`DTEND;TZID=${timeZone}:${formatLocalDateTime(event.endTime)}`);
    lines.push(foldLine(`SUMMARY:${escapeIcsText(event.title)}`));
    lines.push(
      foldLine(
        `DESCRIPTION:${escapeIcsText(
          `Imported from schedular. Day ${event.day + 1} of ${draft.days}.`
        )}`
      )
    );
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");

  return `${lines.join("\r\n")}\r\n`;
}

export function downloadIcsFile(draft: ScheduleDraft) {
  const icsFile = buildIcsFile(draft);
  const blob = new Blob([icsFile], {
    type: "text/calendar;charset=utf-8",
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const filename = `${slugify(draft.name || "schedule") || "schedule"}.ics`;

  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}
