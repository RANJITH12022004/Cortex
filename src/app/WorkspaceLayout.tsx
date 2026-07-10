import { AppLayout } from '@/app/AppLayout';
import { ManagerLayout } from '@/app/ManagerLayout';
import { ProcurementLayout } from '@/app/ProcurementLayout';
import { useAuth } from '@/features/auth/AuthProvider';
import { isManagerRole } from '@/features/auth/roleRoutes';
import { isAdminRole } from '@/app/navigation';

type WorkspaceLayoutProps = {
  title: string;
  children: React.ReactNode;
  hideTitle?: boolean;
};

export function WorkspaceLayout({ title, children, hideTitle }: WorkspaceLayoutProps) {
  const { profile } = useAuth();
  const role = profile?.role;

  if (role && (isAdminRole(role) || isManagerRole(role))) {
    return (
      <ManagerLayout title={title} hideTitle={hideTitle}>
        {children}
      </ManagerLayout>
    );
  }

  if (role === 'procurement') {
    return <ProcurementLayout title={title}>{children}</ProcurementLayout>;
  }

  return <AppLayout title={title}>{children}</AppLayout>;
}
