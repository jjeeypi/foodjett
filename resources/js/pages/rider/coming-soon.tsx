import { Head } from '@inertiajs/react';
import { Construction } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function RiderComingSoon({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <>
            <Head title={title} />
            <div className="flex flex-1 flex-col px-4 py-6 sm:px-6">
                <h1 className="text-2xl font-semibold tracking-tight">
                    {title}
                </h1>
                <Card className="mt-5">
                    <CardContent className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
                        <div className="bg-muted mb-4 flex size-12 items-center justify-center rounded-full">
                            <Construction className="text-muted-foreground size-6" />
                        </div>
                        <p className="font-medium">Coming soon</p>
                        <p className="text-muted-foreground mt-1 max-w-xs text-sm">
                            {description}
                        </p>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
