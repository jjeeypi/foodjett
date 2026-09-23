import { Link } from '@inertiajs/react';
import { MapPinned, Settings, ShieldCheck } from 'lucide-react';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn } from '@/lib/utils';

const items = [
    {
        label: 'Platform settings',
        href: '/admin/settings/platform',
        icon: Settings,
    },
    {
        label: 'Delivery zones',
        href: '/admin/settings/delivery-zones',
        icon: MapPinned,
    },
    {
        label: 'Admin accounts',
        href: '/admin/settings/admins',
        icon: ShieldCheck,
    },
];

export default function SettingsNav() {
    const { currentUrl } = useCurrentUrl();

    return (
        <nav
            aria-label="Settings sections"
            className="bg-muted/20 flex gap-1 overflow-x-auto rounded-lg border p-1"
        >
            {items.map((item) => {
                const active =
                    currentUrl === item.href ||
                    currentUrl.startsWith(`${item.href}/`);

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        preserveState
                        className={cn(
                            'flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                            active
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
                        )}
                    >
                        <item.icon className="size-4" />
                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
}
