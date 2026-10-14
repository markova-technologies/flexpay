/** Format an ETB amount: ETB 2,000.00 */
export function formatETB(amount) {
  if (amount == null || isNaN(amount)) return 'ETB —';
  return `ETB ${Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Format an ETB amount without the "ETB" prefix, for use inside labels */
export function formatAmount(amount) {
  if (amount == null || isNaN(amount)) return '—';
  return Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format an Ethiopian phone number for display: +251 91 234 5678 */
export function formatPhone(phone) {
  if (!phone) return '—';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('251') && digits.length === 12) {
    return `+251 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return `+${digits}`;
}

/** Format an ISO date string: Oct 13, 2026 at 13:45 */
export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Africa/Addis_Ababa',
  }).replace(',', ' at');
}

/** Format date only: Oct 13, 2026 */
export function formatDateShort(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    timeZone: 'Africa/Addis_Ababa',
  });
}

/** Truncate a string with ellipsis */
export function truncate(str, max = 30) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '…' : str;
}
