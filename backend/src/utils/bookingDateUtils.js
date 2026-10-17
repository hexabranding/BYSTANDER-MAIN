/**
 * Utility functions for Booking scheduling, timezone conversions, and interval math.
 * Enforces explicit UTC persistence while respecting participant IANA timezones.
 */

/**
 * Returns the offset in minutes between the specified IANA timezone and UTC at a given Date.
 * A positive number indicates the timezone is ahead of UTC (e.g. +330 for Kolkata).
 * @param {Date} date
 * @param {string} tz
 * @returns {number}
 */
const getOffsetMinutes = (date, tz) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type) => Number(parts.find((p) => p.type === type)?.value);

  const tzYear = getPart('year');
  const tzMonth = getPart('month');
  const tzDay = getPart('day');
  const tzHour = getPart('hour') === 24 ? 0 : getPart('hour');
  const tzMinute = getPart('minute');

  const tzDateAsUtc = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute);
  return (tzDateAsUtc - date.getTime()) / 60000;
};

/**
 * Converts local calendar date ('YYYY-MM-DD') and 24-hr time ('HH:mm')
 * in a specified IANA timezone into an exact UTC Date instance.
 *
 * DST Handling:
 * 1. Nonexistent local times (spring-forward gap): Rejects with 400 ValidationError.
 * 2. Ambiguous local times (fall-back overlap): Resolves using explicit disambiguation policy
 *    ('earlier' by default, or 'later', or 'reject').
 *
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {string} timeStr - 'HH:mm'
 * @param {string} tz - IANA timezone identifier (e.g. 'Asia/Kolkata', 'America/New_York')
 * @param {'earlier'|'later'|'reject'} [disambiguation='earlier'] - Policy for ambiguous fall-back times
 * @returns {Date} UTC Date
 */
export const parseLocalDateTimeToUTC = (
  dateStr,
  timeStr,
  tz = 'Asia/Kolkata',
  disambiguation = 'earlier',
) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  const baseUtc = Date.UTC(year, month - 1, day, hour, minute);

  // Probe offset at base
  const approxOffset = getOffsetMinutes(new Date(baseUtc), tz);

  // Probe potential offsets within ±1 hour shift (standard for Daylight Saving Time)
  const candidateOffsets = [...new Set([approxOffset, approxOffset - 60, approxOffset + 60])];
  const validUtcMatches = [];

  const targetStr = `${dateStr} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const getLocalStr = (utc) => {
    const parts = formatter.formatToParts(utc);
    const getPart = (type) => parts.find((p) => p.type === type)?.value;
    const h = getPart('hour') === '24' ? '00' : getPart('hour');
    return `${getPart('year')}-${getPart('month')}-${getPart('day')} ${h}:${getPart('minute')}`;
  };

  for (const offsetMin of candidateOffsets) {
    const candidateUtc = new Date(baseUtc - offsetMin * 60000);
    if (getLocalStr(candidateUtc) === targetStr) {
      if (!validUtcMatches.some((m) => m.getTime() === candidateUtc.getTime())) {
        validUtcMatches.push(candidateUtc);
      }
    }
  }

  // Sort chronologically
  validUtcMatches.sort((a, b) => a.getTime() - b.getTime());

  // 1. Spring-forward gap: The local time does not exist in this timezone
  if (validUtcMatches.length === 0) {
    const err = new Error(
      `Nonexistent local time: '${timeStr}' on ${dateStr} does not exist in timezone '${tz}' due to Daylight Saving Time spring-forward transition.`,
    );
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  // 2. Fall-back overlap: The local time occurs twice in this timezone
  if (validUtcMatches.length > 1) {
    if (disambiguation === 'reject') {
      const err = new Error(
        `Ambiguous local time: '${timeStr}' on ${dateStr} occurs twice in timezone '${tz}' due to Daylight Saving Time fall-back transition. Please provide explicit ISO timestamps or disambiguation input.`,
      );
      err.statusCode = 400;
      err.name = 'ValidationError';
      throw err;
    }
    return disambiguation === 'later' ? validUtcMatches[1] : validUtcMatches[0];
  }

  return validUtcMatches[0];
};

/**
 * Converts a UTC Date into local calendar day, date string, and time string
 * for a specified IANA timezone.
 * @param {Date} utcDate
 * @param {string} tz - IANA timezone identifier
 * @returns {{ day: string, dateStr: string, timeStr: string }}
 */
export const getLocalTimeInTimezone = (utcDate, tz = 'Asia/Kolkata') => {
  const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
  });
  const day = weekdayFormatter.format(utcDate);

  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateStr = dateFormatter.format(utcDate);

  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const timeStr = timeFormatter.format(utcDate);

  return { day, dateStr, timeStr };
};

/**
 * Calculate total hours between two UTC Date timestamps rounded to 2 decimal places.
 * @param {Date} startUtc
 * @param {Date} endUtc
 * @returns {number}
 */
export const calculateTotalHours = (startUtc, endUtc) => {
  const diffMs = endUtc.getTime() - startUtc.getTime();
  return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
};

/**
 * Check if two time intervals intersect/overlap.
 * Adjacent intervals ([A, B] and [B, C]) do not conflict.
 * @param {Date|number} startA
 * @param {Date|number} endA
 * @param {Date|number} startB
 * @param {Date|number} endB
 * @returns {boolean}
 */
export const isIntervalConflicting = (startA, endA, startB, endB) => {
  const sA = new Date(startA).getTime();
  const eA = new Date(endA).getTime();
  const sB = new Date(startB).getTime();
  const eB = new Date(endB).getTime();

  return sA < eB && eA > sB;
};
