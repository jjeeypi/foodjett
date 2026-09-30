import { Link, router, usePage } from '@inertiajs/react';
import { useEcho } from '@laravel/echo-react';
import {
    CircleHelp,
    ClipboardList,
    Home,
    LogOut,
    MapPin,
    MessageCircle,
    Search,
    Settings,
    ShoppingBag,
    Utensils,
} from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
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
import { CartProvider, useCart } from '@/contexts/cart-context';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';
import { logout } from '@/routes';

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
    const brandName = name === 'Laravel' ? 'Foodjett' : name;
    const getInitials = useInitials();
    const { itemCount, openCart, clearCart } = useCart();
    const [search, setSearch] = useState('');
    const [accountOpen, setAccountOpen] = useState(false);
    const [mobileAccountOpen, setMobileAccountOpen] = useState(false);
    const [desktopSearchOpen, setDesktopSearchOpen] = useState(false);
    const [unreadMessages, setUnreadMessages] = useState(
        customerContext?.unread_messages ?? 0,
    );
    const currentPath = page.url.split('?')[0].replace(/\/$/, '') || '/';

    useEffect(() => {
        const query = page.url.split('?')[1] ?? '';
        setSearch(new URLSearchParams(query).get('q') ?? '');
    }, [page.url]);

    useEffect(() => {
        if (page.props.checkoutCompleted) clearCart();
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
            (currentPath === '/customer/search' ||
                currentPath.startsWith('/customer/restaurants/'))
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
        setDesktopSearchOpen(false);
    };

    const desktopNavControl = (item: NavItem) => {
        const Icon = item.icon;
        const className = cn(
            'relative inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            isActive(item.href)
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        );

        if (item.cart) {
            return (
                <button
                    key={item.label}
                    type="button"
                    className={className}
                    onClick={openCart}
                >
                    <Icon className="size-4" />
                    {item.label}
                    {itemCount > 0 && (
                        <span className="bg-primary text-primary-foreground inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] leading-5">
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
                prefetch
            >
                <Icon className="size-4" />
                {item.label}
                {item.label === 'Messages' && unreadMessages > 0 && (
                    <span className="bg-primary text-primary-foreground inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] leading-5">
                        {unreadMessages > 99 ? '99+' : unreadMessages}
                    </span>
                )}
            </Link>
        );
    };

    const accountMenu = (mobile = false) => {
        const open = mobile ? mobileAccountOpen : accountOpen;
        const setOpen = mobile ? setMobileAccountOpen : setAccountOpen;

        return (
            <DropdownMenu open={open} onOpenChange={setOpen}>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        className={cn(
                            'size-11 rounded-full p-1',
                            mobile &&
                                'border border-white/10 bg-white/5 hover:bg-white/10',
                        )}
                        aria-label="Account menu"
                    >
                        <Avatar className="size-9">
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
                    className={cn('w-60', mobile && 'customer-mobile-surface')}
                    align="end"
                >
                    <DropdownMenuLabel>
                        <p className="truncate">{auth.user.name}</p>
                        <p className="text-muted-foreground truncate text-xs font-normal">
                            {auth.user.email}
                        </p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                        <DropdownMenuItem
                            asChild
                            className={cn(
                                isActive('/customer/account/addresses') &&
                                    'bg-accent',
                            )}
                        >
                            <Link
                                href="/customer/account/addresses"
                                onClick={() => setOpen(false)}
                            >
                                <MapPin /> Addresses
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            asChild
                            className={cn(
                                isActive('/customer/account/profile') &&
                                    'bg-accent',
                            )}
                        >
                            <Link
                                href="/customer/account/profile"
                                onClick={() => setOpen(false)}
                            >
                                <Settings /> Edit profile
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            asChild
                            className={cn(
                                isActive('/customer/account/support') &&
                                    'bg-accent',
                            )}
                        >
                            <Link
                                href="/customer/account/support"
                                onClick={() => setOpen(false)}
                            >
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
                                setOpen(false);
                                clearCart();
                                router.flushAll();
                            }}
                        >
                            <LogOut /> Logout
                        </Link>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    };

    const mobileNavLink = (item: NavItem) => {
        const Icon = item.icon;
        const active = isActive(item.href);

        return (
            <Link
                key={item.label}
                href={item.href ?? '#'}
                className={cn(
                    'relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-medium transition-colors',
                    active ? 'text-primary' : 'text-white/55',
                )}
                prefetch
            >
                <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
                <span>{item.label}</span>
                {item.label === 'Messages' && unreadMessages > 0 && (
                    <span className="bg-primary text-primary-foreground absolute top-2.5 left-1/2 ml-1 inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[9px] leading-4">
                        {unreadMessages > 99 ? '99+' : unreadMessages}
                    </span>
                )}
            </Link>
        );
    };

    return (
        <div className="customer-shell bg-background text-foreground min-h-screen">
            <div className="sticky top-0 z-40">
                {customerContext?.active_order && (
                    <ActiveOrderBanner order={customerContext.active_order} />
                )}

                <header className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/85 border-b backdrop-blur">
                    <div className="flex min-h-16 items-center justify-between px-4 pt-[env(safe-area-inset-top)] md:hidden">
                        <Link
                            href="/customer"
                            className="flex shrink-0 items-center gap-2"
                            prefetch
                        >
                            <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl shadow-[0_0_22px_rgba(57,255,20,0.25)]">
                                <AppLogoIcon className="size-5 fill-current" />
                            </span>
                            <span className="text-lg font-bold tracking-tight text-white">
                                {brandName}
                            </span>
                        </Link>
                        {accountMenu(true)}
                    </div>

                    <div className="mx-auto hidden h-16 max-w-7xl items-center gap-3 px-6 md:flex">
                        <Link
                            href="/customer"
                            className="flex shrink-0 items-center gap-2"
                            prefetch
                        >
                            <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg">
                                <AppLogoIcon className="size-5 fill-current" />
                            </span>
                            <span className="font-semibold tracking-tight">
                                {brandName}
                            </span>
                        </Link>

                        <nav className="mx-auto flex items-center gap-1">
                            {navItems.map(desktopNavControl)}
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
                                aria-label="Open search"
                                onClick={() =>
                                    setDesktopSearchOpen((open) => !open)
                                }
                            >
                                <Search />
                            </Button>
                            {accountMenu()}
                        </div>
                    </div>
                    {desktopSearchOpen && (
                        <form
                            onSubmit={submitSearch}
                            className="hidden border-t px-6 py-3 md:block lg:hidden"
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

            <main className="pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-0">
                {children}
            </main>
            <footer className="border-border bg-muted/20 hidden border-t md:block">
                <div className="text-muted-foreground mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm sm:flex-row md:px-6">
                    <p>
                        © {new Date().getFullYear()} {brandName}
                    </p>
                    <Link
                        href="/customer/account/support"
                        className="hover:text-foreground inline-flex items-center gap-2 font-medium"
                    >
                        <CircleHelp className="size-4" /> Contact Support
                    </Link>
                </div>
            </footer>

            <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden">
                <nav
                    aria-label="Customer navigation"
                    className="pointer-events-auto relative mx-3 grid h-[4.75rem] grid-cols-5 items-end rounded-[1.75rem] border border-white/10 bg-[#161616]/95 px-1 shadow-[0_18px_50px_rgba(0,0,0,0.65)] backdrop-blur-xl"
                >
                    {mobileNavLink(navItems[0])}
                    {mobileNavLink(navItems[1])}
                    <div className="relative flex min-h-16 items-end justify-center">
                        <div
                            aria-hidden="true"
                            className="absolute top-0 left-1/2 h-10 w-20 -translate-x-1/2 rounded-b-[2rem] bg-[#0a0a0a]"
                        />
                        <button
                            type="button"
                            onClick={openCart}
                            className="bg-primary text-primary-foreground relative z-10 mb-4 flex size-16 -translate-y-4 items-center justify-center rounded-full border-[6px] border-[#0a0a0a] shadow-[0_0_28px_rgba(57,255,20,0.32)] transition active:scale-95"
                            aria-label={`Open cart with ${itemCount} items`}
                        >
                            <ShoppingBag className="size-6" strokeWidth={2.5} />
                            {itemCount > 0 && (
                                <span className="absolute -top-1 -right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] leading-5 font-bold text-black ring-2 ring-[#0a0a0a]">
                                    {itemCount > 99 ? '99+' : itemCount}
                                </span>
                            )}
                        </button>
                        <span className="absolute bottom-1.5 text-[10px] font-medium text-white/55">
                            Cart
                        </span>
                    </div>
                    {mobileNavLink(navItems[3])}
                    {mobileNavLink(navItems[4])}
                </nav>
            </div>
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
