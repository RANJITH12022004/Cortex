/** Maps Supabase/Postgres errors to user-friendly messages. */
export function friendlyDbError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;

  if (message.includes('row-level security') || message.includes('42501')) {
    return 'You do not have permission for this action. Sign out and back in, or contact an administrator.';
  }
  if (message.includes('JWT expired') || message.includes('Invalid JWT')) {
    return 'Your session expired. Please sign in again.';
  }
  if (message.includes('Invalid login credentials')) {
    return 'Incorrect email or password.';
  }

  return message || fallback;
}
