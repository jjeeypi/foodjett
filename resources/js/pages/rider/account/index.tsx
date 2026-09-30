import { Head, Link, useForm, usePage } from '@inertiajs/react';
import {
    Bike,
    CreditCard,
    ExternalLink,
    FileCheck2,
    LoaderCircle,
    ShieldAlert,
    Trash2,
    Upload,
    UserRound,
} from 'lucide-react';
import { useMemo, useRef, type FormEvent } from 'react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { send } from '@/routes/verification';

type DocumentStatus = 'pending' | 'verified' | 'rejected';

type RiderDocument = {
    id: number | null;
    type: string;
    label: string;
    status: DocumentStatus | null;
    rejection_reason: string | null;
    file_url: string | null;
};

type Rider = {
    vehicle_type: 'motorcycle' | 'bicycle' | 'car';
    plate_number: string | null;
    approval_status: 'pending' | 'approved' | 'rejected';
    payout_method: 'bank' | 'ewallet' | null;
    payout_account_details: {
        account_name: string;
        provider: string;
        account_number: string;
    };
};

type Props = {
    mustVerifyEmail: boolean;
    status?: string;
    passwordRules: string;
    rider: Rider;
    documents: RiderDocument[];
};

export default function RiderAccount({
    mustVerifyEmail,
    status,
    passwordRules,
    rider,
    documents,
}: Props) {
    return (
        <>
            <Head title="Rider account" />
            <div className="space-y-5 px-4 py-6 sm:px-6">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Account
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Manage your rider profile, documents, and payout
                        details.
                    </p>
                </div>

                <ProfileCard
                    mustVerifyEmail={mustVerifyEmail}
                    status={status}
                />
                <PasswordCard passwordRules={passwordRules} />
                <VehicleCard rider={rider} />
                <DocumentsCard documents={documents} />
                <PayoutCard rider={rider} />
                <DangerZone />
            </div>
        </>
    );
}

function ProfileCard({
    mustVerifyEmail,
    status,
}: Pick<Props, 'mustVerifyEmail' | 'status'>) {
    const { auth } = usePage().props;
    const fileInput = useRef<HTMLInputElement>(null);
    const form = useForm<{
        name: string;
        email: string;
        phone: string;
        avatar: File | null;
    }>({
        name: auth.user.name,
        email: auth.user.email,
        phone: auth.user.phone ?? '',
        avatar: null,
    });
    const preview = useMemo(
        () =>
            form.data.avatar
                ? URL.createObjectURL(form.data.avatar)
                : auth.user.avatar,
        [auth.user.avatar, form.data.avatar],
    );

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({ ...data, _method: 'patch' }));
        form.post('/rider/account/profile', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                form.setData('avatar', null);
                if (fileInput.current) fileInput.current.value = '';
            },
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <UserRound className="size-5" /> Profile
                </CardTitle>
                <CardDescription>
                    JPG, PNG, or WebP avatars are limited to 10 MB. Changing
                    your email requires verification again.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={submit} className="space-y-4">
                    <div className="flex items-center gap-4">
                        <Avatar className="size-20 shrink-0">
                            {preview && (
                                <AvatarImage
                                    src={preview}
                                    alt={form.data.name}
                                />
                            )}
                            <AvatarFallback>
                                {initials(form.data.name)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1 space-y-1.5">
                            <Label htmlFor="rider-avatar">Profile photo</Label>
                            <Input
                                ref={fileInput}
                                id="rider-avatar"
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={(event) =>
                                    form.setData(
                                        'avatar',
                                        event.target.files?.[0] ?? null,
                                    )
                                }
                            />
                            <InputError message={form.errors.avatar} />
                        </div>
                    </div>

                    <Field label="Name" error={form.errors.name}>
                        <Input
                            value={form.data.name}
                            onChange={(event) =>
                                form.setData('name', event.target.value)
                            }
                            autoComplete="name"
                            required
                        />
                    </Field>
                    <Field label="Phone" error={form.errors.phone}>
                        <Input
                            type="tel"
                            value={form.data.phone}
                            onChange={(event) =>
                                form.setData('phone', event.target.value)
                            }
                            autoComplete="tel"
                            placeholder="09XX XXX XXXX"
                        />
                    </Field>
                    <Field label="Email address" error={form.errors.email}>
                        <Input
                            type="email"
                            value={form.data.email}
                            onChange={(event) =>
                                form.setData('email', event.target.value)
                            }
                            autoComplete="email"
                            required
                        />
                    </Field>

                    {mustVerifyEmail &&
                        auth.user.email_verified_at === null && (
                            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                                Your email is unverified.{' '}
                                <Link
                                    href={send()}
                                    as="button"
                                    className="font-medium underline"
                                >
                                    Resend verification email
                                </Link>
                                {status === 'verification-link-sent' && (
                                    <p className="mt-1 font-medium">
                                        A new verification link was sent.
                                    </p>
                                )}
                            </div>
                        )}

                    <Button className="w-full" disabled={form.processing}>
                        {form.processing ? (
                            <LoaderCircle className="animate-spin" />
                        ) : (
                            <Upload />
                        )}
                        Save profile
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

function PasswordCard({ passwordRules }: { passwordRules: string }) {
    const form = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.put('/settings/password', {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Change password</CardTitle>
                <CardDescription>
                    Enter your current password before choosing a new one.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={submit} className="space-y-4">
                    <Field
                        label="Current password"
                        error={form.errors.current_password}
                    >
                        <PasswordInput
                            value={form.data.current_password}
                            onChange={(event) =>
                                form.setData(
                                    'current_password',
                                    event.target.value,
                                )
                            }
                            autoComplete="current-password"
                        />
                    </Field>
                    <Field label="New password" error={form.errors.password}>
                        <PasswordInput
                            value={form.data.password}
                            onChange={(event) =>
                                form.setData('password', event.target.value)
                            }
                            passwordrules={passwordRules}
                            autoComplete="new-password"
                        />
                    </Field>
                    <Field
                        label="Confirm new password"
                        error={form.errors.password_confirmation}
                    >
                        <PasswordInput
                            value={form.data.password_confirmation}
                            onChange={(event) =>
                                form.setData(
                                    'password_confirmation',
                                    event.target.value,
                                )
                            }
                            passwordrules={passwordRules}
                            autoComplete="new-password"
                        />
                    </Field>
                    <Button className="w-full" disabled={form.processing}>
                        Update password
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

function VehicleCard({ rider }: { rider: Rider }) {
    const form = useForm({
        vehicle_type: rider.vehicle_type,
        plate_number: rider.plate_number ?? '',
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Bike className="size-5" /> Vehicle
                </CardTitle>
                <CardDescription>
                    Updating this does not reset your rider approval.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.patch('/rider/account/vehicle', {
                            preserveScroll: true,
                        });
                    }}
                    className="space-y-4"
                >
                    <Field
                        label="Vehicle type"
                        error={form.errors.vehicle_type}
                    >
                        <Select
                            value={form.data.vehicle_type}
                            onValueChange={(value) =>
                                form.setData(
                                    'vehicle_type',
                                    value as Rider['vehicle_type'],
                                )
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="motorcycle">
                                    Motorcycle
                                </SelectItem>
                                <SelectItem value="bicycle">Bicycle</SelectItem>
                                <SelectItem value="car">Car</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field
                        label="Plate number"
                        error={form.errors.plate_number}
                    >
                        <Input
                            value={form.data.plate_number}
                            onChange={(event) =>
                                form.setData(
                                    'plate_number',
                                    event.target.value.toUpperCase(),
                                )
                            }
                            placeholder="Optional for bicycles"
                        />
                    </Field>
                    <Button className="w-full" disabled={form.processing}>
                        Save vehicle
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

function DocumentsCard({ documents }: { documents: RiderDocument[] }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileCheck2 className="size-5" /> Documents
                </CardTitle>
                <CardDescription>
                    Replacing any document sends only that document back for
                    admin review; your rider approval remains unchanged.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {documents.map((document) => (
                    <DocumentUpload key={document.type} document={document} />
                ))}
            </CardContent>
        </Card>
    );
}

function DocumentUpload({ document }: { document: RiderDocument }) {
    const input = useRef<HTMLInputElement>(null);
    const form = useForm<{ document: File | null }>({ document: null });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(`/rider/account/documents/${document.type}`, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                if (input.current) input.current.value = '';
            },
        });
    };

    return (
        <form onSubmit={submit} className="space-y-3 rounded-xl border p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-medium">{document.label}</p>
                    {document.file_url && (
                        <a
                            href={document.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary mt-1 inline-flex items-center gap-1 text-xs font-medium"
                        >
                            View current file{' '}
                            <ExternalLink className="size-3" />
                        </a>
                    )}
                </div>
                <DocumentBadge status={document.status} />
            </div>

            {document.rejection_reason && (
                <div className="rounded-lg bg-red-50 p-3 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-200">
                    <span className="font-semibold">Rejected:</span>{' '}
                    {document.rejection_reason}
                </div>
            )}

            <div className="space-y-1.5">
                <Label htmlFor={`document-${document.type}`}>
                    {document.id ? 'Replace document' : 'Upload document'}
                </Label>
                <Input
                    ref={input}
                    id={`document-${document.type}`}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(event) =>
                        form.setData(
                            'document',
                            event.target.files?.[0] ?? null,
                        )
                    }
                />
                <p className="text-muted-foreground text-xs">
                    JPG, PNG, WebP, or PDF up to 10 MB.
                </p>
                <InputError message={form.errors.document} />
            </div>
            {document.status === 'verified' && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                    Replacing this verified file resets its status to pending.
                </p>
            )}
            <Button
                type="submit"
                variant="outline"
                className="w-full"
                disabled={form.processing || form.data.document === null}
            >
                {form.processing ? (
                    <LoaderCircle className="animate-spin" />
                ) : (
                    <Upload />
                )}
                {document.id ? 'Submit replacement' : 'Upload document'}
            </Button>
        </form>
    );
}

function PayoutCard({ rider }: { rider: Rider }) {
    const form = useForm({
        payout_method: rider.payout_method ?? 'ewallet',
        account_name: rider.payout_account_details.account_name,
        provider: rider.payout_account_details.provider,
        account_number: rider.payout_account_details.account_number,
    });
    const providerLabel =
        form.data.payout_method === 'bank' ? 'Bank name' : 'E-wallet provider';

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CreditCard className="size-5" /> Payout method
                </CardTitle>
                <CardDescription>
                    Account details are encrypted before they are stored.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.patch('/rider/account/payout', {
                            preserveScroll: true,
                        });
                    }}
                    className="space-y-4"
                >
                    <Field
                        label="Payout method"
                        error={form.errors.payout_method}
                    >
                        <Select
                            value={form.data.payout_method}
                            onValueChange={(value) =>
                                form.setData(
                                    'payout_method',
                                    value as 'bank' | 'ewallet',
                                )
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="bank">
                                    Bank account
                                </SelectItem>
                                <SelectItem value="ewallet">
                                    E-wallet
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field
                        label="Account name"
                        error={form.errors.account_name}
                    >
                        <Input
                            value={form.data.account_name}
                            onChange={(event) =>
                                form.setData('account_name', event.target.value)
                            }
                            autoComplete="name"
                        />
                    </Field>
                    <Field label={providerLabel} error={form.errors.provider}>
                        <Input
                            value={form.data.provider}
                            onChange={(event) =>
                                form.setData('provider', event.target.value)
                            }
                            placeholder={
                                form.data.payout_method === 'bank'
                                    ? 'Bank name'
                                    : 'GCash, Maya, etc.'
                            }
                        />
                    </Field>
                    <Field
                        label="Account number"
                        error={form.errors.account_number}
                    >
                        <Input
                            value={form.data.account_number}
                            onChange={(event) =>
                                form.setData(
                                    'account_number',
                                    event.target.value,
                                )
                            }
                            inputMode="numeric"
                            autoComplete="off"
                        />
                    </Field>
                    <Button className="w-full" disabled={form.processing}>
                        Save payout method
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

function DangerZone() {
    const form = useForm({ password: '' });

    return (
        <Card className="border-destructive/40">
            <CardHeader>
                <CardTitle className="text-destructive flex items-center gap-2">
                    <ShieldAlert className="size-5" /> Danger zone
                </CardTitle>
                <CardDescription>
                    Your login and personal files will be removed. Financial and
                    delivery records remain anonymized for accounting history.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="destructive" className="w-full">
                            <Trash2 /> Delete account
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Anonymize rider account?</DialogTitle>
                            <DialogDescription>
                                This cannot be undone. Enter your current
                                password to permanently disable the account.
                            </DialogDescription>
                        </DialogHeader>
                        <Field
                            label="Current password"
                            error={form.errors.password}
                        >
                            <PasswordInput
                                value={form.data.password}
                                onChange={(event) =>
                                    form.setData('password', event.target.value)
                                }
                                autoComplete="current-password"
                            />
                        </Field>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button
                                variant="destructive"
                                disabled={form.processing}
                                onClick={() =>
                                    form.delete('/rider/account', {
                                        preserveScroll: true,
                                    })
                                }
                            >
                                Anonymize account
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}

function Field({
    label,
    error,
    children,
}: {
    label: string;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <Label>{label}</Label>
            {children}
            <InputError message={error} />
        </div>
    );
}

function DocumentBadge({ status }: { status: DocumentStatus | null }) {
    return (
        <Badge
            variant="outline"
            className={cn(
                'shrink-0 capitalize',
                status === 'pending' &&
                    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
                status === 'verified' &&
                    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
                status === 'rejected' &&
                    'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300',
            )}
        >
            {status ?? 'Not uploaded'}
        </Badge>
    );
}

function initials(name: string): string {
    return name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}
