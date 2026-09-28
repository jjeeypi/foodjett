<?php

namespace Tests\Feature\Customer;

use App\Models\Customer;
use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CustomerProfileAccountTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_profile_page_uses_customer_layout_component(): void
    {
        $customer = Customer::factory()->create();

        $this->actingAs($customer->user)
            ->get(route('customer.account.profile.edit'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('customer/account/profile')
                ->where('mustVerifyEmail', true)
                ->has('passwordRules'));
    }

    public function test_customer_can_update_phone_and_avatar_and_phone_stays_unique(): void
    {
        Storage::fake('public');
        $customer = Customer::factory()->create();
        $other = User::factory()->create(['phone' => '09170000000']);

        $this->actingAs($customer->user)
            ->post(route('customer.account.profile.update'), [
                '_method' => 'patch',
                'name' => 'Updated Customer',
                'email' => $customer->user->email,
                'phone' => '09171111111',
                'avatar' => UploadedFile::fake()->create('avatar.jpg', 100, 'image/jpeg'),
            ])
            ->assertRedirect(route('customer.account.profile.edit'))
            ->assertSessionHasNoErrors();

        $customer->user->refresh();
        $this->assertSame('Updated Customer', $customer->user->name);
        $this->assertSame('09171111111', $customer->user->phone);
        $this->assertNotNull($customer->user->avatar_path);
        Storage::disk('public')->assertExists($customer->user->avatar_path);

        $this->actingAs($customer->user)
            ->from(route('customer.account.profile.edit'))
            ->patch(route('customer.account.profile.update'), [
                'name' => $customer->user->name,
                'email' => $customer->user->email,
                'phone' => $other->phone,
            ])
            ->assertSessionHasErrors('phone');
    }

    public function test_email_change_resets_verification_and_sends_a_new_notice(): void
    {
        Notification::fake();
        $customer = Customer::factory()->create();

        $this->actingAs($customer->user)
            ->patch(route('customer.account.profile.update'), [
                'name' => $customer->user->name,
                'email' => 'changed@example.com',
                'phone' => null,
            ])
            ->assertSessionHasNoErrors();

        $this->assertNull($customer->user->refresh()->email_verified_at);
        Notification::assertSentTo($customer->user, VerifyEmail::class);
    }

    public function test_customer_account_deletion_anonymizes_instead_of_deleting_history(): void
    {
        Storage::fake('public');
        $customer = Customer::factory()->create();
        $user = $customer->user;
        $user->update([
            'phone' => '09172222222',
            'avatar_path' => UploadedFile::fake()
                ->create('old.jpg', 100, 'image/jpeg')
                ->store('avatars', 'public'),
        ]);

        $this->actingAs($user)
            ->delete(route('customer.account.profile.destroy'), [
                'password' => 'password',
            ])
            ->assertRedirect('/');

        $this->assertGuest();
        $user->refresh();
        $this->assertSame("Deleted Customer #{$user->id}", $user->name);
        $this->assertNull($user->email);
        $this->assertNull($user->phone);
        $this->assertNull($user->avatar_path);
        $this->assertSame('banned', $user->status);
        $this->assertModelExists($customer);
    }
}
