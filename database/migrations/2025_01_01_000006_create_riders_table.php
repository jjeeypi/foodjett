<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('riders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->enum('vehicle_type', ['motorcycle', 'bicycle', 'car']);
            $table->string('plate_number')->nullable();
            $table->enum('approval_status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->text('rejection_reason')->nullable();
            $table->enum('availability_status', ['offline', 'available', 'busy'])->default('offline');
            $table->decimal('current_latitude', 10, 7)->nullable();
            $table->decimal('current_longitude', 10, 7)->nullable();
            $table->timestamp('last_location_at')->nullable();
            $table->decimal('cash_on_hand', 8, 2)->default(0);
            $table->decimal('cash_remit_limit', 8, 2)->default(2000);
            $table->enum('payout_method', ['bank', 'ewallet'])->nullable();
            $table->json('payout_account_details')->nullable();
            $table->timestamps();

            $table->index(['availability_status', 'approval_status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('riders');
    }
};
