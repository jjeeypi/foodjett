import { Form, Head } from '@inertiajs/react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { login, register as registerCustomer } from '@/routes';
import { store } from '@/routes/register/rider';

type Props = {
    passwordRules: string;
};

export default function RegisterRider({ passwordRules }: Props) {
    return (
        <>
            <Head title="Register as a rider" />

            <Form
                {...store.form()}
                resetOnSuccess={['password', 'password_confirmation']}
                disableWhileProcessing
                className="flex flex-col gap-6"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-5">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Full name</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    required
                                    autoFocus
                                    autoComplete="name"
                                    placeholder="Full name"
                                />
                                <InputError message={errors.name} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="email">Email address</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    required
                                    autoComplete="email"
                                    placeholder="rider@example.com"
                                />
                                <InputError message={errors.email} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="phone">Phone number</Label>
                                <Input
                                    id="phone"
                                    name="phone"
                                    type="tel"
                                    required
                                    autoComplete="tel"
                                    placeholder="09XX XXX XXXX"
                                />
                                <InputError message={errors.phone} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="vehicle_type">
                                    Vehicle type
                                </Label>
                                <select
                                    id="vehicle_type"
                                    name="vehicle_type"
                                    required
                                    defaultValue=""
                                    className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                                >
                                    <option value="" disabled>
                                        Select a vehicle
                                    </option>
                                    <option value="motorcycle">
                                        Motorcycle
                                    </option>
                                    <option value="bicycle">Bicycle</option>
                                    <option value="car">Car</option>
                                </select>
                                <InputError message={errors.vehicle_type} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="plate_number">
                                    Plate number
                                </Label>
                                <Input
                                    id="plate_number"
                                    name="plate_number"
                                    placeholder="Optional for bicycles"
                                />
                                <InputError message={errors.plate_number} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password">Password</Label>
                                <PasswordInput
                                    id="password"
                                    name="password"
                                    required
                                    autoComplete="new-password"
                                    placeholder="Password"
                                    passwordrules={passwordRules}
                                />
                                <InputError message={errors.password} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password_confirmation">
                                    Confirm password
                                </Label>
                                <PasswordInput
                                    id="password_confirmation"
                                    name="password_confirmation"
                                    required
                                    autoComplete="new-password"
                                    placeholder="Confirm password"
                                    passwordrules={passwordRules}
                                />
                                <InputError
                                    message={errors.password_confirmation}
                                />
                            </div>

                            <Button type="submit" className="mt-2 w-full">
                                {processing && <Spinner />}
                                Submit rider application
                            </Button>
                        </div>

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
                    </>
                )}
            </Form>
        </>
    );
}

RegisterRider.layout = {
    title: 'Become a FoodJett rider',
    description:
        'Create an account and submit your rider application for review',
};
