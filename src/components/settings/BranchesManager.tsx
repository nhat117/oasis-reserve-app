import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, TENANT_ID } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
import { useToast } from '@/hooks/use-toast';
import {
  Clock,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Store,
  Trash2,
} from 'lucide-react';

type HoursRow = {
  id: string;
  days_label: string;
  hours_label: string;
  sort_order: number;
};

type Branch = {
  id: string;
  slug: string;
  name: string;
  short_label: string;
  city: string | null;
  address: string;
  address_note: string | null;
  phone: string | null;
  instagram: string | null;
  map_embed_url: string | null;
  image_url: string | null;
  public_holidays: string | null;
  sort_order: number;
  is_active: boolean;
  branch_trading_hours: HoursRow[];
};

type ConfirmState = {
  title: string;
  description: string;
  onConfirm: () => void;
} | null;

const sortById = <T extends { sort_order: number }>(rows: T[]) =>
  [...rows].sort((a, b) => a.sort_order - b.sort_order);

export function BranchesManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: branches, isLoading } = useQuery<Branch[]>({
    queryKey: ['admin-branches', TENANT_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select(
          `
          id, slug, name, short_label, city,
          address, address_note, phone, instagram,
          map_embed_url, image_url, public_holidays, sort_order, is_active,
          branch_trading_hours ( id, days_label, hours_label, sort_order )
        `,
        )
        .eq('tenant_id', TENANT_ID)
        .order('sort_order');
      if (error) throw error;
      const list = (data ?? []) as unknown as Branch[];
      for (const b of list) {
        b.branch_trading_hours = sortById(b.branch_trading_hours);
      }
      return list;
    },
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-branches', TENANT_ID] });

  const upsertBranch = useMutation({
    mutationFn: async (input: BranchInput) => {
      const payload = {
        tenant_id: TENANT_ID,
        slug: input.slug,
        name: input.name,
        short_label: input.short_label,
        city: input.city || null,
        address: input.address,
        address_note: input.address_note || null,
        phone: input.phone || null,
        instagram: input.instagram || null,
        map_embed_url: input.map_embed_url || null,
        image_url: input.image_url || null,
        public_holidays: input.public_holidays || null,
        sort_order: input.sort_order,
        is_active: input.is_active,
      };
      if (input.id) {
        const { error } = await supabase
          .from('branches')
          .update(payload)
          .eq('id', input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('branches').insert(payload);
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

  const deleteBranch = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('branches').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast({ title: 'Branch deleted' });
    },
    onError: (e) =>
      toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const upsertHours = useMutation({
    mutationFn: async (input: {
      id?: string;
      branch_id: string;
      days_label: string;
      hours_label: string;
      sort_order: number;
    }) => {
      if (input.id) {
        const { error } = await supabase
          .from('branch_trading_hours')
          .update({
            days_label: input.days_label,
            hours_label: input.hours_label,
            sort_order: input.sort_order,
          })
          .eq('id', input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('branch_trading_hours').insert({
          tenant_id: TENANT_ID,
          branch_id: input.branch_id,
          days_label: input.days_label,
          hours_label: input.hours_label,
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

  const deleteHours = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('branch_trading_hours')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast({ title: 'Hours row deleted' });
    },
  });

  const [branchDialog, setBranchDialog] = useState<{
    open: boolean;
    branch?: Branch;
  }>({ open: false });
  const [hoursDialog, setHoursDialog] = useState<{
    open: boolean;
    branchId: string;
    row?: HoursRow;
    siblingCount: number;
  }>({ open: false, branchId: '', siblingCount: 0 });
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading branches…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#1B1B1B] tracking-tight">
            Locations
          </h2>
          <p className="text-sm text-muted-foreground/70 mt-0.5">
            Manage physical branches shown on the storefront Location page.
          </p>
        </div>
        <Button
          size="sm"
          className="h-9"
          onClick={() => setBranchDialog({ open: true })}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" /> New branch
        </Button>
      </div>

      {!branches || branches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#E5E5E5] p-8 text-center">
          <Store className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No branches yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {branches.map((branch) => (
            <BranchCard
              key={branch.id}
              branch={branch}
              onEdit={() => setBranchDialog({ open: true, branch })}
              onDelete={() =>
                setConfirm({
                  title: 'Delete branch?',
                  description: `This deletes "${branch.name}" and all its trading hours.`,
                  onConfirm: () => deleteBranch.mutate(branch.id),
                })
              }
              onAddHours={() =>
                setHoursDialog({
                  open: true,
                  branchId: branch.id,
                  siblingCount: branch.branch_trading_hours.length,
                })
              }
              onEditHours={(row) =>
                setHoursDialog({
                  open: true,
                  branchId: branch.id,
                  row,
                  siblingCount: branch.branch_trading_hours.length,
                })
              }
              onDeleteHours={(row) =>
                setConfirm({
                  title: 'Delete hours row?',
                  description: `This deletes "${row.days_label}".`,
                  onConfirm: () => deleteHours.mutate(row.id),
                })
              }
            />
          ))}
        </div>
      )}

      <BranchEditDialog
        state={branchDialog}
        onOpenChange={(open) => setBranchDialog((s) => ({ ...s, open }))}
        siblingCount={branches?.length ?? 0}
        saving={upsertBranch.isPending}
        onSubmit={(input) =>
          upsertBranch.mutate(input, {
            onSuccess: () => setBranchDialog((s) => ({ ...s, open: false })),
          })
        }
      />

      <HoursEditDialog
        state={hoursDialog}
        onOpenChange={(open) => setHoursDialog((s) => ({ ...s, open }))}
        saving={upsertHours.isPending}
        onSubmit={(input) =>
          upsertHours.mutate(input, {
            onSuccess: () => setHoursDialog((s) => ({ ...s, open: false })),
          })
        }
      />

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

function BranchCard({
  branch,
  onEdit,
  onDelete,
  onAddHours,
  onEditHours,
  onDeleteHours,
}: {
  branch: Branch;
  onEdit: () => void;
  onDelete: () => void;
  onAddHours: () => void;
  onEditHours: (row: HoursRow) => void;
  onDeleteHours: (row: HoursRow) => void;
}) {
  return (
    <div className="rounded-lg border border-[#E5E5E5]/60 bg-white">
      <div className="px-5 py-4 border-b border-[#E5E5E5]/30 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-[#1B1B1B] truncate">
              {branch.name}
            </p>
            {!branch.is_active && (
              <span className="text-[10px] uppercase tracking-wider bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
                Disabled
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            {branch.short_label}
            {branch.city ? ` · ${branch.city}` : ''}
          </p>
          <p className="text-xs text-muted-foreground mt-2 flex items-start gap-1.5">
            <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
            <span>
              {branch.address}
              {branch.address_note && (
                <span className="block italic text-muted-foreground/60">
                  {branch.address_note}
                </span>
              )}
            </span>
          </p>
          {branch.phone && (
            <p className="text-xs text-muted-foreground mt-1">{branch.phone}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">
            <Clock className="h-3 w-3" /> Trading hours
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onAddHours}>
            <Plus className="h-3 w-3 mr-1" /> Hours row
          </Button>
        </div>
        {branch.branch_trading_hours.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">No hours yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {branch.branch_trading_hours.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between text-xs gap-3 hover:bg-[#F5F5F5]/40 rounded-md px-2 py-1.5"
              >
                <div className="min-w-0 flex-1 grid grid-cols-2 gap-3">
                  <span className="text-foreground/80 truncate">
                    {row.days_label}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {row.hours_label}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onEditHours(row)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => onDeleteHours(row)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

type BranchInput = {
  id?: string;
  slug: string;
  name: string;
  short_label: string;
  city: string;
  address: string;
  address_note: string;
  phone: string;
  instagram: string;
  map_embed_url: string;
  image_url: string;
  public_holidays: string;
  sort_order: number;
  is_active: boolean;
};

function BranchEditDialog({
  state,
  onOpenChange,
  siblingCount,
  onSubmit,
  saving,
}: {
  state: { open: boolean; branch?: Branch };
  onOpenChange: (open: boolean) => void;
  siblingCount: number;
  onSubmit: (input: BranchInput) => void;
  saving: boolean;
}) {
  const editing = state.branch;
  const [form, setForm] = useState<BranchInput>(() => emptyForm(siblingCount));

  const dialogKey = `${state.open}-${editing?.id ?? 'new'}`;
  useMemo(() => {
    if (editing) {
      setForm({
        id: editing.id,
        slug: editing.slug,
        name: editing.name,
        short_label: editing.short_label,
        city: editing.city ?? '',
        address: editing.address,
        address_note: editing.address_note ?? '',
        phone: editing.phone ?? '',
        instagram: editing.instagram ?? '',
        map_embed_url: editing.map_embed_url ?? '',
        image_url: editing.image_url ?? '',
        public_holidays: editing.public_holidays ?? '',
        sort_order: editing.sort_order,
        is_active: editing.is_active,
      });
    } else {
      setForm(emptyForm(siblingCount));
    }
  }, [dialogKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof BranchInput>(k: K, v: BranchInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit branch' : 'New branch'}</DialogTitle>
          <DialogDescription>
            Branch info shown on the Location page and in the storefront footer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name">
              <Input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Estique Kirrawee"
              />
            </Field>
            <Field label="Short label (uppercase)">
              <Input
                value={form.short_label}
                onChange={(e) => set('short_label', e.target.value)}
                placeholder="ESTIQUE KIRRAWEE"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Slug (url-friendly id)">
              <Input
                value={form.slug}
                onChange={(e) => set('slug', e.target.value)}
                placeholder="kirrawee"
              />
            </Field>
            <Field label="City">
              <Input
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
                placeholder="Kirrawee, NSW"
              />
            </Field>
          </div>
          <Field label="Address">
            <Input
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
              placeholder="Shop 2/24-32 Flora Street, Kirrawee NSW 2232"
            />
          </Field>
          <Field label="Address note (optional)">
            <Input
              value={form.address_note}
              onChange={(e) => set('address_note', e.target.value)}
              placeholder="Kirrawee Shopping Centre"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone">
              <Input
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="02 8544 3900"
              />
            </Field>
            <Field label="Instagram handle">
              <Input
                value={form.instagram}
                onChange={(e) => set('instagram', e.target.value)}
                placeholder="@ausomenails.kirrawee"
              />
            </Field>
          </div>
          <Field label="Google Maps embed URL">
            <Textarea
              value={form.map_embed_url}
              onChange={(e) => set('map_embed_url', e.target.value)}
              className="min-h-[60px] text-xs"
              placeholder="https://www.google.com/maps?q=...&output=embed"
            />
          </Field>
          <Field label="Image URL (optional)">
            <Input
              value={form.image_url}
              onChange={(e) => set('image_url', e.target.value)}
              placeholder="https://…"
            />
          </Field>
          <Field label="Public holiday note">
            <Input
              value={form.public_holidays}
              onChange={(e) => set('public_holidays', e.target.value)}
              placeholder="Hours may vary"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4 items-center">
            <Field label="Sort order">
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) =>
                  set('sort_order', parseInt(e.target.value) || 0)
                }
              />
            </Field>
            <div className="flex items-center justify-between rounded-md border border-[#E5E5E5]/60 px-3 py-2 mt-5">
              <Label className="text-xs">Active</Label>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => set('is_active', v)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={
              !form.name.trim() ||
              !form.short_label.trim() ||
              !form.slug.trim() ||
              !form.address.trim() ||
              saving
            }
            onClick={() => onSubmit(form)}
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {editing ? 'Save changes' : 'Create branch'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HoursEditDialog({
  state,
  onOpenChange,
  onSubmit,
  saving,
}: {
  state: {
    open: boolean;
    branchId: string;
    row?: HoursRow;
    siblingCount: number;
  };
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    id?: string;
    branch_id: string;
    days_label: string;
    hours_label: string;
    sort_order: number;
  }) => void;
  saving: boolean;
}) {
  const editing = state.row;
  const [days, setDays] = useState(editing?.days_label ?? '');
  const [hours, setHours] = useState(editing?.hours_label ?? '');
  const [sortOrder, setSortOrder] = useState(
    editing?.sort_order ?? state.siblingCount + 1,
  );

  const dialogKey = `${state.open}-${editing?.id ?? 'new'}-${state.branchId}`;
  useMemo(() => {
    setDays(editing?.days_label ?? '');
    setHours(editing?.hours_label ?? '');
    setSortOrder(editing?.sort_order ?? state.siblingCount + 1);
  }, [dialogKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Edit hours row' : 'New hours row'}
          </DialogTitle>
          <DialogDescription>
            Group consecutive days into a single row when possible.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <Field label="Days label">
            <Input
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder="Monday – Wednesday, Friday"
            />
          </Field>
          <Field label="Hours label">
            <Input
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="9:00am – 5:30pm"
            />
          </Field>
          <Field label="Sort order">
            <Input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!days.trim() || !hours.trim() || saving}
            onClick={() =>
              onSubmit({
                id: editing?.id,
                branch_id: state.branchId,
                days_label: days.trim(),
                hours_label: hours.trim(),
                sort_order: sortOrder,
              })
            }
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {editing ? 'Save changes' : 'Create row'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function emptyForm(siblingCount: number): BranchInput {
  return {
    slug: '',
    name: '',
    short_label: '',
    city: '',
    address: '',
    address_note: '',
    phone: '',
    instagram: '',
    map_embed_url: '',
    image_url: '',
    public_holidays: '',
    sort_order: siblingCount + 1,
    is_active: true,
  };
}
