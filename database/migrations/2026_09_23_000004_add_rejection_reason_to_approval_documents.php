<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('restaurant_documents', function (Blueprint $table) {
            $table->text('rejection_reason')->nullable()->after('status');
        });

        Schema::table('rider_documents', function (Blueprint $table) {
            $table->text('rejection_reason')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('restaurant_documents', function (Blueprint $table) {
            $table->dropColumn('rejection_reason');
        });

        Schema::table('rider_documents', function (Blueprint $table) {
            $table->dropColumn('rejection_reason');
        });
    }
};
