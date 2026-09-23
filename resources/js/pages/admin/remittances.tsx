import { Head, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Remittance = {
    id: number;
    amount: string;
    reference_note: string | null;
    created_at: string;
    rider: {
        cash_on_hand: string;
        user: { name: string; email: string };
    };
};

export default function AdminRemittances({
    remittances,
}: {
    remittances: Remittance[];
}) {
    return (
        <>
            <Head title="Pending remittances" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Pending remittances
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Confirm only after matching the rider’s deposit or cash
                        handover.
                    </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    {remittances.map((remittance) => (
                        <Card key={remittance.id}>
                            <CardHeader>
                                <CardTitle>
                                    {remittance.rider.user.name}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span>Amount</span>
                                    <strong>
                                        ₱{Number(remittance.amount).toFixed(2)}
                                    </strong>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span>Rider cash balance</span>
                                    <span>
                                        ₱
                                        {Number(
                                            remittance.rider.cash_on_hand,
                                        ).toFixed(2)}
                                    </span>
                                </div>
                                <p className="text-muted-foreground">
                                    {remittance.reference_note ||
                                        'No reference note provided.'}
                                </p>
                                <Button
                                    className="w-full"
                                    onClick={() =>
                                        router.patch(
                                            `/admin/remittances/${remittance.id}/confirm`,
                                        )
                                    }
                                >
                                    Confirm remittance
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {remittances.length === 0 && (
                    <Card>
                        <CardContent className="text-muted-foreground pt-6 text-sm">
                            There are no pending remittances.
                        </CardContent>
                    </Card>
                )}
            </div>
        </>
    );
}
