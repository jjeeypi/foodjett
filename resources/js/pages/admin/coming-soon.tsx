import { Head } from '@inertiajs/react';
import { Construction } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function ComingSoon({ title }: { title: string }) {
    return (
        <>
            <Head title={title} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight">
                        {title}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        This admin module is ready to be built on the shared
                        layout.
                    </p>
                </div>
                <Card className="max-w-xl">
                    <CardContent className="flex items-start gap-4 py-6">
                        <Construction className="text-muted-foreground size-6" />
                        <div>
                            <p className="font-medium">Module coming next</p>
                            <p className="text-muted-foreground mt-1 text-sm">
                                Navigation and access control are in place; this
                                page intentionally contains no business actions
                                yet.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

ComingSoon.layout = {
    title: 'Admin',
};
