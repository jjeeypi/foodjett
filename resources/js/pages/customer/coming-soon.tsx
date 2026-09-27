import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Construction } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function CustomerComingSoon({ title }: { title: string }) {
    return (
        <>
            <Head title={title} />
            <div className="mx-auto flex min-h-[65vh] w-full max-w-3xl items-center px-4 py-10 md:px-6">
                <Card className="w-full border-dashed">
                    <CardContent className="flex flex-col items-center py-12 text-center">
                        <div className="bg-muted flex size-14 items-center justify-center rounded-full">
                            <Construction className="text-muted-foreground size-6" />
                        </div>
                        <h1 className="mt-5 text-2xl font-semibold tracking-tight">
                            {title}
                        </h1>
                        <p className="text-muted-foreground mt-2 max-w-md text-sm">
                            This area is ready in the customer navigation and
                            will be connected in the next feature stage.
                        </p>
                        <Button asChild variant="outline" className="mt-6">
                            <Link href="/customer">
                                <ArrowLeft /> Back home
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
