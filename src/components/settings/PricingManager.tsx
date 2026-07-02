import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, TENANT_ID } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  ChevronDown,
  ChevronRight,
  DollarSign,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';

type Cell = { id: string; column_id: string; value: string };
type Row = {
  id: string;
  service: string;
  sort_order: number;
  price_cells: Cell[];
};
type Column = { id: string; label: string; sort_order: number };
type PriceTable = {
  id: string;
  title: string;
  note: string | null;
  sort_order: number;
  is_active: boolean;
  price_columns: Column[];
  price_rows: Row[];
};
type Note = {
  id: string;
  title: string;
  body: string;
  highlight: string | null;
  icon: string | null;
  sort_order: number;
};
type Category = {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  price_tables: PriceTable[];
  pricing_notes: Note[];
};

type ConfirmState = {
  title: string;
  description: string;
  onConfirm: () => void;
} | null;

const sortById = <T extends { sort_order: number }>(rows: T[]) =>
  [...rows].sort((a, b) => a.sort_order - b.sort_order);

export function PricingManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ['admin-pricing', TENANT_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_categories')
        .select(
          `
          id, slug, name, sort_order, is_active,
          price_tables (
            id, title, note, sort_order, is_active,
            price_columns ( id, label, sort_order ),
            price_rows (
              id, service, sort_order,
              price_cells ( id, column_id, value )
            )
          ),
          pricing_notes ( id, title, body, highlight, icon, sort_order )
        `,
        )
        .eq('tenant_id', TENANT_ID)
        .order('sort_order');
      if (error) throw error;
      const cats = (data ?? []) as unknown as Category[];
      for (const c of cats) {
        c.price_tables = sortById(c.price_tables);
        c.pricing_notes = sortById(c.pricing_notes);
        for (const t of c.price_tables) {
          t.price_columns = sortById(t.price_columns);
          t.price_rows = sortById(t.price_rows);
        }
      }
      return cats;
    },
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-pricing', TENANT_ID] });

  const [confirm, setConfirm] = useState<ConfirmState>(null);

  // -------- mutations -------- //
  const upsertTable = useMutation({
    mutationFn: async (input: {
      id?: string;
      category_id: string;
      title: string;
      note: string | null;
      sort_order: number;
    }) => {
      if (input.id) {
        const { error } = await supabase
          .from('price_tables')
          .update({
            title: input.title,
            note: input.note,
            sort_order: input.sort_order,
          })
          .eq('id', input.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('price_tables')
          .insert({
            tenant_id: TENANT_ID,
            category_id: input.category_id,
            title: input.title,
            note: input.note,
            sort_order: input.sort_order,
          })
          .select('id')
          .single();
        if (error) throw error;
        // create default Price column so the table is editable immediately
        const { error: colErr } = await supabase
          .from('price_columns')
          .insert({
            tenant_id: TENANT_ID,
            table_id: data.id,
            label: 'Price',
            sort_order: 1,
          });
        if (colErr) throw colErr;
      }
    },
    onSuccess: () => {
      refresh();
      toast({ title: 'Saved' });
    },
    onError: (e) =>
      toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteTable = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('price_tables').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast({ title: 'Table deleted' });
    },
    onError: (e) =>
      toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const upsertColumn = useMutation({
    mutationFn: async (input: {
      id?: string;
      table_id: string;
      label: string;
      sort_order: number;
    }) => {
      if (input.id) {
        const { error } = await supabase
          .from('price_columns')
          .update({ label: input.label, sort_order: input.sort_order })
          .eq('id', input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('price_columns').insert({
          tenant_id: TENANT_ID,
          table_id: input.table_id,
          label: input.label,
          sort_order: input.sort_order,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      refresh();
      toast({ title: 'Saved' });
    },
    onError: (e) =>
      toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteColumn = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('price_columns')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast({ title: 'Column deleted' });
    },
  });

  const upsertRow = useMutation({
    mutationFn: async (input: {
      id?: string;
      table_id: string;
      service: string;
      sort_order: number;
      cells: { column_id: string; value: string }[];
    }) => {
      let rowId = input.id;
      if (rowId) {
        const { error } = await supabase
          .from('price_rows')
          .update({ service: input.service, sort_order: input.sort_order })
          .eq('id', rowId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('price_rows')
          .insert({
            tenant_id: TENANT_ID,
            table_id: input.table_id,
            service: input.service,
            sort_order: input.sort_order,
          })
          .select('id')
          .single();
        if (error) throw error;
        rowId = data.id;
      }
      // upsert each cell by (row_id, column_id)
      for (const c of input.cells) {
        const { error } = await supabase.from('price_cells').upsert(
          {
            tenant_id: TENANT_ID,
            row_id: rowId,
            column_id: c.column_id,
            value: c.value,
          },
          { onConflict: 'row_id,column_id' },
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      refresh();
      toast({ title: 'Saved' });
    },
    onError: (e) =>
      toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteRow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('price_rows').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast({ title: 'Row deleted' });
    },
  });

  const upsertNote = useMutation({
    mutationFn: async (input: {
      id?: string;
      category_id: string;
      title: string;
      body: string;
      highlight: string | null;
      icon: string | null;
      sort_order: number;
    }) => {
      if (input.id) {
        const { error } = await supabase
          .from('pricing_notes')
          .update({
            title: input.title,
            body: input.body,
            highlight: input.highlight,
            icon: input.icon,
            sort_order: input.sort_order,
          })
          .eq('id', input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('pricing_notes').insert({
          tenant_id: TENANT_ID,
          category_id: input.category_id,
          title: input.title,
          body: input.body,
          highlight: input.highlight,
          icon: input.icon,
          sort_order: input.sort_order,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      refresh();
      toast({ title: 'Saved' });
    },
    onError: (e) =>
      toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pricing_notes')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast({ title: 'Note deleted' });
    },
  });

  // -------- dialog state -------- //
  const [tableDialog, setTableDialog] = useState<{
    open: boolean;
    categoryId: string;
    table?: PriceTable;
  }>({ open: false, categoryId: '' });
  const [columnDialog, setColumnDialog] = useState<{
    open: boolean;
    tableId: string;
    column?: Column;
    siblingCount: number;
  }>({ open: false, tableId: '', siblingCount: 0 });
  const [rowDialog, setRowDialog] = useState<{
    open: boolean;
    table?: PriceTable;
    row?: Row;
  }>({ open: false });
  const [noteDialog, setNoteDialog] = useState<{
    open: boolean;
    categoryId: string;
    note?: Note;
  }>({ open: false, categoryId: '' });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading pricing…
      </div>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#E5E5E5] p-8 text-center">
        <DollarSign className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          No pricing categories found for this tenant. Run the seed migration first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-[#1B1B1B] tracking-tight">
          Pricing
        </h2>
        <p className="text-sm text-muted-foreground/70 mt-0.5">
          Manage price lists shown on the storefront. Changes appear immediately
          for visitors.
        </p>
      </div>

      <Tabs defaultValue={categories[0].slug} className="w-full">
        <TabsList className="bg-[#F5F5F5] border border-[#E5E5E5]/60">
          {categories.map((c) => (
            <TabsTrigger key={c.id} value={c.slug} className="text-xs uppercase tracking-wider">
              {c.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((category) => (
          <TabsContent
            key={category.id}
            value={category.slug}
            className="space-y-6 pt-4"
          >
            {/* Tables */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#1B1B1B]">
                  Price Tables
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() =>
                    setTableDialog({
                      open: true,
                      categoryId: category.id,
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> New table
                </Button>
              </div>
              <div className="space-y-3">
                {category.price_tables.map((table) => (
                  <TableCard
                    key={table.id}
                    table={table}
                    onEditTable={() =>
                      setTableDialog({
                        open: true,
                        categoryId: category.id,
                        table,
                      })
                    }
                    onDeleteTable={() =>
                      setConfirm({
                        title: 'Delete price table?',
                        description:
                          'This deletes the table and all its rows, columns, and cells.',
                        onConfirm: () => deleteTable.mutate(table.id),
                      })
                    }
                    onAddColumn={() =>
                      setColumnDialog({
                        open: true,
                        tableId: table.id,
                        siblingCount: table.price_columns.length,
                      })
                    }
                    onEditColumn={(c) =>
                      setColumnDialog({
                        open: true,
                        tableId: table.id,
                        column: c,
                        siblingCount: table.price_columns.length,
                      })
                    }
                    onDeleteColumn={(c) =>
                      setConfirm({
                        title: 'Delete column?',
                        description:
                          'All cells in this column will be deleted across every row.',
                        onConfirm: () => deleteColumn.mutate(c.id),
                      })
                    }
                    onAddRow={() =>
                      setRowDialog({ open: true, table })
                    }
                    onEditRow={(row) =>
                      setRowDialog({ open: true, table, row })
                    }
                    onDeleteRow={(row) =>
                      setConfirm({
                        title: 'Delete row?',
                        description: `This deletes "${row.service}" and its prices.`,
                        onConfirm: () => deleteRow.mutate(row.id),
                      })
                    }
                  />
                ))}
                {category.price_tables.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    No tables yet. Click “New table” to add one.
                  </p>
                )}
              </div>
            </section>

            {/* Notes */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#1B1B1B]">
                  Notes blocks
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() =>
                    setNoteDialog({ open: true, categoryId: category.id })
                  }
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> New note
                </Button>
              </div>
              <div className="space-y-2">
                {category.pricing_notes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-lg border border-[#E5E5E5]/60 bg-white p-4 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#1B1B1B]">
                        {note.title}
                      </p>
                      <p className="text-xs text-muted-foreground/70 whitespace-pre-line mt-1">
                        {note.body}
                      </p>
                      {note.highlight && (
                        <p className="text-xs text-amber-700 mt-2 italic">
                          {note.highlight}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          setNoteDialog({
                            open: true,
                            categoryId: category.id,
                            note,
                          })
                        }
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() =>
                          setConfirm({
                            title: 'Delete note?',
                            description: `This deletes "${note.title}".`,
                            onConfirm: () => deleteNote.mutate(note.id),
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {category.pricing_notes.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    No notes for this category.
                  </p>
                )}
              </div>
            </section>
          </TabsContent>
        ))}
      </Tabs>

      {/* Table dialog */}
      <TableEditDialog
        state={tableDialog}
        onOpenChange={(open) =>
          setTableDialog((s) => ({ ...s, open }))
        }
        onSubmit={(input) => {
          upsertTable.mutate(input, {
            onSuccess: () => setTableDialog((s) => ({ ...s, open: false })),
          });
        }}
        siblingCount={
          categories.find((c) => c.id === tableDialog.categoryId)?.price_tables
            .length ?? 0
        }
        saving={upsertTable.isPending}
      />

      {/* Column dialog */}
      <ColumnEditDialog
        state={columnDialog}
        onOpenChange={(open) => setColumnDialog((s) => ({ ...s, open }))}
        onSubmit={(input) =>
          upsertColumn.mutate(input, {
            onSuccess: () => setColumnDialog((s) => ({ ...s, open: false })),
          })
        }
        saving={upsertColumn.isPending}
      />

      {/* Row dialog */}
      <RowEditDialog
        state={rowDialog}
        onOpenChange={(open) => setRowDialog((s) => ({ ...s, open }))}
        onSubmit={(input) =>
          upsertRow.mutate(input, {
            onSuccess: () => setRowDialog((s) => ({ ...s, open: false })),
          })
        }
        saving={upsertRow.isPending}
      />

      {/* Note dialog */}
      <NoteEditDialog
        state={noteDialog}
        onOpenChange={(open) => setNoteDialog((s) => ({ ...s, open }))}
        onSubmit={(input) =>
          upsertNote.mutate(input, {
            onSuccess: () => setNoteDialog((s) => ({ ...s, open: false })),
          })
        }
        siblingCount={
          categories.find((c) => c.id === noteDialog.categoryId)
            ?.pricing_notes.length ?? 0
        }
        saving={upsertNote.isPending}
      />

      {/* Confirm */}
      <AlertDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                confirm?.onConfirm();
                setConfirm(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =================== Table card =================== //
function TableCard({
  table,
  onEditTable,
  onDeleteTable,
  onAddColumn,
  onEditColumn,
  onDeleteColumn,
  onAddRow,
  onEditRow,
  onDeleteRow,
}: {
  table: PriceTable;
  onEditTable: () => void;
  onDeleteTable: () => void;
  onAddColumn: () => void;
  onEditColumn: (c: Column) => void;
  onDeleteColumn: (c: Column) => void;
  onAddRow: () => void;
  onEditRow: (r: Row) => void;
  onDeleteRow: (r: Row) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-lg border border-[#E5E5E5]/60 bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5]/40">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 min-w-0 text-left flex-1"
        >
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground/70 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground/70 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#1B1B1B] truncate">
              {table.title}
            </p>
            {table.note && (
              <p className="text-xs text-muted-foreground/60 italic truncate">
                {table.note}
              </p>
            )}
          </div>
        </button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onEditTable}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={onDeleteTable}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {open && (
        <div className="p-4 space-y-4">
          {/* Columns */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold mr-1">
              Columns
            </span>
            {table.price_columns.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 text-xs bg-[#F5F5F5] border border-[#E5E5E5]/60 rounded-md px-2 py-1"
              >
                {c.label}
                <button
                  className="text-muted-foreground/60 hover:text-[#1B1B1B] ml-0.5"
                  onClick={() => onEditColumn(c)}
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  className="text-muted-foreground/60 hover:text-destructive"
                  onClick={() => onDeleteColumn(c)}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={onAddColumn}
            >
              <Plus className="h-3 w-3 mr-1" /> Column
            </Button>
          </div>

          {/* Rows */}
          <div className="rounded-md border border-[#E5E5E5]/40 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#FAFAFA]">
                <tr>
                  <th className="text-left px-3 py-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">
                    Service
                  </th>
                  {table.price_columns.map((c) => (
                    <th
                      key={c.id}
                      className="text-right px-3 py-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold w-32"
                    >
                      {c.label}
                    </th>
                  ))}
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody>
                {table.price_rows.map((row) => {
                  const cellByCol = new Map(
                    row.price_cells.map((c) => [c.column_id, c.value]),
                  );
                  return (
                    <tr
                      key={row.id}
                      className="border-t border-[#E5E5E5]/30 hover:bg-[#F5F5F5]/40"
                    >
                      <td className="px-3 py-2">{row.service}</td>
                      {table.price_columns.map((c) => (
                        <td
                          key={c.id}
                          className="px-3 py-2 text-right tabular-nums text-muted-foreground"
                        >
                          {cellByCol.get(c.id) ?? '—'}
                        </td>
                      ))}
                      <td className="px-2 py-1 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => onEditRow(row)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => onDeleteRow(row)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {table.price_rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={table.price_columns.length + 2}
                      className="px-3 py-4 text-xs text-center text-muted-foreground italic"
                    >
                      No rows yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={onAddRow}
            disabled={table.price_columns.length === 0}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add row
          </Button>
        </div>
      )}
    </div>
  );
}

// =================== Dialogs =================== //
function TableEditDialog({
  state,
  onOpenChange,
  onSubmit,
  siblingCount,
  saving,
}: {
  state: { open: boolean; categoryId: string; table?: PriceTable };
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    id?: string;
    category_id: string;
    title: string;
    note: string | null;
    sort_order: number;
  }) => void;
  siblingCount: number;
  saving: boolean;
}) {
  const editing = state.table;
  const [title, setTitle] = useState(editing?.title ?? '');
  const [note, setNote] = useState(editing?.note ?? '');
  const [sortOrder, setSortOrder] = useState(
    editing?.sort_order ?? siblingCount + 1,
  );

  // reset when opening for a different row
  const dialogKey = `${state.open}-${editing?.id ?? 'new'}-${state.categoryId}`;
  useMemo(() => {
    setTitle(editing?.title ?? '');
    setNote(editing?.note ?? '');
    setSortOrder(editing?.sort_order ?? siblingCount + 1);
  }, [dialogKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit table' : 'New table'}</DialogTitle>
          <DialogDescription>
            A price table is a card on the storefront pricing page.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Title
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5"
              placeholder="e.g. Nail Extension / Acrylic"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Note (optional)
            </Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1.5"
              placeholder="Shown under the title in italics"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Sort order
            </Label>
            <Input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
              className="mt-1.5"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!title.trim() || saving}
            onClick={() =>
              onSubmit({
                id: editing?.id,
                category_id: state.categoryId,
                title: title.trim(),
                note: note.trim() || null,
                sort_order: sortOrder,
              })
            }
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {editing ? 'Save changes' : 'Create table'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ColumnEditDialog({
  state,
  onOpenChange,
  onSubmit,
  saving,
}: {
  state: {
    open: boolean;
    tableId: string;
    column?: Column;
    siblingCount: number;
  };
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    id?: string;
    table_id: string;
    label: string;
    sort_order: number;
  }) => void;
  saving: boolean;
}) {
  const editing = state.column;
  const [label, setLabel] = useState(editing?.label ?? '');
  const [sortOrder, setSortOrder] = useState(
    editing?.sort_order ?? state.siblingCount + 1,
  );

  const dialogKey = `${state.open}-${editing?.id ?? 'new'}-${state.tableId}`;
  useMemo(() => {
    setLabel(editing?.label ?? '');
    setSortOrder(editing?.sort_order ?? state.siblingCount + 1);
  }, [dialogKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit column' : 'New column'}</DialogTitle>
          <DialogDescription>
            Each column corresponds to a price column on the storefront.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Label
            </Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="mt-1.5"
              placeholder="e.g. Price · Normal Polish · For Her"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Sort order
            </Label>
            <Input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
              className="mt-1.5"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!label.trim() || saving}
            onClick={() =>
              onSubmit({
                id: editing?.id,
                table_id: state.tableId,
                label: label.trim(),
                sort_order: sortOrder,
              })
            }
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {editing ? 'Save changes' : 'Create column'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RowEditDialog({
  state,
  onOpenChange,
  onSubmit,
  saving,
}: {
  state: { open: boolean; table?: PriceTable; row?: Row };
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    id?: string;
    table_id: string;
    service: string;
    sort_order: number;
    cells: { column_id: string; value: string }[];
  }) => void;
  saving: boolean;
}) {
  const editing = state.row;
  const cols = state.table?.price_columns ?? [];

  const [service, setService] = useState(editing?.service ?? '');
  const [sortOrder, setSortOrder] = useState(
    editing?.sort_order ?? (state.table?.price_rows.length ?? 0) + 1,
  );
  const [values, setValues] = useState<Record<string, string>>({});

  const dialogKey = `${state.open}-${editing?.id ?? 'new'}-${state.table?.id ?? ''}`;
  useMemo(() => {
    setService(editing?.service ?? '');
    setSortOrder(
      editing?.sort_order ?? (state.table?.price_rows.length ?? 0) + 1,
    );
    const map: Record<string, string> = {};
    if (editing) {
      for (const cell of editing.price_cells) {
        map[cell.column_id] = cell.value;
      }
    }
    for (const c of cols) {
      if (!(c.id in map)) map[c.id] = '';
    }
    setValues(map);
  }, [dialogKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state.table) return null;

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit row' : 'New row'}</DialogTitle>
          <DialogDescription>
            Service name and a price for each column. Use “—” for unavailable.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Service
            </Label>
            <Input
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="mt-1.5"
              placeholder="e.g. Full Set"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Prices
            </Label>
            <div className="space-y-2">
              {cols.map((col) => (
                <div key={col.id} className="grid grid-cols-3 items-center gap-3">
                  <span className="text-xs text-muted-foreground col-span-1">
                    {col.label}
                  </span>
                  <Input
                    className="col-span-2"
                    value={values[col.id] ?? ''}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [col.id]: e.target.value }))
                    }
                    placeholder="$50 · from $20 · —"
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Sort order
            </Label>
            <Input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
              className="mt-1.5"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!service.trim() || saving}
            onClick={() => {
              const cells = cols
                .map((c) => ({
                  column_id: c.id,
                  value: (values[c.id] ?? '').trim(),
                }))
                .filter((c) => c.value.length > 0);
              onSubmit({
                id: editing?.id,
                table_id: state.table!.id,
                service: service.trim(),
                sort_order: sortOrder,
                cells,
              });
            }}
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {editing ? 'Save changes' : 'Create row'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const NOTE_ICONS = ['Wallet', 'Info', 'Sparkles'];

function NoteEditDialog({
  state,
  onOpenChange,
  onSubmit,
  siblingCount,
  saving,
}: {
  state: { open: boolean; categoryId: string; note?: Note };
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    id?: string;
    category_id: string;
    title: string;
    body: string;
    highlight: string | null;
    icon: string | null;
    sort_order: number;
  }) => void;
  siblingCount: number;
  saving: boolean;
}) {
  const editing = state.note;
  const [title, setTitle] = useState(editing?.title ?? '');
  const [body, setBody] = useState(editing?.body ?? '');
  const [highlight, setHighlight] = useState(editing?.highlight ?? '');
  const [icon, setIcon] = useState(editing?.icon ?? 'Info');
  const [sortOrder, setSortOrder] = useState(
    editing?.sort_order ?? siblingCount + 1,
  );

  const dialogKey = `${state.open}-${editing?.id ?? 'new'}-${state.categoryId}`;
  useMemo(() => {
    setTitle(editing?.title ?? '');
    setBody(editing?.body ?? '');
    setHighlight(editing?.highlight ?? '');
    setIcon(editing?.icon ?? 'Info');
    setSortOrder(editing?.sort_order ?? siblingCount + 1);
  }, [dialogKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit note' : 'New note'}</DialogTitle>
          <DialogDescription>
            Free-form information block (payment policy, safety notes, etc).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Title
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Body — one bullet per line
            </Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="mt-1.5 min-h-[120px]"
              placeholder={'Full payment required on the day.\nNo credit accepted.'}
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Highlight callout (optional)
            </Label>
            <Input
              value={highlight}
              onChange={(e) => setHighlight(e.target.value)}
              className="mt-1.5"
              placeholder="Special offer …"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Icon
              </Label>
              <Select value={icon} onValueChange={setIcon}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTE_ICONS.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Sort order
              </Label>
              <Input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                className="mt-1.5"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!title.trim() || !body.trim() || saving}
            onClick={() =>
              onSubmit({
                id: editing?.id,
                category_id: state.categoryId,
                title: title.trim(),
                body: body.trim(),
                highlight: highlight.trim() || null,
                icon: icon || null,
                sort_order: sortOrder,
              })
            }
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {editing ? 'Save changes' : 'Create note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
