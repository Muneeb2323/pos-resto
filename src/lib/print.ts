/**
 * Thermal Receipt Printing - Sends raw ESC/POS commands to the printer
 * via the backend API (/api/print), which uses Windows winspool.drv
 * to communicate directly with the Black Copper BC-85AC.
 * 
 * This completely bypasses window.print() and the browser rendering pipeline.
 */

type PrintType = 'receipt' | 'bill' | 'kot';

/** Map element IDs to print types */
const ID_TO_TYPE: Record<string, PrintType> = {
  'printable-receipt': 'receipt',
  'printable-customer-bill': 'bill',
  'printable-kitchen-ticket': 'kot',
};

/**
 * Send a print job to the thermal printer via the backend API.
 * @param elementId - The ID used to determine which receipt type to print
 * @param order - The order data object to format and print
 * @param onSuccess - Optional callback on successful print
 * @param onError - Optional callback on print error
 */
export async function printThermalReceipt(
  elementId: string,
  order: any,
  onSuccess?: () => void,
  onError?: (error: string) => void
) {
  const type = ID_TO_TYPE[elementId];
  if (!type) {
    const msg = `Unknown print target: ${elementId}`;
    console.error('[print]', msg);
    onError?.(msg);
    return;
  }

  try {
    const response = await fetch('/api/print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, order }),
    });

    const result = await response.json();

    if (result.success) {
      console.log('[print] Success:', result.message);
      onSuccess?.();
    } else {
      const msg = result.error || 'Print failed';
      console.error('[print] Failed:', msg);
      onError?.(msg);
    }
  } catch (err: any) {
    const msg = err.message || 'Network error while printing';
    console.error('[print] Error:', msg);
    onError?.(msg);
  }
}
