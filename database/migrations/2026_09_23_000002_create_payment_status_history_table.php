<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_status_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->constrained()->cascadeOnDelete();
            $table->enum('from_status', ['pending', 'paid', 'refunded', 'partially_refunded', 'failed'])->nullable();
            $table->enum('to_status', ['pending', 'paid', 'refunded', 'partially_refunded', 'failed']);
            $table->enum('changed_by', ['customer', 'rider', 'admin', 'system']);
            $table->text('note')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_status_history');
    }
};
