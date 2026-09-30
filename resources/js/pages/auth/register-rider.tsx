import { Head, useForm } from '@inertiajs/react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import StepIndicator from '@/components/auth/step-indicator';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { login, register as registerCustomer } from '@/routes';
import { store } from '@/routes/register/rider';

type Props = {
    passwordRules: string;
};

type VehicleType = '' | 'motorcycle' | 'bicycle' | 'car';

type RiderRegistration = {
    name: string;
    email: string;
    phone: string;
    password: string;
    password_confirmation: string;
    vehicle_type: VehicleType;
    plate_number: string;
};

const accountFields: (keyof RiderRegistration)[] = [
    'name',
    'email',
    'phone',
    'password',
    'password_confirmation',
];

export default function RegisterRider({ passwordRules }: Props) {
    const [step, setStep] = useState(1);
    const form = useForm<RiderRegistration>({
        name: '',
        email: '',
        phone: '',
        password: '',
        password_confirmation: '',
        vehicle_type: '',
        plate_number: '',
    });

    const validateAccount = () => {
        form.clearErrors(...accountFields);
        let valid = true;
        const require = (field: keyof RiderRegistration, message: string) => {
            if (String(form.data[field]).trim() === '') {
                form.setError(field, message);
                valid = false;
            }
        };

        require('name', 'Enter your full name.');
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

    const validateVehicle = () => {
        form.clearErrors('vehicle_type', 'plate_number');
        let valid = true;

        if (!form.data.vehicle_type) {
            form.setError('vehicle_type', 'Select a vehicle type.');
            valid = false;
        }
        if (
            form.data.vehicle_type &&
            form.data.vehicle_type !== 'bicycle' &&
            !form.data.plate_number.trim()
        ) {
            form.setError(
                'plate_number',
                'Enter the plate number for this vehicle.',
            );
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
        if (!validateVehicle()) return;

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
            <Head title="Register as a rider" />

            <div className="flex min-w-0 flex-col gap-6">
                <StepIndicator
                    current={step}
                    total={2}
                    label={step === 1 ? 'Account' : 'Vehicle information'}
                />

                <form onSubmit={submit} noValidate className="space-y-6">
                    {step === 1 ? (
                        <div className="grid gap-5">
                            <div className="grid gap-2">
                                <Label htmlFor="rider-name">Full name</Label>
                                <Input
                                    id="rider-name"
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
                                <Label htmlFor="rider-email">
                                    Email address
                                </Label>
                                <Input
                                    id="rider-email"
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
                                    placeholder="rider@example.com"
                                    className="h-11"
                                    aria-invalid={Boolean(form.errors.email)}
                                />
                                <InputError message={form.errors.email} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="rider-phone">
                                    Phone number
                                </Label>
                                <Input
                                    id="rider-phone"
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
                                <Label htmlFor="rider-password">Password</Label>
                                <PasswordInput
                                    id="rider-password"
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
                                <Label htmlFor="rider-password-confirmation">
                                    Confirm password
                                </Label>
                                <PasswordInput
                                    id="rider-password-confirmation"
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
                                <Label htmlFor="rider-vehicle">
                                    Vehicle type
                                </Label>
                                <Select
                                    value={form.data.vehicle_type}
                                    onValueChange={(value) => {
                                        form.setData(
                                            'vehicle_type',
                                            value as VehicleType,
                                        );
                                        form.clearErrors('vehicle_type');
                                    }}
                                >
                                    <SelectTrigger
                                        id="rider-vehicle"
                                        className="h-11 w-full"
                                        aria-invalid={Boolean(
                                            form.errors.vehicle_type,
                                        )}
                                    >
                                        <SelectValue placeholder="Select a vehicle" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="motorcycle">
                                            Motorcycle
                                        </SelectItem>
                                        <SelectItem value="bicycle">
                                            Bicycle
                                        </SelectItem>
                                        <SelectItem value="car">Car</SelectItem>
                                    </SelectContent>
                                </Select>
                                <InputError
                                    message={form.errors.vehicle_type}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="rider-plate-number">
                                    Plate number
                                </Label>
                                <Input
                                    id="rider-plate-number"
                                    value={form.data.plate_number}
                                    onChange={(event) =>
                                        form.setData(
                                            'plate_number',
                                            event.target.value.toUpperCase(),
                                        )
                                    }
                                    type="text"
                                    autoCapitalize="characters"
                                    placeholder="Optional for bicycles"
                                    className="h-11"
                                    aria-invalid={Boolean(
                                        form.errors.plate_number,
                                    )}
                                />
                                <InputError
                                    message={form.errors.plate_number}
                                />
                                <p className="text-muted-foreground text-xs">
                                    Required for motorcycles and cars; optional
                                    for bicycles.
                                </p>
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

RegisterRider.layout = {
    title: 'Become a FoodJett rider',
    description:
        'Create an account and submit your rider application for review',
};
