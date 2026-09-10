type DisplayOrder = { id: string | number; title: string; description?: string | null; priority?: string };
type Language = 'zh' | 'en';
export function workOrderPriorityLabel(priority: string | undefined, language: Language = 'zh'): string {
  const labels: Record<string, string> = language === 'en'
    ? { low: 'Low', medium: 'Normal', high: 'High', urgent: 'Urgent' }
    : { low: '低', medium: '一般', high: '高', urgent: '緊急' };
  return labels[priority ?? ''] ?? (language === 'en' ? 'Unspecified' : '未指定');
}

/** Display only: never replace persisted titles, descriptions, or mutation IDs. */
export function formatWorkOrder(order: DisplayOrder, language: Language = 'zh') {
  const en = language === 'en';
  const isVisitor = order.title.startsWith('[visitor] ');
  const raw = order.description ?? '';
  let fields: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) fields = parsed as Record<string, unknown>;
  } catch { /* Plain legacy text remains readable. */ }
  const text = (value: unknown): string => typeof value === 'string' ? value.trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
  const labels: Record<string, string> = en
    ? { visitor_name: 'Visitor name', visitor_count: 'Visitors', date: 'Visit date', time: 'Visit time', issue: 'Issue', location: 'Location', urgency: 'Urgency', notes: 'Notes' }
    : { visitor_name: '訪客姓名', visitor_count: '來訪人數', date: '到訪日期', time: '到訪時間', issue: '問題描述', location: '位置', urgency: '急迫程度', notes: '備註' };
  const lines: string[] = [];
  for (const [key, label] of Object.entries(labels)) {
    let value = text(fields[key]);
    if (!value) continue;
    if (key === 'visitor_count') value += en ? (value === '1' ? ' person' : ' people') : ' 人';
    if (key === 'urgency') value = workOrderPriorityLabel(value === 'med' ? 'medium' : value, language);
    lines.push(`${label}${en ? ': ' : '：'}${value}`);
  }
  // Preserve additional scalar information rather than silently dropping old fields.
  for (const [key, value] of Object.entries(fields)) {
    if (!(key in labels) && text(value)) lines.push(`${key}${en ? ': ' : '：'}${text(value)}`);
  }
  const legacyName = order.title.slice('[visitor] '.length).replace(/^visitor=/, '').trim();
  const name = text(fields.visitor_name) || legacyName;
  return {
    isVisitor,
    reference: `${isVisitor ? 'V' : 'WO'}-${order.id}`,
    title: isVisitor ? `${en ? 'Visitor registration' : '訪客登記'}${name && name !== 'demo' ? ' · ' + name : ''}` : order.title.replace(/^\[(repair|complaint)\]\s*/, ''),
    description: lines.length ? lines.join('\n') : raw,
    priority: workOrderPriorityLabel(order.priority, language),
  };
}
