import { Head, Link } from '@inertiajs/react';
import { Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminDashboard() {
    return (
        <>
            <Head title="Admin dashboard" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Admin dashboard
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Review operational activity and rider remittances.
                    </p>
                </div>
                <Card className="max-w-md">
                    <CardHeader>
                        <Banknote className="size-5" />
                        <CardTitle>Pending cash remittances</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Button asChild>
                            <Link href="/admin/remittances">
                                Review remittances
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
