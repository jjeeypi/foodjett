import { Head } from '@inertiajs/react';
import { Clock3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function RestaurantComingSoon({ title }: { title: string }) {
    return (
        <>
            <Head title={title} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight">
                        {title}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        This restaurant workspace is ready for its next feature
                        stage.
                    </p>
                </div>
                <Card>
                    <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                        <div className="bg-muted rounded-full p-3">
                            <Clock3 className="size-6" />
                        </div>
                        <p className="font-medium">Coming soon</p>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

RestaurantComingSoon.layout = { title: 'Restaurant' };
