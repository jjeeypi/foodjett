import { Head } from '@inertiajs/react';
import ApprovalStatusCard from '@/components/approval-status-card';

type Props = {
    approvalStatus: 'pending' | 'approved' | 'rejected';
    rejectionReason?: string | null;
};

export default function RiderPending(props: Props) {
    return (
        <>
            <Head title="Rider approval" />
            <ApprovalStatusCard accountType="rider" {...props} />
        </>
    );
}
