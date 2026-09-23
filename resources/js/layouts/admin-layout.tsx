import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Banknote,
    Bike,
    CreditCard,
    HandCoins,
    LayoutDashboard,
    LogOut,
    MapPinned,
    ScrollText,
    Settings,
    ShieldCheck,
    ShoppingBag,
    Star,
    Store,
    Tags,
    TicketPercent,
    Users,
    WalletCards,
} from 'lucide-react';
import type { ReactNode } from 'react';
import AppLogo from '@/components/app-logo';
import { AppShell } from '@/components/app-shell';
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
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarTrigger,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { logout } from '@/routes';
import type { LucideIcon } from 'lucide-react';

type AdminLayoutProps = {
    children: ReactNode;
    title?: string;
};

type AdminNavItem = {
    title: string;
    href: string;
    icon: LucideIcon;
    exact?: boolean;
    pendingCount?: 'restaurants' | 'riders';
};

type AdminNavSection = {
    label: string;
    items: AdminNavItem[];
};

const navSections: AdminNavSection[] = [
    {
        label: 'Overview',
        items: [
            {
                title: 'Dashboard',
                href: '/admin/dashboard',
                icon: LayoutDashboard,
                exact: true,
            },
        ],
    },
    {
        label: 'Restaurants',
        items: [
            {
                title: 'All restaurants',
                href: '/admin/restaurants',
                icon: Store,
                exact: true,
            },
            {
                title: 'Pending approvals',
                href: '/admin/restaurants/pending',
                icon: ShieldCheck,
                pendingCount: 'restaurants',
            },
        ],
    },
    {
        label: 'Riders',
        items: [
            {
                title: 'All riders',
                href: '/admin/riders',
                icon: Bike,
                exact: true,
            },
            {
                title: 'Pending approvals',
                href: '/admin/riders/pending',
                icon: ShieldCheck,
                pendingCount: 'riders',
            },
        ],
    },
    {
        label: 'Customers',
        items: [{ title: 'Customers', href: '/admin/customers', icon: Users }],
    },
    {
        label: 'Orders',
        items: [
            {
                title: 'All orders',
                href: '/admin/orders',
                icon: ShoppingBag,
                exact: true,
            },
            {
                title: 'Unassigned',
                href: '/admin/orders/unassigned',
                icon: Bike,
            },
            {
                title: 'Reports',
                href: '/admin/orders/reports',
                icon: ScrollText,
            },
        ],
    },
    {
        label: 'Catalog',
        items: [
            { title: 'Categories', href: '/admin/categories', icon: Tags },
            {
                title: 'Promotions',
                href: '/admin/promotions',
                icon: TicketPercent,
            },
        ],
    },
    {
        label: 'Finance',
        items: [
            {
                title: 'Transactions',
                href: '/admin/transactions',
                icon: CreditCard,
            },
            {
                title: 'Restaurant payouts',
                href: '/admin/payouts/restaurants',
                icon: WalletCards,
            },
            {
                title: 'Rider payouts',
                href: '/admin/payouts/riders',
                icon: HandCoins,
            },
            {
                title: 'Cash remittances',
                href: '/admin/remittances',
                icon: Banknote,
            },
        ],
    },
    {
        label: 'Quality',
        items: [{ title: 'Reviews', href: '/admin/reviews', icon: Star }],
    },
    {
        label: 'Settings',
        items: [
            {
                title: 'Platform',
                href: '/admin/settings/platform',
                icon: Settings,
            },
            {
                title: 'Delivery zones',
                href: '/admin/settings/delivery-zones',
                icon: MapPinned,
            },
            {
                title: 'Admins',
                href: '/admin/settings/admins',
                icon: ShieldCheck,
            },
        ],
    },
    {
        label: 'System',
        items: [
            {
                title: 'Audit logs',
                href: '/admin/audit-logs',
                icon: ScrollText,
            },
        ],
    },
];

export default function AdminLayout({
    children,
    title = 'Admin',
}: AdminLayoutProps) {
    const page = usePage();
    const { auth } = page.props;
    const pendingApprovals = page.props.adminPendingApprovals;
    const { currentUrl } = useCurrentUrl();
    const resolvedTitle =
        typeof page.props.title === 'string' ? page.props.title : title;

    const isActive = (item: AdminNavItem) =>
        item.exact
            ? currentUrl === item.href
            : currentUrl === item.href ||
              currentUrl.startsWith(`${item.href}/`);

    const handleLogout = () => {
        router.flushAll();
    };

    return (
        <AppShell>
            <Head title={resolvedTitle} />
            <Sidebar collapsible="offcanvas">
                <SidebarHeader className="border-sidebar-border border-b p-3">
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton size="lg" asChild>
                                <Link href="/admin/dashboard" prefetch>
                                    <AppLogo />
                                    <span className="text-muted-foreground text-xs">
                                        Admin
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
                                        {item.pendingCount &&
                                            pendingApprovals &&
                                            pendingApprovals[
                                                item.pendingCount
                                            ] > 0 && (
                                                <SidebarMenuBadge>
                                                    {
                                                        pendingApprovals[
                                                            item.pendingCount
                                                        ]
                                                    }
                                                </SidebarMenuBadge>
                                            )}
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
                <header className="border-border bg-background sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b px-4 md:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                        <SidebarTrigger />
                        <div className="min-w-0">
                            <p className="text-muted-foreground text-xs">
                                Admin panel
                            </p>
                            <h1 className="truncate text-sm font-semibold">
                                {resolvedTitle}
                            </h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="hidden text-sm font-medium sm:inline">
                            {auth.user.name}
                        </span>
                        <Button variant="ghost" size="sm" asChild>
                            <Link
                                href={logout()}
                                method="post"
                                as="button"
                                onClick={handleLogout}
                            >
                                <LogOut />
                                Logout
                            </Link>
                        </Button>
                    </div>
                </header>
                <main className="flex min-h-0 flex-1 flex-col">{children}</main>
            </SidebarInset>
        </AppShell>
    );
}
