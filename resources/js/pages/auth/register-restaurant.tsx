import { Head, useForm } from '@inertiajs/react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import StepIndicator from '@/components/auth/step-indicator';
import InputError from '@/components/input-error';
import LocationMapPicker from '@/components/location-map-picker';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { login, register as registerCustomer } from '@/routes';
import { store } from '@/routes/register/restaurant';

type Props = {
    passwordRules: string;
};

type RestaurantRegistration = {
    name: string;
    email: string;
    phone: string;
    password: string;
    password_confirmation: string;
    restaurant_name: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
    cuisine_type: string;
};

const mapFallback = { latitude: 9.3068, longitude: 123.3054 };
const accountFields: (keyof RestaurantRegistration)[] = [
    'name',
    'email',
    'phone',
    'password',
    'password_confirmation',
];

export default function RegisterRestaurant({ passwordRules }: Props) {
    const [step, setStep] = useState(1);
    const form = useForm<RestaurantRegistration>({
        name: '',
        email: '',
        phone: '',
        password: '',
        password_confirmation: '',
        restaurant_name: '',
        address: '',
        latitude: null,
        longitude: null,
        cuisine_type: '',
    });

    const validateAccount = () => {
        form.clearErrors(...accountFields);
        let valid = true;
        const require = (
            field: keyof RestaurantRegistration,
            message: string,
        ) => {
            if (String(form.data[field] ?? '').trim() === '') {
                form.setError(field, message);
                valid = false;
            }
        };

        require('name', 'Enter the restaurant owner’s name.');
        require('email', 'Enter an email address.');
        require('phone', 'Enter a phone number.');
        require('password', 'Enter a password.');
        require('password_confirmation', 'Confirm the password.');

        if (
            form.data.email &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.data.email)
        ) {
            form.setError('email', 'Enter a valid email address.');
            valid = false;
        }
        if (form.data.password && form.data.password.length < 8) {
            form.setError('password', 'Use at least 8 characters.');
            valid = false;
        }
        if (
            form.data.password_confirmation &&
            form.data.password !== form.data.password_confirmation
        ) {
            form.setError('password_confirmation', 'Passwords do not match.');
            valid = false;
        }

        return valid;
    };

    const validateRestaurant = () => {
        form.clearErrors(
            'restaurant_name',
            'address',
            'latitude',
            'longitude',
            'cuisine_type',
        );
        let valid = true;

        if (!form.data.restaurant_name.trim()) {
            form.setError('restaurant_name', 'Enter the restaurant name.');
            valid = false;
        }
        if (!form.data.address.trim()) {
            form.setError('address', 'Enter the business address.');
            valid = false;
        }
        if (form.data.latitude === null || form.data.longitude === null) {
            form.setError('latitude', 'Select the restaurant on the map.');
            valid = false;
        }
        if (!form.data.cuisine_type.trim()) {
            form.setError('cuisine_type', 'Enter a cuisine type.');
            valid = false;
        }

        return valid;
    };

    const next = () => {
        if (!validateAccount()) return;
        setStep(2);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!validateRestaurant()) return;

        form.post(store.url(), {
            onError: (errors) => {
                if (accountFields.some((field) => field in errors)) {
                    setStep(1);
                }
            },
            onSuccess: () => form.reset('password', 'password_confirmation'),
        });
    };

    return (
        <>
            <Head title="Register your restaurant" />

            <div className="flex min-w-0 flex-col gap-6">
                <StepIndicator
                    current={step}
                    total={2}
                    label={step === 1 ? 'Owner account' : 'Restaurant details'}
                />

                <form onSubmit={submit} noValidate className="space-y-6">
                    {step === 1 ? (
                        <div className="grid gap-5">
                            <div className="grid gap-2">
                                <Label htmlFor="restaurant-owner-name">
                                    Owner name
                                </Label>
                                <Input
                                    id="restaurant-owner-name"
                                    value={form.data.name}
                                    onChange={(event) =>
                                        form.setData('name', event.target.value)
                                    }
                                    type="text"
                                    autoFocus
                                    autoComplete="name"
                                    placeholder="Full name"
                                    className="h-11"
                                    aria-invalid={Boolean(form.errors.name)}
                                />
                                <InputError message={form.errors.name} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="restaurant-owner-email">
                                    Email address
                                </Label>
                                <Input
                                    id="restaurant-owner-email"
                                    value={form.data.email}
                                    onChange={(event) =>
                                        form.setData(
                                            'email',
                                            event.target.value,
                                        )
                                    }
                                    type="email"
                                    autoComplete="email"
                                    inputMode="email"
                                    placeholder="owner@example.com"
                                    className="h-11"
                                    aria-invalid={Boolean(form.errors.email)}
                                />
                                <InputError message={form.errors.email} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="restaurant-owner-phone">
                                    Phone number
                                </Label>
                                <Input
                                    id="restaurant-owner-phone"
                                    value={form.data.phone}
                                    onChange={(event) =>
                                        form.setData(
                                            'phone',
                                            event.target.value,
                                        )
                                    }
                                    type="tel"
                                    autoComplete="tel"
                                    inputMode="tel"
                                    placeholder="09XX XXX XXXX"
                                    className="h-11"
                                    aria-invalid={Boolean(form.errors.phone)}
                                />
                                <InputError message={form.errors.phone} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="restaurant-owner-password">
                                    Password
                                </Label>
                                <PasswordInput
                                    id="restaurant-owner-password"
                                    value={form.data.password}
                                    onChange={(event) =>
                                        form.setData(
                                            'password',
                                            event.target.value,
                                        )
                                    }
                                    autoComplete="new-password"
                                    placeholder="Password"
                                    passwordrules={passwordRules}
                                    className="h-11"
                                    aria-invalid={Boolean(form.errors.password)}
                                />
                                <InputError message={form.errors.password} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="restaurant-owner-password-confirmation">
                                    Confirm password
                                </Label>
                                <PasswordInput
                                    id="restaurant-owner-password-confirmation"
                                    value={form.data.password_confirmation}
                                    onChange={(event) =>
                                        form.setData(
                                            'password_confirmation',
                                            event.target.value,
                                        )
                                    }
                                    autoComplete="new-password"
                                    placeholder="Confirm password"
                                    passwordrules={passwordRules}
                                    className="h-11"
                                    aria-invalid={Boolean(
                                        form.errors.password_confirmation,
                                    )}
                                />
                                <InputError
                                    message={form.errors.password_confirmation}
                                />
                            </div>

                            <Button
                                type="button"
                                onClick={next}
                                className="mt-1 h-11 w-full"
                            >
                                Next <ArrowRight />
                            </Button>
                        </div>
                    ) : (
                        <div className="grid gap-5">
                            <div className="grid gap-2">
                                <Label htmlFor="restaurant-name">
                                    Restaurant name
                                </Label>
                                <Input
                                    id="restaurant-name"
                                    value={form.data.restaurant_name}
                                    onChange={(event) =>
                                        form.setData(
                                            'restaurant_name',
                                            event.target.value,
                                        )
                                    }
                                    autoFocus
                                    placeholder="Your restaurant"
                                    className="h-11"
                                    aria-invalid={Boolean(
                                        form.errors.restaurant_name,
                                    )}
                                />
                                <InputError
                                    message={form.errors.restaurant_name}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="restaurant-address">
                                    Business address
                                </Label>
                                <Input
                                    id="restaurant-address"
                                    value={form.data.address}
                                    onChange={(event) =>
                                        form.setData(
                                            'address',
                                            event.target.value,
                                        )
                                    }
                                    autoComplete="street-address"
                                    placeholder="Street, barangay, city"
                                    className="h-11"
                                    aria-invalid={Boolean(form.errors.address)}
                                />
                                <InputError message={form.errors.address} />
                            </div>

                            <div className="grid gap-2">
                                <Label>Restaurant location</Label>
                                <LocationMapPicker
                                    value={{
                                        latitude: form.data.latitude ?? 0,
                                        longitude: form.data.longitude ?? 0,
                                    }}
                                    fallback={mapFallback}
                                    onChange={(point) => {
                                        form.setData({
                                            ...form.data,
                                            latitude: point.latitude,
                                            longitude: point.longitude,
                                        });
                                        form.clearErrors(
                                            'latitude',
                                            'longitude',
                                        );
                                    }}
                                    helpText="Tap the map or drag the pin to the restaurant entrance. The map stays fixed while you scroll the page."
                                />
                                <InputError
                                    message={
                                        form.errors.latitude ||
                                        form.errors.longitude
                                    }
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="grid min-w-0 gap-2">
                                    <Label htmlFor="restaurant-latitude">
                                        Latitude
                                    </Label>
                                    <Input
                                        id="restaurant-latitude"
                                        value={
                                            form.data.latitude?.toFixed(6) ?? ''
                                        }
                                        readOnly
                                        inputMode="decimal"
                                        placeholder="Select on map"
                                        className="h-11"
                                    />
                                </div>
                                <div className="grid min-w-0 gap-2">
                                    <Label htmlFor="restaurant-longitude">
                                        Longitude
                                    </Label>
                                    <Input
                                        id="restaurant-longitude"
                                        value={
                                            form.data.longitude?.toFixed(6) ??
                                            ''
                                        }
                                        readOnly
                                        inputMode="decimal"
                                        placeholder="Select on map"
                                        className="h-11"
                                    />
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="restaurant-cuisine">
                                    Cuisine type
                                </Label>
                                <Input
                                    id="restaurant-cuisine"
                                    value={form.data.cuisine_type}
                                    onChange={(event) =>
                                        form.setData(
                                            'cuisine_type',
                                            event.target.value,
                                        )
                                    }
                                    placeholder="e.g. Filipino, Cafe, Seafood"
                                    className="h-11"
                                    aria-invalid={Boolean(
                                        form.errors.cuisine_type,
                                    )}
                                />
                                <InputError
                                    message={form.errors.cuisine_type}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-1">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-11"
                                    onClick={() => {
                                        setStep(1);
                                        window.scrollTo({
                                            top: 0,
                                            behavior: 'smooth',
                                        });
                                    }}
                                >
                                    <ArrowLeft /> Back
                                </Button>
                                <Button
                                    type="submit"
                                    className="h-11"
                                    disabled={form.processing}
                                >
                                    {form.processing && <Spinner />}
                                    Submit
                                </Button>
                            </div>
                        </div>
                    )}
                </form>

                <div className="text-muted-foreground space-y-2 text-center text-sm">
                    <p>
                        Looking for a customer account?{' '}
                        <TextLink href={registerCustomer()}>
                            Register as a customer
                        </TextLink>
                    </p>
                    <p>
                        Already registered?{' '}
                        <TextLink href={login()}>Log in</TextLink>
                    </p>
                </div>
            </div>
        </>
    );
}

RegisterRestaurant.layout = {
    title: 'Register your restaurant',
    description:
        'Create an owner account and submit your restaurant for review',
};
