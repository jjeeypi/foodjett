<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Custom app notifications table.
    // If you also use Laravel's built-in notification classes, `php artisan notifications:table`
    // generates an equivalent table with a UUID key — you only need one of the two approaches.
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type'); // e.g. order_status_update, announcement, promo
            $table->string('title');
            $table->text('body');
            $table->json('data')->nullable(); // e.g. {"order_id": 123}
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
