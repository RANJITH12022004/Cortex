import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { ROLE_LABELS } from '@/features/auth/roleRoutes';

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
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen bg-[#F7F8FA]">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-surface-container-low md:flex">
        <div className="border-b border-border px-4 py-4">
          <p className="font-headline text-headline-sm font-bold tracking-tight text-primary">CORTEX</p>
          <p className="cortex-label text-[10px]">Procurement</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_ITEMS.map((item) => {
            const active =
              item.to === '/procurement'
                ? location.pathname === '/procurement'
                : location.pathname.startsWith(item.to);

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`block px-4 py-2.5 text-body-md transition-colors ${
                  active
                    ? 'border-l-2 border-primary bg-surface-container-high font-semibold text-primary'
                    : 'border-l-2 border-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-primary'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border border-t-4 border-t-primary-container bg-surface px-container-padding">
          <div className="flex items-center gap-3 md:hidden">
            <select
              className="cortex-input h-8 max-w-[160px] text-body-sm"
              value={NAV_ITEMS.find((i) => location.pathname.startsWith(i.to))?.to ?? '/procurement'}
              onChange={(e) => navigate(e.target.value)}
            >
              {NAV_ITEMS.map((item) => (
                <option key={item.to} value={item.to}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <span className="hidden font-mono text-data-mono font-semibold text-primary md:inline">
            PROCUREMENT_OPERATIONS
          </span>

          <div className="flex items-center gap-3 text-body-sm">
            {profile && (
              <div className="hidden text-right sm:block">
                <p className="font-mono text-data-mono text-on-surface">{profile.email}</p>
                <p className="cortex-label text-[10px]">{ROLE_LABELS[profile.role]}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="h-row-height-dense rounded border border-border bg-surface px-3 font-headline text-label-caps uppercase text-on-surface-variant hover:border-primary-container hover:text-primary-container"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-surface-container-low p-container-padding md:p-6">
          <div className="mx-auto max-w-7xl">
            <h1 className="mb-6 font-headline text-headline-lg text-on-surface">{title}</h1>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
