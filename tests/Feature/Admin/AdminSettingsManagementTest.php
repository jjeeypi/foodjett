<?php

namespace Tests\Feature\Admin;

use App\Models\Admin;
use App\Models\DeliveryZone;
use App\Models\PlatformSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminSettingsManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_view_and_update_platform_settings_with_an_audit_trail(): void
    {
        $admin = Admin::factory()->create();
        $values = PlatformSetting::query()->pluck('value', 'key')->all();

        $this->actingAs($admin->user)
            ->get(route('admin.settings.platform'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/settings/platform')
                ->has('settings', 9));

        // Prime the accessor cache to prove an update invalidates it.
        $this->assertSame(15.0, PlatformSetting::getFloat('default_commission_rate', 0));
        $values['default_commission_rate'] = '18.5';

        $this->actingAs($admin->user)
            ->patch(route('admin.settings.platform.update'), ['settings' => $values])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertDatabaseHas('platform_settings', [
            'key' => 'default_commission_rate',
            'value' => '18.5',
        ]);
        $this->assertSame(18.5, PlatformSetting::getFloat('default_commission_rate', 0));
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->user_id,
            'action' => 'platform_setting.updated',
            'subject_type' => PlatformSetting::class,
        ]);
    }

    public function test_numeric_platform_settings_are_validated(): void
    {
        $admin = Admin::factory()->create();
        $values = PlatformSetting::query()->pluck('value', 'key')->all();
        $values['admin_alert_after_minutes'] = 'soon';

        $this->actingAs($admin->user)
            ->patch(route('admin.settings.platform.update'), ['settings' => $values])
            ->assertSessionHasErrors('settings.admin_alert_after_minutes');
    }

    public function test_admin_can_manage_circle_delivery_zones_and_actions_are_audited(): void
    {
        $admin = Admin::factory()->create();

        $this->actingAs($admin->user)
            ->post(route('admin.settings.delivery-zones.store'), [
                'name' => 'Downtown Circle',
                'center_latitude' => 9.3068,
                'center_longitude' => 123.3054,
                'radius_km' => 4.5,
                'is_active' => true,
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $zone = DeliveryZone::query()->where('name', 'Downtown Circle')->firstOrFail();
        $this->assertSame('circle', $zone->polygon['type']);
        $this->assertSame([9.3068, 123.3054], $zone->polygon['center']);

        $this->actingAs($admin->user)
            ->get(route('admin.settings.delivery-zones'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/settings/delivery-zones')
                ->has('zones.data', 1)
                ->where('zones.data.0.geometry_type', 'circle'));

        $this->actingAs($admin->user)
            ->patch(route('admin.settings.delivery-zones.update', $zone), [
                'name' => 'Expanded Downtown',
                'center_latitude' => 9.31,
                'center_longitude' => 123.31,
                'radius_km' => 6,
                'is_active' => true,
            ])
            ->assertRedirect();

        $this->actingAs($admin->user)
            ->patch(route('admin.settings.delivery-zones.toggle', $zone))
            ->assertRedirect();

        $this->assertDatabaseHas('delivery_zones', [
            'id' => $zone->id,
            'name' => 'Expanded Downtown',
            'is_active' => false,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'delivery_zone.created',
            'subject_id' => $zone->id,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'delivery_zone.updated',
            'subject_id' => $zone->id,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'delivery_zone.deactivated',
            'subject_id' => $zone->id,
        ]);

        $this->actingAs($admin->user)
            ->delete(route('admin.settings.delivery-zones.destroy', $zone))
            ->assertRedirect();

        $this->assertDatabaseMissing('delivery_zones', ['id' => $zone->id]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'delivery_zone.deleted',
            'subject_id' => $zone->id,
        ]);
    }

    public function test_admin_can_create_and_manage_another_admin_but_not_suspend_self(): void
    {
        $admin = Admin::factory()->create();

        $this->actingAs($admin->user)
            ->post(route('admin.settings.admins.store'), [
                'name' => 'Finance Admin',
                'email' => 'finance.admin@example.com',
                'phone' => '09171234567',
                'password' => 'secure-password',
                'password_confirmation' => 'secure-password',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $created = User::query()->where('email', 'finance.admin@example.com')->firstOrFail();
        $this->assertSame('admin', $created->role);
        $this->assertSame('active', $created->status);
        $this->assertNotNull($created->email_verified_at);
        $this->assertNotNull($created->admin);
        $this->assertTrue(Hash::check('secure-password', $created->password));
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'admin.created',
            'subject_id' => $created->id,
        ]);

        $this->actingAs($admin->user)
            ->patch(route('admin.settings.admins.status', $created), ['status' => 'suspended'])
            ->assertRedirect();
        $this->assertSame('suspended', $created->fresh()->status);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'admin.suspended',
            'subject_id' => $created->id,
        ]);

        $this->actingAs($admin->user)
            ->patch(route('admin.settings.admins.status', $admin->user), ['status' => 'suspended'])
            ->assertSessionHasErrors('status');
        $this->assertSame('active', $admin->user->fresh()->status);
    }

    public function test_new_restaurant_uses_the_configured_default_commission_rate(): void
    {
        PlatformSetting::query()
            ->where('key', 'default_commission_rate')
            ->update(['value' => '12.75']);
        PlatformSetting::forgetCached('default_commission_rate');

        $this->post(route('register.restaurant.store'), [
            'name' => 'Maria Santos',
            'email' => 'settings-owner@example.com',
            'phone' => '09175555555',
            'password' => 'password',
            'password_confirmation' => 'password',
            'restaurant_name' => 'Settings Kitchen',
            'address' => 'Dumaguete City',
            'latitude' => 9.3068,
            'longitude' => 123.3054,
            'cuisine_type' => 'Filipino',
        ])->assertRedirect(route('restaurant.pending'));

        $this->assertDatabaseHas('restaurants', [
            'name' => 'Settings Kitchen',
            'commission_rate' => 12.75,
        ]);
    }

    public function test_non_admin_cannot_access_settings_routes(): void
    {
        $customer = User::factory()->customer()->create();
        $customer->customer()->create();

        $this->actingAs($customer)
            ->get(route('admin.settings.platform'))
            ->assertForbidden();
        $this->actingAs($customer)
            ->get(route('admin.settings.delivery-zones'))
            ->assertForbidden();
        $this->actingAs($customer)
            ->get(route('admin.settings.admins'))
            ->assertForbidden();
    }
}
