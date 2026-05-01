export function parsePostback(data: string): Record<string, string> {
  if (!data) return {};
  if (data.length > 300) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(data)) out[k] = v;
  return out;
}
