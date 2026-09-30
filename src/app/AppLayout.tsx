import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { ROLE_LABELS } from '@/features/auth/roleRoutes';

type AppLayoutProps = {
  title: string;
  children: React.ReactNode;
};

export function AppLayout({ title, children }: AppLayoutProps) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <header className="border-b border-border bg-surface-container-low">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-container-padding py-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="font-headline text-headline-sm uppercase tracking-wide text-primary-container">
              Cortex
            </Link>
            <span className="hidden h-4 w-px bg-border sm:block" />
            <h1 className="font-headline text-headline-sm text-on-surface">{title}</h1>
            {profile && (
              <>
                <span className="hidden h-4 w-px bg-border md:block" />
                <Link to="/notifications" className="hidden text-body-sm text-primary-container hover:underline md:block">
                  Notifications
                </Link>
              </>
            )}
          </div>
          <div className="flex items-center gap-4 text-body-sm">
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
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-container-padding py-8">{children}</main>
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
