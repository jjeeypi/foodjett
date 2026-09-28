import { Link, router, usePage } from '@inertiajs/react';
import { useEcho } from '@laravel/echo-react';
import {
    CircleHelp,
    ClipboardList,
    Home,
    LogOut,
    MapPin,
    Menu,
    MessageCircle,
    Search,
    Settings,
    ShoppingBag,
    Utensils,
} from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import ActiveOrderBanner from '@/components/customer/active-order-banner';
import CartPanel from '@/components/customer/cart-panel';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { CartProvider, useCart } from '@/contexts/cart-context';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';
import { logout } from '@/routes';
import type { LucideIcon } from 'lucide-react';

type NavItem = {
    label: string;
    href?: string;
    icon: LucideIcon;
    cart?: boolean;
};

type UnreadMessagesUpdate = {
    user_id: number;
    unread_count: number;
};

const navItems: NavItem[] = [
    { label: 'Home', href: '/customer', icon: Home },
    { label: 'Foods', href: '/customer/foods', icon: Utensils },
    { label: 'Cart', icon: ShoppingBag, cart: true },
    { label: 'Messages', href: '/customer/messages', icon: MessageCircle },
    { label: 'Orders', href: '/customer/orders', icon: ClipboardList },
];

function CustomerShell({ children }: { children: ReactNode }) {
    const page = usePage();
    const { auth, customerContext, name } = page.props;
    const getInitials = useInitials();
    const { itemCount, openCart, clearCart } = useCart();
    const [search, setSearch] = useState('');
    const [mobileOpen, setMobileOpen] = useState(false);
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
    const [unreadMessages, setUnreadMessages] = useState(
        customerContext?.unread_messages ?? 0,
    );
    const currentPath = page.url.split('?')[0].replace(/\/$/, '') || '/';

    useEffect(() => {
        const query = page.url.split('?')[1] ?? '';
        setSearch(new URLSearchParams(query).get('q') ?? '');
    }, [page.url]);

    useEffect(() => {
        if (page.props.checkoutCompleted) {
            clearCart();
        }
    }, [clearCart, page.props.checkoutCompleted]);

    useEffect(() => {
        setUnreadMessages(customerContext?.unread_messages ?? 0);
    }, [customerContext?.unread_messages]);

    useEcho<UnreadMessagesUpdate>(
        `user.${auth.user.id}.notifications`,
        '.messages.unread.updated',
        (update) => {
            if (update.user_id === auth.user.id) {
                setUnreadMessages(update.unread_count);
            }
        },
        [auth.user.id],
    );

    const isActive = (href?: string) => {
        if (!href) return false;
        const normalizedHref = href.replace(/\/$/, '');

        if (
            normalizedHref === '/customer/foods' &&
            currentPath === '/customer/search'
        ) {
            return true;
        }

        return normalizedHref === '/customer'
            ? currentPath === normalizedHref
            : currentPath === normalizedHref ||
                  currentPath.startsWith(`${normalizedHref}/`);
    };

    const submitSearch = (event: FormEvent) => {
        event.preventDefault();
        router.get(
            '/customer/search',
            search.trim() === '' ? {} : { q: search.trim() },
            { preserveState: true },
        );
        setMobileSearchOpen(false);
    };

    const navControl = (item: NavItem, mobile = false) => {
        const Icon = item.icon;
        const className = cn(
            'relative inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            isActive(item.href)
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            mobile && 'w-full justify-start',
        );

        if (item.cart) {
            return (
                <button
                    key={item.label}
                    type="button"
                    className={className}
                    onClick={() => {
                        setMobileOpen(false);
                        openCart();
                    }}
                >
                    <Icon className="size-4" />
                    {item.label}
                    {itemCount > 0 && (
                        <span className="bg-primary text-primary-foreground ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] leading-5">
                            {itemCount > 99 ? '99+' : itemCount}
                        </span>
                    )}
                </button>
            );
        }

        return (
            <Link
                key={item.label}
                href={item.href ?? '#'}
                className={className}
                onClick={() => setMobileOpen(false)}
                prefetch
            >
                <Icon className="size-4" />
                {item.label}
                {item.label === 'Messages' && unreadMessages > 0 && (
                    <span className="bg-primary text-primary-foreground ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] leading-5">
                        {unreadMessages > 99 ? '99+' : unreadMessages}
                    </span>
                )}
            </Link>
        );
    };

    return (
        <div className="bg-background min-h-screen">
            <div className="sticky top-0 z-40">
                {customerContext?.active_order && (
                    <ActiveOrderBanner order={customerContext.active_order} />
                )}

                <header className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/85 border-b backdrop-blur">
                    <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:px-6">
                        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                            <SheetTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="md:hidden"
                                    aria-label="Open navigation"
                                >
                                    <Menu />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-72">
                                <SheetHeader className="border-b text-left">
                                    <SheetTitle>{name}</SheetTitle>
                                </SheetHeader>
                                <nav className="flex flex-col gap-1 px-3">
                                    {navItems.map((item) =>
                                        navControl(item, true),
                                    )}
                                </nav>
                            </SheetContent>
                        </Sheet>

                        <Link
                            href="/customer"
                            className="flex shrink-0 items-center gap-2"
                            prefetch
                        >
                            <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg">
                                <AppLogoIcon className="size-5 fill-current" />
                            </span>
                            <span className="hidden font-semibold tracking-tight sm:inline">
                                {name}
                            </span>
                        </Link>

                        <nav className="mx-auto hidden items-center gap-1 md:flex">
                            {navItems.map((item) => navControl(item))}
                        </nav>

                        <div className="ml-auto flex items-center gap-1 md:ml-0">
                            <form
                                onSubmit={submitSearch}
                                className="relative hidden lg:block"
                            >
                                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                                <Input
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder="Search food or restaurant"
                                    className="w-64 pl-9"
                                    aria-label="Search food or restaurant"
                                />
                            </form>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="lg:hidden"
                                aria-label="Search"
                                onClick={() =>
                                    setMobileSearchOpen((open) => !open)
                                }
                            >
                                <Search />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="relative md:hidden"
                                onClick={openCart}
                                aria-label={`Cart with ${itemCount} items`}
                            >
                                <ShoppingBag />
                                {itemCount > 0 && (
                                    <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4">
                                        {itemCount > 99 ? '99+' : itemCount}
                                    </span>
                                )}
                            </Button>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className="size-10 rounded-full p-1"
                                        aria-label="Account menu"
                                    >
                                        <Avatar className="size-8">
                                            <AvatarImage
                                                src={auth.user.avatar}
                                                alt={auth.user.name}
                                            />
                                            <AvatarFallback>
                                                {getInitials(auth.user.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    className="w-60"
                                    align="end"
                                >
                                    <DropdownMenuLabel>
                                        <p className="truncate">
                                            {auth.user.name}
                                        </p>
                                        <p className="text-muted-foreground truncate text-xs font-normal">
                                            {auth.user.email}
                                        </p>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuGroup>
                                        <DropdownMenuItem asChild>
                                            <Link href="/customer/addresses">
                                                <MapPin /> Addresses
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <Link href="/settings/profile">
                                                <Settings /> Edit profile
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <Link href="/customer/support">
                                                <CircleHelp /> Contact support
                                            </Link>
                                        </DropdownMenuItem>
                                    </DropdownMenuGroup>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem asChild>
                                        <Link
                                            href={logout()}
                                            method="post"
                                            as="button"
                                            className="w-full"
                                            onClick={() => {
                                                clearCart();
                                                router.flushAll();
                                            }}
                                        >
                                            <LogOut /> Logout
                                        </Link>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    {mobileSearchOpen && (
                        <form
                            onSubmit={submitSearch}
                            className="border-t px-4 py-3 lg:hidden"
                        >
                            <div className="relative mx-auto max-w-7xl">
                                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                                <Input
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder="Search food or restaurant"
                                    className="pl-9"
                                    autoFocus
                                />
                            </div>
                        </form>
                    )}
                </header>
            </div>

            <main>{children}</main>
            <CartPanel />
        </div>
    );
}

export default function CustomerLayout({ children }: { children: ReactNode }) {
    return (
        <CartProvider>
            <CustomerShell>{children}</CustomerShell>
        </CartProvider>
    );
}
