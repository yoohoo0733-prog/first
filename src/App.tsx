import { useState, useEffect } from 'react';
import { Calendar, ShieldCheck, ListChecks, Building2, Database, Loader2, AlertCircle, LayoutDashboard } from 'lucide-react';
import CalendarView from './components/CalendarView';
import BalanceCheck from './components/BalanceCheck';
import FixedItemManager from './components/FixedItemManager';
import AccountManager from './components/AccountManager';
import DashboardView from './components/DashboardView';
import { checkTablesExist, setupTables } from './lib/supabase';

type Tab = 'dashboard' | 'calendar' | 'balance' | 'items' | 'accounts';

const SIDEBAR_ITEMS: { id: Tab; label: string; icon: typeof Calendar }[] = [
  { id: 'dashboard', label: '대시보드', icon: LayoutDashboard },
  { id: 'calendar', label: '달력', icon: Calendar },
  { id: 'balance', label: '잔고확인', icon: ShieldCheck },
  { id: 'items', label: '항목관리', icon: ListChecks },
  { id: 'accounts', label: '통장관리', icon: Building2 },
];

const MOBILE_TABS: { id: Tab; label: string; icon: typeof Calendar }[] = [
  { id: 'calendar', label: '달력', icon: Calendar },
  { id: 'balance', label: '잔고확인', icon: ShieldCheck },
  { id: 'items', label: '항목관리', icon: ListChecks },
  { id: 'accounts', label: '통장관리', icon: Building2 },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [tablesReady, setTablesReady] = useState<boolean | null>(null);
  const [settingUp, setSettingUp] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    checkTablesExist().then(exists => {
      setTablesReady(exists);
    });
  }, []);

  const handleSetup = async () => {
    setSettingUp(true);
    setSetupError(null);
    const result = await setupTables();
    if (result.success) {
      setTablesReady(true);
    } else {
      setSetupError(result.error || '설정에 실패했습니다.');
    }
    setSettingUp(false);
  };

  if (tablesReady === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
          <p className="text-sm text-gray-500">연결 중...</p>
        </div>
      </div>
    );
  }

  if (!tablesReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="card max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-sky-50 flex items-center justify-center mx-auto">
            <Database className="w-8 h-8 text-sky-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">초기 설정이 필요합니다</h2>
            <p className="text-sm text-gray-500 mt-1">
              앱을 사용하려면 데이터베이스 테이블을 생성해야 합니다.
            </p>
          </div>

          {setupError && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{setupError}</span>
            </div>
          )}

          <button
            onClick={handleSetup}
            disabled={settingUp}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3"
          >
            {settingUp ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                설정 중...
              </>
            ) : (
              '테이블 생성하기'
            )}
          </button>

          <p className="text-xs text-gray-400">
            Supabase 대시보드의 SQL 에디터에서 직접 실행하려면 아래 SQL을 복사하세요.
          </p>
          <details className="text-left">
            <summary className="text-xs text-sky-600 cursor-pointer font-medium">SQL 보기</summary>
            <pre className="mt-2 text-[10px] bg-gray-50 p-3 rounded-lg overflow-x-auto text-gray-600 leading-relaxed">
{`CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  balance bigint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read accounts" ON accounts FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert accounts" ON accounts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update accounts" ON accounts FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete accounts" ON accounts FOR DELETE TO anon USING (true);

CREATE TABLE IF NOT EXISTS fixed_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  amount bigint NOT NULL,
  day_of_month integer NOT NULL CHECK (day_of_month >= 1 AND day_of_month <= 31),
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE fixed_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read fixed_items" ON fixed_items FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert fixed_items" ON fixed_items FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update fixed_items" ON fixed_items FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete fixed_items" ON fixed_items FOR DELETE TO anon USING (true);`}
            </pre>
          </details>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardView />;
      case 'calendar': return <CalendarView />;
      case 'balance': return <BalanceCheck />;
      case 'items': return <FixedItemManager />;
      case 'accounts': return <AccountManager />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop layout: sidebar + content */}
      <div className="hidden md:flex">
        {/* Sidebar */}
        <aside className="fixed left-0 top-0 bottom-0 w-56 bg-white border-r border-gray-100 flex flex-col z-20">
          <div className="px-5 py-5 border-b border-gray-100">
            <h1 className="text-base font-bold text-gray-900 tracking-tight">고정지출 가계부</h1>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1">
            {SIDEBAR_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-sky-50 text-sky-700'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  <Icon className={`w-[18px] h-[18px] ${isActive ? 'text-sky-600' : ''}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="px-5 py-4 border-t border-gray-100">
            <p className="text-[10px] text-gray-400">Fixed Expense Budget</p>
          </div>
        </aside>

        {/* Main content */}
        <main className="ml-56 flex-1 min-h-screen p-6 lg:p-8 overflow-auto">
          <div className="max-w-5xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Mobile layout: header + content + bottom tabs */}
      <div className="md:hidden">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-100">
          <div className="max-w-lg mx-auto px-4 py-3">
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">고정지출 가계부</h1>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 py-4 pb-24">
          {activeTab === 'calendar' && <CalendarView />}
          {activeTab === 'balance' && <BalanceCheck />}
          {activeTab === 'items' && <FixedItemManager />}
          {activeTab === 'accounts' && <AccountManager />}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/90 backdrop-blur-lg border-t border-gray-100 safe-area-bottom">
          <div className="max-w-lg mx-auto flex">
            {MOBILE_TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
                    isActive ? 'text-sky-700' : 'text-gray-400 hover:text-gray-500'
                  }`}
                >
                  <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                  <span className={`text-[10px] font-medium ${isActive ? 'font-semibold' : ''}`}>
                    {tab.label}
                  </span>
                  {isActive && (
                    <div className="w-1 h-1 rounded-full bg-sky-700 -mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
