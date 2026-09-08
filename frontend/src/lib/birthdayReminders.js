// The daily "notify admins/managers about today's birthdays" job now runs
// server-side (backend/app/jobs/birthdays.py, on a schedule via
// backend/app/scheduler.py) instead of being triggered from here on
// dashboard load. This file now only powers the dashboard's "Upcoming
// Birthdays" widget, which is pure display and doesn't need to live on the
// server.

/**
 * Returns employees with a birthday in the next `daysAhead` days (today
 * included), sorted soonest-first, for a dashboard "Upcoming Birthdays"
 * widget. Ignores the year in date_of_birth - only month/day matters.
 */
export function getUpcomingBirthdays(employees, daysAhead = 30) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return (employees || [])
    .filter((e) => e.date_of_birth && e.status !== "inactive")
    .map((e) => {
      const parts = e.date_of_birth.slice(0, 10).split("-").map(Number);
      const month = parts[1];
      const day = parts[2];
      let next = new Date(now.getFullYear(), month - 1, day);
      if (next < todayStart) next = new Date(now.getFullYear() + 1, month - 1, day);
      const daysUntil = Math.round((next - todayStart) / 86400000);
      return { employee: e, nextDate: next, daysUntil };
    })
    .filter((x) => x.daysUntil <= daysAhead)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}
