import { Head, router } from '@inertiajs/react';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { useState } from 'react';
import CreateAdminDialog from '@/components/admin/create-admin-dialog';
import DataTable, {
    type DataTableColumn,
    type PaginatedData,
} from '@/components/admin/data-table';
import SettingsNav from '@/components/admin/settings-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Administrator = {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    status: 'active' | 'suspended' | 'banned';
    last_login_at: string | null;
    admin: { id: number; user_id: number };
};

export default function AdminAccounts({
    admins,
    currentAdminId,
}: {
    admins: PaginatedData<Administrator>;
    currentAdminId: number;
}) {
    const [busyId, setBusyId] = useState<number | null>(null);

    const columns: DataTableColumn<Administrator>[] = [
        {
            key: 'name',
            label: 'Administrator',
            render: (admin) => (
                <div>
                    <p className="font-medium">{admin.name}</p>
                    <p className="text-muted-foreground text-xs">
                        {admin.email}
                    </p>
                </div>
            ),
        },
        { key: 'phone', label: 'Phone', render: (admin) => admin.phone || '—' },
        {
            key: 'status',
            label: 'Status',
            render: (admin) => (
                <Badge
                    variant="outline"
                    className={
                        admin.status === 'active'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
                    }
                >
                    {admin.status}
                </Badge>
            ),
        },
        {
            key: 'last-login',
            label: 'Last login',
            render: (admin) =>
                admin.last_login_at
                    ? new Date(admin.last_login_at).toLocaleString()
                    : 'Never',
        },
        {
            key: 'actions',
            label: '',
            className: 'text-right',
            render: (admin) =>
                admin.id === currentAdminId ? (
                    <span className="text-muted-foreground text-xs">
                        Current account
                    </span>
                ) : (
                    <Button
                        size="sm"
                        variant={
                            admin.status === 'active'
                                ? 'destructive'
                                : 'outline'
                        }
                        disabled={busyId === admin.id}
                        onClick={() => {
                            setBusyId(admin.id);
                            router.patch(
                                `/admin/settings/admins/${admin.id}/status`,
                                {
                                    status:
                                        admin.status === 'active'
                                            ? 'suspended'
                                            : 'active',
                                },
                                {
                                    preserveScroll: true,
                                    onFinish: () => setBusyId(null),
                                },
                            );
                        }}
                    >
                        {admin.status === 'active' ? (
                            <ShieldOff />
                        ) : (
                            <ShieldCheck />
                        )}
                        {admin.status === 'active' ? 'Suspend' : 'Reactivate'}
                    </Button>
                ),
        },
    ];

    return (
        <>
            <Head title="Admin accounts" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <SettingsNav />
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight">
                            Admin accounts
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            Create, suspend, and reactivate back-office access.
                        </p>
                    </div>
                    <CreateAdminDialog />
                </div>

                <DataTable
                    columns={columns}
                    paginated={admins}
                    rowKey={(admin) => admin.id}
                    emptyMessage="No administrator accounts found."
                />
            </div>
        </>
    );
}

AdminAccounts.layout = { title: 'Admin accounts' };
