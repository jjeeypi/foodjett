import { useForm } from '@inertiajs/react';
import { RotateCcw } from 'lucide-react';
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

const currency = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

export default function RefundPaymentDialog({
    paymentId,
    orderNumber,
    amount,
    refundedAmount,
}: {
    paymentId: number;
    orderNumber: string;
    amount: number;
    refundedAmount: number;
}) {
    const [open, setOpen] = useState(false);
    const amountId = useId();
    const reasonId = useId();
    const remaining = Math.max(0, amount - refundedAmount);
    const form = useForm({
        amount: remaining.toFixed(2),
        reason: '',
    });

    const close = () => {
        form.reset();
        form.setData('amount', remaining.toFixed(2));
        form.clearErrors();
        setOpen(false);
    };

    const submit = () => {
        form.patch(`/admin/transactions/${paymentId}/refund`, {
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
                <Button
                    size="sm"
                    variant="outline"
                    onClick={(event) => event.stopPropagation()}
                >
                    <RotateCcw /> Refund
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Refund {orderNumber}</DialogTitle>
                    <DialogDescription>
                        Up to {currency.format(remaining)} remains refundable.
                        This updates FoodJett's ledger only and does not submit
                        a refund to PayMongo.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor={amountId}>Refund amount</Label>
                        <Input
                            id={amountId}
                            type="number"
                            min="0.01"
                            max={remaining.toFixed(2)}
                            step="0.01"
                            value={form.data.amount}
                            onChange={(event) =>
                                form.setData('amount', event.target.value)
                            }
                        />
                        <InputError message={form.errors.amount} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={reasonId}>Reason (optional)</Label>
                        <textarea
                            id={reasonId}
                            rows={4}
                            value={form.data.reason}
                            onChange={(event) =>
                                form.setData('reason', event.target.value)
                            }
                            placeholder="Add an internal reconciliation note…"
                            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3"
                        />
                        <InputError message={form.errors.reason} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={close}>
                        Cancel
                    </Button>
                    <Button onClick={submit} disabled={form.processing}>
                        {form.processing ? 'Recording…' : 'Record refund'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
