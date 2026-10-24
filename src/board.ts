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
  OrderStatus,
  RoomChargeDecision,
  Route,
} from './constants.js';
import { type BoardData, type BoardDocket, type BoardOrder, formatNaira } from './orders.js';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escape = (value: unknown) => String(value).replace(/[&<>"']/g, (char) => ESCAPES[char]);

const time = (date: Date) =>
  date.toLocaleTimeString(HOTEL_LOCALE, { timeZone: HOTEL_TIMEZONE, hour: '2-digit', minute: '2-digit' });

const STYLES = `
  :root {
    color-scheme: light;
    --ink: #1c1917; --muted: #78716c; --faint: #a8a29e; --line: rgba(28, 25, 23, .08);
    --gold: #9a7b2f; --glass: rgba(255, 255, 255, .62);
  }
  * { box-sizing: border-box; }
  html { min-height: 100%; background: #f6f3ee; }
  body {
    margin: 0; padding: 56px 24px 80px; font: 15px/1.6 Inter, system-ui, sans-serif; color: var(--ink);
    -webkit-font-smoothing: antialiased;
    background:
      radial-gradient(800px 500px at 10% -10%, rgba(214, 190, 140, .35), transparent 65%),
      radial-gradient(700px 500px at 100% 10%, rgba(176, 196, 222, .35), transparent 65%),
      #f6f3ee;
    background-attachment: fixed;
  }
  main { max-width: 1080px; margin: 0 auto; display: grid; gap: 36px; }
  .top { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 0 6px; }
  h1 { margin: 0; font-size: 28px; font-weight: 500; letter-spacing: -.02em; }
  .top p { margin: 0; color: var(--muted); }
  h2 { margin: 0 0 18px; font-size: 11px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--faint); }
  .panel {
    padding: 26px 28px; border-radius: 20px; border: 1px solid rgba(255, 255, 255, .8); background: var(--glass);
    backdrop-filter: blur(24px) saturate(140%); -webkit-backdrop-filter: blur(24px) saturate(140%);
    box-shadow: 0 1px 2px rgba(28, 25, 23, .04), 0 24px 60px -30px rgba(28, 25, 23, .25);
  }
  .columns { display: grid; gap: 24px; }
  .tickets { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); grid-auto-rows: 1fr; }
  .ticket { display: flex; flex-direction: column; min-height: 150px; padding: 16px 18px; border-radius: 14px; border: 1px solid var(--line); background: rgba(255, 255, 255, .7); }
  .ticket header { display: flex; justify-content: space-between; font-weight: 600; font-variant-numeric: tabular-nums; }
  .ticket header span:last-child { color: var(--gold); font-weight: 500; }
  .ticket ul { margin: 10px 0 16px; padding-left: 16px; font-size: 14px; }
  .ticket li { margin: 2px 0; }
  .ticket .note { display: block; color: var(--muted); font-size: 13px; }
  .ticket footer { margin-top: auto; display: flex; justify-content: space-between; gap: 12px; color: var(--muted); font-size: 13px; font-variant-numeric: tabular-nums; }
  .meta, .empty { color: var(--muted); font-size: 13px; }
  .empty { margin: 0; }
  table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  th, td { text-align: left; padding: 12px 16px 12px 0; border-bottom: 1px solid var(--line); white-space: nowrap; }
  tr:last-child td { border-bottom: 0; }
  th { font-weight: 500; font-size: 12px; color: var(--faint); }
  .scroll { overflow-x: auto; }
  .pill { display: inline-block; padding: 2px 10px; border-radius: 999px; border: 1px solid var(--line); background: rgba(255, 255, 255, .7); font-size: 12px; }
  .pill.done { color: var(--gold); border-color: rgba(154, 123, 47, .3); }
  .pill.alert { color: #b3453a; border-color: rgba(179, 69, 58, .3); }
  form { display: inline; }
  button {
    font: inherit; font-size: 13px; font-weight: 500; padding: 6px 14px; border-radius: 999px; cursor: pointer;
    border: 1px solid var(--line); background: rgba(255, 255, 255, .8); color: var(--ink);
  }
  button:hover { background: #fff; }
  button.primary { background: var(--ink); color: #fff; border-color: var(--ink); }
  button.primary:hover { background: #292524; }
  .payment { max-width: 520px; margin: 10vh auto 0; text-align: center; padding: 44px 36px; }
  .payment h1 { margin-bottom: 14px; }
  .payment p { margin: 0; font-size: 17px; color: var(--muted); }
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
    .map((item) => `<li>${item.quantity} × ${escape(item.name)}${item.note ? `<span class="note">${escape(item.note)}</span>` : ''}</li>`)
    .join('');
  return `<article class="ticket">
  <header><span>${escape(docket.ref)}</span><span>Room ${escape(docket.roomNumber)}</span></header>
  <ul>${lines}</ul>
  <footer><span>${escape(docket.orderRef)} · ${time(docket.createdAt)}</span><span>${formatNaira(docket.totalKobo)}</span></footer>
</article>`;
}

function department(dockets: BoardDocket[], name: Department) {
  const tickets = dockets.filter((docket) => docket.department === name);
  return `<section class="panel"><h2>${DEPARTMENT_NAME[name]}</h2><div class="tickets">${
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
  return `<section class="panel"><h2>Front desk: room charges to confirm</h2>${
    roomCharges.length
      ? `<div class="scroll"><table><tr><th>Order</th><th>Room</th><th>Guest</th><th>Total</th><th></th></tr>${rows}</table></div>`
      : '<p class="empty">Nothing to confirm.</p>'
  }</section>`;
}

function orderTable(orders: BoardOrder[]) {
  const rows = orders
    .map((order) => {
      const payment = order.paymentStatus ? BOARD_PAYMENT_LABEL[order.paymentStatus] : '';
      const refund = order.refundNeeded ? ` <span class="pill alert">${BOARD_REFUND_NEEDED}</span>` : '';
      return `<tr>
  <td>${escape(order.ref)}</td><td>${escape(order.roomNumber)}</td><td>${BOARD_PAYMENT_METHOD_LABEL[order.paymentMethod]}</td>
  <td><span class="pill${order.status === OrderStatus.CLOSED ? ' done' : ''}">${BOARD_ORDER_STATUS_LABEL[order.status]}</span></td><td>${payment}${refund}</td>
  <td>${formatNaira(order.kitchenKobo)}</td><td>${formatNaira(order.barKobo)}</td><td>${formatNaira(order.totalKobo)}</td>
  <td>${time(order.createdAt)}</td>
</tr>`;
    })
    .join('');
  return `<section class="panel"><h2>Latest orders</h2>${
    orders.length
      ? `<div class="scroll"><table><tr><th>Order</th><th>Room</th><th>Payment</th><th>Status</th><th>Paystack</th><th>Kitchen</th><th>Bar</th><th>Total</th><th>Time</th></tr>${rows}</table></div>`
      : '<p class="empty">No orders yet.</p>'
  }</section>`;
}

export function renderBoard(data: BoardData) {
  const body = `<div class="top"><h1>${HOTEL_NAME}</h1><p>Room service board</p></div>
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
  return page(`${HOTEL_NAME} payment`, `<section class="panel payment"><h1>${HOTEL_NAME}</h1><p>${escape(message)}</p></section>`);
}
