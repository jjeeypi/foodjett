import { useForm } from '@inertiajs/react';
import { X } from 'lucide-react';
import { useId, useState } from 'react';
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
    subjectName: string;
    title: string;
    description?: string;
    triggerLabel?: string;
    size?: 'sm' | 'default';
};

export default function RejectActionDialog({
    action,
    subjectName,
    title,
    description,
    triggerLabel = 'Reject',
    size = 'default',
}: Props) {
    const [open, setOpen] = useState(false);
    const reasonId = useId();
    const form = useForm({ reason: '' });

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
            onOpenChange={(nextOpen) => {
                if (nextOpen) {
                    setOpen(true);
                } else {
                    close();
                }
            }}
        >
            <DialogTrigger asChild>
                <Button variant="destructive" size={size}>
                    <X />
                    {triggerLabel}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        {description ??
                            `Explain why ${subjectName} is being rejected.`}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    <Label htmlFor={reasonId}>Rejection reason</Label>
                    <textarea
                        id={reasonId}
                        value={form.data.reason}
                        onChange={(event) =>
                            form.setData('reason', event.target.value)
                        }
                        rows={5}
                        className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3"
                        placeholder="State what needs to be corrected…"
                    />
                    <InputError message={form.errors.reason} />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={close}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={submit}
                        disabled={form.processing}
                    >
                        {form.processing ? 'Rejecting…' : 'Confirm rejection'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
