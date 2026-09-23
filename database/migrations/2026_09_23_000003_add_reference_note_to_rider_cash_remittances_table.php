<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rider_cash_remittances', function (Blueprint $table) {
            $table->string('reference_note')->nullable()->after('amount');
        });
    }

    public function down(): void
    {
        Schema::table('rider_cash_remittances', function (Blueprint $table) {
            $table->dropColumn('reference_note');
        });
    }
};
