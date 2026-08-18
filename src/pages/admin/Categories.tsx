import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderInput, FolderTree, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { adminCategories } from '@/api/admin';
import { ApiError } from '@/lib/http';
import type { CategoryResponse, CreateCategoryRequest, UpdateCategoryRequest } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea } from '@/components/ui';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { RowsSkeleton } from '@/components/RouteSkeletons';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Order categories parent-then-children (depth-first) so indentation reads as a tree. */
function orderTree(cats: CategoryResponse[]): CategoryResponse[] {
  const byParent = new Map<string | null, CategoryResponse[]>();
  for (const c of cats) {
    const key = c.parentId ?? null;
    const arr = byParent.get(key) ?? [];
    arr.push(c);
    byParent.set(key, arr);
  }
  for (const arr of byParent.values()) arr.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const out: CategoryResponse[] = [];
  const visit = (parentId: string | null) => {
    for (const c of byParent.get(parentId) ?? []) {
      out.push(c);
      visit(c.id);
    }
  };
  visit(null);
  // Include any orphaned nodes (parent not in list) that weren't reached.
  for (const c of cats) if (!out.includes(c)) out.push(c);
  return out;
}

export default function Categories() {
  const qc = useQueryClient();
  const [dragging, setDragging] = useState<CategoryResponse | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<CategoryResponse | null>(null);
  const toast = useToast();
  const { isAdmin } = useAuth();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => adminCategories.list(),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<{
    name: string;
    slug: string;
    description: string;
    parentId: string;
    imageUrl: string;
    imageAltText: string;
    bannerUrl: string;
  }>({
    name: '',
    slug: '',
    description: '',
    parentId: '',
    imageUrl: '',
    imageAltText: '',
    bannerUrl: '',
  });
  const [editTarget, setEditTarget] = useState<CategoryResponse | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    description: string;
    sortOrder: string;
    active: boolean;
    imageUrl: string;
    imageAltText: string;
    bannerUrl: string;
  }>({
    name: '',
    description: '',
    sortOrder: '0',
    active: true,
    imageUrl: '',
    imageAltText: '',
    bannerUrl: '',
  });
  const [deleteTarget, setDeleteTarget] = useState<CategoryResponse | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'categories'] });

  function onMutationError(e: unknown, title: string) {
    if (e instanceof ApiError) {
      if (e.hasFieldErrors()) setErrors(e.fieldErrorMap());
      toast.error(title, e.message);
    } else {
      toast.error(title, 'An unexpected error occurred.');
    }
  }

  const createMutation = useMutation({
    mutationFn: (body: CreateCategoryRequest) => adminCategories.create(body),
    onSuccess: () => {
      invalidate();
      toast.success('Category created');
      setCreateOpen(false);
      setCreateForm({ name: '', slug: '', description: '', parentId: '', imageUrl: '', imageAltText: '', bannerUrl: '' });
    },
    onError: (e) => onMutationError(e, 'Could not create'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCategoryRequest }) => adminCategories.update(id, body),
    onSuccess: () => {
      invalidate();
      toast.success('Category updated');
      setEditTarget(null);
    },
    onError: (e) => onMutationError(e, 'Could not update'),
  });

  /**
   * Every category inside this one, itself included.
   *
   * A branch cannot be moved into its own subtree — that detaches it from every root, so the rows
   * survive and nothing reaches them. The backend refuses it (CATEGORY_CYCLE); this is what keeps
   * such a target from being offered or accepted in the first place, so the rule is felt as
   * "that is not a drop zone" rather than as an error after the fact.
   */
  function descendantsOf(id: string, all: CategoryResponse[]): Set<string> {
    const inside = new Set<string>([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const c of all) {
        if (c.parentId && inside.has(c.parentId) && !inside.has(c.id)) {
          inside.add(c.id);
          grew = true;
        }
      }
    }
    return inside;
  }

  const moveMutation = useMutation({
    mutationFn: ({ id, parentId }: { id: string; parentId: string | null }) =>
      adminCategories.move(id, { parentId }),
    onSuccess: async (moved) => {
      await qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
      toast.success(
        `${moved.name} moved`,
        moved.parentName ? `Now inside ${moved.parentName}.` : 'Now a top-level category.',
      );
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'CATEGORY_CYCLE') {
        toast.error('Cannot move it there', 'That category sits inside the one being moved.');
        return;
      }
      if (e instanceof ApiError && e.code === 'CATEGORY_DEPTH_EXCEEDED') {
        toast.error('Too deep', 'The deepest category in that branch would pass the nesting limit.');
        return;
      }
      toast.error('Could not move the category', e instanceof Error ? e.message : 'Please try again.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminCategories.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success('Category deleted');
      setDeleteTarget(null);
    },
    onError: (e) => onMutationError(e, 'Could not delete'),
  });

  const ordered = useMemo(() => orderTree(data ?? []), [data]);

  function openEdit(c: CategoryResponse) {
    setErrors({});
    setEditTarget(c);
    setEditForm({
      name: c.name,
      description: c.description ?? '',
      sortOrder: String(c.sortOrder),
      active: c.active,
      imageUrl: c.imageUrl ?? '',
      imageAltText: c.imageAltText ?? '',
      bannerUrl: c.bannerUrl ?? '',
    });
  }

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle="Organise your catalog into a hierarchy."
        action={
          <Button
            onClick={() => {
              setErrors({});
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New category
          </Button>
        }
      />

      <Card className="p-4">
        {ordered.length > 0 ? (
          <p className="mb-3 text-caption text-slate-500">
            Drag a category onto another to nest it inside, or use the move button to pick a new parent. A category
            takes everything inside it when it moves.
          </p>
        ) : null}
        {isLoading ? (
          <RowsSkeleton rows={6} />
        ) : isError ? (
          <EmptyState title="Could not load categories" message={(error as Error)?.message} />
        ) : ordered.length === 0 ? (
          <EmptyState
            icon={<FolderTree className="h-10 w-10" />}
            title="No categories yet"
            message="Create your first category to start organising products."
          />
        ) : (
          <ul className="divide-y divide-ink-800">
            {ordered.map((c) => {
              const blocked = dragging ? descendantsOf(dragging.id, ordered).has(c.id) : false;
              return (
              <li
                key={c.id}
                draggable
                onDragStart={() => setDragging(c)}
                onDragEnd={() => {
                  setDragging(null);
                  setDropTarget(null);
                }}
                onDragOver={(e) => {
                  // preventDefault is what marks this a valid drop zone; withholding it on a
                  // category inside the dragged branch is how the cursor says "not here".
                  if (!dragging || blocked) return;
                  e.preventDefault();
                  setDropTarget(c.id);
                }}
                onDragLeave={() => setDropTarget((t) => (t === c.id ? null : t))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropTarget(null);
                  if (dragging && !blocked && dragging.id !== c.id) {
                    moveMutation.mutate({ id: dragging.id, parentId: c.id });
                  }
                  setDragging(null);
                }}
                className={`flex items-center justify-between gap-3 py-3 ${
                  dropTarget === c.id ? 'rounded-lg bg-primary/10 ring-1 ring-primary/40' : ''
                } ${dragging?.id === c.id ? 'opacity-50' : ''} ${
                  blocked && dragging && dragging.id !== c.id ? 'opacity-40' : ''
                }`}
              >
                <div className="flex min-w-0 items-center gap-2" style={{ paddingLeft: `${c.depth * 1.5}rem` }}>
                  <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-600" aria-hidden />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-100">{c.name}</span>
                      <Badge tone={c.active ? 'green' : 'gray'}>{c.active ? 'Active' : 'Inactive'}</Badge>
                    </div>
                    <p className="truncate font-mono text-xs text-slate-500">/{c.slug}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {/* Dragging is not reachable by keyboard and is poor on touch, so the same move
                      is always available as a plain picker. */}
                  <Button size="sm" variant="ghost" onClick={() => setMoveTarget(c)} aria-label={`Move ${c.name}`}>
                    <FolderInput className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(c)} aria-label={`Edit ${c.name}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteTarget(c)}
                      aria-label={`Delete ${c.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-rose-400" />
                    </Button>
                  )}
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Move: the keyboard- and touch-reachable equivalent of a drag. */}
      <Modal
        open={!!moveTarget}
        onClose={() => setMoveTarget(null)}
        title={moveTarget ? `Move ${moveTarget.name}` : 'Move category'}
      >
        {moveTarget ? (
          <>
            <p className="text-body-sm text-slate-400">
              Everything inside {moveTarget.name} moves with it. Categories inside it are not offered, because a branch
              cannot contain itself.
            </p>
            <ul className="mt-4 max-h-72 space-y-1 overflow-y-auto">
              <li>
                <button
                  type="button"
                  disabled={moveTarget.parentId === null}
                  onClick={() => {
                    moveMutation.mutate({ id: moveTarget.id, parentId: null });
                    setMoveTarget(null);
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left text-body-sm text-slate-200 transition hover:bg-ink-800 disabled:opacity-40"
                >
                  Top level
                  {moveTarget.parentId === null ? <span className="text-slate-500"> — already here</span> : null}
                </button>
              </li>
              {ordered
                .filter((c) => !descendantsOf(moveTarget.id, ordered).has(c.id))
                .map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={c.id === moveTarget.parentId}
                      onClick={() => {
                        moveMutation.mutate({ id: moveTarget.id, parentId: c.id });
                        setMoveTarget(null);
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left text-body-sm text-slate-200 transition hover:bg-ink-800 disabled:opacity-40"
                      style={{ paddingLeft: `${0.75 + c.depth * 1.25}rem` }}
                    >
                      {c.name}
                      {c.id === moveTarget.parentId ? <span className="text-slate-500"> — already here</span> : null}
                    </button>
                  </li>
                ))}
            </ul>
          </>
        ) : null}
      </Modal>

      {/* Create modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New category"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={createMutation.isPending}
              onClick={() =>
                createMutation.mutate({
                  name: createForm.name.trim(),
                  slug: createForm.slug.trim(),
                  description: createForm.description.trim() || null,
                  parentId: createForm.parentId || null,
                  imageUrl: createForm.imageUrl.trim() || null,
                  imageAltText: createForm.imageAltText.trim() || null,
                  bannerUrl: createForm.bannerUrl.trim() || null,
                })
              }
            >
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" required error={errors.name}>
            <Input
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              invalid={!!errors.name}
            />
          </Field>
          <Field
            label="Slug"
            required
            error={errors.slug}
            hint="lowercase-with-hyphens"
          >
            <Input
              value={createForm.slug}
              onChange={(e) => setCreateForm((f) => ({ ...f, slug: e.target.value }))}
              invalid={!!errors.slug || (!!createForm.slug && !SLUG_RE.test(createForm.slug))}
            />
          </Field>
          <Field label="Parent" error={errors.parentId}>
            <Select
              value={createForm.parentId}
              onChange={(e) => setCreateForm((f) => ({ ...f, parentId: e.target.value }))}
            >
              <option value="">— Top level —</option>
              {ordered.map((c) => (
                <option key={c.id} value={c.id}>
                  {'— '.repeat(c.depth)}
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description" error={errors.description}>
            <Textarea
              rows={3}
              value={createForm.description}
              onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
            />
          </Field>
          <ImageUploadField
            label="Tile image"
            aspect="square"
            hint="Shown wherever categories appear in a grid."
            value={createForm.imageUrl}
            onChange={(url) => setCreateForm((f) => ({ ...f, imageUrl: url }))}
            error={errors.imageUrl}
            aiContext={{ categoryName: createForm.name, forCategory: true }}
            aiSingleImage
          />
          <Field label="Image alt text" hint="Describes the tile for screen readers." error={errors.imageAltText}>
            <Input
              value={createForm.imageAltText}
              onChange={(e) => setCreateForm((f) => ({ ...f, imageAltText: e.target.value }))}
            />
          </Field>
          <ImageUploadField
            label="Category banner"
            hint="Wide hero across the top of this category's own page. A stretched tile looks wrong here, so use a separate crop."
            value={createForm.bannerUrl}
            onChange={(url) => setCreateForm((f) => ({ ...f, bannerUrl: url }))}
            error={errors.bannerUrl}
            aiContext={{ categoryName: createForm.name, forCategory: true }}
            aiSingleImage
          />
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={editTarget ? `Edit “${editTarget.name}”` : 'Edit category'}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button
              loading={updateMutation.isPending}
              onClick={() =>
                editTarget &&
                updateMutation.mutate({
                  id: editTarget.id,
                  body: {
                    name: editForm.name.trim(),
                    description: editForm.description.trim() || null,
                    sortOrder: Number(editForm.sortOrder) || 0,
                    active: editForm.active,
                    imageUrl: editForm.imageUrl.trim() || null,
                    imageAltText: editForm.imageAltText.trim() || null,
                    bannerUrl: editForm.bannerUrl.trim() || null,
                  },
                })
              }
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" required error={errors.name}>
            <Input
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              invalid={!!errors.name}
            />
          </Field>
          <Field label="Sort order" error={errors.sortOrder}>
            <Input
              type="number"
              value={editForm.sortOrder}
              onChange={(e) => setEditForm((f) => ({ ...f, sortOrder: e.target.value }))}
            />
          </Field>
          <Field label="Description" error={errors.description}>
            <Textarea
              rows={3}
              value={editForm.description}
              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
            />
          </Field>
          <ImageUploadField
            label="Tile image"
            aspect="square"
            hint="Shown wherever categories appear in a grid."
            value={editForm.imageUrl}
            onChange={(url) => setEditForm((f) => ({ ...f, imageUrl: url }))}
            error={errors.imageUrl}
            aiContext={{ categoryName: editForm.name, forCategory: true }}
            aiSingleImage
          />
          <Field label="Image alt text" hint="Describes the tile for screen readers." error={errors.imageAltText}>
            <Input
              value={editForm.imageAltText}
              onChange={(e) => setEditForm((f) => ({ ...f, imageAltText: e.target.value }))}
            />
          </Field>
          <ImageUploadField
            label="Category banner"
            hint="Wide hero across the top of this category's own page."
            value={editForm.bannerUrl}
            onChange={(url) => setEditForm((f) => ({ ...f, bannerUrl: url }))}
            error={errors.bannerUrl}
            aiContext={{ categoryName: editForm.name, forCategory: true }}
            aiSingleImage
          />
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={editForm.active}
              onChange={(e) => setEditForm((f) => ({ ...f, active: e.target.checked }))}
            />
            Active
          </label>
        </div>
      </Modal>

      {/* Delete modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete category?"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-400">
          Delete <span className="font-medium text-slate-200">{deleteTarget?.name}</span>? Products in this category
          will be uncategorised.
        </p>
      </Modal>
    </div>
  );
}
