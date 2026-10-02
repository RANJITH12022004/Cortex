import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';

type ProcurementLayoutProps = {
  title: string;
  children: React.ReactNode;
};

const NAV_ITEMS = [
  { to: '/procurement', label: 'Overview' },
  { to: '/notifications', label: 'Notifications' },
  { to: '/tasks', label: 'Employee handover' },
] as const;

export function ProcurementLayout({ title, children }: ProcurementLayoutProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-[#f4f5f7]">
      <button
        type="button"
        onClick={() => setSidebarOpen((open) => !open)}
        aria-expanded={sidebarOpen}
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        className="fixed left-4 top-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#53617a] text-lg font-bold text-white shadow-lg hover:bg-[#445066]"
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-30 bg-black/30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[#53617a] text-white shadow-xl transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-b border-white/15 px-4 py-5 pl-20">
          <p className="font-headline text-headline-sm font-bold tracking-tight text-white">CORTEX</p>
          <p className="mt-1 text-body-sm text-white/70">Procurement</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {NAV_ITEMS.map((item) => {
            const active =
              item.to === '/procurement'
                ? location.pathname === '/procurement'
                : location.pathname.startsWith(item.to);

            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`mb-1 block rounded-lg px-3 py-2.5 text-body-md transition-colors ${
                  active
                    ? 'bg-[#e48b59] font-semibold text-white'
                    : 'text-white/85 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/15 p-4">
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="flex h-12 w-full items-center justify-center rounded-lg bg-white/10 font-headline text-label-caps uppercase text-white hover:bg-[#e48b59]"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-h-screen px-4 pb-8 pt-20 md:px-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="mb-6 font-headline text-headline-lg text-on-surface">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  );
}
