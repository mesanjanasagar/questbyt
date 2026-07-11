export interface KOTItem {
  name: string;
  quantity: number;
  variantName?: string;
  notes?: string;
}

export interface KOTParams {
  storeName: string;
  orderNumber?: number;
  orderType: string;
  tableNumber?: string | number;
  guestCount?: number;
  cashierName: string;
  items: KOTItem[];
  notes?: string;
  /** true when this ticket covers only newly-added items on an order the kitchen has already seen */
  isReorder?: boolean;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

// Opens a dedicated print window formatted for an 80mm thermal ticket and
// triggers the browser print dialog — there's no physical kitchen printer
// integration here, so this is the realistic web equivalent: the cashier's
// print dialog target (thermal printer, PDF, etc.) decides where it lands.
export function printKOT(params: KOTParams): void {
  const win = window.open('', '_blank', 'width=380,height=600');
  if (!win) return;

  const now = new Date();
  const timeLabel = now.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  const orderLabel = params.orderNumber != null ? `#${params.orderNumber}` : 'NEW';

  const itemRows = params.items.map((i) => `
    <tr>
      <td class="qty">${i.quantity}x</td>
      <td class="name">
        ${escapeHtml(i.name)}${i.variantName ? ` <span class="variant">(${escapeHtml(i.variantName)})</span>` : ''}
        ${i.notes ? `<div class="notes">${escapeHtml(i.notes)}</div>` : ''}
      </td>
    </tr>
  `).join('');

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>KOT ${orderLabel}</title>
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
        .kot-label { font-size: 20px; font-weight: bold; margin: 6px 0; letter-spacing: 2px; }
        .meta { font-size: 12px; margin: 2px 0; }
        hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        td { padding: 4px 0; vertical-align: top; }
        .qty { width: 15%; font-weight: bold; }
        .name { width: 85%; }
        .variant { font-size: 12px; color: #333; }
        .notes { font-size: 12px; font-style: italic; color: #333; }
        .footer { font-size: 11px; margin-top: 10px; text-align: center; }
        @media print {
          body { width: 80mm; }
        }
      </style>
    </head>
    <body>
      <div class="center">
        <div class="store">${escapeHtml(params.storeName)}</div>
        <div class="kot-label">${params.isReorder ? 'KOT — ADDITIONAL ITEMS' : 'KITCHEN ORDER TICKET'}</div>
      </div>
      <div class="meta">Order: <strong>${orderLabel}</strong></div>
      <div class="meta">Type: <strong>${escapeHtml(params.orderType)}</strong>${params.tableNumber != null ? ` &middot; Table <strong>${params.tableNumber}</strong>` : ''}</div>
      ${params.guestCount ? `<div class="meta">Guests: ${params.guestCount}</div>` : ''}
      <div class="meta">Cashier: ${escapeHtml(params.cashierName)}</div>
      <div class="meta">${timeLabel}</div>
      <hr />
      <table><tbody>${itemRows}</tbody></table>
      <hr />
      ${params.notes ? `<div class="meta">Notes: ${escapeHtml(params.notes)}</div>` : ''}
      <div class="footer">${params.items.reduce((s, i) => s + i.quantity, 0)} item(s)</div>
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
  // Some browsers don't fire onload reliably for document.write — fall back.
  setTimeout(doPrint, 300);
}
