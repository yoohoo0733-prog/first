import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Check, X, Repeat, CalendarClock } from 'lucide-react';
import { Account, FixedItem, fetchAccounts, fetchFixedItems, createFixedItem, updateFixedItem, deleteFixedItem } from '../lib/supabase';
import { formatWon, getToday } from '../lib/utils';
import { getAdjustedDay } from '../lib/holidays';

export default function FixedItemManager() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [items, setItems] = useState<FixedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDay, setFormDay] = useState('1');
  const [formType, setFormType] = useState<'income' | 'expense'>('expense');
  const [formAccountId, setFormAccountId] = useState('');

  const today = getToday();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [accData, itemData] = await Promise.all([fetchAccounts(), fetchFixedItems()]);
      setAccounts(accData);
      setItems(itemData);
      if (accData.length > 0 && !formAccountId) {
        setFormAccountId(accData[0].id);
      }
    } catch (e: any) {
      setError(e.message || '데이터를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setFormName('');
    setFormAmount('');
    setFormDay('1');
    setFormType('expense');
    setFormAccountId(accounts.length > 0 ? accounts[0].id : '');
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = async () => {
    const name = formName.trim();
    const amount = parseInt(formAmount.replace(/,/g, ''), 10);
    const day = parseInt(formDay, 10);
    if (!name || isNaN(amount) || isNaN(day) || !formAccountId) return;

    try {
      const item = { name, amount, day_of_month: day, type: formType, account_id: formAccountId };
      if (editingId) {
        await updateFixedItem(editingId, item);
      } else {
        await createFixedItem(item);
      }
      resetForm();
      await load();
    } catch (e: any) {
      setError(e.message || '저장에 실패했습니다.');
    }
  };

  const handleEdit = (item: FixedItem) => {
    setEditingId(item.id);
    setFormName(item.name);
    setFormAmount(item.amount.toString());
    setFormDay(item.day_of_month.toString());
    setFormType(item.type);
    setFormAccountId(item.account_id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 항목을 삭제하시겠습니까?')) return;
    try {
      await deleteFixedItem(id);
      await load();
    } catch (e: any) {
      setError(e.message || '삭제에 실패했습니다.');
    }
  };

  const getAccountName = (accountId: string) => {
    return accounts.find(a => a.id === accountId)?.name ?? '알 수 없음';
  };

  const itemAdjustments = useMemo(() => {
    const map = new Map<string, { adjustedDay: number; wasAdjusted: boolean; reason: string | null }>();
    items.forEach(item => {
      const adj = getAdjustedDay(today.year, today.month, item.day_of_month);
      map.set(item.id, adj);
    });
    return map;
  }, [items, today.year, today.month]);

  const formDayAdjustment = useMemo(() => {
    const day = parseInt(formDay, 10);
    if (isNaN(day) || day < 1 || day > 31) return null;
    return getAdjustedDay(today.year, today.month, day);
  }, [formDay, today.year, today.month]);

  const totalIncome = items.filter(i => i.type === 'income').reduce((s, i) => s + i.amount, 0);
  const totalExpense = items.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0);

  if (loading && items.length === 0) {
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

      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-sky-500" />
            <span className="text-xs text-gray-500">월 고정수입</span>
          </div>
          <p className="text-lg font-bold text-sky-600">{formatWon(totalIncome)}</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <span className="text-xs text-gray-500">월 고정지출</span>
          </div>
          <p className="text-lg font-bold text-red-600">{formatWon(totalExpense)}</p>
        </div>
      </div>

      {accounts.length === 0 && (
        <div className="bg-amber-50 text-amber-700 px-4 py-3 rounded-xl text-sm">
          먼저 통장을 등록해주세요.
        </div>
      )}

      {items.length === 0 && !showForm && accounts.length > 0 && (
        <div className="text-center py-12 text-gray-400">
          <Repeat className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">등록된 고정항목이 없습니다</p>
          <p className="text-xs mt-1">아래 버튼으로 항목을 추가해보세요</p>
        </div>
      )}

      <div className="space-y-2">
        {items.map(item => {
          const adj = itemAdjustments.get(item.id);
          return (
            <div key={item.id} className="card flex items-center justify-between group py-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  item.type === 'income' ? 'bg-sky-50' : 'bg-red-50'
                }`}>
                  {item.type === 'income'
                    ? <TrendingUp className="w-5 h-5 text-sky-500" />
                    : <TrendingDown className="w-5 h-5 text-red-500" />
                  }
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{item.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-gray-400">매월 {item.day_of_month}일</span>
                    {adj && adj.wasAdjusted && (
                      <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5" title={adj.reason ?? ''}>
                        <CalendarClock className="w-3 h-3" />
                        {adj.adjustedDay}일 조정
                      </span>
                    )}
                    <span className="text-xs text-gray-300">|</span>
                    <span className="text-xs text-gray-400">{getAccountName(item.account_id)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-semibold text-sm whitespace-nowrap ${
                  item.type === 'income' ? 'text-sky-600' : 'text-red-600'
                }`}>
                  {item.type === 'income' ? '+' : '-'}{formatWon(item.amount)}
                </span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showForm ? (
        <div className="card space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-sm">{editingId ? '항목 수정' : '새 항목 추가'}</h3>
            <button onClick={resetForm} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setFormType('income')}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                formType === 'income'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              수입
            </button>
            <button
              onClick={() => setFormType('expense')}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                formType === 'expense'
                  ? 'bg-red-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              지출
            </button>
          </div>

          <div>
            <label className="label">항목명</label>
            <input
              type="text"
              className="input-field"
              placeholder="예: 월급, 월세"
              value={formName}
              onChange={e => setFormName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">금액 (원)</label>
            <input
              type="text"
              className="input-field"
              placeholder="예: 3000000"
              value={formAmount}
              onChange={e => setFormAmount(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </div>
          <div>
            <label className="label">매월 며칠</label>
            <select
              className="select-field"
              value={formDay}
              onChange={e => setFormDay(e.target.value)}
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                <option key={d} value={d}>{d}일</option>
              ))}
            </select>
            {formDayAdjustment && formDayAdjustment.wasAdjusted && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                <CalendarClock className="w-3.5 h-3.5 flex-shrink-0" />
                <span>이번 달 조정: {formDayAdjustment.adjustedDay}일 ({formDayAdjustment.reason})</span>
              </div>
            )}
          </div>
          <div>
            <label className="label">연결 통장</label>
            <select
              className="select-field"
              value={formAccountId}
              onChange={e => setFormAccountId(e.target.value)}
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleSubmit} className="btn-primary flex items-center gap-1.5">
              <Check className="w-4 h-4" />
              {editingId ? '수정' : '추가'}
            </button>
            <button onClick={resetForm} className="btn-secondary">취소</button>
          </div>
        </div>
      ) : accounts.length > 0 ? (
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="w-full card border-dashed border-2 border-gray-200 text-gray-400 hover:text-sky-600 hover:border-sky-300 flex items-center justify-center gap-2 py-4"
        >
          <Plus className="w-5 h-5" />
          <span className="text-sm font-medium">항목 추가</span>
        </button>
      ) : null}
    </div>
  );
}
