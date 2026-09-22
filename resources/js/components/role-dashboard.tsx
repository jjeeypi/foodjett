import { Head } from '@inertiajs/react';
import { BarChart3, ClipboardList, Users } from 'lucide-react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

type Props = {
    role: 'Admin' | 'Restaurant' | 'Rider' | 'Customer';
    description: string;
};

const cards = [
    {
        title: 'Overview',
        description: 'Role-specific metrics and activity will appear here.',
        icon: BarChart3,
    },
    {
        title: 'Orders',
        description: 'Order management will be connected in the next phase.',
        icon: ClipboardList,
    },
    {
        title: 'Account',
        description: 'Use settings to manage your profile and security.',
        icon: Users,
    },
];

export default function RoleDashboard({ role, description }: Props) {
    return (
        <>
            <Head title={`${role} dashboard`} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {role} dashboard
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {description}
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    {cards.map((card) => (
                        <Card key={card.title}>
                            <CardHeader>
                                <card.icon className="text-muted-foreground size-5" />
                                <CardTitle>{card.title}</CardTitle>
                                <CardDescription>
                                    {card.description}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="bg-muted h-20 rounded-lg" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </>
    );
}
