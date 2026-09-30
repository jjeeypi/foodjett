import { Head, router, useForm } from '@inertiajs/react';
import {
    Banknote,
    CalendarDays,
    CircleDollarSign,
    Clock3,
    ReceiptText,
    TriangleAlert,
    WalletCards,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Pagination, type PaginatedData } from '@/components/admin/data-table';
import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Earning = {
    id: number;
    order_number: string;
    restaurant_name: string;
    delivered_at: string;
    base_pay: number;
    distance_pay: number;
    waiting_pay: number;
    incentive_pay: number;
    tip_amount: number;
    total_earned: number;
};

type Payout = {
    id: number;
    period_start: string;
    period_end: string;
    total_amount: number;
    status: 'pending' | 'paid';
    paid_at: string | null;
};

type Remittance = {
    id: number;
    amount: number;
    reference_note: string | null;
    status: 'pending' | 'confirmed';
    remitted_at: string | null;
    created_at: string;
};

type Props = {
    summary: { today: number; week: number; month: number };
    filters: { from: string; to: string };
    earnings: PaginatedData<Earning>;
    payouts: Payout[];
    cash: {
        cash_on_hand: number;
        cash_remit_limit: number;
        pending_remittance_total: number;
        available_to_remit: number;
    };
    remittances: Remittance[];
};

const currency = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

const dateTime = new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

const dateOnly = new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
});

export default function RiderEarnings({
    summary,
    filters,
    earnings,
    payouts,
    cash,
    remittances,
}: Props) {
    const [from, setFrom] = useState(filters.from);
    const [to, setTo] = useState(filters.to);
    const remittance = useForm({ amount: '', reference_note: '' });
    const limitRatio =
        cash.cash_remit_limit > 0
            ? cash.cash_on_hand / cash.cash_remit_limit
            : 1;
    const progress = Math.min(100, Math.max(0, limitRatio * 100));
    const atLimit = cash.cash_on_hand >= cash.cash_remit_limit;
    const nearLimit = !atLimit && limitRatio >= 0.8;

    const applyFilters = (event: FormEvent) => {
        event.preventDefault();
        router.get(
            '/rider/earnings',
            { from: from || undefined, to: to || undefined },
            { preserveScroll: true, preserveState: true, replace: true },
        );
    };

    const clearFilters = () => {
        setFrom('');
        setTo('');
        router.get(
            '/rider/earnings',
            {},
            { preserveScroll: true, preserveState: true, replace: true },
        );
    };

    const submitRemittance = (event: FormEvent) => {
        event.preventDefault();
        remittance.post('/rider/remittances', {
            preserveScroll: true,
            onSuccess: () => {
                remittance.reset();
                toast.success('Remittance submitted for admin confirmation.');
            },
        });
    };

    return (
        <>
            <Head title="Earnings" />
            <div className="space-y-5 px-4 py-6 sm:px-6">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Earnings
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Delivery pay, payouts, and collected COD cash.
                    </p>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <SummaryCard
                        label="Today"
                        value={summary.today}
                        icon={Clock3}
                    />
                    <SummaryCard
                        label="This week"
                        value={summary.week}
                        icon={CalendarDays}
                    />
                    <SummaryCard
                        label="This month"
                        value={summary.month}
                        icon={CircleDollarSign}
                    />
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Delivery earnings</CardTitle>
                        <CardDescription>
                            Filter using each order&apos;s delivered date.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <form
                            onSubmit={applyFilters}
                            className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                        >
                            <div className="space-y-1.5">
                                <Label htmlFor="earnings-from">From</Label>
                                <Input
                                    id="earnings-from"
                                    type="date"
                                    value={from}
                                    max={to || undefined}
                                    onChange={(event) =>
                                        setFrom(event.target.value)
                                    }
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="earnings-to">To</Label>
                                <Input
                                    id="earnings-to"
                                    type="date"
                                    value={to}
                                    min={from || undefined}
                                    onChange={(event) =>
                                        setTo(event.target.value)
                                    }
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button type="submit" className="flex-1">
                                    Apply
                                </Button>
                                {(filters.from || filters.to) && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={clearFilters}
                                    >
                                        Clear
                                    </Button>
                                )}
                            </div>
                        </form>

                        <div className="space-y-3">
                            {earnings.data.map((earning) => (
                                <EarningReceipt
                                    key={earning.id}
                                    earning={earning}
                                />
                            ))}
                            {earnings.data.length === 0 && (
                                <div className="text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm">
                                    No delivery earnings match this date range.
                                </div>
                            )}
                        </div>
                    </CardContent>
                    <Pagination paginated={earnings} />
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <WalletCards className="size-5" /> Payout history
                        </CardTitle>
                        <CardDescription>
                            Payouts are generated and marked paid by an admin.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {payouts.map((payout) => (
                            <div
                                key={payout.id}
                                className="flex items-start justify-between gap-3 rounded-xl border p-4"
                            >
                                <div className="min-w-0">
                                    <p className="font-semibold">
                                        {currency.format(payout.total_amount)}
                                    </p>
                                    <p className="text-muted-foreground mt-1 text-xs">
                                        {dateOnly.format(
                                            new Date(
                                                `${payout.period_start}T00:00:00`,
                                            ),
                                        )}{' '}
                                        –{' '}
                                        {dateOnly.format(
                                            new Date(
                                                `${payout.period_end}T00:00:00`,
                                            ),
                                        )}
                                    </p>
                                    {payout.paid_at && (
                                        <p className="text-muted-foreground mt-1 text-xs">
                                            Paid{' '}
                                            {dateTime.format(
                                                new Date(payout.paid_at),
                                            )}
                                        </p>
                                    )}
                                </div>
                                <StatusBadge status={payout.status} />
                            </div>
                        ))}
                        {payouts.length === 0 && (
                            <p className="text-muted-foreground py-6 text-center text-sm">
                                No payouts generated yet.
                            </p>
                        )}
                    </CardContent>
                </Card>

                <Card id="cash-remittance" className="scroll-mt-20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Banknote className="size-5" /> COD cash
                        </CardTitle>
                        <CardDescription>
                            Pending requests reserve part of your cash balance
                            until an admin confirms them.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="space-y-3 rounded-xl border p-4">
                            <div className="flex items-end justify-between gap-3">
                                <div>
                                    <p className="text-muted-foreground text-xs font-medium uppercase">
                                        Cash on hand
                                    </p>
                                    <p className="text-2xl font-semibold">
                                        {currency.format(cash.cash_on_hand)}
                                    </p>
                                </div>
                                <p className="text-muted-foreground text-right text-xs">
                                    Limit
                                    <br />
                                    <span className="text-foreground font-medium">
                                        {currency.format(cash.cash_remit_limit)}
                                    </span>
                                </p>
                            </div>
                            <div className="bg-muted h-2.5 overflow-hidden rounded-full">
                                <div
                                    className={cn(
                                        'h-full rounded-full transition-[width]',
                                        atLimit
                                            ? 'bg-red-500'
                                            : nearLimit
                                              ? 'bg-amber-500'
                                              : 'bg-emerald-500',
                                    )}
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <div className="text-muted-foreground flex justify-between gap-3 text-xs">
                                <span>
                                    Pending:{' '}
                                    {currency.format(
                                        cash.pending_remittance_total,
                                    )}
                                </span>
                                <span>
                                    Available to remit:{' '}
                                    {currency.format(cash.available_to_remit)}
                                </span>
                            </div>
                        </div>

                        {(nearLimit || atLimit) && (
                            <Alert
                                variant={atLimit ? 'destructive' : 'default'}
                            >
                                <TriangleAlert />
                                <AlertTitle>
                                    {atLimit
                                        ? 'COD order acceptance is blocked'
                                        : 'You are close to your cash limit'}
                                </AlertTitle>
                                <AlertDescription>
                                    Submit collected cash for remittance. COD
                                    orders are blocked when cash on hand reaches
                                    the limit.
                                </AlertDescription>
                            </Alert>
                        )}

                        <form
                            onSubmit={submitRemittance}
                            className="space-y-4 rounded-xl border p-4"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="font-medium">Remit cash</p>
                                    <p className="text-muted-foreground text-xs">
                                        Admin confirmation will reduce cash on
                                        hand.
                                    </p>
                                </div>
                                {cash.available_to_remit > 0 && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                            remittance.setData(
                                                'amount',
                                                cash.available_to_remit.toFixed(
                                                    2,
                                                ),
                                            )
                                        }
                                    >
                                        Use available
                                    </Button>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="remittance-amount">
                                    Amount
                                </Label>
                                <Input
                                    id="remittance-amount"
                                    type="number"
                                    inputMode="decimal"
                                    min="0.01"
                                    max={cash.available_to_remit.toFixed(2)}
                                    step="0.01"
                                    placeholder="0.00"
                                    value={remittance.data.amount}
                                    onChange={(event) =>
                                        remittance.setData(
                                            'amount',
                                            event.target.value,
                                        )
                                    }
                                />
                                <InputError
                                    message={remittance.errors.amount}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="remittance-note">
                                    Reference or receipt note (optional)
                                </Label>
                                <Input
                                    id="remittance-note"
                                    maxLength={255}
                                    placeholder="Deposit slip or transfer reference"
                                    value={remittance.data.reference_note}
                                    onChange={(event) =>
                                        remittance.setData(
                                            'reference_note',
                                            event.target.value,
                                        )
                                    }
                                />
                                <InputError
                                    message={remittance.errors.reference_note}
                                />
                            </div>
                            <Button
                                type="submit"
                                className="w-full"
                                disabled={
                                    remittance.processing ||
                                    cash.available_to_remit <= 0
                                }
                            >
                                {remittance.processing
                                    ? 'Submitting…'
                                    : 'Submit remittance'}
                            </Button>
                        </form>

                        <div>
                            <h3 className="mb-3 font-medium">
                                Remittance history
                            </h3>
                            <div className="space-y-3">
                                {remittances.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex items-start justify-between gap-3 rounded-xl border p-4"
                                    >
                                        <div className="min-w-0">
                                            <p className="font-semibold">
                                                {currency.format(item.amount)}
                                            </p>
                                            <p className="text-muted-foreground mt-1 text-xs">
                                                Submitted{' '}
                                                {dateTime.format(
                                                    new Date(item.created_at),
                                                )}
                                            </p>
                                            <p className="text-muted-foreground mt-1 truncate text-xs">
                                                {item.reference_note ||
                                                    'No reference note'}
                                            </p>
                                            {item.status === 'pending' && (
                                                <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                                                    Waiting for admin
                                                    confirmation
                                                </p>
                                            )}
                                            {item.remitted_at && (
                                                <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                                    Confirmed{' '}
                                                    {dateTime.format(
                                                        new Date(
                                                            item.remitted_at,
                                                        ),
                                                    )}
                                                </p>
                                            )}
                                        </div>
                                        <StatusBadge status={item.status} />
                                    </div>
                                ))}
                                {remittances.length === 0 && (
                                    <p className="text-muted-foreground py-6 text-center text-sm">
                                        No remittances submitted yet.
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

function SummaryCard({
    label,
    value,
    icon: Icon,
}: {
    label: string;
    value: number;
    icon: typeof CircleDollarSign;
}) {
    return (
        <Card>
            <CardContent className="p-3 sm:p-4">
                <div className="bg-primary/10 text-primary mb-2 flex size-8 items-center justify-center rounded-full sm:mb-3 sm:size-9">
                    <Icon className="size-4" />
                </div>
                <p className="text-muted-foreground text-xs font-medium">
                    {label}
                </p>
                <p className="mt-1 text-sm font-semibold tracking-tight min-[390px]:text-base sm:text-xl">
                    {currency.format(value)}
                </p>
            </CardContent>
        </Card>
    );
}

function EarningReceipt({ earning }: { earning: Earning }) {
    return (
        <div className="rounded-xl border p-4">
            <div className="flex items-start justify-between gap-3 border-b pb-3">
                <div className="min-w-0">
                    <p className="truncate font-semibold">
                        {earning.order_number}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                        {earning.restaurant_name}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                        Delivered{' '}
                        {dateTime.format(new Date(earning.delivered_at))}
                    </p>
                </div>
                <div className="bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <ReceiptText className="size-5" />
                </div>
            </div>
            <div className="space-y-2 pt-3 text-sm">
                <BreakdownRow label="Base pay" value={earning.base_pay} />
                <BreakdownRow
                    label="Distance pay"
                    value={earning.distance_pay}
                />
                <BreakdownRow label="Waiting pay" value={earning.waiting_pay} />
                <BreakdownRow
                    label="Incentive pay"
                    value={earning.incentive_pay}
                />
                <BreakdownRow label="Tip" value={earning.tip_amount} />
                <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Total earned</span>
                    <span>{currency.format(earning.total_earned)}</span>
                </div>
            </div>
        </div>
    );
}

function BreakdownRow({ label, value }: { label: string; value: number }) {
    return (
        <div className="text-muted-foreground flex justify-between gap-3">
            <span>{label}</span>
            <span className={value > 0 ? 'text-foreground' : undefined}>
                {currency.format(value)}
            </span>
        </div>
    );
}

function StatusBadge({ status }: { status: 'pending' | 'paid' | 'confirmed' }) {
    return (
        <Badge
            variant="outline"
            className={cn(
                'shrink-0 capitalize',
                status === 'pending'
                    ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
            )}
        >
            {status}
        </Badge>
    );
}
