import { useEffect, useState } from 'react';
import {
  PlusCircle,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  CalendarDays,
  X,
  Wallet,
} from 'lucide-react';
import { supabase } from './lib/supabase';

interface FixedItem {
  id: string;
  name: string;
  amount: number;
  type: 'income' | 'expense';
  day_of_month: number | null;
  is_last_day: boolean;
  created_at: string;
}

interface FormData {
  name: string;
  amount: string;
  type: 'income' | 'expense';
  day: string; // '1'–'31' or 'last'
}

const EMPTY_FORM: FormData = { name: '', amount: '', type: 'expense', day: '1' };

function getLastDayOfCurrentMonth(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function formatDay(item: FixedItem): string {
  if (item.is_last_day) return '말일';
  return `${item.day_of_month}일`;
}

function resolveDay(item: FixedItem): number {
  return item.is_last_day ? getLastDayOfCurrentMonth() : (item.day_of_month ?? 1);
}

function formatKRW(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

export default function App() {
  const [items, setItems] = useState<FixedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('fixed_items')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) {
      setError(error.message);
    } else {
      setItems(data ?? []);
    }
    setLoading(false);
  }

  function openCreate() {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(item: FixedItem) {
    setEditingId(item.id);
    setFormData({
      name: item.name,
      amount: String(item.amount),
      type: item.type,
      day: item.is_last_day ? 'last' : String(item.day_of_month ?? 1),
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
  }

  async function handleSave() {
    if (!formData.name.trim() || !formData.amount) return;
    setSaving(true);

    const isLastDay = formData.day === 'last';
    const payload = {
      name: formData.name.trim(),
      amount: Number(formData.amount),
      type: formData.type,
      is_last_day: isLastDay,
      day_of_month: isLastDay ? null : Number(formData.day),
    };

    let err;
    if (editingId) {
      ({ error: err } = await supabase
        .from('fixed_items')
        .update(payload)
        .eq('id', editingId));
    } else {
      ({ error: err } = await supabase.from('fixed_items').insert(payload));
    }

    if (err) {
      setError(err.message);
    } else {
      await fetchItems();
      closeForm();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('fixed_items').delete().eq('id', id);
    if (error) {
      setError(error.message);
    } else {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }
  }

  const income = items
    .filter((i) => i.type === 'income')
    .sort((a, b) => resolveDay(a) - resolveDay(b));
  const expense = items
    .filter((i) => i.type === 'expense')
    .sort((a, b) => resolveDay(a) - resolveDay(b));

  const totalIncome = income.reduce((s, i) => s + i.amount, 0);
  const totalExpense = expense.reduce((s, i) => s + i.amount, 0);
  const balance = totalIncome - totalExpense;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-xl">
              <Wallet className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">고정 수입·지출</h1>
              <p className="text-xs text-slate-400">매월 반복되는 항목 관리</p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 transition-colors rounded-xl px-4 py-2 text-sm font-semibold"
          >
            <PlusCircle className="w-4 h-4" />
            항목 추가
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <SummaryCard
            label="총 수입"
            amount={totalIncome}
            color="text-emerald-400"
            bg="bg-emerald-500/10 border-emerald-500/20"
            icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
          />
          <SummaryCard
            label="총 지출"
            amount={totalExpense}
            color="text-rose-400"
            bg="bg-rose-500/10 border-rose-500/20"
            icon={<TrendingDown className="w-5 h-5 text-rose-400" />}
          />
          <SummaryCard
            label="순 잔액"
            amount={balance}
            color={balance >= 0 ? 'text-blue-400' : 'text-orange-400'}
            bg={
              balance >= 0
                ? 'bg-blue-500/10 border-blue-500/20'
                : 'bg-orange-500/10 border-orange-500/20'
            }
            icon={<Wallet className="w-5 h-5 text-blue-400" />}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-rose-500/20 border border-rose-500/40 rounded-xl px-4 py-3 text-rose-300 text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="text-center py-20 text-slate-400">불러오는 중…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">아직 항목이 없습니다.</p>
            <p className="text-xs mt-1">위의 '항목 추가' 버튼을 눌러 시작하세요.</p>
          </div>
        ) : (
          <>
            <ItemSection
              title="수입"
              items={income}
              color="emerald"
              onEdit={openEdit}
              onDelete={handleDelete}
            />
            <ItemSection
              title="지출"
              items={expense}
              color="rose"
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          </>
        )}
      </main>

      {/* Form modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && closeForm()}
        >
          <div className="bg-slate-800 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h2 className="font-semibold text-base">
                {editingId ? '항목 수정' : '항목 추가'}
              </h2>
              <button
                onClick={closeForm}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Type */}
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">구분</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['income', 'expense'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setFormData((f) => ({ ...f, type: t }))}
                      className={`py-2 rounded-xl text-sm font-semibold transition-colors border ${
                        formData.type === t
                          ? t === 'income'
                            ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                            : 'bg-rose-500/20 border-rose-500/60 text-rose-300'
                          : 'border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      {t === 'income' ? '수입' : '지출'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">항목명</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                  placeholder="예: 월급, 구독료, 관리비"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">금액 (원)</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0"
                  min={0}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
                />
              </div>

              {/* Day */}
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">발생일</label>
                <select
                  value={formData.day}
                  onChange={(e) => setFormData((f) => ({ ...f, day: e.target.value }))}
                  className="w-full bg-slate-700 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/60"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={String(d)}>
                      {d}일
                    </option>
                  ))}
                  <option value="last">말일</option>
                </select>
              </div>
            </div>

            <div className="px-6 pb-5 flex gap-3">
              <button
                onClick={closeForm}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-slate-400 hover:text-white hover:border-white/20 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.name.trim() || !formData.amount}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-semibold"
              >
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  amount,
  color,
  bg,
  icon,
}: {
  label: string;
  amount: number;
  color: string;
  bg: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${bg}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <p className={`text-base font-bold ${color} leading-tight`}>
        {formatKRW(Math.abs(amount))}
      </p>
    </div>
  );
}

function ItemSection({
  title,
  items,
  color,
  onEdit,
  onDelete,
}: {
  title: string;
  items: FixedItem[];
  color: 'emerald' | 'rose';
  onEdit: (item: FixedItem) => void;
  onDelete: (id: string) => void;
}) {
  if (items.length === 0) return null;

  const accent = color === 'emerald' ? 'text-emerald-400' : 'text-rose-400';
  const badge =
    color === 'emerald'
      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
      : 'bg-rose-500/10 text-rose-300 border-rose-500/20';

  return (
    <section>
      <h2 className={`text-sm font-semibold mb-3 ${accent}`}>{title}</h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between bg-white/5 hover:bg-white/8 border border-white/10 rounded-2xl px-4 py-3 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-lg border ${badge}`}
              >
                {formatDay(item)}
              </span>
              <span className="text-sm font-medium truncate">{item.name}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-2">
              <span className={`text-sm font-semibold ${accent}`}>
                {formatKRW(item.amount)}
              </span>
              <button
                onClick={() => onEdit(item)}
                className="text-slate-400 hover:text-white transition-colors"
                aria-label="수정"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(item.id)}
                className="text-slate-400 hover:text-rose-400 transition-colors"
                aria-label="삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
