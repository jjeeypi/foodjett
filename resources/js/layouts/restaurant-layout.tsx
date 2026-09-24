import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Banknote,
    FileCheck2,
    History,
    LayoutDashboard,
    LogOut,
    Megaphone,
    PackageOpen,
    Power,
    Settings,
    ShoppingBag,
    Star,
    Store,
    Tags,
    WalletCards,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import AppLogo from '@/components/app-logo';
import { AppShell } from '@/components/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarTrigger,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn } from '@/lib/utils';
import { logout } from '@/routes';
import type { LucideIcon } from 'lucide-react';

type RestaurantLayoutProps = { children: ReactNode; title?: string };
type NavItem = {
    title: string;
    href: string;
    icon: LucideIcon;
    exact?: boolean;
};
type NavSection = { label: string; items: NavItem[] };

const navSections: NavSection[] = [
    {
        label: 'Overview',
        items: [
            {
                title: 'Dashboard',
                href: '/restaurant/dashboard',
                icon: LayoutDashboard,
                exact: true,
            },
        ],
    },
    {
        label: 'Orders',
        items: [
            {
                title: 'New / Active',
                href: '/restaurant/orders/active',
                icon: PackageOpen,
            },
            {
                title: 'History',
                href: '/restaurant/orders/history',
                icon: History,
            },
        ],
    },
    {
        label: 'Menu',
        items: [
            {
                title: 'Items',
                href: '/restaurant/menu/items',
                icon: ShoppingBag,
                exact: true,
            },
            {
                title: 'Categories',
                href: '/restaurant/menu/categories',
                icon: Tags,
            },
        ],
    },
    {
        label: 'Store settings',
        items: [
            {
                title: 'Profile & hours',
                href: '/restaurant/store/profile',
                icon: Settings,
            },
            {
                title: 'Documents',
                href: '/restaurant/store/documents',
                icon: FileCheck2,
            },
        ],
    },
    {
        label: 'Marketing',
        items: [
            {
                title: 'Promotions',
                href: '/restaurant/promotions',
                icon: Megaphone,
            },
        ],
    },
    {
        label: 'Earnings',
        items: [
            {
                title: 'Sales summary',
                href: '/restaurant/earnings/summary',
                icon: Banknote,
            },
            {
                title: 'Payouts',
                href: '/restaurant/earnings/payouts',
                icon: WalletCards,
            },
        ],
    },
    {
        label: 'Feedback',
        items: [{ title: 'Reviews', href: '/restaurant/reviews', icon: Star }],
    },
];

export default function RestaurantLayout({
    children,
    title = 'Restaurant',
}: RestaurantLayoutProps) {
    const page = usePage();
    const { auth, restaurantContext } = page.props;
    const { currentUrl } = useCurrentUrl();
    const resolvedTitle =
        typeof page.props.title === 'string' ? page.props.title : title;
    const [operatingStatus, setOperatingStatus] = useState(
        restaurantContext?.operating_status ?? 'closed',
    );
    const [updatingStatus, setUpdatingStatus] = useState(false);

    useEffect(() => {
        if (restaurantContext)
            setOperatingStatus(restaurantContext.operating_status);
    }, [restaurantContext]);

    const isActive = (item: NavItem) =>
        item.exact
            ? currentUrl === item.href
            : currentUrl === item.href ||
              currentUrl.startsWith(`${item.href}/`);

    const toggleOperatingStatus = () => {
        const previous = operatingStatus;
        const next = operatingStatus === 'open' ? 'closed' : 'open';
        setOperatingStatus(next);
        setUpdatingStatus(true);
        router.patch(
            '/restaurant/operating-status',
            { operating_status: next },
            {
                preserveScroll: true,
                preserveState: true,
                only: ['restaurantContext'],
                onError: () => setOperatingStatus(previous),
                onFinish: () => setUpdatingStatus(false),
            },
        );
    };

    return (
        <AppShell>
            <Head title={resolvedTitle} />
            <Sidebar collapsible="offcanvas">
                <SidebarHeader className="border-sidebar-border border-b p-3">
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton size="lg" asChild>
                                <Link href="/restaurant/dashboard" prefetch>
                                    <AppLogo />
                                    <span className="text-muted-foreground text-xs">
                                        Restaurant
                                    </span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarHeader>
                <SidebarContent className="py-2">
                    {navSections.map((section) => (
                        <SidebarGroup key={section.label} className="py-1">
                            <SidebarGroupLabel>
                                {section.label}
                            </SidebarGroupLabel>
                            <SidebarMenu>
                                {section.items.map((item) => (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={isActive(item)}
                                            tooltip={item.title}
                                        >
                                            <Link href={item.href} prefetch>
                                                <item.icon />
                                                <span>{item.title}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroup>
                    ))}
                </SidebarContent>
                <SidebarFooter className="border-sidebar-border border-t p-3">
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                            {auth.user.name}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                            {auth.user.email}
                        </p>
                    </div>
                </SidebarFooter>
            </Sidebar>

            <SidebarInset className="min-w-0">
                <header className="border-border bg-background sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b px-4 py-2 md:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                        <SidebarTrigger />
                        {restaurantContext?.logo_url ? (
                            <img
                                src={restaurantContext.logo_url}
                                alt=""
                                className="hidden size-9 rounded-lg border object-cover sm:block"
                            />
                        ) : (
                            <div className="bg-muted hidden size-9 items-center justify-center rounded-lg sm:flex">
                                <Store className="size-4" />
                            </div>
                        )}
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                                {restaurantContext?.name ?? 'Restaurant'}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                                {resolvedTitle}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant={
                                operatingStatus === 'open'
                                    ? 'default'
                                    : 'outline'
                            }
                            onClick={toggleOperatingStatus}
                            disabled={updatingStatus || !restaurantContext}
                            className={cn(
                                operatingStatus === 'open' &&
                                    'bg-emerald-600 hover:bg-emerald-600/90 dark:bg-emerald-700',
                            )}
                        >
                            <Power />
                            <span className="hidden sm:inline">
                                {updatingStatus
                                    ? 'Updating...'
                                    : operatingStatus === 'open'
                                      ? 'Open'
                                      : 'Closed'}
                            </span>
                        </Button>
                        <Badge
                            variant="outline"
                            className="hidden capitalize md:inline-flex"
                        >
                            {operatingStatus.replace('_', ' ')}
                        </Badge>
                        <Button variant="ghost" size="sm" asChild>
                            <Link
                                href={logout()}
                                method="post"
                                as="button"
                                onClick={() => router.flushAll()}
                            >
                                <LogOut />
                                <span className="hidden sm:inline">Logout</span>
                            </Link>
                        </Button>
                    </div>
                </header>
                <main className="flex min-h-0 flex-1 flex-col">{children}</main>
            </SidebarInset>
        </AppShell>
    );
}
