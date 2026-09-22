import { Form, Head } from '@inertiajs/react';
import InputError from '@/components/input-error';
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

export default function RegisterRestaurant({ passwordRules }: Props) {
    return (
        <>
            <Head title="Register your restaurant" />

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
                                <Label htmlFor="name">Owner name</Label>
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
                                    placeholder="owner@example.com"
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
                                <Label htmlFor="restaurant_name">
                                    Restaurant name
                                </Label>
                                <Input
                                    id="restaurant_name"
                                    name="restaurant_name"
                                    required
                                    placeholder="Your restaurant"
                                />
                                <InputError message={errors.restaurant_name} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="cuisine_type">
                                    Cuisine type
                                </Label>
                                <Input
                                    id="cuisine_type"
                                    name="cuisine_type"
                                    required
                                    placeholder="e.g. Filipino, Cafe, Seafood"
                                />
                                <InputError message={errors.cuisine_type} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="address">
                                    Business address
                                </Label>
                                <Input
                                    id="address"
                                    name="address"
                                    required
                                    autoComplete="street-address"
                                    placeholder="Street, barangay, city"
                                />
                                <InputError message={errors.address} />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="latitude">Latitude</Label>
                                    <Input
                                        id="latitude"
                                        name="latitude"
                                        type="number"
                                        step="any"
                                        required
                                        placeholder="9.3068"
                                    />
                                    <InputError message={errors.latitude} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="longitude">Longitude</Label>
                                    <Input
                                        id="longitude"
                                        name="longitude"
                                        type="number"
                                        step="any"
                                        required
                                        placeholder="123.3054"
                                    />
                                    <InputError message={errors.longitude} />
                                </div>
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
                                Submit restaurant application
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

RegisterRestaurant.layout = {
    title: 'Register your restaurant',
    description:
        'Create an owner account and submit your restaurant for review',
};
