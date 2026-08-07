/**
 * Formats a Postgres `date` ("2026-08-20") as e.g. "20 Aug".
 *
 * Built from the parts rather than `new Date(iso)` on purpose: that parses a
 * bare date string as UTC midnight, which renders as the previous day in any
 * timezone behind UTC.
 */
export function formatEventDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;

  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  return new Date(iso).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}
