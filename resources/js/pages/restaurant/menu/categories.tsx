import { Head, router, useForm } from '@inertiajs/react';
import { ArrowDown, ArrowUp, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Category = {
    id: number;
    name: string;
    sort_order: number;
    menu_items_count: number;
};

function CategoryRow({
    category,
    first,
    last,
    busy,
    onMove,
    onDelete,
}: {
    category: Category;
    first: boolean;
    last: boolean;
    busy: boolean;
    onMove: (direction: 'up' | 'down') => void;
    onDelete: () => void;
}) {
    const [editing, setEditing] = useState(false);
    const form = useForm({ name: category.name });

    return (
        <div className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
                {editing ? (
                    <div className="max-w-md space-y-2">
                        <Input
                            value={form.data.name}
                            onChange={(event) =>
                                form.setData('name', event.target.value)
                            }
                        />
                        <InputError message={form.errors.name} />
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <p className="font-medium">{category.name}</p>
                        <Badge variant="secondary">
                            {category.menu_items_count}{' '}
                            {category.menu_items_count === 1 ? 'item' : 'items'}
                        </Badge>
                    </div>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <Button
                    size="icon"
                    variant="outline"
                    disabled={first || busy}
                    onClick={() => onMove('up')}
                    aria-label="Move category up"
                >
                    <ArrowUp />
                </Button>
                <Button
                    size="icon"
                    variant="outline"
                    disabled={last || busy}
                    onClick={() => onMove('down')}
                    aria-label="Move category down"
                >
                    <ArrowDown />
                </Button>
                {editing ? (
                    <>
                        <Button
                            size="sm"
                            disabled={form.processing}
                            onClick={() =>
                                form.patch(
                                    `/restaurant/menu/categories/${category.id}`,
                                    {
                                        preserveScroll: true,
                                        onSuccess: () => setEditing(false),
                                    },
                                )
                            }
                        >
                            <Save /> Save
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                                form.reset();
                                form.clearErrors();
                                setEditing(false);
                            }}
                        >
                            Cancel
                        </Button>
                    </>
                ) : (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(true)}
                    >
                        <Pencil /> Rename
                    </Button>
                )}
                <Button size="sm" variant="destructive" onClick={onDelete}>
                    <Trash2 /> Delete
                </Button>
            </div>
        </div>
    );
}

export default function MenuCategories({
    categories,
}: {
    categories: Category[];
}) {
    const createForm = useForm({ name: '' });
    const [busyId, setBusyId] = useState<number | null>(null);
    const [deleting, setDeleting] = useState<Category | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const create = (event: React.FormEvent) => {
        event.preventDefault();
        createForm.post('/restaurant/menu/categories', {
            preserveScroll: true,
            onSuccess: () => createForm.reset(),
        });
    };

    const move = (category: Category, direction: 'up' | 'down') => {
        setBusyId(category.id);
        router.patch(
            `/restaurant/menu/categories/${category.id}/move`,
            { direction },
            { preserveScroll: true, onFinish: () => setBusyId(null) },
        );
    };

    return (
        <>
            <Head title="Menu categories" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight">
                        Menu categories
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        Organize the sections customers see in your menu.
                    </p>
                </div>

                <Card>
                    <CardContent className="pt-6">
                        <form
                            onSubmit={create}
                            className="flex flex-col gap-3 sm:flex-row sm:items-end"
                        >
                            <div className="flex-1 space-y-2">
                                <Label htmlFor="new-category">
                                    New category
                                </Label>
                                <Input
                                    id="new-category"
                                    value={createForm.data.name}
                                    onChange={(event) =>
                                        createForm.setData(
                                            'name',
                                            event.target.value,
                                        )
                                    }
                                    placeholder="e.g. Rice meals"
                                />
                                <InputError message={createForm.errors.name} />
                            </div>
                            <Button
                                type="submit"
                                disabled={createForm.processing}
                            >
                                <Plus /> Add category
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="divide-y pt-2">
                        {categories.length === 0 ? (
                            <p className="text-muted-foreground py-12 text-center text-sm">
                                No categories yet.
                            </p>
                        ) : (
                            categories.map((category, index) => (
                                <CategoryRow
                                    key={category.id}
                                    category={category}
                                    first={index === 0}
                                    last={index === categories.length - 1}
                                    busy={busyId === category.id}
                                    onMove={(direction) =>
                                        move(category, direction)
                                    }
                                    onDelete={() => {
                                        setDeleteError(null);
                                        setDeleting(category);
                                    }}
                                />
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog
                open={deleting !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeleting(null);
                        setDeleteError(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete {deleting?.name}?</DialogTitle>
                        <DialogDescription>
                            A category can only be deleted after all of its menu
                            items have been moved or removed.
                        </DialogDescription>
                    </DialogHeader>
                    <InputError message={deleteError ?? undefined} />
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleting(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={
                                deleting !== null && busyId === deleting.id
                            }
                            onClick={() => {
                                if (!deleting) return;
                                setBusyId(deleting.id);
                                setDeleteError(null);
                                router.delete(
                                    `/restaurant/menu/categories/${deleting.id}`,
                                    {
                                        preserveScroll: true,
                                        onSuccess: () => setDeleting(null),
                                        onError: (errors) =>
                                            setDeleteError(
                                                errors.category ??
                                                    'The category could not be deleted.',
                                            ),
                                        onFinish: () => setBusyId(null),
                                    },
                                );
                            }}
                        >
                            Delete category
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

MenuCategories.layout = { title: 'Menu categories' };
