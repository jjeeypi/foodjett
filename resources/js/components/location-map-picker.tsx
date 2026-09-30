import type { Map as LeafletMap, Marker } from 'leaflet';
import { Crosshair } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';

export type MapPoint = { latitude: number; longitude: number };

type Props = {
    value: MapPoint;
    fallback: MapPoint;
    onChange: (point: MapPoint) => void;
    helpText?: string;
};

export default function LocationMapPicker({
    value,
    fallback,
    onChange,
    helpText = 'Tap the map or drag the pin to the exact location.',
}: Props) {
    const container = useRef<HTMLDivElement>(null);
    const map = useRef<LeafletMap | null>(null);
    const marker = useRef<Marker | null>(null);
    const onChangeRef = useRef(onChange);
    const [locating, setLocating] = useState(false);
    onChangeRef.current = onChange;

    useEffect(() => {
        let cancelled = false;

        void import('leaflet').then((L) => {
            if (cancelled || !container.current || map.current) return;

            const initial: [number, number] = [
                value.latitude || fallback.latitude,
                value.longitude || fallback.longitude,
            ];
            const instance = L.map(container.current, {
                dragging: false,
                scrollWheelZoom: false,
                touchZoom: true,
            }).setView(initial, 15);
            map.current = instance;

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution:
                    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19,
            }).addTo(instance);

            marker.current = L.marker(initial, {
                draggable: true,
                autoPan: true,
            }).addTo(instance);
            marker.current.on('dragend', () => {
                const point = marker.current?.getLatLng();
                if (point) {
                    onChangeRef.current({
                        latitude: point.lat,
                        longitude: point.lng,
                    });
                }
            });
            instance.on('click', (event) => {
                marker.current?.setLatLng(event.latlng);
                onChangeRef.current({
                    latitude: event.latlng.lat,
                    longitude: event.latlng.lng,
                });
            });
            window.setTimeout(() => instance.invalidateSize(), 0);
        });

        return () => {
            cancelled = true;
            map.current?.remove();
            map.current = null;
            marker.current = null;
        };
    }, [fallback.latitude, fallback.longitude]);

    useEffect(() => {
        if (!map.current || !marker.current || !value.latitude) return;
        const point: [number, number] = [value.latitude, value.longitude];
        marker.current.setLatLng(point);
        map.current.panTo(point);
    }, [value.latitude, value.longitude]);

    const useCurrentLocation = () => {
        if (!navigator.geolocation) return;
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                onChange({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });
                setLocating(false);
            },
            () => setLocating(false),
            { enableHighAccuracy: true, timeout: 10_000 },
        );
    };

    return (
        <div className="space-y-2">
            <div className="relative min-h-64 overflow-hidden rounded-lg border">
                <div
                    ref={container}
                    className="h-64 min-h-64 w-full sm:h-72 sm:min-h-72"
                    aria-label="Location map picker"
                />
                <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="absolute top-3 right-3 z-[500] min-h-10 shadow"
                    onClick={useCurrentLocation}
                    disabled={locating}
                >
                    <Crosshair />
                    {locating ? 'Locating…' : 'Use my location'}
                </Button>
            </div>
            <p className="text-muted-foreground text-xs">{helpText}</p>
        </div>
    );
}
