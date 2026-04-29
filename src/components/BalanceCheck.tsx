import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, Wallet, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { Account, FixedItem, fetchAccounts, fetchFixedItems } from '../lib/supabase';
import { formatWon, getToday } from '../lib/utils';
import { getAdjustedDay } from '../lib/holidays';

interface AccountBalance {
  account: Account;
  items: FixedItem[];
  totalExpenseUntilNextIncome: number;
  nextIncomeDay: number | null;
  nextIncomeOriginalDay: number | null;
  daysUntilNextIncome: number | null;
  isSufficient: boolean;
  shortfall: number;
}

export default function BalanceCheck() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [items, setItems] = useState<FixedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const today = getToday();

  const computeAccountBalances = (): AccountBalance[] => {
    return accounts.map(account => {
      const accountItems = items.filter(i => i.account_id === account.id);
      const incomeItems = accountItems.filter(i => i.type === 'income');
      const expenseItems = accountItems.filter(i => i.type === 'expense');

      const incomeDays = incomeItems.map(i => {
        const adj = getAdjustedDay(today.year, today.month, i.day_of_month);
        return { adjusted: adj.adjustedDay, original: i.day_of_month };
      }).sort((a, b) => a.adjusted - b.adjusted);

      let nextIncomeDay: number | null = null;
      let nextIncomeOriginalDay: number | null = null;
      let daysUntilNextIncome: number | null = null;

      if (incomeDays.length > 0) {
        const nextInSameMonth = incomeDays.find(d => d.adjusted > today.day);
        if (nextInSameMonth) {
          nextIncomeDay = nextInSameMonth.adjusted;
          nextIncomeOriginalDay = nextInSameMonth.original;
          daysUntilNextIncome = nextInSameMonth.adjusted - today.day;
        } else {
          nextIncomeDay = incomeDays[0].adjusted;
          nextIncomeOriginalDay = incomeDays[0].original;
          const daysInCurrentMonth = new Date(today.year, today.month + 1, 0).getDate();
          daysUntilNextIncome = (daysInCurrentMonth - today.day) + incomeDays[0].adjusted;
        }
      }

      let totalExpenseUntilNextIncome = 0;
      if (incomeDays.length > 0 && nextIncomeDay !== null) {
        if (nextIncomeDay > today.day) {
          totalExpenseUntilNextIncome = expenseItems
            .filter(i => {
              const adj = getAdjustedDay(today.year, today.month, i.day_of_month);
              return adj.adjustedDay > today.day && adj.adjustedDay <= nextIncomeDay;
            })
            .reduce((s, i) => s + i.amount, 0);
        } else {
          const afterToday = expenseItems.filter(i => {
            const adj = getAdjustedDay(today.year, today.month, i.day_of_month);
            return adj.adjustedDay > today.day;
          });
          const beforeNext = expenseItems.filter(i => {
            const adj = getAdjustedDay(today.year, today.month, i.day_of_month);
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

      return {
        account,
        items: accountItems,
        totalExpenseUntilNextIncome,
        nextIncomeDay,
        nextIncomeOriginalDay,
        daysUntilNextIncome,
        isSufficient,
        shortfall,
      };
    });
  };

  const accountBalances = computeAccountBalances();
  const hasWarning = accountBalances.some(ab => !ab.isSufficient);
  const totalShortfall = accountBalances.reduce((s, ab) => s + ab.shortfall, 0);

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

      {accounts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Wallet className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">등록된 통장이 없습니다</p>
          <p className="text-xs mt-1">통장관리에서 통장을 먼저 등록해주세요</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Info className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">등록된 고정항목이 없습니다</p>
          <p className="text-xs mt-1">항목관리에서 수입/지출 항목을 등록해주세요</p>
        </div>
      ) : (
        <>
          {hasWarning ? (
            <div className="card bg-gradient-to-br from-red-500 to-red-600 text-white border-0">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-semibold text-sm">잔고 부족</span>
              </div>
              <p className="text-2xl font-bold">{formatWon(totalShortfall)}</p>
              <p className="text-red-200 text-xs mt-1">다음 수입일까지 부족한 금액</p>
            </div>
          ) : (
            <div className="card bg-gradient-to-br from-sky-600 to-sky-700 text-white border-0">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-semibold text-sm">잔고 충분</span>
              </div>
              <p className="text-sm text-sky-200">모든 통장의 잔고가 다음 수입일까지 충분합니다</p>
            </div>
          )}

          <div className="card bg-amber-50 border-amber-100">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 leading-relaxed">
                오늘({today.month + 1}월 {today.day}일) 기준으로, 다음 수입일까지 각 통장에서 나갈 고정지출 합계를 계산합니다.
                주말 및 공휴일 조정이 적용된 날짜를 기준으로 합니다. 잔고가 부족한 통장은 빨간색으로 표시됩니다.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {accountBalances.map(ab => {
              const incomeItems = ab.items.filter(i => i.type === 'income');
              const expenseItems = ab.items.filter(i => i.type === 'expense');

              return (
                <div key={ab.account.id} className={`card ${
                  !ab.isSufficient ? 'border-red-200 bg-red-50/30' : ''
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        ab.isSufficient ? 'bg-sky-50' : 'bg-red-100'
                      }`}>
                        <Wallet className={`w-4 h-4 ${ab.isSufficient ? 'text-sky-600' : 'text-red-500'}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{ab.account.name}</p>
                        <p className="text-xs text-gray-400">현재 잔고: {formatWon(ab.account.balance)}</p>
                      </div>
                    </div>
                    {!ab.isSufficient && (
                      <div className="flex items-center gap-1 text-red-600">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-xs font-semibold">{formatWon(ab.shortfall)} 부족</span>
                      </div>
                    )}
                  </div>

                  {ab.nextIncomeDay !== null && (
                    <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-gray-50">
                      <TrendingUp className="w-3.5 h-3.5 text-sky-500" />
                      <span className="text-xs text-gray-600">
                        다음 수입일: 매월 {ab.nextIncomeOriginalDay}일
                        {ab.nextIncomeDay !== ab.nextIncomeOriginalDay && (
                          <span className="text-amber-600"> (조정: {ab.nextIncomeDay}일)</span>
                        )}
                        ({ab.daysUntilNextIncome}일 후)
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-gray-50">
                    <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-xs text-gray-600">
                      다음 수입일까지 지출 합계: <span className="font-semibold text-red-600">{formatWon(ab.totalExpenseUntilNextIncome)}</span>
                    </span>
                  </div>

                  {expenseItems.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-gray-400 font-medium mb-1">지출 항목 상세</p>
                      {expenseItems.map(item => {
                        const adj = getAdjustedDay(today.year, today.month, item.day_of_month);
                        return (
                          <div key={item.id} className="flex items-center justify-between py-1">
                            <span className="text-xs text-gray-500">
                              {item.name} ({item.day_of_month}일
                              {adj.wasAdjusted && (
                                <span className="text-amber-600"> &rarr; {adj.adjustedDay}일</span>
                              )})
                            </span>
                            <span className="text-xs text-red-500 font-medium">-{formatWon(item.amount)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {incomeItems.length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
                      <p className="text-xs text-gray-400 font-medium mb-1">수입 항목</p>
                      {incomeItems.map(item => {
                        const adj = getAdjustedDay(today.year, today.month, item.day_of_month);
                        return (
                          <div key={item.id} className="flex items-center justify-between py-1">
                            <span className="text-xs text-gray-500">
                              {item.name} ({item.day_of_month}일
                              {adj.wasAdjusted && (
                                <span className="text-amber-600"> &rarr; {adj.adjustedDay}일</span>
                              )})
                            </span>
                            <span className="text-xs text-sky-500 font-medium">+{formatWon(item.amount)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
