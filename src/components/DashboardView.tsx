import { useState, useEffect, useCallback, useMemo } from 'react';
import { TrendingUp, TrendingDown, Wallet, AlertTriangle, CheckCircle2, Building2 } from 'lucide-react';
import { Account, FixedItem, fetchAccounts, fetchFixedItems } from '../lib/supabase';
import { formatWon, getToday, getDaysInMonth } from '../lib/utils';
import { getAdjustedDay } from '../lib/holidays';
import CalendarView from './CalendarView';

interface AccountBalance {
  account: Account;
  totalExpenseUntilNextIncome: number;
  nextIncomeDay: number | null;
  daysUntilNextIncome: number | null;
  isSufficient: boolean;
  shortfall: number;
}

export default function DashboardView() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [items, setItems] = useState<FixedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [calYear, setCalYear] = useState(getToday().year);
  const [calMonth, setCalMonth] = useState(getToday().month);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [accData, itemData] = await Promise.all([fetchAccounts(), fetchFixedItems()]);
      setAccounts(accData);
      setItems(itemData);
    } catch {
      // errors handled by individual components
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = getToday();
  const totalIncome = items.filter(i => i.type === 'income').reduce((s, i) => s + i.amount, 0);
  const totalExpense = items.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0);

  const adjustedItemsMap = useMemo(() => {
    const map = new Map<number, { items: FixedItem[]; adjustments: { originalDay: number; reason: string | null }[] }>();

    const addToMap = (item: FixedItem, effectiveDay: number, srcYear: number, srcMonth: number) => {
      const adj = getAdjustedDay(srcYear, srcMonth, effectiveDay);
      if (adj.adjustedYear !== calYear || adj.adjustedMonth !== calMonth) return;
      if (!map.has(adj.adjustedDay)) map.set(adj.adjustedDay, { items: [], adjustments: [] });
      const entry = map.get(adj.adjustedDay)!;
      entry.items.push(item);
      entry.adjustments.push({ originalDay: effectiveDay, reason: adj.reason });
    };

    items.forEach(item => {
      if (item.is_last_day) {
        addToMap(item, getDaysInMonth(calYear, calMonth), calYear, calMonth);
        const prevYear = calMonth === 0 ? calYear - 1 : calYear;
        const prevMonth = calMonth === 0 ? 11 : calMonth - 1;
        addToMap(item, getDaysInMonth(prevYear, prevMonth), prevYear, prevMonth);
      } else {
        addToMap(item, item.day_of_month ?? 1, calYear, calMonth);
      }
    });

    return map;
  }, [items, calYear, calMonth]);

  const computeAccountBalances = (): AccountBalance[] => {
    return accounts.map(account => {
      const accountItems = items.filter(i => i.account_id === account.id);
      const incomeItems = accountItems.filter(i => i.type === 'income');
      const expenseItems = accountItems.filter(i => i.type === 'expense');
      const incomeDays = incomeItems.map(i => {
        const effectiveDay = i.is_last_day ? getDaysInMonth(today.year, today.month) : (i.day_of_month ?? 1);
        const adj = getAdjustedDay(today.year, today.month, effectiveDay);
        return adj.adjustedDay;
      }).sort((a, b) => a - b);

      let nextIncomeDay: number | null = null;
      let daysUntilNextIncome: number | null = null;

      if (incomeDays.length > 0) {
        const nextInSameMonth = incomeDays.find(d => d > today.day);
        if (nextInSameMonth) {
          nextIncomeDay = nextInSameMonth;
          daysUntilNextIncome = nextInSameMonth - today.day;
        } else {
          nextIncomeDay = incomeDays[0];
          const daysInCurrentMonth = new Date(today.year, today.month + 1, 0).getDate();
          daysUntilNextIncome = (daysInCurrentMonth - today.day) + incomeDays[0];
        }
      }

      let totalExpenseUntilNextIncome = 0;
      if (incomeDays.length > 0 && nextIncomeDay !== null) {
        if (nextIncomeDay > today.day) {
          totalExpenseUntilNextIncome = expenseItems
            .filter(i => {
              const effectiveDay = i.is_last_day ? getDaysInMonth(today.year, today.month) : (i.day_of_month ?? 1);
              const adj = getAdjustedDay(today.year, today.month, effectiveDay);
              return adj.adjustedDay > today.day && adj.adjustedDay <= nextIncomeDay;
            })
            .reduce((s, i) => s + i.amount, 0);
        } else {
          const afterToday = expenseItems.filter(i => {
            const effectiveDay = i.is_last_day ? getDaysInMonth(today.year, today.month) : (i.day_of_month ?? 1);
            const adj = getAdjustedDay(today.year, today.month, effectiveDay);
            return adj.adjustedDay > today.day;
          });
          const beforeNext = expenseItems.filter(i => {
            const effectiveDay = i.is_last_day ? getDaysInMonth(today.year, today.month) : (i.day_of_month ?? 1);
            const adj = getAdjustedDay(today.year, today.month, effectiveDay);
            return adj.adjustedDay <= nextIncomeDay;
          });
          const allExpenses = [...afterToday, ...beforeNext];
          const seen = new Set<string>();
          const unique = allExpenses.filter(i => {
            if (seen.has(i.id)) return false;
            seen.add(i.id);
            return true;
          });
          totalExpenseUntilNextIncome = unique.reduce((s, i) => s + i.amount, 0);
        }
      } else {
        totalExpenseUntilNextIncome = expenseItems.reduce((s, i) => s + i.amount, 0);
      }

      const isSufficient = account.balance >= totalExpenseUntilNextIncome;
      const shortfall = isSufficient ? 0 : totalExpenseUntilNextIncome - account.balance;

      return { account, totalExpenseUntilNextIncome, nextIncomeDay, daysUntilNextIncome, isSufficient, shortfall };
    });
  };

  const accountBalances = computeAccountBalances();
  const hasWarning = accountBalances.some(ab => !ab.isSufficient);
  const totalShortfall = accountBalances.reduce((s, ab) => s + ab.shortfall, 0);

  const selectedData = selectedDay ? adjustedItemsMap.get(selectedDay) : null;
  const selectedItems = selectedData?.items ?? [];
  const selectedAdjustments = selectedData?.adjustments ?? [];
  const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name ?? '';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Row 1: Monthly income & expense */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-6 h-6 text-sky-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500">월 수입</p>
            <p className="text-xl font-bold text-sky-600">{formatWon(totalIncome)}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
            <TrendingDown className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500">월 지출</p>
            <p className="text-xl font-bold text-red-600">{formatWon(totalExpense)}</p>
          </div>
        </div>
      </div>

      {/* Row 2: Account balances + sufficiency check */}
      <div className="card">
        <h3 className="font-semibold text-sm text-gray-700 mb-4">통장 잔고 현황</h3>
        {accounts.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Building2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">등록된 통장이 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              {accountBalances.map(ab => (
                <div key={ab.account.id} className={`flex items-center justify-between p-3 rounded-xl ${
                  !ab.isSufficient ? 'bg-red-50/60 border border-red-100' : 'bg-gray-50'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      ab.isSufficient ? 'bg-sky-50' : 'bg-red-100'
                    }`}>
                      <Wallet className={`w-4 h-4 ${ab.isSufficient ? 'text-sky-600' : 'text-red-500'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{ab.account.name}</p>
                      <p className="text-xs text-gray-400">{formatWon(ab.account.balance)}</p>
                    </div>
                  </div>
                  {!ab.isSufficient && (
                    <div className="flex items-center gap-1 text-red-600">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="text-xs font-semibold">{formatWon(ab.shortfall)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center">
              {hasWarning ? (
                <div className="w-full p-4 rounded-xl bg-gradient-to-br from-red-500 to-red-600 text-white">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-semibold text-sm">잔고 부족</span>
                  </div>
                  <p className="text-2xl font-bold">{formatWon(totalShortfall)}</p>
                  <p className="text-red-200 text-xs mt-1">다음 수입일까지 부족한 금액</p>
                  {accountBalances.filter(ab => !ab.isSufficient).map(ab => (
                    <div key={ab.account.id} className="mt-2 pt-2 border-t border-red-400/30">
                      <p className="text-xs text-red-100">
                        {ab.account.name}: 다음 수입일({ab.nextIncomeDay}일)까지 {formatWon(ab.totalExpenseUntilNextIncome)} 지출 예정
                      </p>
                    </div>
                  ))}
                </div>
              ) : accounts.length > 0 && items.length > 0 ? (
                <div className="w-full p-4 rounded-xl bg-gradient-to-br from-sky-600 to-sky-700 text-white">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-semibold text-sm">잔고 충분</span>
                  </div>
                  <p className="text-sm text-sky-200">모든 통장의 잔고가 다음 수입일까지 충분합니다</p>
                </div>
              ) : (
                <div className="w-full p-4 rounded-xl bg-gray-50 text-gray-400 text-center text-sm">
                  고정항목을 등록하면 잔고 충분 여부를 확인할 수 있습니다
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Row 3: Calendar + selected day items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CalendarView
          selectedDay={selectedDay}
          onDaySelect={setSelectedDay}
          onMonthChange={(y, m) => { setCalYear(y); setCalMonth(m); }}
          compact
        />

        <div className="card">
          {selectedDay !== null ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="font-semibold text-sm">{calMonth + 1}월 {selectedDay}일 항목</h3>
                {selectedAdjustments.some(a => a.originalDay !== selectedDay) && (
                  <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">조정됨</span>
                )}
              </div>
              {selectedItems.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-sm">해당 날짜에 등록된 항목이 없습니다</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedItems.map((item, idx) => {
                    const adj = selectedAdjustments[idx];
                    const wasAdjusted = adj && adj.originalDay !== selectedDay;
                    return (
                      <div key={item.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-gray-50">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-block w-2 h-2 rounded-full ${
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
            </>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">달력에서 날짜를 선택하세요</p>
              <p className="text-xs mt-1">해당 날짜의 수입/지출 항목이 표시됩니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
