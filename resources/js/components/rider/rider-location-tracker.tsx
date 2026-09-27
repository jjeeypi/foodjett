import { useEcho } from '@laravel/echo-react';
import { MapPin, Radio, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const LOCATION_INTERVAL_MS = 7000;
const locationStatuses = new Set([
    'rider_assigned',
    'at_restaurant',
    'picked_up',
    'on_the_way',
]);

type SharingState =
    | 'starting'
    | 'sharing'
    | 'unsupported'
    | 'denied'
    | 'error'
    | 'stopped';

type StatusUpdate = {
    id: number;
    status: string;
};

export default function RiderLocationTracker({
    orderId,
    initialStatus,
}: {
    orderId: number;
    initialStatus: string;
}) {
    const [enabled, setEnabled] = useState(() =>
        locationStatuses.has(initialStatus),
    );
    const [sharingState, setSharingState] = useState<SharingState>(() =>
        locationStatuses.has(initialStatus) ? 'starting' : 'stopped',
    );
    const locating = useRef(false);
    const sending = useRef(false);
    const mounted = useRef(true);

    useEcho<StatusUpdate>(
        `order.${orderId}.status`,
        '.order.status.updated',
        (update) => {
            if (update.id === orderId && !locationStatuses.has(update.status)) {
                setEnabled(false);
                setSharingState('stopped');
            }
        },
        [orderId],
    );

    const sendLocation = useCallback(async (position: GeolocationPosition) => {
        if (sending.current || !mounted.current) {
            return;
        }

        const csrfToken = document
            .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
            ?.getAttribute('content');

        if (!csrfToken) {
            setSharingState('error');

            return;
        }

        sending.current = true;

        try {
            const response = await fetch('/rider/location', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                },
                body: JSON.stringify({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                }),
            });

            if (!response.ok) {
                throw new Error(`Location update failed (${response.status})`);
            }

            if (mounted.current) {
                setSharingState('sharing');
            }
        } catch {
            if (mounted.current) {
                setSharingState('error');
            }
        } finally {
            sending.current = false;
        }
    }, []);

    useEffect(() => {
        mounted.current = true;

        if (!enabled) {
            return () => {
                mounted.current = false;
            };
        }

        if (!('geolocation' in navigator)) {
            setSharingState('unsupported');

            return () => {
                mounted.current = false;
            };
        }

        const requestPosition = () => {
            if (locating.current || !mounted.current) {
                return;
            }

            locating.current = true;
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    locating.current = false;
                    void sendLocation(position);
                },
                (error) => {
                    locating.current = false;
                    if (mounted.current) {
                        setSharingState(
                            error.code === error.PERMISSION_DENIED
                                ? 'denied'
                                : 'error',
                        );
                    }
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 5000,
                    timeout: 6500,
                },
            );
        };

        requestPosition();
        const interval = window.setInterval(
            requestPosition,
            LOCATION_INTERVAL_MS,
        );

        return () => {
            mounted.current = false;
            window.clearInterval(interval);
        };
    }, [enabled, sendLocation]);

    if (sharingState === 'unsupported' || sharingState === 'denied') {
        return (
            <Alert variant="destructive">
                <TriangleAlert />
                <AlertTitle>Location sharing is unavailable</AlertTitle>
                <AlertDescription>
                    {sharingState === 'denied'
                        ? 'Allow location access in this browser so the customer can follow the delivery.'
                        : 'This browser does not support geolocation.'}
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <Alert>
            {sharingState === 'sharing' ? <Radio /> : <MapPin />}
            <AlertTitle>
                {sharingState === 'sharing'
                    ? 'Live location is being shared'
                    : sharingState === 'stopped'
                      ? 'Location sharing stopped'
                      : sharingState === 'error'
                        ? 'Retrying location sharing'
                        : 'Starting location sharing'}
            </AlertTitle>
            <AlertDescription>
                {sharingState === 'stopped'
                    ? 'This order no longer needs live rider location.'
                    : 'Keep this page open while completing the delivery.'}
            </AlertDescription>
        </Alert>
    );
}
