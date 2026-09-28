import { AlertCircle, LoaderCircle } from 'lucide-react';
import AddressMapPicker from '@/components/customer/address-map-picker';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type AddressFormValues = {
    label: string;
    address_line: string;
    landmark: string;
    delivery_instructions: string;
    latitude: number;
    longitude: number;
};

type Props = {
    value: AddressFormValues;
    fallback: { latitude: number; longitude: number };
    onChange: (value: AddressFormValues) => void;
    onSubmit: () => void;
    onCancel?: () => void;
    errors?: string[];
    processing?: boolean;
    submitLabel?: string;
    idPrefix?: string;
};

export const emptyAddress = (
    fallback: Props['fallback'],
): AddressFormValues => ({
    label: 'Home',
    address_line: '',
    landmark: '',
    delivery_instructions: '',
    latitude: fallback.latitude,
    longitude: fallback.longitude,
});

export default function AddressForm({
    value,
    fallback,
    onChange,
    onSubmit,
    onCancel,
    errors = [],
    processing = false,
    submitLabel = 'Save address',
    idPrefix = 'address',
}: Props) {
    const update = <Key extends keyof AddressFormValues>(
        key: Key,
        nextValue: AddressFormValues[Key],
    ) => onChange({ ...value, [key]: nextValue });

    return (
        <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}-label`}>Label</Label>
                    <Input
                        id={`${idPrefix}-label`}
                        list={`${idPrefix}-label-options`}
                        value={value.label}
                        onChange={(event) =>
                            update('label', event.target.value)
                        }
                        placeholder="Home, Work, Other, or custom"
                        maxLength={50}
                    />
                    <datalist id={`${idPrefix}-label-options`}>
                        <option value="Home" />
                        <option value="Work" />
                        <option value="Other" />
                    </datalist>
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}-landmark`}>
                        Landmark (optional)
                    </Label>
                    <Input
                        id={`${idPrefix}-landmark`}
                        value={value.landmark}
                        onChange={(event) =>
                            update('landmark', event.target.value)
                        }
                        maxLength={255}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-line`}>Full address</Label>
                <Input
                    id={`${idPrefix}-line`}
                    value={value.address_line}
                    onChange={(event) =>
                        update('address_line', event.target.value)
                    }
                    required
                    maxLength={255}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-instructions`}>
                    Delivery instructions (optional)
                </Label>
                <textarea
                    id={`${idPrefix}-instructions`}
                    className="border-input bg-background min-h-20 w-full rounded-md border px-3 py-2 text-sm"
                    value={value.delivery_instructions}
                    onChange={(event) =>
                        update('delivery_instructions', event.target.value)
                    }
                    maxLength={500}
                />
            </div>

            <AddressMapPicker
                value={value}
                fallback={fallback}
                onChange={(point) => onChange({ ...value, ...point })}
            />

            {errors.length > 0 && (
                <Alert variant="destructive">
                    <AlertCircle />
                    <AlertTitle>Check this address</AlertTitle>
                    <AlertDescription>
                        <ul className="list-disc space-y-1 pl-4">
                            {errors.map((error) => (
                                <li key={error}>{error}</li>
                            ))}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}

            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    onClick={onSubmit}
                    disabled={
                        processing ||
                        !value.label.trim() ||
                        !value.address_line.trim()
                    }
                >
                    {processing && <LoaderCircle className="animate-spin" />}
                    {submitLabel}
                </Button>
                {onCancel && (
                    <Button type="button" variant="ghost" onClick={onCancel}>
                        Cancel
                    </Button>
                )}
            </div>
        </div>
    );
}
