import { supabase, TENANT_ID } from '@/integrations/supabase/client';

// Business config tables — setup/configuration data a shop owner would want
// to back up or clone into a new tenant. Excludes transactional records
// (bookings, sales, customers, payment history, activity logs) and secrets
// (app_settings holds API keys/tokens, so it's intentionally not included).
const BACKUP_TABLES = [
  'services',
  'therapists',
  'products',
  'membership_tiers',
  'discount_codes',
  'shop_holidays',
  'branches',
  'branch_trading_hours',
  'price_categories',
  'price_tables',
  'price_columns',
  'price_rows',
  'price_cells',
  'pricing_notes',
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

export interface BusinessConfigBackup {
  version: 1;
  exported_at: string;
  tenant_id: string;
  tables: Partial<Record<BackupTable, Record<string, unknown>[]>>;
}

export async function exportBusinessConfig(): Promise<BusinessConfigBackup> {
  const tables: BusinessConfigBackup['tables'] = {};
  for (const table of BACKUP_TABLES) {
    const { data, error } = await supabase.from(table).select('*');
    if (error) throw error;
    tables[table] = data ?? [];
  }
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    tenant_id: TENANT_ID,
    tables,
  };
}

export function downloadBackupJson(backup: BusinessConfigBackup, filenamePrefix: string) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}-${backup.exported_at.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Tables are imported in this order so foreign keys (branch_id, category_id,
// table_id, row_id/column_id) resolve to rows already upserted earlier in
// the same pass.
const IMPORT_ORDER: BackupTable[] = [
  'services',
  'therapists',
  'products',
  'membership_tiers',
  'discount_codes',
  'shop_holidays',
  'branches',
  'branch_trading_hours',
  'price_categories',
  'price_tables',
  'price_columns',
  'price_rows',
  'price_cells',
  'pricing_notes',
];

export function parseBackupFile(text: string): BusinessConfigBackup {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || parsed.version !== 1 || typeof parsed.tables !== 'object') {
    throw new Error('Not a valid business config backup file');
  }
  return parsed as BusinessConfigBackup;
}

// Upserts every row by its original id, re-pointed to the current tenant.
// Rows whose id already exists (e.g. re-importing a previous export into
// the same tenant) get overwritten; unknown ids are inserted as new rows.
export async function importBusinessConfig(backup: BusinessConfigBackup): Promise<{ table: string; count: number }[]> {
  const results: { table: string; count: number }[] = [];
  for (const table of IMPORT_ORDER) {
    const rows = backup.tables[table];
    if (!rows || rows.length === 0) continue;
    const scopedRows = rows.map((row) => ({ ...row, tenant_id: TENANT_ID }));
    const { error } = await supabase.from(table).upsert(scopedRows, { onConflict: 'id' });
    if (error) throw new Error(`${table}: ${error.message}`);
    results.push({ table, count: scopedRows.length });
  }
  return results;
}
