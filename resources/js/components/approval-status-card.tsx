import { Clock3, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

type Props = {
    accountType: 'restaurant' | 'rider';
    approvalStatus: 'pending' | 'approved' | 'rejected';
    rejectionReason?: string | null;
};

export default function ApprovalStatusCard({
    accountType,
    approvalStatus,
    rejectionReason,
}: Props) {
    const label = accountType === 'restaurant' ? 'restaurant' : 'rider';
    const rejected = approvalStatus === 'rejected';

    return (
        <div className="flex min-h-[70vh] items-center justify-center p-4">
            <Card className="w-full max-w-2xl">
                <CardHeader className="items-center text-center">
                    <div className="bg-muted mb-2 flex size-14 items-center justify-center rounded-full">
                        {rejected ? (
                            <TriangleAlert className="text-destructive size-7" />
                        ) : (
                            <Clock3 className="text-muted-foreground size-7" />
                        )}
                    </div>
                    <Badge variant={rejected ? 'destructive' : 'secondary'}>
                        {approvalStatus}
                    </Badge>
                    <CardTitle className="pt-2 text-2xl">
                        {rejected
                            ? `${label[0].toUpperCase()}${label.slice(1)} application needs attention`
                            : `Your ${label} application is under review`}
                    </CardTitle>
                    <CardDescription className="max-w-lg">
                        {rejected
                            ? 'Review the reason below before contacting support or resubmitting your application.'
                            : 'FoodJett will unlock your dashboard after an administrator approves your application.'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    {rejected && rejectionReason && (
                        <Alert variant="destructive">
                            <TriangleAlert className="size-4" />
                            <AlertTitle>Rejection reason</AlertTitle>
                            <AlertDescription>
                                {rejectionReason}
                            </AlertDescription>
                        </Alert>
                    )}

                    {!rejected && (
                        <Alert>
                            <ShieldCheck className="size-4" />
                            <AlertTitle>No action is required yet</AlertTitle>
                            <AlertDescription>
                                You can continue managing account security from
                                settings while the application is reviewed.
                            </AlertDescription>
                        </Alert>
                    )}

                    <p className="text-muted-foreground text-center text-sm">
                        Document uploads and application resubmission will be
                        added here when the approval workflow is implemented.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
