export function normalizeDomain(input: string): string {
  try {
    const url = new URL(input.startsWith('http') ? input : `https://${input}`);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return input
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .split('?')[0]
      .split('#')[0];
  }
}
