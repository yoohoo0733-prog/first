import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Check, X, CalendarClock, Banknote, CreditCard, List } from 'lucide-react';
import { Account, FixedItem, fetchAccounts, fetchFixedItems, createFixedItem, updateFixedItem, deleteFixedItem } from '../lib/supabase';
import { formatWon, getToday, getDaysInMonth } from '../lib/utils';
import { getItemAdjustedDay, AdjustedDate } from '../lib/holidays';

export interface EditState {
  id: string | 'new';
  section: 'salary' | 'card' | 'regular';
  name: string;
  amount: string;
  day: string;
  accountId: string;
  type: 'income' | 'expense';
}

// ── Module-level components (avoids unmount/remount on parent re-render) ──

interface InlineFormProps {
  label: string;
  editState: EditState;
  accounts: Account[];
  year: number;
  month: number;
  onChange: (updates: Partial<EditState>) => void;
  onSave: () => void;
  onCancel: () => void;
}

const InlineForm = memo(function InlineForm({
  label, editState, accounts, year, month, onChange, onSave, onCancel,
}: InlineFormProps) {
  const { section, day } = editState;
  const showLastDay = section === 'regular';
  const showType = section === 'regular';
  const dayLabel = section === 'salary' ? '지급일' : '결제일';

  const previewAdj = useMemo<AdjustedDate | null>(() => {
    if (day === 'last') {
      return getItemAdjustedDay(section, year, month, getDaysInMonth(year, month));
    }
    const d = parseInt(day, 10);
    if (isNaN(d) || d < 1 || d > 31) return null;
    return getItemAdjustedDay(section, year, month, d);
  }, [day, section, year, month]);

  return (
    <div className="border border-sky-200 bg-sky-50/40 rounded-xl p-3 space-y-3">
      <p className="text-xs font-medium text-sky-700">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">이름</label>
          <input
            type="text"
            className="input-field text-sm"
            placeholder={
              section === 'salary' ? '예: 홍길동 월급'
              : section === 'card' ? '예: 신한카드'
              : '항목명'
            }
            value={editState.name}
            onChange={e => onChange({ name: e.target.value })}
          />
        </div>
        <div>
          <label className="label">금액 (원)</label>
          <input
            type="text"
            className="input-field text-sm"
            placeholder="예: 3000000"
            value={editState.amount}
            onChange={e => onChange({ amount: e.target.value.replace(/[^0-9]/g, '') })}
          />
        </div>
        <div>
          <label className="label">{dayLabel}</label>
          <select
            className="select-field text-sm"
            value={editState.day}
            onChange={e => onChange({ day: e.target.value })}
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
              <option key={d} value={d}>{d}일</option>
            ))}
            {showLastDay && <option value="last">말일</option>}
          </select>
          {previewAdj?.wasAdjusted && (
            <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
              <CalendarClock className="w-3 h-3" />
              이번 달 {previewAdj.adjustedDay}일로 조정
            </p>
          )}
        </div>
        <div>
          <label className="label">연결 통장</label>
          <select
            className="select-field text-sm"
            value={editState.accountId}
            onChange={e => onChange({ accountId: e.target.value })}
          >
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        {showType && (
          <div className="col-span-2 flex gap-2">
            <button
              onClick={() => onChange({ type: 'income' })}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${
                editState.type === 'income' ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >수입</button>
            <button
              onClick={() => onChange({ type: 'expense' })}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${
                editState.type === 'expense' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >지출</button>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={onSave} className="btn-primary flex items-center gap-1.5 text-sm py-2">
          <Check className="w-3.5 h-3.5" />
          {editState.id === 'new' ? '추가' : '저장'}
        </button>
        <button onClick={onCancel} className="btn-secondary text-sm py-2">
          <X className="w-3.5 h-3.5 inline mr-1" />취소
        </button>
      </div>
    </div>
  );
});

interface ItemRowProps {
  item: FixedItem;
  adj: AdjustedDate;
  accountName: string;
  deletable: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

const ItemRow = memo(function ItemRow({ item, adj, accountName, deletable, onEdit, onDelete }: ItemRowProps) {
  return (
    <div className="card flex items-center justify-between group py-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
          item.type === 'income' ? 'bg-sky-50' : 'bg-red-50'
        }`}>
          {item.category === 'salary'
            ? <Banknote className="w-4 h-4 text-sky-500" />
            : item.category === 'card'
            ? <CreditCard className="w-4 h-4 text-purple-500" />
            : item.type === 'income'
            ? <TrendingUp className="w-4 h-4 text-sky-500" />
            : <TrendingDown className="w-4 h-4 text-red-500" />
          }
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{item.name}</p>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <span className="text-xs text-gray-400">
              매월 {item.is_last_day ? '말일' : `${item.day_of_month}일`}
            </span>
            {adj.wasAdjusted && (
              <span
                className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5"
                title={adj.reason ?? ''}
              >
                <CalendarClock className="w-3 h-3" />{adj.adjustedDay}일 조정
              </span>
            )}
            <span className="text-xs text-gray-300">|</span>
            <span className="text-xs text-gray-400">{accountName}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
        <span className={`font-semibold text-sm whitespace-nowrap ${
          item.type === 'income' ? 'text-sky-600' : 'text-red-600'
        }`}>
          {item.type === 'income' ? '+' : '-'}{formatWon(item.amount)}
        </span>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          {deletable && (
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

// ── Main component ──

export default function FixedItemManager() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [items, setItems] = useState<FixedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);

  const today = getToday();

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

  const salaryItems = useMemo(() => items.filter(i => i.category === 'salary'), [items]);
  const cardItems = useMemo(() => items.filter(i => i.category === 'card'), [items]);
  const regularItems = useMemo(() => items.filter(i => i.category === 'regular'), [items]);

  const totalIncome = useMemo(() => items.filter(i => i.type === 'income').reduce((s, i) => s + i.amount, 0), [items]);
  const totalExpense = useMemo(() => items.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0), [items]);

  const getAccountName = useCallback((id: string) => accounts.find(a => a.id === id)?.name ?? '알 수 없음', [accounts]);

  const getAdj = useCallback((item: FixedItem): AdjustedDate => {
    const day = item.is_last_day ? getDaysInMonth(today.year, today.month) : (item.day_of_month ?? 1);
    return getItemAdjustedDay(item.category, today.year, today.month, day);
  }, [today.year, today.month]);

  const handleEditChange = useCallback((updates: Partial<EditState>) => {
    setEditState(s => s ? { ...s, ...updates } : null);
  }, []);

  const startEdit = useCallback((item: FixedItem) => {
    setError(null);
    setEditState({
      id: item.id,
      section: item.category,
      name: item.name,
      amount: item.amount.toString(),
      day: item.is_last_day ? 'last' : (item.day_of_month ?? 1).toString(),
      accountId: item.account_id,
      type: item.type,
    });
  }, []);

  const startNew = useCallback((section: 'salary' | 'card' | 'regular') => {
    setError(null);
    setEditState(s => ({
      id: 'new',
      section,
      name: '',
      amount: '',
      day: '25',
      accountId: s?.accountId || accounts[0]?.id || '',
      type: section === 'salary' ? 'income' : 'expense',
    }));
  }, [accounts]);

  const cancelEdit = useCallback(() => { setEditState(null); setError(null); }, []);

  const handleSave = useCallback(async () => {
    if (!editState) return;
    const name = editState.name.trim();
    const amount = parseInt(editState.amount.replace(/,/g, ''), 10);
    const isLastDay = editState.day === 'last';
    const day = isLastDay ? null : parseInt(editState.day, 10);
    if (!name || isNaN(amount) || amount <= 0 || (!isLastDay && (isNaN(day as number) || (day as number) < 1)) || !editState.accountId) {
      setError('모든 필드를 올바르게 입력해주세요.');
      return;
    }
    try {
      const payload = {
        name,
        amount,
        day_of_month: day,
        is_last_day: isLastDay,
        type: editState.type,
        category: editState.section,
        account_id: editState.accountId,
      };
      if (editState.id === 'new') {
        await createFixedItem(payload);
      } else {
        await updateFixedItem(editState.id, payload);
      }
      setEditState(null);
      setError(null);
      await load();
    } catch (e: any) {
      setError(e.message || '저장에 실패했습니다.');
    }
  }, [editState, load]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('이 항목을 삭제하시겠습니까?')) return;
    try {
      await deleteFixedItem(id);
      await load();
    } catch (e: any) {
      setError(e.message || '삭제에 실패했습니다.');
    }
  }, [load]);

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isEditingItem = (id: string) => editState?.id === id;
  const isAddingTo = (section: 'salary' | 'card' | 'regular') =>
    editState?.id === 'new' && editState.section === section;
  const isEditingSection = (section: 'salary' | 'card' | 'regular') =>
    editState?.section === section;

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">{error}</div>
      )}

      {/* Summary */}
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

      {/* ── 월급 section ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Banknote className="w-4 h-4 text-sky-600" />
            <h3 className="font-semibold text-sm text-gray-800">월급</h3>
            <span className="text-[10px] text-sky-700 bg-sky-50 border border-sky-100 px-1.5 py-0.5 rounded-full">
              이전 영업일 조정
            </span>
          </div>
          {salaryItems.length < 2 && !editState && accounts.length > 0 && (
            <button
              onClick={() => startNew('salary')}
              className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-800 font-medium"
            >
              <Plus className="w-3.5 h-3.5" />추가
            </button>
          )}
        </div>
        {salaryItems.length === 0 && !isEditingSection('salary') && (
          <p className="text-xs text-gray-400 py-2 px-1">등록된 월급 항목이 없습니다.</p>
        )}
        {salaryItems.map(item =>
          isEditingItem(item.id) && editState ? (
            <InlineForm
              key={item.id}
              label="월급 수정"
              editState={editState}
              accounts={accounts}
              year={today.year}
              month={today.month}
              onChange={handleEditChange}
              onSave={handleSave}
              onCancel={cancelEdit}
            />
          ) : (
            <ItemRow
              key={item.id}
              item={item}
              adj={getAdj(item)}
              accountName={getAccountName(item.account_id)}
              deletable={false}
              onEdit={() => startEdit(item)}
              onDelete={() => handleDelete(item.id)}
            />
          )
        )}
        {isAddingTo('salary') && editState && (
          <InlineForm
            label="월급 추가"
            editState={editState}
            accounts={accounts}
            year={today.year}
            month={today.month}
            onChange={handleEditChange}
            onSave={handleSave}
            onCancel={cancelEdit}
          />
        )}
      </div>

      {/* ── 카드대금 section ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-purple-600" />
            <h3 className="font-semibold text-sm text-gray-800">카드대금</h3>
            <span className="text-[10px] text-purple-700 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded-full">
              다음 영업일 조정
            </span>
          </div>
          {!editState && accounts.length > 0 && (
            <button
              onClick={() => startNew('card')}
              className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium"
            >
              <Plus className="w-3.5 h-3.5" />카드 추가
            </button>
          )}
        </div>
        {cardItems.length === 0 && !isEditingSection('card') && (
          <p className="text-xs text-gray-400 py-2 px-1">등록된 카드 항목이 없습니다.</p>
        )}
        {cardItems.map(item =>
          isEditingItem(item.id) && editState ? (
            <InlineForm
              key={item.id}
              label="카드대금 수정"
              editState={editState}
              accounts={accounts}
              year={today.year}
              month={today.month}
              onChange={handleEditChange}
              onSave={handleSave}
              onCancel={cancelEdit}
            />
          ) : (
            <ItemRow
              key={item.id}
              item={item}
              adj={getAdj(item)}
              accountName={getAccountName(item.account_id)}
              deletable={true}
              onEdit={() => startEdit(item)}
              onDelete={() => handleDelete(item.id)}
            />
          )
        )}
        {isAddingTo('card') && editState && (
          <InlineForm
            label="카드 추가"
            editState={editState}
            accounts={accounts}
            year={today.year}
            month={today.month}
            onChange={handleEditChange}
            onSave={handleSave}
            onCancel={cancelEdit}
          />
        )}
      </div>

      {/* ── 일반 고정항목 section ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <List className="w-4 h-4 text-gray-500" />
            <h3 className="font-semibold text-sm text-gray-800">일반 고정항목</h3>
          </div>
          {!editState && accounts.length > 0 && (
            <button
              onClick={() => startNew('regular')}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 font-medium"
            >
              <Plus className="w-3.5 h-3.5" />항목 추가
            </button>
          )}
        </div>
        {regularItems.length === 0 && !isEditingSection('regular') && (
          <p className="text-xs text-gray-400 py-2 px-1">등록된 일반 고정항목이 없습니다.</p>
        )}
        {regularItems.map(item =>
          isEditingItem(item.id) && editState ? (
            <InlineForm
              key={item.id}
              label="항목 수정"
              editState={editState}
              accounts={accounts}
              year={today.year}
              month={today.month}
              onChange={handleEditChange}
              onSave={handleSave}
              onCancel={cancelEdit}
            />
          ) : (
            <ItemRow
              key={item.id}
              item={item}
              adj={getAdj(item)}
              accountName={getAccountName(item.account_id)}
              deletable={true}
              onEdit={() => startEdit(item)}
              onDelete={() => handleDelete(item.id)}
            />
          )
        )}
        {isAddingTo('regular') && editState && (
          <InlineForm
            label="항목 추가"
            editState={editState}
            accounts={accounts}
            year={today.year}
            month={today.month}
            onChange={handleEditChange}
            onSave={handleSave}
            onCancel={cancelEdit}
          />
        )}
      </div>
    </div>
  );
}
