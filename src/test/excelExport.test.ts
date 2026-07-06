import { describe, it, expect } from 'vitest';
import { exportBusinessReport } from '@/lib/excelExport';

/**
 * Unit tests for the bookkeeper-facing Excel export.
 *
 * Scope:
 *   - Date-range filtering excludes sales/bookings outside the selected period.
 *   - Summary sheet totals (gross revenue, refunds, net revenue, payment-method breakdown).
 *   - Sales sheet renders each row with correct customer/service/amount fallbacks.
 *   - Appointments sheet falls back to service price when total_amount is null.
 *   - Services and Staff sheets render independent of the date range.
 */

const RANGE = {
  from: new Date('2026-06-01T00:00:00Z'),
  to: new Date('2026-06-30T23:59:59Z'),
  label: 'June 2026',
};

const baseSale = {
  id: 's1',
  booking_id: null,
  amount: 50,
  payment_method: 'cash',
  payment_provider: null,
  external_payment_id: null,
  notes: null,
  sale_date: '2026-06-15',
  created_at: '2026-06-15T10:00:00Z',
  customer_name: 'Jane Doe',
  customer_phone: '0400000000',
  is_refunded: false,
  bookings: null,
};

const baseBooking = {
  id: 'b1',
  customer_name: 'Jane Doe',
  customer_phone: '0400000000',
  customer_email: 'jane@example.com',
  booking_date: '2026-06-15',
  start_time: '10:00:00',
  end_time: '11:00:00',
  status: 'completed',
  payment_status: 'paid',
  total_amount: null as number | null,
  notes: null,
  created_at: '2026-06-15T09:00:00Z',
  services: { name: 'Classic Manicure', price: 45 },
  therapists: { name: 'Isabella Chen' },
};

function buildReport(overrides: Partial<Parameters<typeof exportBusinessReport>[0]> = {}) {
  return exportBusinessReport({
    spaName: 'Test Salon',
    sales: [],
    bookings: [],
    services: [],
    therapists: [],
    range: RANGE,
    ...overrides,
  });
}

function sheetRows(workbook: ReturnType<typeof exportBusinessReport>, name: string) {
  const sheet = workbook.getWorksheet(name)!;
  const rows: Record<string, unknown>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const values: Record<string, unknown> = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = sheet.getColumn(colNumber).key as string;
      values[key] = cell.value;
    });
    rows.push(values);
  });
  return rows;
}

// The Sales sheet appends a trailing TOTAL row after the transaction rows —
// exclude it so per-transaction assertions only see actual sales.
function salesTransactionRows(workbook: ReturnType<typeof exportBusinessReport>) {
  return sheetRows(workbook, 'Sales').filter((r) => r.service !== 'TOTAL');
}

describe('exportBusinessReport — date range filtering', () => {
  it('excludes sales outside the selected range', () => {
    const wb = buildReport({
      sales: [
        { ...baseSale, id: 'in-range', sale_date: '2026-06-15' },
        { ...baseSale, id: 'before-range', sale_date: '2026-05-31' },
        { ...baseSale, id: 'after-range', sale_date: '2026-07-01' },
      ],
    });
    const rows = salesTransactionRows(wb);
    expect(rows).toHaveLength(1);
  });

  it('excludes bookings outside the selected range', () => {
    const wb = buildReport({
      bookings: [
        { ...baseBooking, id: 'in-range', booking_date: '2026-06-01' },
        { ...baseBooking, id: 'before-range', booking_date: '2026-05-01' },
        { ...baseBooking, id: 'after-range', booking_date: '2026-08-01' },
      ],
    });
    const rows = sheetRows(wb, 'Appointments');
    expect(rows).toHaveLength(1);
  });

  it('includes a sale dated exactly on the range boundary', () => {
    const wb = buildReport({
      sales: [{ ...baseSale, sale_date: '2026-06-01' }],
    });
    expect(salesTransactionRows(wb)).toHaveLength(1);
  });
});

describe('exportBusinessReport — Sales sheet', () => {
  it('falls back to the linked booking customer when sale has no customer_name', () => {
    const wb = buildReport({
      sales: [
        {
          ...baseSale,
          customer_name: null,
          customer_phone: null,
          bookings: { customer_name: 'Booked Customer', customer_phone: '0411111111', booking_date: null, start_time: null, services: { name: 'Gel Manicure' } },
        },
      ],
    });
    const rows = salesTransactionRows(wb);
    expect(rows[0].customer_name).toBe('Booked Customer');
    expect(rows[0].service).toBe('Gel Manicure');
  });

  it('labels a sale with no customer or booking as Walk-in', () => {
    const wb = buildReport({
      sales: [{ ...baseSale, customer_name: null, bookings: null }],
    });
    const rows = salesTransactionRows(wb);
    expect(rows[0].customer_name).toBe('Walk-in');
  });

  it('flags refunded sales and excludes them from the net total', () => {
    const wb = buildReport({
      sales: [
        { ...baseSale, id: 's1', amount: 100, is_refunded: false },
        { ...baseSale, id: 's2', amount: 30, is_refunded: true },
      ],
    });
    const rows = salesTransactionRows(wb);
    const refundedRow = rows.find((r) => r.is_refunded === 'Yes');
    expect(refundedRow).toBeTruthy();
    expect(refundedRow!.amount).toBe(30);
  });
});

describe('exportBusinessReport — Appointments sheet', () => {
  it('uses the linked service price when total_amount is null', () => {
    const wb = buildReport({
      bookings: [{ ...baseBooking, total_amount: null, services: { name: 'Deluxe Pedicure', price: 75 } }],
    });
    const rows = sheetRows(wb, 'Appointments');
    expect(rows[0].amount).toBe(75);
  });

  it('prefers total_amount over the service price when set', () => {
    const wb = buildReport({
      bookings: [{ ...baseBooking, total_amount: 60, services: { name: 'Deluxe Pedicure', price: 75 } }],
    });
    const rows = sheetRows(wb, 'Appointments');
    expect(rows[0].amount).toBe(60);
  });
});

describe('exportBusinessReport — Summary sheet totals', () => {
  it('computes gross revenue, refunded amount, and net revenue', () => {
    const wb = buildReport({
      sales: [
        { ...baseSale, id: 's1', amount: 100, is_refunded: false },
        { ...baseSale, id: 's2', amount: 40, is_refunded: true },
      ],
    });
    const summary = wb.getWorksheet('Summary')!;
    const findRow = (label: string) => {
      let found: number | undefined;
      summary.eachRow((row, rowNumber) => {
        if (row.getCell(1).value === label) found = row.getCell(2).value as number;
      });
      return found;
    };
    expect(findRow('Gross Revenue')).toBe(140);
    expect(findRow('Refunded Amount')).toBe(40);
    expect(findRow('Net Revenue')).toBe(100);
  });

  it('excludes refunded sales from the payment-method breakdown', () => {
    const wb = buildReport({
      sales: [
        { ...baseSale, id: 's1', amount: 100, payment_method: 'cash', is_refunded: false },
        { ...baseSale, id: 's2', amount: 999, payment_method: 'card', is_refunded: true },
      ],
    });
    const summary = wb.getWorksheet('Summary')!;
    let cardRowFound = false;
    let cashAmount: number | undefined;
    summary.eachRow((row) => {
      const label = row.getCell(1).value;
      if (label === 'Card') cardRowFound = true;
      if (label === 'Cash') cashAmount = row.getCell(2).value as number;
    });
    expect(cardRowFound).toBe(false);
    expect(cashAmount).toBe(100);
  });

  it('counts completed and cancelled appointments separately', () => {
    const wb = buildReport({
      bookings: [
        { ...baseBooking, id: 'b1', status: 'completed' },
        { ...baseBooking, id: 'b2', status: 'cancelled' },
        { ...baseBooking, id: 'b3', status: 'confirmed' },
      ],
    });
    const summary = wb.getWorksheet('Summary')!;
    const findRow = (label: string) => {
      let found: number | undefined;
      summary.eachRow((row) => {
        if (row.getCell(1).value === label) found = row.getCell(2).value as number;
      });
      return found;
    };
    expect(findRow('Total Appointments')).toBe(3);
    expect(findRow('Completed Appointments')).toBe(1);
    expect(findRow('Cancelled Appointments')).toBe(1);
  });
});

describe('exportBusinessReport — Services and Staff sheets', () => {
  it('lists all services regardless of the selected date range', () => {
    const wb = buildReport({
      services: [
        { id: 'sv1', name: 'Classic Manicure', description: null, duration_minutes: 30, price: 45, is_active: true, category: 'Nails' },
        { id: 'sv2', name: 'Inactive Service', description: null, duration_minutes: 20, price: 20, is_active: false, category: null },
      ],
    });
    const rows = sheetRows(wb, 'Services');
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.name)).toContain('Inactive Service');
  });

  it('counts completed appointments per staff member', () => {
    const wb = buildReport({
      therapists: [{ id: 't1', name: 'Isabella Chen', phone: null, email: null, is_active: true }],
      bookings: [
        { ...baseBooking, id: 'b1', status: 'completed', therapists: { name: 'Isabella Chen' } },
        { ...baseBooking, id: 'b2', status: 'confirmed', therapists: { name: 'Isabella Chen' } },
      ],
    });
    const rows = sheetRows(wb, 'Staff');
    expect(rows[0].completed_bookings).toBe(1);
  });
});
