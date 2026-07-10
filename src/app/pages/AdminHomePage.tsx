import { ManagerLayout, StubCard } from '@/app/ManagerLayout';

export function AdminHomePage() {
  return (
    <ManagerLayout title="Administration">
      <StubCard
        title="Administration"
        description="Manage user access and send invitations."
        links={[{ to: '/admin/invite', label: 'Invite user' }]}
      />
    </ManagerLayout>
  );
}
