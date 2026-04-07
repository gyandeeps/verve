/**
 * Clinical Console Date Formatting
 *
 * Standardizes date-time display across the application according to the design system.
 * Uses a short month, numeric day, and 2-digit hour/minute with 12-hour clock.
 */
export const formatDateTime = (date: Date | number | string): string => {
  const d =
    typeof date === "string" || typeof date === "number"
      ? new Date(date)
      : date;

  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};
