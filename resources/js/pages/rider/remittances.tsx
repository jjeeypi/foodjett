import { Head, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Remittance = {
    id: number;
    amount: string;
    reference_note: string | null;
    status: 'pending' | 'confirmed';
    remitted_at: string | null;
    created_at: string;
};

export default function RiderRemittances({
    rider,
    remittances,
}: {
    rider: { cash_on_hand: string; cash_remit_limit: string };
    remittances: Remittance[];
}) {
    const form = useForm({ amount: '', reference_note: '' });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post('/rider/remittances', {
            onSuccess: () => form.reset(),
        });
    };

    return (
        <>
            <Head title="Cash remittances" />
            <div className="grid gap-6 p-4 md:p-6 lg:grid-cols-[22rem_1fr]">
                <Card className="self-start">
                    <CardHeader>
                        <CardTitle>Remit cash</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={submit} className="space-y-4">
                            <div className="rounded-lg border p-3 text-sm">
                                <p className="text-muted-foreground">
                                    Cash on hand
                                </p>
                                <p className="text-xl font-semibold">
                                    ₱{Number(rider.cash_on_hand).toFixed(2)}
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="amount">Amount</Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={form.data.amount}
                                    onChange={(event) =>
                                        form.setData(
                                            'amount',
                                            event.target.value,
                                        )
                                    }
                                />
                                <InputError message={form.errors.amount} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="reference_note">
                                    Reference note (optional)
                                </Label>
                                <Input
                                    id="reference_note"
                                    placeholder="Deposit slip or transfer reference"
                                    value={form.data.reference_note}
                                    onChange={(event) =>
                                        form.setData(
                                            'reference_note',
                                            event.target.value,
                                        )
                                    }
                                />
                                <InputError
                                    message={form.errors.reference_note}
                                />
                            </div>
                            <Button
                                type="submit"
                                className="w-full"
                                disabled={form.processing}
                            >
                                Submit remittance
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Remittance history</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {remittances.map((remittance) => (
                            <div
                                key={remittance.id}
                                className="flex items-start justify-between gap-4 rounded-lg border p-4 text-sm"
                            >
                                <div>
                                    <p className="font-semibold">
                                        ₱{Number(remittance.amount).toFixed(2)}
                                    </p>
                                    <p className="text-muted-foreground">
                                        {remittance.reference_note ||
                                            'No reference note'}
                                    </p>
                                </div>
                                <span className="rounded-full border px-2 py-1 text-xs capitalize">
                                    {remittance.status}
                                </span>
                            </div>
                        ))}
                        {remittances.length === 0 && (
                            <p className="text-muted-foreground text-sm">
                                No remittances submitted yet.
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
