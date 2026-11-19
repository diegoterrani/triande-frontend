/** Empty base means same-origin `/api/v2` (the SPA served under `/app`). */
export function readApiBase(): string {
  const fromApi = import.meta.env?.VITE_API_BASE?.trim();
  const fromLegacy = import.meta.env?.VITE_TRIADE_API_BASE?.trim();
  return (fromApi || fromLegacy || '').replace(/\/+$/, '');
}
