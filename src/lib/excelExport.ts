import ExcelJS from 'exceljs';
import { format } from 'date-fns';

type Sale = {
  id: string;
  booking_id: string | null;
  amount: number;
  tip_amount?: number | null;
  therapist_name?: string | null;
  payment_method: string;
  payment_provider: string | null;
  external_payment_id: string | null;
  notes: string | null;
  sale_date: string;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  is_refunded: boolean;
  bookings?: {
    customer_name: string | null;
    customer_phone: string | null;
    booking_date: string | null;
    start_time: string | null;
    services?: { name: string | null } | null;
  } | null;
  therapists?: { name: string | null } | null;
};

type Booking = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
  total_amount: number | null;
  notes: string | null;
  created_at: string;
  services?: { name: string | null; price: number | null } | null;
  therapists?: { name: string | null } | null;
};

type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  is_active: boolean;
  category: string | null;
};

type Therapist = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
};

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1B1B1B' },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  color: { argb: 'FFFFFFFF' },
  bold: true,
  size: 11,
};

const CURRENCY_FORMAT = '"A$"#,##0.00';
const DATE_FORMAT = 'dd/mm/yyyy';

function styleHeaderRow(sheet: ExcelJS.Worksheet) {
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle' };
  });
  headerRow.height = 20;
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

function autoFitColumns(sheet: ExcelJS.Worksheet, columns: { key: string; width?: number }[]) {
  sheet.columns = columns.map((c) => ({ key: c.key, width: c.width ?? 18 }));
}

function toDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildSalesSheet(workbook: ExcelJS.Workbook, sales: Sale[]) {
  const sheet = workbook.addWorksheet('Sales');
  autoFitColumns(sheet, [
    { key: 'sale_date', width: 14 },
    { key: 'customer_name', width: 24 },
    { key: 'customer_phone', width: 16 },
    { key: 'service', width: 28 },
    { key: 'staff', width: 20 },
    { key: 'amount', width: 14 },
    { key: 'tip_amount', width: 12 },
    { key: 'payment_method', width: 16 },
    { key: 'payment_provider', width: 16 },
    { key: 'external_payment_id', width: 22 },
    { key: 'is_refunded', width: 12 },
    { key: 'notes', width: 30 },
    { key: 'created_at', width: 20 },
  ]);

  sheet.addRow({
    sale_date: 'Sale Date',
    customer_name: 'Customer Name',
    customer_phone: 'Customer Phone',
    service: 'Service',
    staff: 'Staff',
    amount: 'Amount',
    tip_amount: 'Tip',
    payment_method: 'Payment Method',
    payment_provider: 'Payment Provider',
    external_payment_id: 'Payment Reference',
    is_refunded: 'Refunded',
    notes: 'Notes',
    created_at: 'Recorded At',
  });

  let totalAmount = 0;
  let totalTips = 0;
  let totalRefunded = 0;

  for (const s of sales) {
    const customerName = s.customer_name || s.bookings?.customer_name || 'Walk-in';
    const customerPhone = s.customer_phone || s.bookings?.customer_phone || '';
    const serviceName = s.bookings?.services?.name || '';
    const amount = Number(s.amount) || 0;
    const tipAmount = Number(s.tip_amount) || 0;
    totalAmount += amount;
    totalTips += tipAmount;
    if (s.is_refunded) totalRefunded += amount;

    const row = sheet.addRow({
      sale_date: toDate(s.sale_date),
      customer_name: customerName,
      customer_phone: customerPhone,
      service: serviceName,
      staff: s.therapists?.name || s.therapist_name || '',
      amount,
      tip_amount: tipAmount,
      payment_method: s.payment_method,
      payment_provider: s.payment_provider || '',
      external_payment_id: s.external_payment_id || '',
      is_refunded: s.is_refunded ? 'Yes' : 'No',
      notes: s.notes || '',
      created_at: toDate(s.created_at),
    });

    row.getCell('sale_date').numFmt = DATE_FORMAT;
    row.getCell('amount').numFmt = CURRENCY_FORMAT;
    row.getCell('tip_amount').numFmt = CURRENCY_FORMAT;
    row.getCell('created_at').numFmt = 'dd/mm/yyyy hh:mm';
    if (s.is_refunded) {
      row.getCell('is_refunded').font = { color: { argb: 'FFB91C1C' }, bold: true };
    }
  }

  // Totals row
  const totalRow = sheet.addRow({
    sale_date: '',
    customer_name: '',
    customer_phone: '',
    service: 'TOTAL',
    staff: '',
    amount: totalAmount,
    tip_amount: totalTips,
    payment_method: '',
    payment_provider: '',
    external_payment_id: '',
    is_refunded: '',
    notes: `Refunded: A$${totalRefunded.toFixed(2)}`,
    created_at: '',
  });
  totalRow.font = { bold: true };
  totalRow.getCell('amount').numFmt = CURRENCY_FORMAT;
  totalRow.getCell('amount').border = { top: { style: 'thin' } };
  totalRow.getCell('tip_amount').numFmt = CURRENCY_FORMAT;
  totalRow.getCell('tip_amount').border = { top: { style: 'thin' } };
  totalRow.getCell('service').border = { top: { style: 'thin' } };

  styleHeaderRow(sheet);
  sheet.autoFilter = { from: 'A1', to: `M${sales.length + 1}` };
}

function buildBookingsSheet(workbook: ExcelJS.Workbook, bookings: Booking[]) {
  const sheet = workbook.addWorksheet('Appointments');
  autoFitColumns(sheet, [
    { key: 'booking_date', width: 14 },
    { key: 'start_time', width: 12 },
    { key: 'end_time', width: 12 },
    { key: 'customer_name', width: 24 },
    { key: 'customer_phone', width: 16 },
    { key: 'customer_email', width: 26 },
    { key: 'service', width: 28 },
    { key: 'therapist', width: 20 },
    { key: 'status', width: 14 },
    { key: 'payment_status', width: 14 },
    { key: 'amount', width: 14 },
    { key: 'notes', width: 30 },
  ]);

  sheet.addRow({
    booking_date: 'Date',
    start_time: 'Start Time',
    end_time: 'End Time',
    customer_name: 'Customer Name',
    customer_phone: 'Customer Phone',
    customer_email: 'Customer Email',
    service: 'Service',
    therapist: 'Staff',
    status: 'Status',
    payment_status: 'Payment Status',
    amount: 'Service Price',
    notes: 'Notes',
  });

  for (const b of bookings) {
    const amount = b.total_amount ?? b.services?.price ?? 0;
    const row = sheet.addRow({
      booking_date: toDate(b.booking_date),
      start_time: b.start_time?.slice(0, 5) || '',
      end_time: b.end_time?.slice(0, 5) || '',
      customer_name: b.customer_name,
      customer_phone: b.customer_phone,
      customer_email: b.customer_email || '',
      service: b.services?.name || '',
      therapist: b.therapists?.name || '',
      status: b.status,
      payment_status: b.payment_status,
      amount,
      notes: b.notes || '',
    });
    row.getCell('booking_date').numFmt = DATE_FORMAT;
    row.getCell('amount').numFmt = CURRENCY_FORMAT;
    if (b.status === 'cancelled') {
      row.getCell('status').font = { color: { argb: 'FFB91C1C' } };
    }
  }

  styleHeaderRow(sheet);
  sheet.autoFilter = { from: 'A1', to: `L${bookings.length + 1}` };
}

function buildServicesSheet(workbook: ExcelJS.Workbook, services: Service[]) {
  const sheet = workbook.addWorksheet('Services');
  autoFitColumns(sheet, [
    { key: 'name', width: 28 },
    { key: 'category', width: 18 },
    { key: 'description', width: 40 },
    { key: 'duration_minutes', width: 14 },
    { key: 'price', width: 14 },
    { key: 'is_active', width: 12 },
  ]);

  sheet.addRow({
    name: 'Service Name',
    category: 'Category',
    description: 'Description',
    duration_minutes: 'Duration (min)',
    price: 'Price',
    is_active: 'Active',
  });

  for (const s of services) {
    const row = sheet.addRow({
      name: s.name,
      category: s.category || '',
      description: s.description || '',
      duration_minutes: s.duration_minutes,
      price: Number(s.price) || 0,
      is_active: s.is_active ? 'Yes' : 'No',
    });
    row.getCell('price').numFmt = CURRENCY_FORMAT;
  }

  styleHeaderRow(sheet);
  sheet.autoFilter = { from: 'A1', to: `F${services.length + 1}` };
}

function buildStaffSheet(workbook: ExcelJS.Workbook, therapists: Therapist[], sales: Sale[], bookings: Booking[]) {
  const sheet = workbook.addWorksheet('Staff');
  autoFitColumns(sheet, [
    { key: 'name', width: 24 },
    { key: 'phone', width: 16 },
    { key: 'email', width: 26 },
    { key: 'is_active', width: 12 },
    { key: 'completed_bookings', width: 18 },
  ]);

  sheet.addRow({
    name: 'Staff Name',
    phone: 'Phone',
    email: 'Email',
    is_active: 'Active',
    completed_bookings: 'Completed Appointments',
  });

  for (const th of therapists) {
    const completedCount = bookings.filter(
      (b) => b.therapists?.name === th.name && b.status === 'completed'
    ).length;
    sheet.addRow({
      name: th.name,
      phone: th.phone || '',
      email: th.email || '',
      is_active: th.is_active ? 'Yes' : 'No',
      completed_bookings: completedCount,
    });
  }

  styleHeaderRow(sheet);
  sheet.autoFilter = { from: 'A1', to: `E${therapists.length + 1}` };
}

function buildSummarySheet(
  workbook: ExcelJS.Workbook,
  spaName: string,
  sales: Sale[],
  bookings: Booking[],
  dateRangeLabel: string
) {
  const sheet = workbook.addWorksheet('Summary', { properties: { tabColor: { argb: 'FF006AFF' } } });
  sheet.getColumn(1).width = 28;
  sheet.getColumn(2).width = 22;

  sheet.mergeCells('A1:B1');
  const title = sheet.getCell('A1');
  title.value = `${spaName} — Financial Report`;
  title.font = { bold: true, size: 16 };

  sheet.mergeCells('A2:B2');
  const subtitle = sheet.getCell('A2');
  subtitle.value = `Period: ${dateRangeLabel} · Generated ${format(new Date(), 'dd/MM/yyyy HH:mm')}`;
  subtitle.font = { italic: true, color: { argb: 'FF666666' } };

  const totalRevenue = sales.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const totalTips = sales.reduce((sum, s) => sum + (Number(s.tip_amount) || 0), 0);
  const totalRefunded = sales.filter((s) => s.is_refunded).reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const netRevenue = totalRevenue - totalRefunded;
  const completedBookings = bookings.filter((b) => b.status === 'completed').length;
  const cancelledBookings = bookings.filter((b) => b.status === 'cancelled').length;

  const byMethod = new Map<string, number>();
  for (const s of sales) {
    if (s.is_refunded) continue;
    const key = s.payment_method || 'unknown';
    byMethod.set(key, (byMethod.get(key) || 0) + (Number(s.amount) || 0));
  }

  const rows: [string, number | string][] = [
    ['', ''],
    ['Total Sales Transactions', sales.length],
    ['Gross Revenue', totalRevenue],
    ['Total Tips', totalTips],
    ['Refunded Amount', totalRefunded],
    ['Net Revenue', netRevenue],
    ['', ''],
    ['Total Appointments', bookings.length],
    ['Completed Appointments', completedBookings],
    ['Cancelled Appointments', cancelledBookings],
    ['', ''],
  ];

  let r = 4;
  for (const [label, value] of rows) {
    const labelCell = sheet.getCell(`A${r}`);
    const valueCell = sheet.getCell(`B${r}`);
    labelCell.value = label;
    valueCell.value = value;
    if (label) labelCell.font = { bold: true };
    if (typeof value === 'number' && (label.includes('Revenue') || label.includes('Refunded') || label.includes('Tips'))) {
      valueCell.numFmt = CURRENCY_FORMAT;
    }
    r++;
  }

  const methodHeaderCell = sheet.getCell(`A${r}`);
  methodHeaderCell.value = 'Revenue by Payment Method';
  methodHeaderCell.font = { bold: true, underline: true };
  r++;
  for (const [method, amount] of byMethod) {
    sheet.getCell(`A${r}`).value = method.charAt(0).toUpperCase() + method.slice(1);
    const cell = sheet.getCell(`B${r}`);
    cell.value = amount;
    cell.numFmt = CURRENCY_FORMAT;
    r++;
  }
}

export type ExportRange = { from: Date; to: Date; label: string };

export function exportBusinessReport(params: {
  spaName: string;
  sales: Sale[];
  bookings: Booking[];
  services: Service[];
  therapists: Therapist[];
  range: ExportRange;
}) {
  const { spaName, sales, bookings, services, therapists, range } = params;

  const inRange = (dateStr: string | null | undefined) => {
    const d = toDate(dateStr || null);
    if (!d) return false;
    return d >= range.from && d <= range.to;
  };

  const rangedSales = sales.filter((s) => inRange(s.sale_date));
  const rangedBookings = bookings.filter((b) => inRange(b.booking_date));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = spaName;
  workbook.created = new Date();

  buildSummarySheet(workbook, spaName, rangedSales, rangedBookings, range.label);
  buildSalesSheet(workbook, rangedSales);
  buildBookingsSheet(workbook, rangedBookings);
  buildServicesSheet(workbook, services);
  buildStaffSheet(workbook, therapists, rangedSales, rangedBookings);

  return workbook;
}

export async function downloadWorkbook(workbook: ExcelJS.Workbook, filenamePrefix: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
