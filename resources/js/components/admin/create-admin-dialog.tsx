import { useForm } from '@inertiajs/react';
import { UserPlus } from 'lucide-react';
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

export default function CreateAdminDialog() {
    const [open, setOpen] = useState(false);
    const nameId = useId();
    const emailId = useId();
    const phoneId = useId();
    const passwordId = useId();
    const confirmationId = useId();
    const form = useForm({
        name: '',
        email: '',
        phone: '',
        password: '',
        password_confirmation: '',
    });

    const close = () => {
        form.reset();
        form.clearErrors();
        setOpen(false);
    };

    const submit = () => {
        form.post('/admin/settings/admins', {
            preserveScroll: true,
            onSuccess: close,
        });
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => (next ? setOpen(true) : close())}
        >
            <DialogTrigger asChild>
                <Button>
                    <UserPlus /> Add administrator
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create administrator</DialogTitle>
                    <DialogDescription>
                        The new account is active and email-verified
                        immediately. Share the password through a secure
                        channel.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor={nameId}>Name</Label>
                        <Input
                            id={nameId}
                            value={form.data.name}
                            onChange={(event) =>
                                form.setData('name', event.target.value)
                            }
                        />
                        <InputError message={form.errors.name} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor={emailId}>Email</Label>
                        <Input
                            id={emailId}
                            type="email"
                            value={form.data.email}
                            onChange={(event) =>
                                form.setData('email', event.target.value)
                            }
                        />
                        <InputError message={form.errors.email} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor={phoneId}>Phone (optional)</Label>
                        <Input
                            id={phoneId}
                            value={form.data.phone}
                            onChange={(event) =>
                                form.setData('phone', event.target.value)
                            }
                        />
                        <InputError message={form.errors.phone} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={passwordId}>Password</Label>
                        <Input
                            id={passwordId}
                            type="password"
                            value={form.data.password}
                            onChange={(event) =>
                                form.setData('password', event.target.value)
                            }
                        />
                        <InputError message={form.errors.password} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={confirmationId}>Confirm password</Label>
                        <Input
                            id={confirmationId}
                            type="password"
                            value={form.data.password_confirmation}
                            onChange={(event) =>
                                form.setData(
                                    'password_confirmation',
                                    event.target.value,
                                )
                            }
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={close}>
                        Cancel
                    </Button>
                    <Button onClick={submit} disabled={form.processing}>
                        {form.processing
                            ? 'Creating...'
                            : 'Create administrator'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
