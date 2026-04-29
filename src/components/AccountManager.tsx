import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Building2, Check, X } from 'lucide-react';
import { Account, fetchAccounts, createAccount, updateAccount, deleteAccount } from '../lib/supabase';
import { formatWon } from '../lib/utils';

export default function AccountManager() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formBalance, setFormBalance] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAccounts();
      setAccounts(data);
    } catch (e: any) {
      setError(e.message || '데이터를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setFormName('');
    setFormBalance('');
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = async () => {
    const name = formName.trim();
    const balance = parseInt(formBalance.replace(/,/g, ''), 10);
    if (!name || isNaN(balance)) return;

    try {
      if (editingId) {
        await updateAccount(editingId, name, balance);
      } else {
        await createAccount(name, balance);
      }
      resetForm();
      await load();
    } catch (e: any) {
      setError(e.message || '저장에 실패했습니다.');
    }
  };

  const handleEdit = (account: Account) => {
    setEditingId(account.id);
    setFormName(account.name);
    setFormBalance(account.balance.toString());
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 통장을 삭제하시겠습니까? 연결된 고정수입/지출 항목도 함께 삭제됩니다.')) return;
    try {
      await deleteAccount(id);
      await load();
    } catch (e: any) {
      setError(e.message || '삭제에 실패했습니다.');
    }
  };

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  if (loading && accounts.length === 0) {
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

      <div className="card bg-gradient-to-br from-sky-600 to-sky-700 text-white border-0">
        <p className="text-sky-200 text-sm mb-1">총 잔고</p>
        <p className="text-2xl font-bold">{formatWon(totalBalance)}</p>
        <p className="text-sky-300 text-xs mt-1">통장 {accounts.length}개</p>
      </div>

      {accounts.length === 0 && !showForm && (
        <div className="text-center py-12 text-gray-400">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">등록된 통장이 없습니다</p>
          <p className="text-xs mt-1">아래 버튼으로 통장을 추가해보세요</p>
        </div>
      )}

      <div className="space-y-3">
        {accounts.map(account => (
          <div key={account.id} className="card flex items-center justify-between group">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-sky-600" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{account.name}</p>
                <p className="text-sm text-gray-500">{formatWon(account.balance)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleEdit(account)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(account.id)}
                className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showForm ? (
        <div className="card space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-sm">{editingId ? '통장 수정' : '새 통장 추가'}</h3>
            <button onClick={resetForm} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div>
            <label className="label">통장 이름</label>
            <input
              type="text"
              className="input-field"
              placeholder="예: 주거래통장"
              value={formName}
              onChange={e => setFormName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">현재 잔고</label>
            <input
              type="text"
              className="input-field"
              placeholder="예: 1500000"
              value={formBalance}
              onChange={e => setFormBalance(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleSubmit} className="btn-primary flex items-center gap-1.5">
              <Check className="w-4 h-4" />
              {editingId ? '수정' : '추가'}
            </button>
            <button onClick={resetForm} className="btn-secondary">취소</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="w-full card border-dashed border-2 border-gray-200 text-gray-400 hover:text-sky-600 hover:border-sky-300 flex items-center justify-center gap-2 py-4"
        >
          <Plus className="w-5 h-5" />
          <span className="text-sm font-medium">통장 추가</span>
        </button>
      )}
    </div>
  );
}
