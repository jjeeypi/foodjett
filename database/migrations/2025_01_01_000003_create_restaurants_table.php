<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('restaurants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('logo_path')->nullable();
            $table->string('cover_photo_path')->nullable();
            $table->string('cuisine_type')->nullable();
            $table->string('address');
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->unsignedInteger('default_prep_time_minutes')->default(15);
            $table->decimal('min_order_amount', 8, 2)->default(0);
            $table->decimal('commission_rate', 5, 2)->default(15.00);
            $table->enum('approval_status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->text('rejection_reason')->nullable();
            $table->enum('operating_status', ['open', 'closed', 'temporarily_closed'])->default('closed');
            $table->enum('payout_method', ['bank', 'ewallet'])->nullable();
            $table->json('payout_account_details')->nullable();
            $table->timestamps();

            $table->index(['approval_status', 'operating_status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('restaurants');
    }
};
