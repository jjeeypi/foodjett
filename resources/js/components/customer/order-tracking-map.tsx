import type { CircleMarker, Map as LeafletMap, Polyline } from 'leaflet';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export type MapPoint = {
    latitude: number;
    longitude: number;
};

export type RiderLocation = MapPoint & {
    timestamp: string;
};

export default function OrderTrackingMap({
    restaurant,
    delivery,
    rider,
}: {
    restaurant: MapPoint;
    delivery: MapPoint & { address: string };
    rider: RiderLocation | null;
}) {
    const container = useRef<HTMLDivElement>(null);
    const map = useRef<LeafletMap | null>(null);
    const riderMarker = useRef<CircleMarker | null>(null);
    const routeLine = useRef<Polyline | null>(null);
    const leaflet = useRef<typeof import('leaflet') | null>(null);
    const latestRider = useRef(rider);
    latestRider.current = rider;

    useEffect(() => {
        let cancelled = false;

        void import('leaflet').then((L) => {
            if (cancelled || !container.current || map.current) {
                return;
            }

            leaflet.current = L;
            const instance = L.map(container.current, {
                zoomControl: true,
                attributionControl: true,
            });
            map.current = instance;

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution:
                    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19,
            }).addTo(instance);

            L.circleMarker([restaurant.latitude, restaurant.longitude], {
                radius: 9,
                color: '#b45309',
                fillColor: '#f59e0b',
                fillOpacity: 1,
                weight: 3,
            })
                .addTo(instance)
                .bindTooltip('Restaurant');

            L.circleMarker([delivery.latitude, delivery.longitude], {
                radius: 9,
                color: '#047857',
                fillColor: '#10b981',
                fillOpacity: 1,
                weight: 3,
            })
                .addTo(instance)
                .bindTooltip('Delivery address');

            const bounds: [number, number][] = [
                [restaurant.latitude, restaurant.longitude],
                [delivery.latitude, delivery.longitude],
            ];
            const currentRider = latestRider.current;

            if (currentRider) {
                riderMarker.current = L.circleMarker(
                    [currentRider.latitude, currentRider.longitude],
                    {
                        radius: 10,
                        color: '#1d4ed8',
                        fillColor: '#3b82f6',
                        fillOpacity: 1,
                        weight: 3,
                    },
                )
                    .addTo(instance)
                    .bindTooltip('Rider');
                routeLine.current = L.polyline(
                    [
                        [currentRider.latitude, currentRider.longitude],
                        [delivery.latitude, delivery.longitude],
                    ],
                    {
                        color: '#3b82f6',
                        dashArray: '6 8',
                        opacity: 0.8,
                        weight: 3,
                    },
                ).addTo(instance);
                bounds.push([currentRider.latitude, currentRider.longitude]);
            }

            instance.fitBounds(bounds, { padding: [35, 35], maxZoom: 16 });
            window.setTimeout(() => instance.invalidateSize(), 0);
        });

        return () => {
            cancelled = true;
            map.current?.remove();
            map.current = null;
            riderMarker.current = null;
            routeLine.current = null;
            leaflet.current = null;
        };
    }, [
        delivery.latitude,
        delivery.longitude,
        restaurant.latitude,
        restaurant.longitude,
    ]);

    useEffect(() => {
        const L = leaflet.current;
        const instance = map.current;

        if (!L || !instance || !rider) {
            return;
        }

        const point: [number, number] = [rider.latitude, rider.longitude];

        if (riderMarker.current) {
            riderMarker.current.setLatLng(point);
        } else {
            riderMarker.current = L.circleMarker(point, {
                radius: 10,
                color: '#1d4ed8',
                fillColor: '#3b82f6',
                fillOpacity: 1,
                weight: 3,
            })
                .addTo(instance)
                .bindTooltip('Rider');
        }

        const route: [number, number][] = [
            point,
            [delivery.latitude, delivery.longitude],
        ];

        if (routeLine.current) {
            routeLine.current.setLatLngs(route);
        } else {
            routeLine.current = L.polyline(route, {
                color: '#3b82f6',
                dashArray: '6 8',
                opacity: 0.8,
                weight: 3,
            }).addTo(instance);
        }

        instance.panInside(point, { padding: [40, 40] });
    }, [delivery.latitude, delivery.longitude, rider]);

    return (
        <div className="relative overflow-hidden rounded-lg border">
            <div ref={container} className="h-80 w-full md:h-96" />
            {!rider && (
                <div className="bg-background/95 pointer-events-none absolute right-3 bottom-3 left-3 z-[500] rounded-md border px-3 py-2 text-center text-xs shadow-sm backdrop-blur">
                    Waiting for the rider&apos;s first location update.
                </div>
            )}
            <div className="bg-background/95 absolute top-3 right-3 z-[500] space-y-1 rounded-md border p-2 text-xs shadow-sm backdrop-blur">
                <p>
                    <span className="mr-2 inline-block size-2.5 rounded-full bg-amber-500" />
                    Restaurant
                </p>
                <p>
                    <span className="mr-2 inline-block size-2.5 rounded-full bg-blue-500" />
                    Rider
                </p>
                <p>
                    <span className="mr-2 inline-block size-2.5 rounded-full bg-emerald-500" />
                    Delivery
                </p>
            </div>
        </div>
    );
}
