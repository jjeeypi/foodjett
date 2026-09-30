<?php

namespace App\Http\Controllers\Rider;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileDeleteRequest;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use App\Models\AuditLog;
use App\Models\Rider;
use App\Models\RiderDocument;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class AccountController extends Controller
{
    /** @var array<string, string> */
    private const DOCUMENT_TYPES = [
        'drivers_license' => "Driver's license",
        'vehicle_registration' => 'Vehicle registration',
        'valid_id' => 'Valid ID',
        'police_clearance' => 'Police clearance',
    ];

    public function index(Request $request): Response
    {
        $rider = $this->rider($request);
        $documents = $rider->documents()->latest()->get()->keyBy('type');
        $payoutDetails = $rider->payout_account_details ?? [];

        return Inertia::render('rider/account/index', [
            'mustVerifyEmail' => true,
            'status' => $request->session()->get('status'),
            'passwordRules' => Password::defaults()->toPasswordRulesString(),
            'rider' => [
                'vehicle_type' => $rider->vehicle_type,
                'plate_number' => $rider->plate_number,
                'approval_status' => $rider->approval_status,
                'payout_method' => $rider->payout_method,
                'payout_account_details' => [
                    'account_name' => $payoutDetails['account_name'] ?? '',
                    'provider' => $payoutDetails['provider'] ?? '',
                    'account_number' => $payoutDetails['account_number'] ?? '',
                ],
            ],
            'documents' => collect(self::DOCUMENT_TYPES)
                ->map(function (string $label, string $type) use ($documents): array {
                    /** @var RiderDocument|null $document */
                    $document = $documents->get($type);

                    return [
                        'id' => $document?->id,
                        'type' => $type,
                        'label' => $label,
                        'status' => $document?->status,
                        'rejection_reason' => $document?->rejection_reason,
                        'file_url' => $document === null
                            ? null
                            : Storage::disk('public')->url($document->file_path),
                    ];
                })
                ->values(),
        ]);
    }

    public function updateProfile(ProfileUpdateRequest $request): RedirectResponse
    {
        $this->rider($request);
        $user = $request->user();
        $user->fill($request->safe()->only(['name', 'email', 'phone']));
        $emailChanged = $user->isDirty('email');
        $oldAvatar = $user->avatar_path;

        if ($emailChanged) {
            $user->email_verified_at = null;
        }

        if ($request->hasFile('avatar')) {
            $user->avatar_path = $request->file('avatar')->store('avatars', 'public');
        }

        $user->save();

        if ($request->hasFile('avatar') && $oldAvatar !== null) {
            Storage::disk('public')->delete($oldAvatar);
        }

        if ($emailChanged) {
            $user->sendEmailVerificationNotification();
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Profile updated.']);

        return to_route('rider.account');
    }

    public function updateVehicle(Request $request): RedirectResponse
    {
        $rider = $this->rider($request);
        $validated = $request->validate([
            'vehicle_type' => ['required', Rule::in(['motorcycle', 'bicycle', 'car'])],
            'plate_number' => ['nullable', 'string', 'max:50'],
        ]);

        $rider->update([
            'vehicle_type' => $validated['vehicle_type'],
            'plate_number' => filled($validated['plate_number'] ?? null)
                ? $validated['plate_number']
                : null,
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Vehicle information updated.']);

        return back();
    }

    public function updatePayout(Request $request): RedirectResponse
    {
        $rider = $this->rider($request);
        $validated = $request->validate([
            'payout_method' => ['required', Rule::in(['bank', 'ewallet'])],
            'account_name' => ['required', 'string', 'max:100'],
            'provider' => ['required', 'string', 'max:100'],
            'account_number' => ['required', 'string', 'max:100'],
        ]);

        $rider->update([
            'payout_method' => $validated['payout_method'],
            'payout_account_details' => [
                'account_name' => $validated['account_name'],
                'provider' => $validated['provider'],
                'account_number' => $validated['account_number'],
            ],
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Payout method updated.']);

        return back();
    }

    public function replaceDocument(Request $request, string $type): RedirectResponse
    {
        abort_unless(array_key_exists($type, self::DOCUMENT_TYPES), 404);
        $rider = $this->rider($request);
        $document = $rider->documents()->where('type', $type)->latest()->first();

        if ($document === null) {
            Gate::authorize('create', RiderDocument::class);
        } else {
            Gate::authorize('update', $document);
        }

        $validated = $request->validate([
            'document' => [
                'required',
                'file',
                'mimes:jpg,jpeg,png,webp,pdf',
                'max:10240',
            ],
        ]);
        $newPath = $validated['document']->store("rider-documents/{$rider->id}", 'public');
        $oldPath = $document?->file_path;

        try {
            DB::transaction(function () use ($document, $rider, $type, $newPath): void {
                $record = $document ?? new RiderDocument([
                    'rider_id' => $rider->id,
                    'type' => $type,
                ]);
                $record->fill([
                    'file_path' => $newPath,
                    'status' => 'pending',
                    'rejection_reason' => null,
                ])->save();
            });
        } catch (Throwable $exception) {
            Storage::disk('public')->delete($newPath);

            throw $exception;
        }

        if ($oldPath !== null && $oldPath !== $newPath) {
            Storage::disk('public')->delete($oldPath);
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => self::DOCUMENT_TYPES[$type].' submitted for review.',
        ]);

        return back();
    }

    public function destroy(ProfileDeleteRequest $request): RedirectResponse
    {
        $rider = $this->rider($request);
        $user = $request->user();
        $files = $rider->documents()->pluck('file_path');

        if ($user->avatar_path !== null) {
            $files->push($user->avatar_path);
        }

        DB::transaction(function () use ($rider, $user): void {
            AuditLog::query()->create([
                'user_id' => $user->id,
                'action' => 'rider.account_anonymized',
                'subject_type' => Rider::class,
                'subject_id' => $rider->id,
                'changes' => ['status' => ['before' => $user->status, 'after' => 'banned']],
                'created_at' => now(),
            ]);

            $rider->documents()->delete();
            $rider->update([
                'plate_number' => null,
                'availability_status' => 'offline',
                'current_latitude' => null,
                'current_longitude' => null,
                'last_location_at' => null,
                'payout_method' => null,
                'payout_account_details' => null,
            ]);
            $user->forceFill([
                'name' => "Deleted Rider #{$user->id}",
                'email' => null,
                'phone' => null,
                'avatar_path' => null,
                'email_verified_at' => null,
                'phone_verified_at' => null,
                'remember_token' => null,
                'status' => 'banned',
            ])->save();
        });

        Storage::disk('public')->delete($files->all());
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }

    private function rider(Request $request): Rider
    {
        $rider = $request->user()?->rider;
        abort_unless($rider !== null, 403);

        return $rider;
    }
}
