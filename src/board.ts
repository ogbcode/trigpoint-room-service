import {
  BOARD_ORDER_STATUS_LABEL,
  BOARD_PAYMENT_LABEL,
  BOARD_PAYMENT_METHOD_LABEL,
  BOARD_REFRESH_MS,
  BOARD_REFUND_NEEDED,
  DEPARTMENT_NAME,
  Department,
  HOTEL_LOCALE,
  HOTEL_NAME,
  HOTEL_TIMEZONE,
  RoomChargeDecision,
  Route,
} from './constants.js';
import { type BoardData, type BoardDocket, type BoardOrder, formatNaira } from './orders.js';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escape = (value: unknown) => String(value).replace(/[&<>"']/g, (char) => ESCAPES[char]);

const time = (date: Date) =>
  date.toLocaleTimeString(HOTEL_LOCALE, { timeZone: HOTEL_TIMEZONE, hour: '2-digit', minute: '2-digit' });

const STYLES = `
  :root { color-scheme: light; --ink: #18181b; --muted: #71717a; --line: #e4e4e7; --surface: #ffffff; --page: #f4f4f5; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px 16px; font: 14px/1.45 system-ui, sans-serif; color: var(--ink); background: var(--page); }
  main { max-width: 1100px; margin: 0 auto; display: grid; gap: 28px; }
  h1 { margin: 0; font-size: 20px; }
  h2 { margin: 0 0 10px; font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
  .columns { display: grid; gap: 20px; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
  .tickets { display: grid; gap: 10px; }
  .ticket { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
  .ticket header { display: flex; justify-content: space-between; font-weight: 600; }
  .meta, .empty { color: var(--muted); }
  .ticket ul { margin: 8px 0; padding-left: 18px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 8px 10px 8px 0; border-bottom: 1px solid var(--line); white-space: nowrap; }
  th { font-weight: 500; color: var(--muted); }
  .scroll { overflow-x: auto; }
  form { display: inline; }
  button { font: inherit; padding: 4px 10px; border-radius: 6px; border: 1px solid var(--line); background: var(--surface); cursor: pointer; }
  button.primary { background: var(--ink); color: #fff; border-color: var(--ink); }
`;

function page(title: string, body: string, script = '') {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<style>${STYLES}</style>
</head>
<body><main>${body}</main>${script}</body>
</html>`;
}

function ticket(docket: BoardDocket) {
  const lines = docket.items
    .map((item) => `<li>${item.quantity} × ${escape(item.name)}${item.note ? ` (${escape(item.note)})` : ''}</li>`)
    .join('');
  return `<article class="ticket">
  <header><span>${escape(docket.ref)}</span><span>Room ${escape(docket.roomNumber)}</span></header>
  <ul>${lines}</ul>
  <div class="meta">${escape(docket.orderRef)} · ${time(docket.createdAt)} · ${formatNaira(docket.totalKobo)}</div>
</article>`;
}

function department(dockets: BoardDocket[], name: Department) {
  const tickets = dockets.filter((docket) => docket.department === name);
  return `<section><h2>${DEPARTMENT_NAME[name]}</h2><div class="tickets">${
    tickets.length ? tickets.map(ticket).join('') : '<p class="empty">No tickets yet.</p>'
  }</div></section>`;
}

function decisionForm(order: BoardOrder, decision: RoomChargeDecision, label: string, primary = false) {
  const action = Route.BOARD_DECISION.replace(':orderRef', encodeURIComponent(order.ref)).replace(':decision', decision);
  return `<form method="post" action="${escape(action)}"><button${primary ? ' class="primary"' : ''}>${label}</button></form>`;
}

function frontDesk(roomCharges: BoardOrder[]) {
  const rows = roomCharges
    .map(
      (order) => `<tr>
  <td>${escape(order.ref)}</td><td>Room ${escape(order.roomNumber)}</td><td>${escape(order.guest)}</td>
  <td>${formatNaira(order.totalKobo)}</td>
  <td>${decisionForm(order, RoomChargeDecision.ACCEPT, 'Accept', true)} ${decisionForm(order, RoomChargeDecision.REJECT, 'Reject')}</td>
</tr>`,
    )
    .join('');
  return `<section><h2>Front desk: room charges to confirm</h2>${
    roomCharges.length
      ? `<div class="scroll"><table><tr><th>Order</th><th>Room</th><th>Guest</th><th>Total</th><th></th></tr>${rows}</table></div>`
      : '<p class="empty">Nothing to confirm.</p>'
  }</section>`;
}

function orderTable(orders: BoardOrder[]) {
  const rows = orders
    .map((order) => {
      const payment = order.paymentStatus ? BOARD_PAYMENT_LABEL[order.paymentStatus] : '';
      const refund = order.refundNeeded ? ` (${BOARD_REFUND_NEEDED})` : '';
      return `<tr>
  <td>${escape(order.ref)}</td><td>${escape(order.roomNumber)}</td><td>${BOARD_PAYMENT_METHOD_LABEL[order.paymentMethod]}</td>
  <td>${BOARD_ORDER_STATUS_LABEL[order.status]}</td><td>${payment}${refund}</td>
  <td>${formatNaira(order.kitchenKobo)}</td><td>${formatNaira(order.barKobo)}</td><td>${formatNaira(order.totalKobo)}</td>
  <td>${time(order.createdAt)}</td>
</tr>`;
    })
    .join('');
  return `<section><h2>Latest orders</h2>${
    orders.length
      ? `<div class="scroll"><table><tr><th>Order</th><th>Room</th><th>Payment</th><th>Status</th><th>Paystack</th><th>Kitchen</th><th>Bar</th><th>Total</th><th>Time</th></tr>${rows}</table></div>`
      : '<p class="empty">No orders yet.</p>'
  }</section>`;
}

export function renderBoard(data: BoardData) {
  const body = `<h1>${HOTEL_NAME} room service</h1>
<div class="columns">${department(data.dockets, Department.KITCHEN)}${department(data.dockets, Department.BAR)}</div>
${frontDesk(data.roomCharges)}
${orderTable(data.orders)}`;
  const refresh = `<script>
setInterval(async () => {
  const response = await fetch(location.href);
  if (!response.ok) return;
  const next = new DOMParser().parseFromString(await response.text(), 'text/html');
  document.querySelector('main').replaceWith(next.querySelector('main'));
}, ${BOARD_REFRESH_MS});
</script>`;
  return page(`${HOTEL_NAME} board`, body, refresh);
}

export function renderPaymentPage(message: string) {
  return page(`${HOTEL_NAME} payment`, `<h1>${HOTEL_NAME}</h1><p>${escape(message)}</p>`);
}
