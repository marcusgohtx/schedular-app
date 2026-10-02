"use client";

interface TimeWindowSliderProps {
  startHour: number;
  endHour: number;
  onChange: (startHour: number, endHour: number) => void;
}

const LEFT_MIN_HOUR = 0;
const LEFT_MAX_HOUR = 6;
const RIGHT_MIN_HOUR = 18;
const RIGHT_MAX_HOUR = 24;
const MAX_HOUR = 24;

function formatHourLabel(hour: number) {
  const normalizedHour = hour % 24;
  const suffix = normalizedHour >= 12 ? "PM" : "AM";
  const twelveHour = normalizedHour % 12 || 12;
  return `${twelveHour} ${suffix}`;
}

export function TimeWindowSlider({
  startHour,
  endHour,
  onChange,
}: TimeWindowSliderProps) {
  const startPercent = (startHour / MAX_HOUR) * 100;
  const endPercent = (endHour / MAX_HOUR) * 100;
  const leftTrackWidthPercent =
    ((LEFT_MAX_HOUR - LEFT_MIN_HOUR) / MAX_HOUR) * 100;
  const rightTrackLeftPercent = (RIGHT_MIN_HOUR / MAX_HOUR) * 100;
  const rightTrackWidthPercent =
    ((RIGHT_MAX_HOUR - RIGHT_MIN_HOUR) / MAX_HOUR) * 100;
  const sliderThumbClasses =
    "absolute top-0 h-full appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-8 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:mt-2 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:shadow [&::-moz-range-track]:h-8 [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:shadow";

  return (
    <div className="min-w-[260px] max-w-sm">
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span>{formatHourLabel(startHour)}</span>
        <span>{formatHourLabel(endHour)}</span>
      </div>

      <div className="relative h-8">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-gray-200" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-blue-500"
          style={{
            left: `${startPercent}%`,
            width: `${Math.max(0, endPercent - startPercent)}%`,
          }}
        />

        <input
          type="range"
          min={LEFT_MIN_HOUR}
          max={LEFT_MAX_HOUR}
          step={1}
          value={startHour}
          onChange={(event) => {
            const nextStart = Math.max(
              LEFT_MIN_HOUR,
              Math.min(Number(event.target.value), LEFT_MAX_HOUR)
            );
            onChange(nextStart, endHour);
          }}
          aria-label="Visible start hour"
          className={sliderThumbClasses}
          style={{
            left: "0%",
            width: `${leftTrackWidthPercent}%`,
          }}
        />

        <input
          type="range"
          min={RIGHT_MIN_HOUR}
          max={RIGHT_MAX_HOUR}
          step={1}
          value={endHour}
          onChange={(event) => {
            const nextEnd = Math.min(
              RIGHT_MAX_HOUR,
              Math.max(Number(event.target.value), RIGHT_MIN_HOUR)
            );
            onChange(startHour, nextEnd);
          }}
          aria-label="Visible end hour"
          className={sliderThumbClasses}
          style={{
            left: `${rightTrackLeftPercent}%`,
            width: `${rightTrackWidthPercent}%`,
          }}
        />
      </div>
    </div>
  );
}
