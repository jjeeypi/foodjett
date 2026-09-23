import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type FinanceStatus =
    | 'pending'
    | 'paid'
    | 'confirmed'
    | 'partially_refunded'
    | 'refunded'
    | 'failed';

const styles: Record<FinanceStatus, string> = {
    pending:
        'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
    paid: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
    confirmed:
        'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
    partially_refunded:
        'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300',
    refunded:
        'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300',
    failed: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300',
};

export default function FinanceStatusBadge({
    status,
    className,
}: {
    status: FinanceStatus;
    className?: string;
}) {
    return (
        <Badge
            variant="outline"
            className={cn(
                'whitespace-nowrap capitalize',
                styles[status],
                className,
            )}
        >
            {status.replaceAll('_', ' ')}
        </Badge>
    );
}
