<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rider_cash_remittances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rider_id')->constrained()->cascadeOnDelete();
            $table->decimal('amount', 8, 2);
            $table->enum('status', ['pending', 'confirmed'])->default('pending');
            $table->foreignId('confirmed_by_admin_id')->nullable()->constrained('admins')->nullOnDelete();
            $table->timestamp('remitted_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rider_cash_remittances');
    }
};
