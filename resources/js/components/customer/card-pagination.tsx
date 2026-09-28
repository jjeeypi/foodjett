import { Link } from '@inertiajs/react';
import { cn } from '@/lib/utils';
import type { Paginated } from '@/types/customer-catalog';

const label = (value: string) =>
    value
        .replace('&laquo; Previous', 'Previous')
        .replace('Next &raquo;', 'Next');

export default function CardPagination({
    paginated,
}: {
    paginated: Pick<Paginated<unknown>, 'links' | 'last_page'> &
        Partial<Pick<Paginated<unknown>, 'from' | 'to' | 'total'>>;
}) {
    if (paginated.last_page <= 1) return null;

    return (
        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t pt-5 sm:flex-row">
            <p className="text-muted-foreground text-sm">
                Showing {paginated.from ?? 0}–{paginated.to ?? 0} of{' '}
                {paginated.total ?? 0}
            </p>
            <nav className="flex flex-wrap items-center justify-end gap-1">
                {paginated.links.map((link) =>
                    link.url ? (
                        <Link
                            key={`${link.label}-${link.url}`}
                            href={link.url}
                            preserveState
                            preserveScroll
                            className={cn(
                                'rounded-md border px-3 py-1.5 text-sm transition-colors',
                                link.active
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background hover:bg-muted',
                            )}
                        >
                            {label(link.label)}
                        </Link>
                    ) : (
                        <span
                            key={link.label}
                            className="text-muted-foreground rounded-md border px-3 py-1.5 text-sm opacity-50"
                        >
                            {label(link.label)}
                        </span>
                    ),
                )}
            </nav>
        </div>
    );
}
