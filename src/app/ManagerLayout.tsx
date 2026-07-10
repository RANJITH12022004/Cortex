import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { ROLE_LABELS } from '@/features/auth/roleRoutes';
import { getSidebarNavItems, getWorkspaceLabel, pickNavItemForPath } from '@/app/navigation';

type ManagerLayoutProps = {
  title: string;
  children: React.ReactNode;
  /** When true, skip the default page header (e.g. product editor has its own data plate). */
  hideTitle?: boolean;
};

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/orders', label: 'Orders' },
  { to: '/products', label: 'Products' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/reports/vendor-damage', label: 'Damage report' },
  { to: '/trace', label: 'Trace' },
  { to: '/notifications', label: 'Notifications' },
  { to: '/team/invite', label: 'Team' },
] as const;

export function ManagerLayout({ title, children, hideTitle = false }: ManagerLayoutProps) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navItems = profile ? getSidebarNavItems(profile.role) : [...NAV_ITEMS];
  const workspaceLabel = profile ? getWorkspaceLabel(profile.role) : 'Manager';

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen bg-[#F7F8FA]">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-surface-container-low md:flex">
        <div className="border-b border-border px-4 py-4">
          <p className="font-headline text-headline-sm font-bold tracking-tight text-primary">CORTEX</p>
          <p className="cortex-label text-[10px]">{workspaceLabel}</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {navItems.map((item) => {
            const active =
              item.to === '/dashboard'
                ? location.pathname === '/dashboard'
                : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
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
              className="cortex-input h-8 max-w-[140px] text-body-sm"
              value={pickNavItemForPath(location.pathname, navItems)}
              onChange={(e) => navigate(e.target.value)}
            >
              {navItems.map((item) => (
                <option key={item.to} value={item.to}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <span className="hidden font-mono text-data-mono font-semibold text-primary md:inline">
            CORTEX_SYSTEM_OS
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
            {!hideTitle && (
              <h1 className="mb-6 font-headline text-headline-lg text-on-surface">{title}</h1>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export function StubCard({
  title,
  description,
  links,
}: {
  title: string;
  description: string;
  links?: { to: string; label: string }[];
}) {
  return (
    <div className="cortex-module p-6">
      <div className="border-l-4 border-primary-container pl-4">
        <h2 className="font-headline text-headline-md text-on-surface">{title}</h2>
        <p className="mt-2 text-body-md text-on-surface-variant">{description}</p>
      </div>
      {links && links.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-3">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="inline-flex h-row-height-dense items-center rounded bg-primary-container px-4 font-headline text-label-caps uppercase text-on-primary hover:bg-primary"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
