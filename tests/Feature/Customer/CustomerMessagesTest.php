<?php

namespace Tests\Feature\Customer;

use App\Actions\Orders\TransitionOrderStatus;
use App\Events\MessageSent;
use App\Events\UserUnreadMessagesUpdated;
use App\Models\Admin;
use App\Models\Conversation;
use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\Message;
use App\Models\Order;
use App\Models\Restaurant;
use App\Models\Rider;
use App\Services\ConversationService;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CustomerMessagesTest extends TestCase
{
    use RefreshDatabase;

    public function test_central_status_transitions_create_each_conversation_once(): void
    {
        $order = $this->makeOrder();
        $rider = Rider::factory()->approved()->create();

        app(TransitionOrderStatus::class)->handle(
            $order,
            'accepted',
            'restaurant',
            attributes: ['accepted_at' => now()],
        );
        app(ConversationService::class)->forOrder(
            $order,
            Conversation::CUSTOMER_RESTAURANT,
        );

        $this->assertDatabaseCount('conversations', 1);
        $this->assertDatabaseHas('conversations', [
            'order_id' => $order->id,
            'type' => Conversation::CUSTOMER_RESTAURANT,
        ]);

        app(TransitionOrderStatus::class)->handle(
            $order,
            'rider_assigned',
            'rider',
            attributes: [
                'rider_id' => $rider->id,
                'rider_assigned_at' => now(),
            ],
        );

        $this->assertDatabaseCount('conversations', 2);
        $this->assertDatabaseHas('conversations', [
            'order_id' => $order->id,
            'type' => Conversation::CUSTOMER_RIDER,
        ]);

        $restaurantConversation = Conversation::query()
            ->where('order_id', $order->id)
            ->where('type', Conversation::CUSTOMER_RESTAURANT)
            ->sole();
        $riderConversation = Conversation::query()
            ->where('order_id', $order->id)
            ->where('type', Conversation::CUSTOMER_RIDER)
            ->sole();

        $this->actingAs($order->customer->user)
            ->get(route('customer.orders.show', $order))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where(
                    'order.restaurant.message_url',
                    route('customer.messages.show', $restaurantConversation, absolute: false),
                )
                ->where(
                    'order.rider.message_url',
                    route('customer.messages.show', $riderConversation, absolute: false),
                ));
    }

    public function test_customer_inbox_lists_threads_messages_and_marks_counterpart_messages_read(): void
    {
        $order = $this->makeOrder(status: 'accepted');
        $conversation = app(ConversationService::class)->forOrder(
            $order,
            Conversation::CUSTOMER_RESTAURANT,
        );
        $message = Message::query()->create([
            'conversation_id' => $conversation->id,
            'sender_user_id' => $order->restaurant->user_id,
            'body' => 'Your order will be ready shortly.',
        ]);

        $this->actingAs($order->customer->user)
            ->get(route('customer.messages.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('customer/messages/index')
                ->has('conversations', 1)
                ->where('conversations.0.id', $conversation->id)
                ->where('conversations.0.unread_count', 1)
                ->where('conversations.0.last_message.body', $message->body)
                ->where('customerContext.unread_messages', 1));

        $this->actingAs($order->customer->user)
            ->get(route('customer.messages.show', $conversation))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('customer/messages/index')
                ->where('selectedConversation.id', $conversation->id)
                ->where('messages.data.0.id', $message->id));

        $this->actingAs($order->customer->user)
            ->patchJson(route('customer.messages.read', $conversation))
            ->assertOk()
            ->assertJsonPath('unread_count', 0);

        $this->assertNotNull($message->refresh()->read_at);
    }

    public function test_sending_is_participant_only_and_broadcasts_the_message_and_unread_update(): void
    {
        Event::fake([MessageSent::class, UserUnreadMessagesUpdated::class]);
        $order = $this->makeOrder(status: 'accepted');
        $conversation = app(ConversationService::class)->forOrder(
            $order,
            Conversation::CUSTOMER_RESTAURANT,
        );
        $otherCustomer = Customer::factory()->create();

        $this->actingAs($otherCustomer->user)
            ->postJson(route('customer.messages.store', $conversation), [
                'body' => 'I should not be able to send this.',
            ])
            ->assertForbidden();

        $this->actingAs($order->customer->user)
            ->postJson(route('customer.messages.store', $conversation), [
                'body' => 'Please leave it with the guard.',
            ])
            ->assertCreated()
            ->assertJsonPath('message.body', 'Please leave it with the guard.');

        $message = Message::query()->sole();
        $this->assertSame($order->customer->user_id, $message->sender_user_id);
        Event::assertDispatched(
            MessageSent::class,
            fn (MessageSent $event): bool => $event->id === $message->id
                && $event->conversation_id === $conversation->id,
        );
        Event::assertDispatched(
            UserUnreadMessagesUpdated::class,
            fn (UserUnreadMessagesUpdated $event): bool => $event->user_id === $order->restaurant->user_id
                && $event->conversation_unread_count === 1,
        );
    }

    public function test_policy_supports_each_participant_and_makes_admins_view_only(): void
    {
        $order = $this->makeOrder(status: 'rider_assigned');
        $rider = Rider::factory()->approved()->create();
        $order->update(['rider_id' => $rider->id]);
        $restaurantConversation = app(ConversationService::class)->forOrder(
            $order,
            Conversation::CUSTOMER_RESTAURANT,
        );
        $riderConversation = app(ConversationService::class)->forOrder(
            $order,
            Conversation::CUSTOMER_RIDER,
        );
        $admin = Admin::factory()->create();
        $otherRider = Rider::factory()->approved()->create();

        $this->assertTrue(Gate::forUser($order->customer->user)->allows('view', $restaurantConversation));
        $this->assertTrue(Gate::forUser($order->restaurant->user)->allows('send', $restaurantConversation));
        $this->assertTrue(Gate::forUser($rider->user)->allows('send', $riderConversation));
        $this->assertFalse(Gate::forUser($otherRider->user)->allows('view', $riderConversation));
        $this->assertTrue(Gate::forUser($admin->user)->allows('view', $riderConversation));
        $this->assertFalse(Gate::forUser($admin->user)->allows('send', $riderConversation));
    }

    public function test_terminal_order_schedules_chat_closure_after_the_configured_grace_period(): void
    {
        $order = $this->makeOrder(status: 'accepted');
        $conversation = app(ConversationService::class)->forOrder(
            $order,
            Conversation::CUSTOMER_RESTAURANT,
        );

        app(TransitionOrderStatus::class)->handle(
            $order,
            'delivered',
            'rider',
            attributes: ['delivered_at' => now()],
        );

        $conversation->refresh();
        $this->assertNotNull($conversation->closed_at);
        $this->assertTrue($conversation->closed_at->isSameMinute(now()->addMinutes(30)));
        $this->assertTrue(Gate::forUser($order->customer->user)->allows('send', $conversation));

        $this->travel(31)->minutes();

        $this->assertFalse(Gate::forUser($order->customer->user)->allows('send', $conversation));
        $this->actingAs($order->customer->user)
            ->postJson(route('customer.messages.store', $conversation), ['body' => 'Too late'])
            ->assertForbidden();
    }

    public function test_private_channels_use_the_same_participant_rules_and_user_channel_is_owner_only(): void
    {
        $order = $this->makeOrder(status: 'accepted');
        $conversation = app(ConversationService::class)->forOrder(
            $order,
            Conversation::CUSTOMER_RESTAURANT,
        );
        $otherCustomer = Customer::factory()->create();
        $admin = Admin::factory()->create();
        $conversationAuthorizer = Broadcast::getChannels()->get('conversation.{conversationId}');
        $notificationAuthorizer = Broadcast::getChannels()->get('user.{userId}.notifications');

        $this->assertIsCallable($conversationAuthorizer);
        $this->assertTrue($conversationAuthorizer($order->customer->user, $conversation->id));
        $this->assertTrue($conversationAuthorizer($order->restaurant->user, $conversation->id));
        $this->assertTrue($conversationAuthorizer($admin->user, $conversation->id));
        $this->assertFalse($conversationAuthorizer($otherCustomer->user, $conversation->id));

        $this->assertIsCallable($notificationAuthorizer);
        $this->assertTrue($notificationAuthorizer($order->customer->user, $order->customer->user_id));
        $this->assertFalse($notificationAuthorizer($otherCustomer->user, $order->customer->user_id));

        $message = Message::query()->create([
            'conversation_id' => $conversation->id,
            'sender_user_id' => $order->customer->user_id,
            'body' => 'Is the order ready?',
        ]);
        $event = new MessageSent($message);

        $this->assertInstanceOf(PrivateChannel::class, $event->broadcastOn()[0]);
        $this->assertSame(
            "private-conversation.{$conversation->id}",
            $event->broadcastOn()[0]->name,
        );
    }

    private function makeOrder(?Customer $customer = null, string $status = 'placed'): Order
    {
        $customer ??= Customer::factory()->create();
        $address = CustomerAddress::factory()->create(['customer_id' => $customer->id]);
        $restaurant = Restaurant::factory()->approved()->create();

        return Order::query()->create([
            'order_number' => 'FJ-'.fake()->unique()->numerify('########'),
            'customer_id' => $customer->id,
            'restaurant_id' => $restaurant->id,
            'customer_address_id' => $address->id,
            'status' => $status,
            'subtotal' => 200,
            'delivery_fee' => 50,
            'service_fee' => 10,
            'discount_amount' => 0,
            'tip_amount' => 0,
            'total_amount' => 260,
            'commission_amount' => 30,
            'payment_method' => 'cod',
            'placed_at' => now(),
            'accepted_at' => $status === 'placed' ? null : now(),
        ]);
    }
}
