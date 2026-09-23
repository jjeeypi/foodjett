import { useForm } from '@inertiajs/react';
import { useId, useState, type ReactNode } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

type Props = {
    action: string;
    field: 'reason' | 'resolution';
    title: string;
    description: string;
    fieldLabel: string;
    placeholder: string;
    triggerLabel: string;
    submitLabel: string;
    processingLabel: string;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary';
    triggerIcon?: ReactNode;
};

export default function TextActionDialog({
    action,
    field,
    title,
    description,
    fieldLabel,
    placeholder,
    triggerLabel,
    submitLabel,
    processingLabel,
    variant = 'default',
    triggerIcon,
}: Props) {
    const [open, setOpen] = useState(false);
    const fieldId = useId();
    const form = useForm({ reason: '', resolution: '' });

    const close = () => {
        form.reset();
        form.clearErrors();
        setOpen(false);
    };

    const submit = () => {
        form.patch(action, {
            preserveScroll: true,
            onSuccess: close,
        });
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : close())}
        >
            <DialogTrigger asChild>
                <Button variant={variant}>
                    {triggerIcon}
                    {triggerLabel}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    <Label htmlFor={fieldId}>{fieldLabel}</Label>
                    <textarea
                        id={fieldId}
                        value={form.data[field]}
                        onChange={(event) =>
                            form.setData(field, event.target.value)
                        }
                        rows={5}
                        className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3"
                        placeholder={placeholder}
                    />
                    <InputError message={form.errors[field]} />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={close}>
                        Cancel
                    </Button>
                    <Button
                        variant={variant}
                        onClick={submit}
                        disabled={form.processing}
                    >
                        {form.processing ? processingLabel : submitLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
