import { Head, Link, useForm } from '@inertiajs/react';
import { CircleHelp, LoaderCircle, Send } from 'lucide-react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
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

type TicketStatus = 'open' | 'in_progress' | 'closed';

type Ticket = {
    id: number;
    subject: string;
    status: TicketStatus;
    created_at: string;
    show_url: string;
};

type SelectedTicket = Ticket & { message: string };

const statusLabels: Record<TicketStatus, string> = {
    open: 'Open',
    in_progress: 'In progress',
    closed: 'Closed',
};

const date = new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

export default function Support({
    tickets,
    selectedTicket,
}: {
    tickets: Ticket[];
    selectedTicket: SelectedTicket | null;
}) {
    const form = useForm({ subject: '', message: '' });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post('/customer/account/support', {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };

    return (
        <>
            <Head title="Contact support" />
            <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                        Contact support
                    </h1>
                    <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
                        Use this page for general account or platform help. For
                        a missing item, wrong item, or delivery issue, use
                        “Report a problem” on that order’s detail page instead.
                    </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>New support ticket</CardTitle>
                                <CardDescription>
                                    Describe the issue and an administrator will
                                    review it.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={submit} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="support-subject">
                                            Subject
                                        </Label>
                                        <Input
                                            id="support-subject"
                                            value={form.data.subject}
                                            onChange={(event) =>
                                                form.setData(
                                                    'subject',
                                                    event.target.value,
                                                )
                                            }
                                            maxLength={150}
                                            required
                                        />
                                        <InputError
                                            message={form.errors.subject}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="support-message">
                                            Message
                                        </Label>
                                        <textarea
                                            id="support-message"
                                            value={form.data.message}
                                            onChange={(event) =>
                                                form.setData(
                                                    'message',
                                                    event.target.value,
                                                )
                                            }
                                            className="border-input bg-background min-h-36 w-full rounded-md border px-3 py-2 text-sm"
                                            maxLength={3000}
                                            required
                                        />
                                        <InputError
                                            message={form.errors.message}
                                        />
                                    </div>
                                    <Button disabled={form.processing}>
                                        {form.processing ? (
                                            <LoaderCircle className="animate-spin" />
                                        ) : (
                                            <Send />
                                        )}
                                        Submit ticket
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        {selectedTicket && (
                            <Card>
                                <CardHeader>
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <CardTitle>
                                                {selectedTicket.subject}
                                            </CardTitle>
                                            <CardDescription>
                                                Submitted{' '}
                                                {date.format(
                                                    new Date(
                                                        selectedTicket.created_at,
                                                    ),
                                                )}
                                            </CardDescription>
                                        </div>
                                        <SupportStatus
                                            status={selectedTicket.status}
                                        />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm whitespace-pre-wrap">
                                        {selectedTicket.message}
                                    </p>
                                    {/* The current schema stores one message only; threaded admin replies are intentionally out of scope. */}
                                    <p className="text-muted-foreground mt-6 border-t pt-4 text-xs">
                                        This ticket currently shows status only.
                                        Support replies require a future ticket
                                        replies table.
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    <Card className="h-fit">
                        <CardHeader>
                            <CardTitle>Your tickets</CardTitle>
                            <CardDescription>
                                Select a ticket to read its details.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {tickets.length === 0 && (
                                <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center text-sm">
                                    <CircleHelp className="size-8" />
                                    No support tickets yet.
                                </div>
                            )}
                            {tickets.map((ticket) => (
                                <Link
                                    key={ticket.id}
                                    href={ticket.show_url}
                                    preserveScroll
                                    className={cn(
                                        'hover:bg-muted/50 block rounded-lg border p-3 transition-colors',
                                        selectedTicket?.id === ticket.id &&
                                            'border-primary bg-primary/5',
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="line-clamp-2 text-sm font-medium">
                                            {ticket.subject}
                                        </p>
                                        <SupportStatus status={ticket.status} />
                                    </div>
                                    <p className="text-muted-foreground mt-2 text-xs">
                                        {date.format(
                                            new Date(ticket.created_at),
                                        )}
                                    </p>
                                </Link>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}

function SupportStatus({ status }: { status: TicketStatus }) {
    return (
        <Badge
            variant="outline"
            className={cn(
                status === 'open' &&
                    'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
                status === 'in_progress' &&
                    'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
                status === 'closed' && 'text-muted-foreground bg-muted/50',
            )}
        >
            {statusLabels[status]}
        </Badge>
    );
}
