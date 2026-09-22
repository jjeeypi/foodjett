import { Head } from '@inertiajs/react';
import ApprovalStatusCard from '@/components/approval-status-card';

type Props = {
    approvalStatus: 'pending' | 'approved' | 'rejected';
    rejectionReason?: string | null;
};

export default function RestaurantPending(props: Props) {
    return (
        <>
            <Head title="Restaurant approval" />
            <ApprovalStatusCard accountType="restaurant" {...props} />
        </>
    );
}
