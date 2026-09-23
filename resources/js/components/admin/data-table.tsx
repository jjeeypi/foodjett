import { Link, router } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type DataTableColumn<Row> = {
    key: string;
    label: string;
    className?: string;
    render: (row: Row) => ReactNode;
};

type PaginationLink = {
    url: string | null;
    label: string;
    active: boolean;
};

type PaginationMeta = {
    current_page: number;
    from: number | null;
    last_page: number;
    per_page: number;
    to: number | null;
    total: number;
};

export type PaginatedData<Row> = PaginationMeta & {
    data: Row[];
    links: PaginationLink[];
    meta?: PaginationMeta;
};

type DataTableProps<Row> = {
    columns: DataTableColumn<Row>[];
    paginated: PaginatedData<Row>;
    emptyMessage?: string;
    rowKey: (row: Row) => number | string;
    rowHref?: (row: Row) => string;
};

const paginationLabel = (label: string) =>
    label
        .replace('&laquo; Previous', 'Previous')
        .replace('Next &raquo;', 'Next');

export function Pagination({
    paginated,
}: {
    paginated: Pick<PaginatedData<unknown>, 'links'> &
        Partial<PaginationMeta> & { meta?: PaginationMeta };
}) {
    const meta = paginated.meta ?? paginated;

    if (!meta.last_page || meta.last_page <= 1) {
        return null;
    }

    return (
        <div className="bg-muted/20 flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row">
            <p className="text-muted-foreground text-sm">
                Showing {meta.from ?? 0}–{meta.to ?? 0} of {meta.total ?? 0}
            </p>
            <nav className="flex flex-wrap items-center justify-end gap-1">
                {paginated.links.map((link) =>
                    link.url ? (
                        <Link
                            key={`${link.label}-${link.url}`}
                            href={link.url}
                            preserveScroll
                            preserveState
                            className={cn(
                                'rounded-md border px-3 py-1.5 text-sm transition-colors',
                                link.active
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background hover:bg-muted',
                            )}
                        >
                            {paginationLabel(link.label)}
                        </Link>
                    ) : (
                        <span
                            key={link.label}
                            className="text-muted-foreground rounded-md border px-3 py-1.5 text-sm opacity-50"
                        >
                            {paginationLabel(link.label)}
                        </span>
                    ),
                )}
            </nav>
        </div>
    );
}

export default function DataTable<Row>({
    columns,
    paginated,
    emptyMessage = 'No records found.',
    rowKey,
    rowHref,
}: DataTableProps<Row>) {
    return (
        <div className="overflow-hidden rounded-xl border">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50 text-muted-foreground border-b text-xs tracking-wide uppercase">
                        <tr>
                            {columns.map((column) => (
                                <th
                                    key={column.key}
                                    className={cn(
                                        'px-4 py-3 font-medium',
                                        column.className,
                                    )}
                                >
                                    {column.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {paginated.data.map((row) => (
                            <tr
                                key={rowKey(row)}
                                tabIndex={rowHref ? 0 : undefined}
                                role={rowHref ? 'link' : undefined}
                                onClick={() => {
                                    if (rowHref) {
                                        router.visit(rowHref(row));
                                    }
                                }}
                                onKeyDown={(event) => {
                                    if (
                                        rowHref &&
                                        (event.key === 'Enter' ||
                                            event.key === ' ')
                                    ) {
                                        event.preventDefault();
                                        router.visit(rowHref(row));
                                    }
                                }}
                                className={cn(
                                    'hover:bg-muted/30 transition-colors',
                                    rowHref &&
                                        'focus-visible:ring-ring cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset',
                                )}
                            >
                                {columns.map((column) => (
                                    <td
                                        key={column.key}
                                        className={cn(
                                            'px-4 py-3 align-middle',
                                            column.className,
                                        )}
                                    >
                                        {column.render(row)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {paginated.data.length === 0 && (
                <div className="text-muted-foreground px-6 py-12 text-center text-sm">
                    {emptyMessage}
                </div>
            )}

            <Pagination paginated={paginated} />
        </div>
    );
}
