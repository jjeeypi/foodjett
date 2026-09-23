import { useForm } from '@inertiajs/react';
import { CalendarRange } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const localDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const today = new Date();
const oneWeekAgo = new Date(today);
oneWeekAgo.setDate(today.getDate() - 6);

export default function GeneratePayoutDialog({
    action,
    subject,
}: {
    action: string;
    subject: 'restaurant' | 'rider';
}) {
    const [open, setOpen] = useState(false);
    const startId = useId();
    const endId = useId();
    const form = useForm({
        period_start: localDate(oneWeekAgo),
        period_end: localDate(today),
    });

    const close = () => {
        form.clearErrors();
        setOpen(false);
    };

    const submit = () => {
        form.post(action, {
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
                <Button>
                    <CalendarRange /> Generate payouts
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="capitalize">
                        Generate {subject} payouts
                    </DialogTitle>
                    <DialogDescription>
                        Creates pending payouts for qualifying delivered work in
                        the inclusive period. Existing overlapping periods are
                        skipped.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor={startId}>Period start</Label>
                        <Input
                            id={startId}
                            type="date"
                            value={form.data.period_start}
                            max={form.data.period_end || localDate(today)}
                            onChange={(event) =>
                                form.setData('period_start', event.target.value)
                            }
                        />
                        <InputError message={form.errors.period_start} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={endId}>Period end</Label>
                        <Input
                            id={endId}
                            type="date"
                            value={form.data.period_end}
                            min={form.data.period_start || undefined}
                            max={localDate(today)}
                            onChange={(event) =>
                                form.setData('period_end', event.target.value)
                            }
                        />
                        <InputError message={form.errors.period_end} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={close}>
                        Cancel
                    </Button>
                    <Button onClick={submit} disabled={form.processing}>
                        {form.processing ? 'Generating…' : 'Generate payouts'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
