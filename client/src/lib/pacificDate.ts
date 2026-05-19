/**
 * Returns today's date as YYYY-MM-DD in US Pacific Time.
 * All "what day is it?" logic in the app uses this so the daily reset
 * is always midnight Pacific — consistent with Hollywood / content schedules.
 */
export const getPacificDateStr = (): string =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
