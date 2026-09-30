<?php

namespace Tests\Feature\Rider;

use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\Order;
use App\Models\Restaurant;
use App\Models\Rider;
use App\Models\RiderCashRemittance;
use App\Models\RiderDocument;
use App\Models\RiderEarning;
use App\Models\RiderPayout;
use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class RiderAccountTest extends TestCase
{
    use RefreshDatabase;

    public function test_account_page_contains_the_riders_profile_documents_and_payout_details(): void
    {
        $rider = Rider::factory()->approved()->create([
            'vehicle_type' => 'motorcycle',
            'plate_number' => 'ABC-1234',
            'payout_method' => 'ewallet',
            'payout_account_details' => [
                'account_name' => 'Test Rider',
                'provider' => 'GCash',
                'account_number' => '09171234567',
            ],
        ]);
        RiderDocument::factory()->create([
            'rider_id' => $rider->id,
            'type' => 'drivers_license',
            'status' => 'rejected',
            'rejection_reason' => 'The image is blurry.',
        ]);

        $this->actingAs($rider->user)
            ->get(route('rider.account'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('rider/account/index')
                ->where('rider.vehicle_type', 'motorcycle')
                ->where('rider.plate_number', 'ABC-1234')
                ->where('rider.payout_method', 'ewallet')
                ->where('rider.payout_account_details.provider', 'GCash')
                ->has('passwordRules')
                ->has('documents', 4)
                ->where('documents.0.type', 'drivers_license')
                ->where('documents.0.status', 'rejected')
                ->where('documents.0.rejection_reason', 'The image is blurry.'));
    }

    public function test_rider_can_update_profile_and_email_change_requires_verification_again(): void
    {
        Storage::fake('public');
        Notification::fake();
        $rider = Rider::factory()->approved()->create();
        User::factory()->create(['phone' => '09170000000']);

        $this->actingAs($rider->user)
            ->from(route('rider.account'))
            ->patch(route('rider.account.profile.update'), [
                'name' => $rider->user->name,
                'email' => $rider->user->email,
                'phone' => '09170000000',
            ])
            ->assertSessionHasErrors('phone');

        $this->actingAs($rider->user)
            ->post(route('rider.account.profile.update'), [
                '_method' => 'patch',
                'name' => 'Updated Rider',
                'email' => 'updated-rider@example.com',
                'phone' => '09171111111',
                'avatar' => UploadedFile::fake()->create('avatar.jpg', 100, 'image/jpeg'),
            ])
            ->assertRedirect(route('rider.account'))
            ->assertSessionHasNoErrors();

        $user = $rider->user->refresh();
        $this->assertSame('Updated Rider', $user->name);
        $this->assertSame('updated-rider@example.com', $user->email);
        $this->assertSame('09171111111', $user->phone);
        $this->assertNull($user->email_verified_at);
        $this->assertNotNull($user->avatar_path);
        Storage::disk('public')->assertExists($user->avatar_path);
        Notification::assertSentTo($user, VerifyEmail::class);
    }

    public function test_vehicle_and_encrypted_payout_updates_stay_scoped_to_the_authenticated_rider(): void
    {
        $rider = Rider::factory()->approved()->create();
        $otherRider = Rider::factory()->approved()->create([
            'vehicle_type' => 'bicycle',
            'plate_number' => null,
        ]);

        $this->actingAs($rider->user)
            ->patch(route('rider.account.vehicle.update'), [
                'vehicle_type' => 'car',
                'plate_number' => 'NEW-123',
            ])
            ->assertSessionHasNoErrors();

        $this->actingAs($rider->user)
            ->patch(route('rider.account.payout.update'), [
                'payout_method' => 'bank',
                'account_name' => 'Updated Rider',
                'provider' => 'Test Bank',
                'account_number' => '1234567890',
            ])
            ->assertSessionHasNoErrors();

        $rider->refresh();
        $this->assertSame('car', $rider->vehicle_type);
        $this->assertSame('NEW-123', $rider->plate_number);
        $this->assertSame('approved', $rider->approval_status);
        $this->assertSame('bank', $rider->payout_method);
        $this->assertSame('1234567890', $rider->payout_account_details['account_number']);

        $stored = (string) DB::table('riders')
            ->where('id', $rider->id)
            ->value('payout_account_details');
        $this->assertStringNotContainsString('1234567890', $stored);
        $this->assertSame('bicycle', $otherRider->refresh()->vehicle_type);
    }

    public function test_replacing_a_verified_document_resets_only_that_document_to_pending(): void
    {
        Storage::fake('public');
        $rider = Rider::factory()->approved()->create();
        $otherRider = Rider::factory()->approved()->create();
        $oldPath = UploadedFile::fake()->create('old-license.jpg', 100, 'image/jpeg')
            ->store("rider-documents/{$rider->id}", 'public');
        $document = RiderDocument::factory()->create([
            'rider_id' => $rider->id,
            'type' => 'drivers_license',
            'file_path' => $oldPath,
            'status' => 'verified',
        ]);
        $otherDocument = RiderDocument::factory()->create([
            'rider_id' => $otherRider->id,
            'type' => 'drivers_license',
            'status' => 'verified',
        ]);

        $this->actingAs($rider->user)
            ->post(route('rider.account.documents.replace', 'drivers_license'), [
                'document' => UploadedFile::fake()->create(
                    'new-license.pdf',
                    500,
                    'application/pdf',
                ),
            ])
            ->assertSessionHasNoErrors();

        $document->refresh();
        $this->assertSame('pending', $document->status);
        $this->assertNull($document->rejection_reason);
        $this->assertNotSame($oldPath, $document->file_path);
        Storage::disk('public')->assertMissing($oldPath);
        Storage::disk('public')->assertExists($document->file_path);
        $this->assertSame('approved', $rider->refresh()->approval_status);
        $this->assertSame('verified', $otherDocument->refresh()->status);
    }

    public function test_account_deletion_anonymizes_personal_data_but_preserves_financial_history(): void
    {
        Storage::fake('public');
        $rider = Rider::factory()->approved()->create([
            'plate_number' => 'PRIVATE-1',
            'payout_method' => 'ewallet',
            'payout_account_details' => ['account_number' => '09179999999'],
        ]);
        $user = $rider->user;
        $avatarPath = UploadedFile::fake()->create('avatar.jpg', 100, 'image/jpeg')
            ->store('avatars', 'public');
        $documentPath = UploadedFile::fake()->create('license.jpg', 100, 'image/jpeg')
            ->store("rider-documents/{$rider->id}", 'public');
        $user->update(['avatar_path' => $avatarPath, 'phone' => '09172222222']);
        $document = RiderDocument::factory()->create([
            'rider_id' => $rider->id,
            'type' => 'drivers_license',
            'file_path' => $documentPath,
        ]);
        $earning = $this->createEarning($rider);
        $payout = RiderPayout::query()->create([
            'rider_id' => $rider->id,
            'period_start' => now()->startOfMonth(),
            'period_end' => now(),
            'total_amount' => 100,
            'status' => 'paid',
            'paid_at' => now(),
        ]);
        $remittance = RiderCashRemittance::query()->create([
            'rider_id' => $rider->id,
            'amount' => 50,
            'status' => 'pending',
        ]);

        $this->actingAs($user)
            ->delete(route('rider.account.destroy'), ['password' => 'password'])
            ->assertRedirect('/');

        $this->assertGuest();
        $user->refresh();
        $rider->refresh();
        $this->assertSame("Deleted Rider #{$user->id}", $user->name);
        $this->assertNull($user->email);
        $this->assertNull($user->phone);
        $this->assertNull($user->avatar_path);
        $this->assertSame('banned', $user->status);
        $this->assertNull($rider->plate_number);
        $this->assertNull($rider->payout_method);
        $this->assertNull($rider->payout_account_details);
        $this->assertModelMissing($document);
        $this->assertModelExists($earning);
        $this->assertModelExists($payout);
        $this->assertModelExists($remittance);
        Storage::disk('public')->assertMissing($avatarPath);
        Storage::disk('public')->assertMissing($documentPath);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'action' => 'rider.account_anonymized',
            'subject_id' => $rider->id,
        ]);
    }

    private function createEarning(Rider $rider): RiderEarning
    {
        $customer = Customer::factory()->create();
        $address = CustomerAddress::factory()->create(['customer_id' => $customer->id]);
        $restaurant = Restaurant::factory()->approved()->create();
        $order = Order::query()->create([
            'order_number' => 'FJ-ACCOUNT-'.fake()->unique()->numerify('####'),
            'customer_id' => $customer->id,
            'restaurant_id' => $restaurant->id,
            'customer_address_id' => $address->id,
            'rider_id' => $rider->id,
            'status' => 'delivered',
            'subtotal' => 100,
            'delivery_fee' => 40,
            'service_fee' => 0,
            'discount_amount' => 0,
            'tip_amount' => 0,
            'total_amount' => 140,
            'payment_method' => 'cod',
            'placed_at' => now()->subHour(),
            'delivered_at' => now(),
        ]);

        return RiderEarning::query()->create([
            'rider_id' => $rider->id,
            'order_id' => $order->id,
            'base_pay' => 40,
            'distance_pay' => 20,
            'waiting_pay' => 10,
            'incentive_pay' => 20,
            'tip_amount' => 10,
            'total_earned' => 100,
        ]);
    }
}
