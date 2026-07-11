export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ReceiptPayment {
  method: string;
  amount: number;
  cashTendered?: number;
  changeDue?: number;
}

export interface ReceiptParams {
  storeName: string;
  orderNumber?: number;
  orderType: string;
  tableNumber?: string | number;
  cashierName: string;
  items: ReceiptItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  payments: ReceiptPayment[];
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

const METHOD_LABEL: Record<string, string> = { cash: 'Cash', card: 'Card', wallet: 'Wallet', online: 'Online' };

// Same "open a dedicated print window" approach as printKOT — this is the
// customer-facing copy, printed once payment actually clears (not on send
// to kitchen), and lists every payment collected so a split bill shows up
// as multiple lines rather than a single misleading total.
export function printReceipt(params: ReceiptParams): void {
  const win = window.open('', '_blank', 'width=380,height=650');
  if (!win) return;

  const now = new Date();
  const timeLabel = now.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  const orderLabel = params.orderNumber != null ? `#${params.orderNumber}` : '';

  const itemRows = params.items.map((i) => `
    <tr>
      <td class="qty">${i.quantity}x</td>
      <td class="name">${escapeHtml(i.name)}</td>
      <td class="amt">${i.totalPrice.toFixed(2)}</td>
    </tr>
  `).join('');

  const paymentRows = params.payments.map((p, idx) => `
    <div class="pay-row">
      <span>${params.payments.length > 1 ? `Share ${idx + 1} — ` : ''}${METHOD_LABEL[p.method] ?? p.method}</span>
      <span>AED ${p.amount.toFixed(2)}</span>
    </div>
    ${p.cashTendered != null ? `
      <div class="pay-row sub">
        <span>Tendered</span><span>AED ${p.cashTendered.toFixed(2)}</span>
      </div>
      <div class="pay-row sub">
        <span>Change</span><span>AED ${(p.changeDue ?? 0).toFixed(2)}</span>
      </div>
    ` : ''}
  `).join('');

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Receipt ${orderLabel}</title>
      <style>
        * { box-sizing: border-box; }
        body {
          font-family: 'Courier New', monospace;
          width: 80mm;
          margin: 0 auto;
          padding: 8px 10px;
          color: #000;
        }
        .center { text-align: center; }
        .store { font-size: 16px; font-weight: bold; }
        .receipt-label { font-size: 13px; margin: 4px 0; letter-spacing: 1px; color: #333; }
        .meta { font-size: 12px; margin: 2px 0; }
        hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        td { padding: 3px 0; vertical-align: top; }
        .qty { width: 12%; font-weight: bold; }
        .name { width: 63%; }
        .amt { width: 25%; text-align: right; }
        .totals-row { display: flex; justify-content: space-between; font-size: 13px; padding: 2px 0; }
        .grand-total { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; padding: 6px 0; }
        .pay-row { display: flex; justify-content: space-between; font-size: 13px; padding: 2px 0; }
        .pay-row.sub { color: #555; font-size: 11px; padding-left: 8px; }
        .footer { font-size: 11px; margin-top: 12px; text-align: center; color: #333; }
        @media print { body { width: 80mm; } }
      </style>
    </head>
    <body>
      <div class="center">
        <div class="store">${escapeHtml(params.storeName)}</div>
        <div class="receipt-label">RECEIPT</div>
      </div>
      <div class="meta">Order: <strong>${orderLabel}</strong></div>
      <div class="meta">Type: <strong>${escapeHtml(params.orderType)}</strong>${params.tableNumber != null ? ` &middot; Table <strong>${params.tableNumber}</strong>` : ''}</div>
      <div class="meta">Cashier: ${escapeHtml(params.cashierName)}</div>
      <div class="meta">${timeLabel}</div>
      <hr />
      <table><tbody>${itemRows}</tbody></table>
      <hr />
      <div class="totals-row"><span>Subtotal</span><span>AED ${params.subtotal.toFixed(2)}</span></div>
      ${params.discountAmount > 0 ? `<div class="totals-row"><span>Discount</span><span>-AED ${params.discountAmount.toFixed(2)}</span></div>` : ''}
      <div class="totals-row"><span>VAT (5%)</span><span>AED ${params.taxAmount.toFixed(2)}</span></div>
      <div class="grand-total"><span>TOTAL</span><span>AED ${params.totalAmount.toFixed(2)}</span></div>
      <hr />
      ${paymentRows}
      <div class="footer">Thank you!</div>
    </body>
    </html>
  `);
  win.document.close();
  win.focus();

  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    try { win.print(); } catch { /* window may already be closed */ }
  };
  win.onload = doPrint;
  setTimeout(doPrint, 300);
}
