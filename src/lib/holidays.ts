import { isHoliday, isBusinessDay } from 'korean-holidays';

export interface AdjustedDate {
  originalDay: number;
  adjustedDay: number;
  adjustedMonth: number; // 0-indexed; may differ from input when date overflows into next month
  adjustedYear: number;
  wasAdjusted: boolean;
  reason: string | null;
}

const DAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

export function getAdjustedDay(year: number, month: number, day: number): AdjustedDate {
  const date = new Date(year, month, day);
  const originalDow = date.getDay();
  let current = new Date(year, month, day);
  let reason: string | null = null;

  // Step 1: Weekend adjustment
  if (originalDow === 6) {
    current.setDate(current.getDate() + 2);
    reason = '토요일이므로 월요일로 조정';
  } else if (originalDow === 0) {
    current.setDate(current.getDate() + 1);
    reason = '일요일이므로 월요일로 조정';
  }

  // Step 2: Holiday adjustment - keep moving forward until we hit a business day
  let iterations = 0;
  while (!isBusinessDay(current) && iterations < 30) {
    const holiday = isHoliday(current);
    const dow = current.getDay();

    if (dow === 6) {
      if (!reason) reason = '토요일이므로 월요일로 조정';
      else reason += ', 토요일';
      current.setDate(current.getDate() + 2);
    } else if (dow === 0) {
      if (!reason) reason = '일요일이므로 월요일로 조정';
      else reason += ', 일요일';
      current.setDate(current.getDate() + 1);
    } else if (holiday) {
      if (!reason) reason = `${holiday.nameKo}이므로 다음 영업일로 조정`;
      else reason += `, ${holiday.nameKo}`;
      current.setDate(current.getDate() + 1);
    }
    iterations++;
  }

  const adjustedDay = current.getDate();
  const adjustedMonth = current.getMonth();
  const adjustedYear = current.getFullYear();
  const wasAdjusted = adjustedDay !== day || adjustedMonth !== month || adjustedYear !== year;

  return {
    originalDay: day,
    adjustedDay,
    adjustedMonth,
    adjustedYear,
    wasAdjusted,
    reason: wasAdjusted ? reason : null,
  };
}

export function getDayName(year: number, month: number, day: number): string {
  return DAY_NAMES[new Date(year, month, day).getDay()];
}

export function isWeekend(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month, day).getDay();
  return dow === 0 || dow === 6;
}

export function isHolidayDate(year: number, month: number, day: number): boolean {
  const holiday = isHoliday(new Date(year, month, day));
  return holiday !== null;
}

export function getHolidayName(year: number, month: number, day: number): string | null {
  const holiday = isHoliday(new Date(year, month, day));
  return holiday ? holiday.nameKo : null;
}
