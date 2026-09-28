import type { Auth } from '@/types/auth';
import type { CustomerOrderStatus } from '@/components/customer/order-status-badge';

declare module 'react' {
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            auth: Auth;
            adminPendingApprovals: {
                restaurants: number;
                riders: number;
            } | null;
            restaurantContext: {
                id: number;
                name: string;
                logo_url: string | null;
                operating_status: 'open' | 'closed' | 'temporarily_closed';
                approval_status: 'pending' | 'approved' | 'rejected';
            } | null;
            customerContext: {
                active_order: {
                    id: number;
                    order_number: string;
                    status: CustomerOrderStatus;
                    show_url: string;
                } | null;
            } | null;
            checkoutCompleted: boolean;
            sidebarOpen: boolean;
            [key: string]: unknown;
        };
    }
}
