import { Link, router, usePage } from '@inertiajs/react';
import {
    Bike,
    CircleDollarSign,
    LockKeyhole,
    Power,
    RadioTower,
    UserRound,
    Zap,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

type RiderLayoutProps = { children: ReactNode };
type AvailabilityState = 'offline' | 'available' | 'busy';
type Coordinates = { latitude: number; longitude: number };
type NavItem = { label: string; href: string; icon: LucideIcon };

const navItems: NavItem[] = [
    { label: 'Pool', href: '/rider/orders', icon: RadioTower },
    { label: 'Active', href: '/rider/active', icon: Bike },
    { label: 'Earnings', href: '/rider/earnings', icon: CircleDollarSign },
    { label: 'Account', href: '/rider/account', icon: UserRound },
];

function getCurrentPosition(): Promise<Coordinates | null> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
        return Promise.resolve(null);
    }

    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            ({ coords }) =>
                resolve({
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                }),
            () => resolve(null),
            {
                enableHighAccuracy: true,
                timeout: 8_000,
                maximumAge: 0,
            },
        );
    });
}

export default function RiderLayout({ children }: RiderLayoutProps) {
    const { auth, riderContext } = usePage().props;
    const { currentUrl } = useCurrentUrl();
    const serverAvailability: AvailabilityState = riderContext?.is_busy
        ? 'busy'
        : riderContext?.availability_status === 'available'
          ? 'available'
          : 'offline';
    const [availability, setAvailability] =
        useState<AvailabilityState>(serverAvailability);
    const [updating, setUpdating] = useState(false);

    useEffect(() => setAvailability(serverAvailability), [serverAvailability]);

    const isActive = (item: NavItem) => {
        if (item.label === 'Pool' && currentUrl === '/rider/dashboard') {
            return true;
        }

        return (
            currentUrl === item.href || currentUrl.startsWith(`${item.href}/`)
        );
    };

    const submitToggle = (coordinates: Coordinates | null) => {
        router.post('/rider/availability/toggle', coordinates ?? {}, {
            preserveScroll: true,
            preserveState: true,
            only: ['riderContext'],
            onSuccess: () =>
                toast.success(
                    availability === 'offline'
                        ? 'You are now online.'
                        : 'You are now offline.',
                ),
            onError: (errors) =>
                toast.error(
                    typeof errors.availability === 'string'
                        ? errors.availability
                        : 'Your availability could not be updated.',
                ),
            onFinish: () => setUpdating(false),
        });
    };

    const toggleAvailability = async () => {
        if (availability === 'busy') {
            toast.error('Finish your current delivery first.');
            return;
        }

        if (updating) return;
        setUpdating(true);

        if (availability === 'available') {
            submitToggle(null);
            return;
        }

        const coordinates = await getCurrentPosition();
        if (coordinates === null) {
            toast.info(
                'Location was unavailable. You can still go online using your last saved location.',
            );
        }
        submitToggle(coordinates);
    };

    const availabilityLabel =
        availability === 'busy'
            ? 'Busy'
            : availability === 'available'
              ? 'Online'
              : 'Offline';
    const AvailabilityIcon =
        availability === 'busy'
            ? LockKeyhole
            : availability === 'available'
              ? Zap
              : Power;

    return (
        <div className="bg-muted/30 min-h-dvh">
            <header className="border-border/80 bg-background/95 supports-[backdrop-filter]:bg-background/85 sticky top-0 z-30 border-b backdrop-blur">
                <div className="mx-auto flex min-h-14 w-full max-w-3xl items-center justify-between gap-3 px-4">
                    <div className="min-w-0">
                        <p className="text-muted-foreground text-xs font-medium">
                            Rider
                        </p>
                        <p className="truncate text-sm font-semibold">
                            {auth.user.name}
                        </p>
                    </div>
                    <div
                        className={cn(
                            'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold',
                            availability === 'available' &&
                                'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
                            availability === 'offline' &&
                                'bg-muted text-muted-foreground',
                            availability === 'busy' &&
                                'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
                        )}
                    >
                        <span
                            className={cn(
                                'size-2 rounded-full',
                                availability === 'available' &&
                                    'bg-emerald-500',
                                availability === 'offline' && 'bg-zinc-400',
                                availability === 'busy' && 'bg-amber-500',
                            )}
                        />
                        {availabilityLabel}
                    </div>
                </div>
            </header>

            <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-3xl flex-col pb-[calc(6.25rem+env(safe-area-inset-bottom))]">
                {children}
            </main>

            <nav
                aria-label="Rider navigation"
                className="border-border/80 bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.35)] backdrop-blur"
            >
                <div className="relative mx-auto grid min-h-16 w-full max-w-3xl grid-cols-5 px-1 pb-[max(env(safe-area-inset-bottom),0.25rem)]">
                    {navItems.slice(0, 2).map((item) => (
                        <RiderNavItem
                            key={item.href}
                            item={item}
                            active={isActive(item)}
                        />
                    ))}

                    <div aria-hidden="true" className="min-h-16" />

                    {navItems.slice(2).map((item) => (
                        <RiderNavItem
                            key={item.href}
                            item={item}
                            active={isActive(item)}
                        />
                    ))}

                    <button
                        type="button"
                        aria-label={
                            availability === 'busy'
                                ? 'Busy with an active delivery'
                                : availability === 'available'
                                  ? 'Go offline'
                                  : 'Go online'
                        }
                        aria-disabled={availability === 'busy' || updating}
                        onClick={toggleAvailability}
                        className={cn(
                            'ring-background absolute top-0 left-1/2 flex size-16 -translate-x-1/2 -translate-y-5 touch-manipulation flex-col items-center justify-center rounded-full border-4 shadow-lg ring-4 transition active:scale-95',
                            availability === 'available' &&
                                'border-emerald-600 bg-emerald-600 text-white',
                            availability === 'offline' &&
                                'border-border bg-background text-muted-foreground',
                            availability === 'busy' &&
                                'border-amber-500 bg-amber-500 text-white',
                            updating && 'pointer-events-none opacity-70',
                        )}
                    >
                        <AvailabilityIcon className="size-6" />
                        <span className="mt-0.5 text-[10px] leading-none font-bold">
                            {updating ? 'Wait' : availabilityLabel}
                        </span>
                    </button>
                </div>
            </nav>
        </div>
    );
}

function RiderNavItem({ item, active }: { item: NavItem; active: boolean }) {
    return (
        <Link
            href={item.href}
            prefetch
            aria-current={active ? 'page' : undefined}
            className={cn(
                'flex min-h-16 touch-manipulation flex-col items-center justify-center gap-1 rounded-md px-1 py-2 text-[11px] font-medium transition-colors',
                active
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
            )}
        >
            <item.icon className={cn('size-5', active && 'stroke-[2.5]')} />
            <span>{item.label}</span>
            <span
                className={cn(
                    'h-0.5 w-5 rounded-full',
                    active ? 'bg-foreground' : 'bg-transparent',
                )}
            />
        </Link>
    );
}
