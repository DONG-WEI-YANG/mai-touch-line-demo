import type Database from 'better-sqlite3';
import { monthDays, shiftMonth, taipeiToday } from '../../lib/booking-calendar';

type Booking = { id: number; facilityName: string; startTime: string; endTime: string; status: string };
export type CalendarData = { month: string; day?: string; counts: Record<string, number>; bookings: Booking[]; offset: number };

export function makeBookingCalendar(db: Database.Database, owner: (lineUserId: string) => number | undefined) {
  return (lineUserId: string, month: string, day?: string, offset = 0): CalendarData => {
    if (!/^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/.test(month)) throw new Error('無效月份');
    if (day && !monthDays(month).includes(day)) throw new Error('無效日期');
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('無效頁碼');
    const userId = owner(lineUserId);
    if (!userId || !Number.isSafeInteger(userId)) throw new Error('請先綁定住戶帳戶');
    const rows = db.prepare('SELECT date, COUNT(*) AS count FROM bookings WHERE userId=? AND date>=? AND date<? GROUP BY date').all(userId, `${month}-01`, `${shiftMonth(month, 1)}-01`) as { date: string; count: number }[];
    const counts = Object.fromEntries(rows.map(row => [row.date, row.count]));
    const total = day ? counts[day] ?? 0 : 0;
    const start = Math.min(Math.floor(offset / 10) * 10, Math.max(0, Math.floor((total - 1) / 10) * 10));
    const bookings = day ? db.prepare(`SELECT b.id, COALESCE(a.name,'設施') AS facilityName, b.startTime, b.endTime, b.status
      FROM bookings b LEFT JOIN amenities a ON a.id=b.amenityId
      WHERE b.userId=? AND b.date=? ORDER BY b.startTime,b.id LIMIT 10 OFFSET ?`).all(userId, day, start) as Booking[] : [];
    return { month, day, counts, bookings, offset: start };
  };
}

export function calendarMessage(data: CalendarData, webUrl: string) {
  const { month, day, counts, bookings, offset } = data;
  const today = taipeiToday();
  const button = (label: string, value: string) => ({ type: 'button', height: 'sm', style: 'secondary', action: { type: 'postback', label, data: value } });
  const cells = monthDays(month);
  const status: Record<string, string> = { pending: '待確認', confirmed: '已確認', cancelled: '已取消', completed: '已完成' };
  const monthNav = `nav=calendar&month=${month}`;
  return { type: 'flex', altText: `我的行事曆 ${day ?? month}`, contents: {
    type: 'bubble', size: 'giga',
    header: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [
      { type: 'text', text: `我的行事曆｜${month}`, size: 'lg', weight: 'bold', color: '#8B6C35' },
      { type: 'text', text: '點日期查看預約；數字下方為筆數，含已取消／已完成。', size: 'xs', wrap: true },
    ] },
    body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [
      { type: 'box', layout: 'horizontal', contents: ['日','一','二','三','四','五','六'].map(text => ({ type: 'text', text, align: 'center', size: 'xs', flex: 1 })) },
      ...Array.from({ length: cells.length / 7 }, (_, week) => ({ type: 'box', layout: 'horizontal', spacing: 'xs', contents: cells.slice(week * 7, week * 7 + 7).map(date => ({
        type: 'box', layout: 'vertical', flex: 1, paddingTop: '8px', paddingBottom: '8px', cornerRadius: '4px',
        backgroundColor: date && date === day ? '#E8D7B4' : date === today ? '#F5F2EB' : '#FFFFFF',
        ...(date ? { action: { type: 'postback', data: `${monthNav}&day=${date}`, displayText: `查看 ${date} 預約` } } : {}),
        contents: [
          { type: 'text', text: date ? String(Number(date.slice(-2))) : ' ', align: 'center', size: 'sm' },
          { type: 'text', text: date && counts[date] ? `${counts[date]}筆` : ' ', align: 'center', size: 'xxs', color: '#8B6C35' },
        ],
      })) })),
      ...(day ? [{ type: 'text', text: `${day}｜${counts[day] ?? 0} 筆預約`, weight: 'bold', size: 'sm', margin: 'lg' },
        ...(!bookings.length ? [{ type: 'text', text: '當日沒有預約，可選擇其他日期。', size: 'sm', wrap: true }] : bookings.map(booking => ({
          type: 'box', layout: 'vertical', paddingAll: '10px', backgroundColor: '#F5F2EB', cornerRadius: '4px',
          action: { type: 'postback', data: `query=${encodeURIComponent(`查詢 BK-${booking.id}`)}`, displayText: `查看 BK-${booking.id}` },
          contents: [
            { type: 'text', text: `${booking.startTime}–${booking.endTime} ${booking.facilityName}`, size: 'sm', weight: 'bold', wrap: true },
            { type: 'text', text: `BK-${booking.id}｜${status[booking.status] ?? booking.status}｜查看詳情`, size: 'xs', wrap: true },
          ],
        }))),
      ] : [{ type: 'text', text: Object.keys(counts).length ? '選擇上方日期，預約會顯示在這裡。' : '本月沒有預約，可切換月份查看歷史。', size: 'sm', wrap: true }]),
    ] },
    footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [
      ...(day && offset > 0 ? [button('上一頁預約', `${monthNav}&day=${day}&offset=${offset - 10}`)] : []),
      ...(day && offset + 10 < (counts[day] ?? 0) ? [button('下一頁預約', `${monthNav}&day=${day}&offset=${offset + 10}`)] : []),
      { type: 'box', layout: 'horizontal', contents: [
        ...(month > '1900-01' ? [button('上個月', `nav=calendar&month=${shiftMonth(month, -1)}`)] : []),
        ...(month < '2199-12' ? [button('下個月', `nav=calendar&month=${shiftMonth(month, 1)}`)] : []),
      ] },
      button('今天', `nav=calendar&month=${today.slice(0, 7)}&day=${today}`),
      { type: 'button', style: 'primary', color: '#8B6C35', action: { type: 'uri', label: 'Web 完整行事曆／取消預約', uri: webUrl } },
      button('回服務首頁', 'nav=home'),
    ] },
  } };
}
