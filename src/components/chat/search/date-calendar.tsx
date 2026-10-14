import { useTranslation } from "react-i18next";
import { useState } from "react";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { dateLocale } from "@/lib/date-locale";

interface DateCalendarProps {
  /** Called with the selected day at local midnight. */
  onSelect: (day: Date) => void;
}

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/**
 * Compact month-grid calendar (weeks starting Monday) used by the
 * search input for `before:` / `after:` / `during:` suggestions. Purely presentational —
 * the caller owns insertion into the query string.
 */
export const DateCalendar = ({ onSelect }: DateCalendarProps) => {
  const { t: tr } = useTranslation();
  const [viewMonth, setViewMonth] = useState<Date>(() => startOfMonth(new Date()));

  const gridStart = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="p-2" onClick={(event) => event.stopPropagation()}>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-1.5">
        <button
          type="button"
          onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-[#3f4147] transition"
          title={tr("cb.prevMonth")}
        >
          <ChevronLeft className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
        </button>
        <span className="text-xs font-semibold text-black dark:text-white capitalize">
          {format(viewMonth, "LLLL yyyy", dateLocale())}
        </span>
        <button
          type="button"
          onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-[#3f4147] transition"
          title={tr("cb.nextMonth")}
        >
          <ChevronRight className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 mb-0.5">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="h-6 flex items-center justify-center text-[10px] font-semibold text-zinc-400 dark:text-zinc-500"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day) => {
          const outside = !isSameMonth(day, viewMonth);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelect(startOfDay(day))}
              className={cn(
                "h-6 w-6 mx-auto flex items-center justify-center rounded-full text-xs transition",
                outside
                  ? "text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400"
                  : "text-black dark:text-white hover:bg-zinc-200 dark:hover:bg-[#3f4147]",
                isToday(day) && "font-bold ring-1 ring-indigo-400 dark:ring-indigo-500"
              )}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>

      {/* Quick picks */}
      <div className="mt-1.5 pt-1.5 border-t border-zinc-200 dark:border-[#3f4147] flex gap-x-1 justify-center">
        <button
          type="button"
          onClick={() => onSelect(startOfDay(new Date()))}
          className="px-2 py-0.5 rounded text-[11px] text-indigo-600 dark:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-[#2b2d31] transition"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => onSelect(startOfDay(subDays(new Date(), 1)))}
          className="px-2 py-0.5 rounded text-[11px] text-indigo-600 dark:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-[#2b2d31] transition"
        >
          Yesterday
        </button>
      </div>
    </div>
  );
};
