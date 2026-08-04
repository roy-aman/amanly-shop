import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Pencil, Star, Trash2 } from 'lucide-react';
import * as addressApi from '@/api/addresses';
import { ApiError } from '@/lib/http';
import type { AddressRequest, AddressResponse } from '@/lib/types';
import { useToast } from '@/context/ToastContext';
import { Button, EmptyState, Field, Input, Modal, PageLoader } from '@/components/ui';

interface FormState {
  label: string;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  makeDefault: boolean;
}

const EMPTY: FormState = {
  label: '',
  recipientName: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  makeDefault: false,
};

function toForm(a: AddressResponse): FormState {
  return {
    label: a.label,
    recipientName: a.recipientName,
    phone: a.phone ?? '',
    addressLine1: a.addressLine1,
    addressLine2: a.addressLine2 ?? '',
    city: a.city,
    state: a.state ?? '',
    postalCode: a.postalCode,
    country: a.country,
    makeDefault: a.isDefault,
  };
}

function toRequest(form: FormState): AddressRequest {
  return {
    label: form.label.trim(),
    recipientName: form.recipientName.trim(),
    phone: form.phone.trim() || null,
    addressLine1: form.addressLine1.trim(),
    addressLine2: form.addressLine2.trim() || null,
    city: form.city.trim(),
    state: form.state.trim() || null,
    postalCode: form.postalCode.trim(),
    country: form.country.trim(),
    makeDefault: form.makeDefault,
  };
}

function formatAddress(a: AddressResponse): string {
  return [a.addressLine1, a.addressLine2, a.city, a.state, a.postalCode, a.country].filter(Boolean).join(', ');
}

export default function Addresses() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: list = [], isLoading } = useQuery({ queryKey: ['addresses'], queryFn: addressApi.listAddresses });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ['addresses'] });
  }

  const saveMutation = useMutation({
    mutationFn: (form: FormState) =>
      editingId ? addressApi.updateAddress(editingId, toRequest(form)) : addressApi.addAddress(toRequest(form)),
    onSuccess: async () => {
      await invalidate();
      setModalOpen(false);
      toast.success(editingId ? 'Address updated' : 'Address added');
    },
    onError: (e) => handleError(e),
  });

  const defaultMutation = useMutation({
    mutationFn: (id: string) => addressApi.setDefaultAddress(id),
    onSuccess: () => invalidate(),
    onError: (e) => handleError(e),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => addressApi.deleteAddress(id),
    onSuccess: async () => {
      await invalidate();
      setConfirmId(null);
      toast.success('Address removed');
    },
    onError: (e) => handleError(e),
  });

  function handleError(e: unknown) {
    if (e instanceof ApiError) {
      const fe = e.fieldErrorMap();
      if (Object.keys(fe).length) setErrors(fe);
      else toast.error('Something went wrong', e.message);
    } else {
      toast.error('Unexpected error', String(e));
    }
  }

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY });
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(a: AddressResponse) {
    setEditingId(a.id);
    setForm(toForm(a));
    setErrors({});
    setModalOpen(true);
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.label.trim()) next.label = 'Label is required';
    if (!form.recipientName.trim()) next.recipientName = 'Name is required';
    if (!form.addressLine1.trim()) next.addressLine1 = 'Address is required';
    if (!form.city.trim()) next.city = 'City is required';
    if (!form.postalCode.trim()) next.postalCode = 'Postal code is required';
    if (!form.country.trim()) next.country = 'Country is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function save() {
    if (!validate()) return;
    saveMutation.mutate(form);
  }

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-700 pb-6">
        <div>
          <h1 className="font-display text-h1 text-slate-100">Addresses</h1>
          <p className="mt-2 text-body-sm text-slate-400">
            Saved addresses prefill checkout and sync across your devices.
          </p>
        </div>
        <Button onClick={openAdd} variant="outline">
          Add address
        </Button>
      </header>

      <div className="mt-8">
      {list.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-10 w-10" />}
          title="No saved addresses"
          message="Add an address to make checkout faster."
          action={<Button onClick={openAdd}>Add address</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-x-10 border-t border-ink-700 sm:grid-cols-2">
          {list.map((a) => (
            <div key={a.id} className="flex flex-col gap-3 border-b border-ink-700 py-6">
              <div className="flex items-center gap-3">
                <span className="text-body-sm font-medium text-slate-100">{a.label}</span>
                {a.isDefault && <span className="text-overline uppercase text-slate-500">Default</span>}
              </div>
              <div className="text-body-sm text-slate-400">
                <p className="text-slate-200">{a.recipientName}</p>
                {a.phone && <p>{a.phone}</p>}
                <p>{formatAddress(a)}</p>
              </div>
              <div className="mt-auto flex flex-wrap gap-4 pt-2">
                {!a.isDefault && (
                  <Button variant="ghost" size="sm" onClick={() => defaultMutation.mutate(a.id)} loading={defaultMutation.isPending}>
                    <Star className="h-3.5 w-3.5" /> Set default
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmId(a.id)}>
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>

      {/* Add / edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit address' : 'Add address'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saveMutation.isPending}>
              {editingId ? 'Save changes' : 'Add address'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Label" required error={errors.label} className="sm:col-span-2">
            <Input value={form.label} onChange={(e) => set('label', e.target.value)} invalid={!!errors.label} placeholder="Home, Office…" />
          </Field>
          <Field label="Full name" required error={errors.recipientName}>
            <Input value={form.recipientName} onChange={(e) => set('recipientName', e.target.value)} invalid={!!errors.recipientName} />
          </Field>
          <Field label="Phone" error={errors.phone}>
            <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="Address line 1" required error={errors.addressLine1} className="sm:col-span-2">
            <Input value={form.addressLine1} onChange={(e) => set('addressLine1', e.target.value)} invalid={!!errors.addressLine1} />
          </Field>
          <Field label="Address line 2" error={errors.addressLine2} className="sm:col-span-2">
            <Input value={form.addressLine2} onChange={(e) => set('addressLine2', e.target.value)} />
          </Field>
          <Field label="City" required error={errors.city}>
            <Input value={form.city} onChange={(e) => set('city', e.target.value)} invalid={!!errors.city} />
          </Field>
          <Field label="State / Region" error={errors.state}>
            <Input value={form.state} onChange={(e) => set('state', e.target.value)} />
          </Field>
          <Field label="Postal code" required error={errors.postalCode}>
            <Input value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} invalid={!!errors.postalCode} />
          </Field>
          <Field label="Country" required error={errors.country}>
            <Input value={form.country} onChange={(e) => set('country', e.target.value)} invalid={!!errors.country} />
          </Field>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.makeDefault}
              onChange={(e) => set('makeDefault', e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Set as default address
          </label>
        </div>
      </Modal>

      {/* Remove confirm */}
      <Modal
        open={confirmId !== null}
        onClose={() => setConfirmId(null)}
        title="Remove address?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmId(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => confirmId && removeMutation.mutate(confirmId)} loading={removeMutation.isPending}>
              Remove
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-400">This address will be removed from your account.</p>
      </Modal>
    </div>
  );
}
