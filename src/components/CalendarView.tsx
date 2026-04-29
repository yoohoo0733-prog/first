import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Account, FixedItem, fetchAccounts, fetchFixedItems } from '../lib/supabase';
import { formatWon, getDaysInMonth, getFirstDayOfMonth, getToday } from '../lib/utils';
import { getAdjustedDay, getHolidayName } from '../lib/holidays';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

interface CalendarViewProps {
  selectedDay?: number | null;
  onDaySelect?: (day: number | null) => void;
  onMonthChange?: (year: number, month: number) => void;
  compact?: boolean;
}

export default function CalendarView({ selectedDay: externalDay, onDaySelect, onMonthChange, compact }: CalendarViewProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [items, setItems] = useState<FixedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ day: number; text: string } | null>(null);
  const today = getToday();
  const [year, setYear] = useState(today.year);
  const [month, setMonth] = useState(today.month);
  const [internalDay, setInternalDay] = useState<number | null>(today.day);

  const selectedDay = externalDay !== undefined ? externalDay : internalDay;
  const setSelectedDay = onDaySelect ?? setInternalDay;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [accData, itemData] = await Promise.all([fetchAccounts(), fetchFixedItems()]);
      setAccounts(accData);
      setItems(itemData);
    } catch (e: any) {
      setError(e.message || '데이터를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { onMonthChange?.(year, month); }, [year, month, onMonthChange]);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };

  const goToToday = () => {
    setYear(today.year);
    setMonth(today.month);
    setSelectedDay(today.day);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const isCurrentMonth = year === today.year && month === today.month;

  const adjustedItemsMap = useMemo(() => {
    const map = new Map<number, { items: FixedItem[]; originalDay: number; reason: string | null }[]>();

    const addToMap = (item: FixedItem, effectiveDay: number, srcYear: number, srcMonth: number) => {
      const adj = getAdjustedDay(srcYear, srcMonth, effectiveDay);
      if (adj.adjustedYear !== year || adj.adjustedMonth !== month) return;
      if (!map.has(adj.adjustedDay)) map.set(adj.adjustedDay, []);
      map.get(adj.adjustedDay)!.push({ items: [item], originalDay: effectiveDay, reason: adj.reason });
    };

    items.forEach(item => {
      if (item.is_last_day) {
        // Current month's last day — include only if adjusted date stays in this month
        addToMap(item, getDaysInMonth(year, month), year, month);
        // Previous month's last day — include if it overflows into this month
        const prevYear = month === 0 ? year - 1 : year;
        const prevMonth = month === 0 ? 11 : month - 1;
        addToMap(item, getDaysInMonth(prevYear, prevMonth), prevYear, prevMonth);
      } else {
        addToMap(item, item.day_of_month ?? 1, year, month);
      }
    });

    const merged = new Map<number, { items: FixedItem[]; adjustments: { originalDay: number; reason: string | null }[] }>();
    map.forEach((entries, adjDay) => {
      const allItems: FixedItem[] = [];
      const adjustments: { originalDay: number; reason: string | null }[] = [];
      entries.forEach(e => {
        allItems.push(...e.items);
        adjustments.push({ originalDay: e.originalDay, reason: e.reason });
      });
      merged.set(adjDay, { items: allItems, adjustments });
    });
    return merged;
  }, [items, year, month]);

  const getAccountName = (accountId: string) => {
    return accounts.find(a => a.id === accountId)?.name ?? '';
  };

  const selectedData = selectedDay ? adjustedItemsMap.get(selectedDay) : null;
  const selectedItems = selectedData?.items ?? [];
  const selectedAdjustments = selectedData?.adjustments ?? [];

  const monthIncome = items.filter(i => i.type === 'income').reduce((s, i) => s + i.amount, 0);
  const monthExpense = items.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">{error}</div>
      )}

      {!compact && (
        <div className="grid grid-cols-2 gap-3 md:hidden">
          <div className="card py-3">
            <p className="text-xs text-gray-500 mb-0.5">월 수입</p>
            <p className="text-base font-bold text-sky-600">{formatWon(monthIncome)}</p>
          </div>
          <div className="card py-3">
            <p className="text-xs text-gray-500 mb-0.5">월 지출</p>
            <p className="text-base font-bold text-red-600">{formatWon(monthExpense)}</p>
          </div>
        </div>
      )}

      <div className="card relative">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-base">{year}년 {month + 1}월</h2>
            {!isCurrentMonth && (
              <button
                onClick={goToToday}
                className="text-xs text-sky-600 hover:text-sky-700 font-medium px-2 py-0.5 rounded-md bg-sky-50"
              >
                오늘
              </button>
            )}
          </div>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0">
          {WEEKDAYS.map((d, i) => (
            <div key={i} className={`text-center text-xs font-medium py-2 ${
              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
            }`}>
              {d}
            </div>
          ))}

          {Array.from({ length: firstDay }, (_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dayData = adjustedItemsMap.get(day);
            const hasItems = !!dayData && dayData.items.length > 0;
            const hasIncome = hasItems && dayData.items.some(it => it.type === 'income');
            const hasExpense = hasItems && dayData.items.some(it => it.type === 'expense');
            const hasAdjustment = hasItems && dayData.adjustments.some(a => a.originalDay !== day);
            const holidayName = getHolidayName(year, month, day);
            const isToday = isCurrentMonth && day === today.day;
            const isSelected = day === selectedDay;
            const dayOfWeek = (firstDay + i) % 7;

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                onMouseEnter={() => {
                  if (hasAdjustment) {
                    const reasons = dayData!.adjustments
                      .filter(a => a.originalDay !== day && a.reason)
                      .map(a => a.reason);
                    if (reasons.length > 0) setTooltip({ day, text: reasons.join(', ') });
                  }
                }}
                onMouseLeave={() => setTooltip(null)}
                className={`aspect-square flex flex-col items-center justify-center rounded-xl text-sm relative transition-all ${
                  isSelected
                    ? 'bg-sky-600 text-white shadow-md scale-105'
                    : isToday
                    ? 'bg-sky-50 text-sky-700 font-semibold'
                    : holidayName
                    ? 'text-red-400'
                    : 'hover:bg-gray-50'
                } ${!isSelected && dayOfWeek === 0 ? 'text-red-400' : ''} ${
                  !isSelected && dayOfWeek === 6 ? 'text-blue-400' : ''
                }`}
              >
                <span className="text-xs leading-none">{day}</span>
                {hasItems && (
                  <div className="flex gap-0.5 mt-0.5 items-center">
                    {hasIncome && (
                      <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-sky-300' : 'bg-sky-500'}`} />
                    )}
                    {hasExpense && (
                      <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-red-300' : 'bg-red-500'}`} />
                    )}
                    {hasAdjustment && (
                      <span className={`text-[7px] font-bold leading-none ${
                        isSelected ? 'text-white/80' : 'text-amber-500'
                      }`}>*</span>
                    )}
                  </div>
                )}
                {tooltip && tooltip.day === day && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-[10px] rounded-md whitespace-nowrap z-50 shadow-lg">
                    {tooltip.text}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-800" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {!compact && selectedDay !== null && (
        <div className="card md:hidden">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-semibold text-sm">{month + 1}월 {selectedDay}일 항목</h3>
            {selectedAdjustments.some(a => a.originalDay !== selectedDay) && (
              <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">조정됨</span>
            )}
          </div>
          {selectedItems.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">해당 날짜에 등록된 항목이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {selectedItems.map((item, idx) => {
                const adj = selectedAdjustments[idx];
                const wasAdjusted = adj && adj.originalDay !== selectedDay;
                return (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                        item.type === 'income' ? 'bg-sky-500' : 'bg-red-500'
                      }`} />
                      <span className="text-sm">{item.name}</span>
                      {wasAdjusted && (
                        <span className="text-[10px] text-amber-600 bg-amber-50 px-1 py-0.5 rounded" title={adj.reason ?? ''}>
                          {adj.originalDay}일에서 조정
                        </span>
                      )}
                      {getAccountName(item.account_id) && (
                        <span className="text-xs text-gray-400">({getAccountName(item.account_id)})</span>
                      )}
                    </div>
                    <span className={`text-sm font-medium ${
                      item.type === 'income' ? 'text-sky-600' : 'text-red-600'
                    }`}>
                      {item.type === 'income' ? '+' : '-'}{formatWon(item.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
