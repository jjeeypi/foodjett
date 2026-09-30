<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('riders')
            ->whereNotNull('payout_account_details')
            ->select(['id', 'payout_account_details'])
            ->orderBy('id')
            ->each(function (object $rider): void {
                $details = json_decode((string) $rider->payout_account_details, true, 512, JSON_THROW_ON_ERROR);

                if (! is_array($details) || isset($details['encrypted'])) {
                    return;
                }

                DB::table('riders')->where('id', $rider->id)->update([
                    'payout_account_details' => json_encode([
                        'encrypted' => Crypt::encryptString(json_encode($details, JSON_THROW_ON_ERROR)),
                    ], JSON_THROW_ON_ERROR),
                ]);
            });
    }

    public function down(): void
    {
        DB::table('riders')
            ->whereNotNull('payout_account_details')
            ->select(['id', 'payout_account_details'])
            ->orderBy('id')
            ->each(function (object $rider): void {
                $stored = json_decode((string) $rider->payout_account_details, true, 512, JSON_THROW_ON_ERROR);
                $ciphertext = is_array($stored) ? ($stored['encrypted'] ?? null) : null;

                if (! is_string($ciphertext)) {
                    return;
                }

                DB::table('riders')->where('id', $rider->id)->update([
                    'payout_account_details' => Crypt::decryptString($ciphertext),
                ]);
            });
    }
};
