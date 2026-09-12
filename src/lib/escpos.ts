/**
 * ESC/POS Command Builder for Black Copper BC-85AC (80mm Thermal Printer)
 * Generates raw byte sequences that the printer understands natively.
 * Character width: 42 chars per line (Font A, 80mm paper, 72mm printable)
 */

const ESC = '\x1B';
const GS = '\x1D';
const LF = '\x0A';

export const LINE_WIDTH = 42;

export const CMD = {
  // Printer initialization
  INIT: `${ESC}@`,

  // Paper cut
  CUT_PARTIAL: `${GS}V\x01`,
  CUT_FULL: `${GS}V\x00`,

  // Feed lines
  FEED: (n: number) => `${ESC}d${String.fromCharCode(n)}`,

  // Text alignment
  ALIGN_LEFT: `${ESC}a\x00`,
  ALIGN_CENTER: `${ESC}a\x01`,
  ALIGN_RIGHT: `${ESC}a\x02`,

  // Font style
  BOLD_ON: `${ESC}E\x01`,
  BOLD_OFF: `${ESC}E\x00`,
  UNDERLINE_ON: `${ESC}-\x01`,
  UNDERLINE_OFF: `${ESC}-\x00`,

  // Font size (using ESC ! n)
  SIZE_NORMAL: `${ESC}!\x00`,
  SIZE_DOUBLE_HEIGHT: `${ESC}!\x10`,
  SIZE_DOUBLE_WIDTH: `${ESC}!\x20`,
  SIZE_DOUBLE: `${ESC}!\x30`,       // double width + double height
  SIZE_BOLD: `${ESC}!\x08`,          // emphasized/bold
  SIZE_DOUBLE_BOLD: `${ESC}!\x38`,   // double + bold
};

/** Print a line of text followed by newline */
export function text(str: string): string {
  return str + LF;
}

/** Print a separator line */
export function separator(char: string = '-'): string {
  return char.repeat(LINE_WIDTH) + LF;
}

/** Print a dashed separator */
export function dashed(): string {
  return separator('-');
}

/** Print a double separator */
export function doubleLine(): string {
  return separator('=');
}

/** Print two columns: left-aligned text and right-aligned text */
export function columns(left: string, right: string): string {
  const rightLen = right.length;
  const leftMax = LINE_WIDTH - rightLen - 1;
  const leftTrimmed = left.substring(0, leftMax);
  return leftTrimmed.padEnd(LINE_WIDTH - rightLen) + right + LF;
}

/** Print three columns */
export function threeColumns(left: string, center: string, right: string): string {
  const third = Math.floor(LINE_WIDTH / 3);
  const l = left.substring(0, third).padEnd(third);
  const c = center.substring(0, third).padEnd(third);
  const r = right.substring(0, LINE_WIDTH - third * 2).padStart(LINE_WIDTH - third * 2);
  return l + c + r + LF;
}

/** Center a text within LINE_WIDTH */
export function centerText(str: string): string {
  if (str.length >= LINE_WIDTH) return str.substring(0, LINE_WIDTH) + LF;
  const pad = Math.floor((LINE_WIDTH - str.length) / 2);
  return ' '.repeat(pad) + str + LF;
}

/** Blank line */
export function blank(): string {
  return LF;
}

/** Format currency */
export function currency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return 'Rs.0';
  /*
   * Paisa are shown only when there are any.
   *
   * Whole-rupee prices still read "Rs.1,450", but an amount the till actually charges
   * to the paisa prints in full - previously it was rounded for display only, so a
   * receipt could claim Rs.1,450 against a recorded sale of Rs.1,449.53 and leave the
   * drawer short at reconciliation.
   */
  const hasPaisa = Math.round(num * 100) % 100 !== 0;
  return `Rs.${num.toLocaleString('en-PK', {
    minimumFractionDigits: hasPaisa ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

/** Format a date/time string for receipt */
export function formatReceiptDate(dateStr: string | Date): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-PK', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  } catch {
    return String(dateStr);
  }
}

// ============================================================
// RECEIPT FORMATTERS
// ============================================================

/** Format a full order receipt (customer copy with payment info) */
export function formatOrderReceipt(order: any): string {
  let r = '';

  // Initialize printer
  r += CMD.INIT;

  // Header
  r += CMD.ALIGN_CENTER;
  r += CMD.SIZE_DOUBLE_BOLD;
  r += text('FORK & FIRE');
  r += CMD.SIZE_NORMAL;
  r += CMD.BOLD_ON;
  r += text('Special Fast Food & Pizza');
  r += CMD.BOLD_OFF;
  r += text('Main Karkhana Bazar, Chak 267 RB');
  r += text('Jallandhar Arain');
  r += CMD.BOLD_ON;
  r += text('Delivery: 0301-9622267');
  r += text('         0305-7729767');
  r += CMD.BOLD_OFF;
  r += CMD.ALIGN_LEFT;
  r += dashed();

  // Order info
  const orderNum = order.orderNumber?.startsWith('#') ? order.orderNumber : `#${order.orderNumber}`;
  const orderType = (order.orderType || 'DINE IN').replace('_', ' ');
  r += CMD.BOLD_ON;
  r += columns(`ORDER: ${orderNum}`, orderType.toUpperCase());
  r += CMD.BOLD_OFF;
  r += text(`Date: ${formatReceiptDate(order.createdAt || new Date())}`);
  
  // Resolve Waiter & Rider Names
  const waiterName = order.waiterName || order.waiter?.name || null;
  const riderName = order.riderName || order.rider?.name || null;

  if (order.table) {
    r += CMD.BOLD_ON;
    r += text(`Table: ${order.table.name}`);
    r += CMD.BOLD_OFF;
  }
  if (waiterName) {
    r += CMD.BOLD_ON;
    r += text(`Waiter: ${waiterName}`);
    r += CMD.BOLD_OFF;
  }
  if (riderName) {
    r += CMD.BOLD_ON;
    r += text(`Rider: ${riderName}`);
    r += CMD.BOLD_OFF;
  }
  r += text(`Cashier: ${order.cashier?.name || 'Terminal 1'}`);
  if (order.customer) {
    r += text(`Customer: ${order.customer.name} (${order.customer.phone || ''})`);
    if (order.deliveryAddress) {
      r += text(`Addr: ${order.deliveryAddress}`);
    }
  }
  r += dashed();

  // Items header
  r += CMD.BOLD_ON;
  r += columns('ITEM', 'TOTAL');
  r += CMD.BOLD_OFF;
  r += separator('-');

  // Items
  if (order.items && order.items.length > 0) {
    for (const item of order.items) {
      const name = item.productName || item.name || 'Item';
      const total = currency(item.itemTotal || 0);
      r += CMD.BOLD_ON;
      r += columns(name, total);
      r += CMD.BOLD_OFF;
      const qty = item.quantity || 1;
      const price = item.unitPrice || item.price || 0;
      r += text(`  ${qty} x ${currency(price)}`);

      // Modifiers
      if (item.modifiers && item.modifiers.length > 0) {
        for (const mod of item.modifiers) {
          const modName = mod.modifierName || mod.name;
          const modPrice = Number(mod.unitPrice || mod.price || 0);
          r += text(`  + ${modName}${modPrice > 0 ? ` (${currency(modPrice)})` : ''}`);
        }
      }

      // Notes
      if (item.notes) {
        r += text(`  Note: ${item.notes}`);
      }
    }
  }
  r += dashed();

  // Totals
  r += columns('Subtotal:', currency(order.subtotal || 0));

  if (Number(order.discountAmount) > 0) {
    const reason = order.discountReason ? ` (${order.discountReason})` : '';
    r += columns(`Discount${reason}:`, `-${currency(order.discountAmount)}`);
  }

  if (Number(order.taxAmount) > 0) {
    r += columns('GST / Tax:', currency(order.taxAmount));
  }

  if (Number(order.deliveryCharge) > 0) {
    r += columns('Delivery Charge:', currency(order.deliveryCharge));
  }

  r += doubleLine();
  r += CMD.SIZE_DOUBLE_BOLD;
  r += columns('GRAND TOTAL:', currency(order.grandTotal || 0));
  r += CMD.SIZE_NORMAL;
  r += dashed();

  // Payment info
  const payment = order.payments?.[0];
  const method = payment?.paymentMethod || 'CASH';
  const received = payment?.amountReceived || order.grandTotal || 0;
  const change = payment?.changeGiven || 0;

  r += columns('Payment:', method.toUpperCase());
  r += columns('Amount Tendered:', currency(received));
  r += CMD.BOLD_ON;
  r += columns('Change Returned:', currency(change));
  r += CMD.BOLD_OFF;
  r += dashed();

  // Status
  r += CMD.ALIGN_CENTER;
  r += CMD.BOLD_ON;
  r += text('*** PAID IN FULL - THANK YOU! ***');
  r += CMD.BOLD_OFF;
  r += blank();
  r += CMD.BOLD_ON;
  r += text('GOOD FOOD - GOOD LIFE');
  r += CMD.BOLD_OFF;
  r += text('Fresh & Hot Delivery to Your Doorstep!');
  r += text('Taste The Heat');
  r += blank();
  r += text('Software: Fork & Fire POS');
  r += CMD.ALIGN_LEFT;

  // Feed and cut
  r += CMD.FEED(4);
  r += CMD.CUT_PARTIAL;

  return r;
}

/** Settings a receipt can draw on. Optional so callers without them still work. */
export interface ReceiptSettings {
  onlinePaymentInfo?: string | null;
}

/**
 * Format a customer bill (pre-payment invoice).
 *
 * Unlike the paid receipt, this one carries the restaurant's transfer accounts, since
 * the diner has not paid yet and may want to send the money rather than queue at the
 * counter. The accounts come from settings, not from this file.
 */
export function formatCustomerBill(order: any, settings?: ReceiptSettings | null): string {
  let r = '';

  r += CMD.INIT;

  // Header
  r += CMD.ALIGN_CENTER;
  r += CMD.BOLD_ON;
  r += CMD.SIZE_DOUBLE;
  r += text('CUSTOMER BILL');
  r += CMD.SIZE_NORMAL;
  r += blank();
  r += CMD.SIZE_DOUBLE_BOLD;
  r += text('FORK & FIRE');
  r += CMD.SIZE_NORMAL;
  r += CMD.BOLD_ON;
  r += text('Special Fast Food & Pizza');
  r += CMD.BOLD_OFF;
  r += text('Main Karkhana Bazar, Chak 267 RB');
  r += text('Jallandhar Arain');
  r += CMD.ALIGN_LEFT;
  r += dashed();

  /*
   * Transfer accounts.
   *
   * Only the customer bill carries these: the diner has not paid yet, so the numbers
   * are useful to them. They come from settings rather than from this file, because
   * wallet accounts change far more often than the receipt layout does.
   */
  const paymentLines = (settings?.onlinePaymentInfo || '')
    .split('\n')
    .map((line: string) => line.trim())
    .filter(Boolean);

  if (paymentLines.length > 0) {
    r += CMD.ALIGN_CENTER;
    r += CMD.BOLD_ON;
    r += text('*** ONLINE PAYMENT ***');
    r += CMD.BOLD_OFF;
    r += CMD.ALIGN_LEFT;
    for (const line of paymentLines) {
      r += CMD.BOLD_ON;
      r += text(line.substring(0, LINE_WIDTH));
      r += CMD.BOLD_OFF;
    }
    r += dashed();
  }

  // Order info
  const orderNum = order.orderNumber?.startsWith('#') ? order.orderNumber : `#${order.orderNumber}`;
  const orderType = (order.orderType || 'DINE IN').replace('_', ' ');
  r += CMD.BOLD_ON;
  r += columns(`ORDER: ${orderNum}`, orderType.toUpperCase());
  r += CMD.BOLD_OFF;
  r += text(`Date: ${formatReceiptDate(order.createdAt || new Date())}`);
  
  // Resolve Waiter & Rider Names
  const waiterName = order.waiterName || order.waiter?.name || null;
  const riderName = order.riderName || order.rider?.name || null;

  if (order.table) {
    r += CMD.BOLD_ON;
    r += text(`Table: ${order.table.name}`);
    r += CMD.BOLD_OFF;
  }
  if (waiterName) {
    r += CMD.BOLD_ON;
    r += text(`Waiter: ${waiterName}`);
    r += CMD.BOLD_OFF;
  }
  if (riderName) {
    r += CMD.BOLD_ON;
    r += text(`Rider: ${riderName}`);
    r += CMD.BOLD_OFF;
  }
  r += text(`Cashier: ${order.cashier?.name || 'Admin'}`);
  if (order.customer) {
    r += text(`Customer: ${order.customer.name} (${order.customer.phone || ''})`);
    if (order.deliveryAddress) {
      r += text(`Addr: ${order.deliveryAddress}`);
    }
  }
  r += dashed();

  // Items
  r += CMD.BOLD_ON;
  r += columns('ITEM', 'TOTAL');
  r += CMD.BOLD_OFF;
  r += separator('-');

  if (order.items && order.items.length > 0) {
    for (const item of order.items) {
      const name = item.productName || item.name || 'Item';
      const total = currency(item.itemTotal || 0);
      r += CMD.BOLD_ON;
      r += columns(name, total);
      r += CMD.BOLD_OFF;
      r += text(`  ${item.quantity || 1} x ${currency(item.unitPrice || item.price || 0)}`);

      if (item.modifiers && item.modifiers.length > 0) {
        for (const mod of item.modifiers) {
          const modName = mod.modifierName || mod.name;
          const modPrice = Number(mod.unitPrice || mod.price || 0);
          r += text(`  + ${modName}${modPrice > 0 ? ` (${currency(modPrice)})` : ''}`);
        }
      }
      if (item.notes) {
        r += text(`  Note: ${item.notes}`);
      }
    }
  }
  r += dashed();

  // Totals
  r += columns('Subtotal:', currency(order.subtotal || 0));
  if (Number(order.discountAmount) > 0) {
    r += columns(`Discount:`, `-${currency(order.discountAmount)}`);
  }
  if (Number(order.taxAmount) > 0) {
    r += columns('GST / Tax:', currency(order.taxAmount));
  }
  if (Number(order.deliveryCharge) > 0) {
    r += columns('Delivery:', currency(order.deliveryCharge));
  }
  r += doubleLine();
  r += CMD.SIZE_DOUBLE_BOLD;
  r += columns('TOTAL PAYABLE:', currency(order.grandTotal || 0));
  r += CMD.SIZE_NORMAL;
  r += dashed();

  // Status
  r += CMD.ALIGN_CENTER;
  r += CMD.BOLD_ON;
  const status = order.paymentStatus === 'PAID' ? 'STATUS: PAID' : 'STATUS: UNPAID / DUE';
  r += text(`*** ${status} ***`);
  r += blank();
  r += text('*** PLEASE PAY AT COUNTER ***');
  r += CMD.BOLD_OFF;
  r += text('GOOD FOOD - GOOD LIFE');
  r += CMD.ALIGN_LEFT;

  r += CMD.FEED(4);
  r += CMD.CUT_PARTIAL;

  return r;
}

/** Format a kitchen order ticket (KOT) */
export function formatKitchenTicket(order: any): string {
  let r = '';

  r += CMD.INIT;

  // Header - matches order receipt style
  r += CMD.ALIGN_CENTER;
  r += CMD.SIZE_DOUBLE_BOLD;
  r += text('FORK & FIRE');
  r += CMD.SIZE_NORMAL;
  r += CMD.BOLD_ON;
  r += text('*** KITCHEN ORDER TICKET (KOT) ***');
  r += text('CHEF / KITCHEN COPY');
  r += CMD.BOLD_OFF;
  r += CMD.ALIGN_LEFT;
  r += dashed();

  // Order info
  const orderNum = order.orderNumber?.startsWith('#') ? order.orderNumber : `#${order.orderNumber}`;
  const orderType = (order.orderType || 'DINE IN').replace('_', ' ');
  r += CMD.BOLD_ON;
  r += columns(`ORDER: ${orderNum}`, orderType.toUpperCase());
  r += CMD.BOLD_OFF;
  r += text(`Date: ${formatReceiptDate(order.createdAt || new Date())}`);

  // Table
  if (order.table) {
    r += CMD.BOLD_ON;
    r += text(`Table: ${order.table.name}`);
    r += CMD.BOLD_OFF;
  }

  // Waiter / Staff serving this table (Dine-In)
  const waiterName = order.waiterName || order.waiter?.name || null;
  if (waiterName) {
    r += CMD.BOLD_ON;
    r += text(`Waiter: ${waiterName}`);
    r += CMD.BOLD_OFF;
  }

  // Delivery Rider (Delivery)
  const riderName = order.riderName || order.rider?.name || null;
  if (riderName) {
    r += CMD.BOLD_ON;
    r += text(`Rider: ${riderName}`);
    r += CMD.BOLD_OFF;
  }

  const totalQty = order.items?.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0) || 0;
  r += text(`Total Items: ${totalQty}`);

  if (order.customer) {
    r += text(`Customer: ${order.customer.name} ${order.customer.phone ? `(${order.customer.phone})` : ''}`);
    if (order.deliveryAddress) {
      r += text(`Delivery Addr: ${order.deliveryAddress}`);
    }
  }
  r += dashed();

  // Items header
  r += CMD.BOLD_ON;
  r += text('ITEMS:');
  r += CMD.BOLD_OFF;
  r += separator('-');

  // Items - normal size, bold like order receipt
  if (order.items && order.items.length > 0) {
    for (const item of order.items) {
      const name = item.productName || item.name || 'Item';
      const qty = item.quantity || 1;

      r += CMD.BOLD_ON;
      r += text(`${qty}x  ${name}`);
      r += CMD.BOLD_OFF;

      // Modifiers
      if (item.modifiers && item.modifiers.length > 0) {
        for (const mod of item.modifiers) {
          r += text(`    + ${mod.modifierName || mod.name}`);
        }
      }

      // Notes
      if (item.notes) {
        r += CMD.BOLD_ON;
        r += text(`    Note: ${item.notes}`);
        r += CMD.BOLD_OFF;
      }
    }
  }

  // General order notes
  if (order.orderNotes) {
    r += dashed();
    r += CMD.BOLD_ON;
    r += text('Special Instructions:');
    r += CMD.BOLD_OFF;
    r += text(order.orderNotes);
  }

  r += dashed();

  // Footer
  r += CMD.ALIGN_CENTER;
  r += CMD.BOLD_ON;
  r += text('*** PREPARE FRESH & SERVE HOT ***');
  r += CMD.BOLD_OFF;
  r += text(`KOT ${orderNum}`);
  r += CMD.ALIGN_LEFT;

  r += CMD.FEED(4);
  r += CMD.CUT_PARTIAL;

  return r;
}
