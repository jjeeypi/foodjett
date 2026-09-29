import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { LoaderCircle, Upload } from 'lucide-react';
import { useMemo, useRef, type FormEvent } from 'react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { send } from '@/routes/verification';

export default function CustomerProfile({
    mustVerifyEmail,
    status,
    passwordRules,
}: {
    mustVerifyEmail: boolean;
    status?: string;
    passwordRules: string;
}) {
    const { auth } = usePage().props;
    const fileInput = useRef<HTMLInputElement>(null);
    const profile = useForm<{
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
            profile.data.avatar
                ? URL.createObjectURL(profile.data.avatar)
                : auth.user.avatar,
        [auth.user.avatar, profile.data.avatar],
    );

    const saveProfile = (event: FormEvent) => {
        event.preventDefault();
        profile.transform((data) => ({ ...data, _method: 'patch' }));
        profile.post('/customer/account/profile', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                profile.setData('avatar', null);
                if (fileInput.current) fileInput.current.value = '';
            },
        });
    };

    return (
        <>
            <Head title="Edit profile" />
            <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 md:px-6 md:py-8">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                        Account profile
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Manage your personal details and account security.
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Profile information</CardTitle>
                        <CardDescription>
                            Email changes require verification again. Avatar
                            uploads accept JPG, PNG, or WebP up to 10 MB.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={saveProfile} className="space-y-5">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                <Avatar className="size-20">
                                    {preview && (
                                        <AvatarImage
                                            src={preview}
                                            alt={profile.data.name}
                                        />
                                    )}
                                    <AvatarFallback>
                                        {profile.data.name
                                            .split(' ')
                                            .map((part) => part[0])
                                            .join('')
                                            .slice(0, 2)
                                            .toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <Input
                                        ref={fileInput}
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={(event) =>
                                            profile.setData(
                                                'avatar',
                                                event.target.files?.[0] ?? null,
                                            )
                                        }
                                        className="max-w-sm"
                                    />
                                    <InputError
                                        message={profile.errors.avatar}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Name</Label>
                                    <Input
                                        id="name"
                                        value={profile.data.name}
                                        onChange={(event) =>
                                            profile.setData(
                                                'name',
                                                event.target.value,
                                            )
                                        }
                                        required
                                    />
                                    <InputError message={profile.errors.name} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone</Label>
                                    <Input
                                        id="phone"
                                        value={profile.data.phone}
                                        onChange={(event) =>
                                            profile.setData(
                                                'phone',
                                                event.target.value,
                                            )
                                        }
                                        placeholder="09XX XXX XXXX"
                                    />
                                    <InputError
                                        message={profile.errors.phone}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={profile.data.email}
                                    onChange={(event) =>
                                        profile.setData(
                                            'email',
                                            event.target.value,
                                        )
                                    }
                                    required
                                />
                                <InputError message={profile.errors.email} />
                            </div>

                            {mustVerifyEmail &&
                                auth.user.email_verified_at === null && (
                                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                                        Your email is unverified.{' '}
                                        <Link
                                            href={send()}
                                            as="button"
                                            className="font-medium underline"
                                        >
                                            Resend verification email
                                        </Link>
                                        {status ===
                                            'verification-link-sent' && (
                                            <p className="mt-1 font-medium">
                                                A new verification link was
                                                sent.
                                            </p>
                                        )}
                                    </div>
                                )}

                            <Button disabled={profile.processing}>
                                {profile.processing ? (
                                    <LoaderCircle className="animate-spin" />
                                ) : (
                                    <Upload />
                                )}
                                Save profile
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <PasswordCard passwordRules={passwordRules} />
                <AnonymizeAccount />
            </div>
        </>
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
                    Reuses the existing Breeze password validation flow.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={submit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="current-password">
                            Current password
                        </Label>
                        <PasswordInput
                            id="current-password"
                            value={form.data.current_password}
                            onChange={(event) =>
                                form.setData(
                                    'current_password',
                                    event.target.value,
                                )
                            }
                            autoComplete="current-password"
                        />
                        <InputError message={form.errors.current_password} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="new-password">New password</Label>
                            <PasswordInput
                                id="new-password"
                                value={form.data.password}
                                onChange={(event) =>
                                    form.setData('password', event.target.value)
                                }
                                passwordrules={passwordRules}
                                autoComplete="new-password"
                            />
                            <InputError message={form.errors.password} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">
                                Confirm password
                            </Label>
                            <PasswordInput
                                id="confirm-password"
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
                            <InputError
                                message={form.errors.password_confirmation}
                            />
                        </div>
                    </div>
                    <Button disabled={form.processing}>Update password</Button>
                </form>
            </CardContent>
        </Card>
    );
}

function AnonymizeAccount() {
    const form = useForm({ password: '' });

    return (
        <Card className="border-destructive/40">
            <CardHeader>
                <CardTitle>Delete account</CardTitle>
                <CardDescription>
                    Your login and personal details will be permanently disabled
                    and anonymized. Order and review history remains for
                    financial and operational records.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="destructive">Delete account</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Anonymize this account?</DialogTitle>
                            <DialogDescription>
                                This cannot be undone. Enter your current
                                password to continue.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2">
                            <Label htmlFor="delete-password">Password</Label>
                            <PasswordInput
                                id="delete-password"
                                value={form.data.password}
                                onChange={(event) =>
                                    form.setData('password', event.target.value)
                                }
                            />
                            <InputError message={form.errors.password} />
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button
                                variant="destructive"
                                disabled={form.processing}
                                onClick={() =>
                                    form.delete('/customer/account/profile', {
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
