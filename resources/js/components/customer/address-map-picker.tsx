import LocationMapPicker from '@/components/location-map-picker';

type Point = { latitude: number; longitude: number };

export default function AddressMapPicker({
    value,
    fallback,
    onChange,
}: {
    value: Point;
    fallback: Point;
    onChange: (point: Point) => void;
}) {
    return (
        <LocationMapPicker
            value={value}
            fallback={fallback}
            onChange={onChange}
            helpText="Tap the map or drag the pin to the exact delivery location."
        />
    );
}
