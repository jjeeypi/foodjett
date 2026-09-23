import { router } from '@inertiajs/react';
import { Check, ExternalLink, FileText } from 'lucide-react';
import { useState } from 'react';
import ApprovalStatusBadge, {
    type ApprovalStatus,
} from '@/components/admin/approval-status-badge';
import RejectActionDialog from '@/components/admin/reject-action-dialog';
import { Button } from '@/components/ui/button';

export type ApprovalDocument = {
    id: number;
    type: string;
    file_path: string;
    status: Extract<ApprovalStatus, 'pending' | 'verified' | 'rejected'>;
    rejection_reason: string | null;
};

type Props = {
    document: ApprovalDocument;
    verifyUrl: string;
    rejectUrl: string;
};

const documentUrl = (path: string) =>
    path.startsWith('http') ? path : `/storage/${path.replace(/^\/+/, '')}`;

const isImage = (path: string) => /\.(jpe?g|png|gif|webp)$/i.test(path);

export default function DocumentCard({
    document,
    verifyUrl,
    rejectUrl,
}: Props) {
    const [verifying, setVerifying] = useState(false);
    const label = document.type.replaceAll('_', ' ');
    const filename = document.file_path.split('/').pop() ?? document.file_path;

    const verify = () => {
        setVerifying(true);
        router.patch(
            verifyUrl,
            {},
            {
                preserveScroll: true,
                onFinish: () => setVerifying(false),
            },
        );
    };

    return (
        <article className="overflow-hidden rounded-lg border">
            <a
                href={documentUrl(document.file_path)}
                target="_blank"
                rel="noreferrer"
                className="group block"
            >
                {isImage(document.file_path) ? (
                    <img
                        src={documentUrl(document.file_path)}
                        alt={label}
                        className="bg-muted h-32 w-full object-cover"
                    />
                ) : (
                    <div className="bg-muted flex h-32 items-center justify-center">
                        <FileText className="text-muted-foreground size-8" />
                    </div>
                )}
                <div className="group-hover:bg-muted/50 flex items-start justify-between gap-2 border-t p-3 transition-colors">
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium capitalize">
                            {label}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                            {filename}
                        </p>
                    </div>
                    <ExternalLink className="mt-0.5 size-4 shrink-0" />
                </div>
            </a>
            <div className="space-y-3 border-t p-3">
                <ApprovalStatusBadge status={document.status} />
                {document.rejection_reason && (
                    <p className="text-xs text-red-700 dark:text-red-300">
                        {document.rejection_reason}
                    </p>
                )}
                <div className="flex flex-wrap gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={verify}
                        disabled={verifying || document.status === 'verified'}
                    >
                        <Check />
                        {verifying ? 'Verifying…' : 'Verify'}
                    </Button>
                    <RejectActionDialog
                        action={rejectUrl}
                        subjectName={label}
                        title="Reject document"
                        description={`Explain what is invalid or missing from the ${label}.`}
                        triggerLabel="Reject"
                        size="sm"
                    />
                </div>
            </div>
        </article>
    );
}
