<?php

namespace Tests\Feature\Customer;

use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\Order;
use App\Models\Restaurant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerAddressesTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_manage_addresses_and_exactly_one_default(): void
    {
        $customer = Customer::factory()->create();

        $this->actingAs($customer->user)
            ->post(route('customer.account.addresses.store'), $this->addressData('Home'))
            ->assertSessionHasNoErrors();
        $home = $customer->addresses()->sole();
        $this->assertTrue($home->is_default);

        $this->actingAs($customer->user)
            ->post(route('customer.account.addresses.store'), $this->addressData('Work'))
            ->assertSessionHasNoErrors();
        $work = $customer->addresses()->where('label', 'Work')->sole();
        $this->assertFalse($work->is_default);

        $this->actingAs($customer->user)
            ->patch(route('customer.account.addresses.default', $work))
            ->assertSessionHasNoErrors();

        $this->assertSame(1, $customer->addresses()->where('is_default', true)->count());
        $this->assertTrue($work->refresh()->is_default);
        $this->assertFalse($home->refresh()->is_default);

        $this->actingAs($customer->user)
            ->patch(route('customer.account.addresses.update', $work), [
                ...$this->addressData('Office'),
                'address_line' => 'Updated office address',
            ])
            ->assertSessionHasNoErrors();
        $this->assertSame('Updated office address', $work->refresh()->address_line);
    }

    public function test_first_address_can_be_saved_outside_a_zone_with_a_warning_instead_of_a_block(): void
    {
        $customer = Customer::factory()->create();

        $this->actingAs($customer->user)
            ->from(route('customer.account.addresses.index'))
            ->post(route('customer.account.addresses.store'), $this->addressData('Home'))
            ->assertRedirect(route('customer.account.addresses.index'))
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('customer_addresses', [
            'customer_id' => $customer->id,
            'label' => 'Home',
        ]);
    }

    public function test_customer_cannot_manage_another_customers_address(): void
    {
        $customer = Customer::factory()->create();
        $other = Customer::factory()->create();
        $address = CustomerAddress::factory()->create(['customer_id' => $other->id]);

        $this->actingAs($customer->user)
            ->patch(route('customer.account.addresses.update', $address), $this->addressData('Mine'))
            ->assertForbidden();
        $this->actingAs($customer->user)
            ->delete(route('customer.account.addresses.destroy', $address))
            ->assertForbidden();
    }

    public function test_deleting_default_promotes_another_address(): void
    {
        $customer = Customer::factory()->create();
        $default = CustomerAddress::factory()->create([
            'customer_id' => $customer->id,
            'is_default' => true,
        ]);
        $replacement = CustomerAddress::factory()->create([
            'customer_id' => $customer->id,
            'is_default' => false,
        ]);

        $this->actingAs($customer->user)
            ->delete(route('customer.account.addresses.destroy', $default))
            ->assertSessionHasNoErrors();

        $this->assertModelMissing($default);
        $this->assertTrue($replacement->refresh()->is_default);
    }

    public function test_address_used_by_an_order_is_preserved(): void
    {
        $customer = Customer::factory()->create();
        $address = CustomerAddress::factory()->create([
            'customer_id' => $customer->id,
            'is_default' => true,
        ]);
        $this->makeOrder($customer, $address);

        $this->actingAs($customer->user)
            ->from(route('customer.account.addresses.index'))
            ->delete(route('customer.account.addresses.destroy', $address))
            ->assertRedirect(route('customer.account.addresses.index'))
            ->assertSessionHasErrors('address');

        $this->assertModelExists($address);
    }

    /** @return array<string, mixed> */
    private function addressData(string $label): array
    {
        return [
            'label' => $label,
            'address_line' => '123 Test Street, Cebu City',
            'landmark' => 'Near the plaza',
            'delivery_instructions' => 'Call on arrival',
            'latitude' => 10.3157,
            'longitude' => 123.8854,
        ];
    }

    private function makeOrder(Customer $customer, CustomerAddress $address): Order
    {
        $restaurant = Restaurant::factory()->approved()->create();

        return Order::query()->create([
            'order_number' => 'FJ-'.fake()->unique()->numerify('########'),
            'customer_id' => $customer->id,
            'restaurant_id' => $restaurant->id,
            'customer_address_id' => $address->id,
            'status' => 'delivered',
            'subtotal' => 200,
            'delivery_fee' => 50,
            'service_fee' => 10,
            'discount_amount' => 0,
            'tip_amount' => 0,
            'total_amount' => 260,
            'commission_amount' => 30,
            'payment_method' => 'cod',
            'placed_at' => now()->subHour(),
            'delivered_at' => now(),
        ]);
    }
}
