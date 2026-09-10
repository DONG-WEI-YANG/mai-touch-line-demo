import { expect, it } from 'vitest';
import { formatWorkOrder, workOrderPriorityLabel } from '../src/lib/work-order-presentation';

it('shows a visitor reference and readable fields without exposing storage JSON', () => {
  const order = { id: 10, title: '[visitor] visitor=AA', description: '{"visitor_name":"AA","visitor_count":1,"date":"2026-09-11","time":"18:00"}', priority: 'medium' };
  const before = JSON.stringify(order);
  expect(formatWorkOrder(order)).toEqual({ isVisitor: true, reference: 'V-10', title: '訪客登記 · AA', description: '訪客姓名：AA\n來訪人數：1 人\n到訪日期：2026-09-11\n到訪時間：18:00', priority: '一般' });
  expect(JSON.stringify(order)).toBe(before);
});
it.each(['{broken', '請先聯絡管理室', 'null', '[1,2]'])('preserves unsupported legacy description %s without crashing', description => {
  expect(formatWorkOrder({ id: '10', title: '[visitor] visitor=AA', description }).description).toBe(description);
});
it('preserves plain repair text and its WO identity', () => {
  expect(formatWorkOrder({ id: 4, title: '冷氣漏水', description: '大廳右側', priority: 'urgent' })).toMatchObject({ reference: 'WO-4', title: '冷氣漏水', description: '大廳右側', priority: '緊急', isVisitor: false });
});
it('formats repair fields, ignores nested visitor names, and supports English labels', () => {
  expect(formatWorkOrder({ id: 4, title: '[repair] 漏水', description: '{"issue":"漏水","location":"大廳"}' }).description).toBe('問題描述：漏水\n位置：大廳');
  expect(formatWorkOrder({ id: 5, title: '[visitor] visitor=Alice', description: '{"visitor_name":{"bad":true},"visitor_count":2}' }, 'en')).toMatchObject({ reference: 'V-5', title: 'Visitor registration · Alice', description: 'Visitors: 2 people' });
  expect(workOrderPriorityLabel('high', 'en')).toBe('High');
});
