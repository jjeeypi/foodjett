<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileDeleteRequest;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Show the user's profile settings page.
     */
    public function edit(Request $request): Response
    {
        return Inertia::render('settings/profile', [
            'mustVerifyEmail' => true,
            'status' => $request->session()->get('status'),
        ]);
    }

    public function customerEdit(Request $request): Response
    {
        abort_unless($request->user()?->customer !== null, 403);

        return Inertia::render('customer/account/profile', [
            'mustVerifyEmail' => true,
            'status' => $request->session()->get('status'),
            'passwordRules' => Password::defaults()->toPasswordRulesString(),
        ]);
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
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

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Profile updated.')]);

        return to_route(
            $request->routeIs('customer.account.profile.update')
                ? 'customer.account.profile.edit'
                : 'profile.edit',
        );
    }

    /**
     * Delete the user's profile.
     */
    public function destroy(ProfileDeleteRequest $request): RedirectResponse
    {
        $user = $request->user();

        if ($user->isCustomer() && $user->customer()->exists()) {
            $avatar = $user->avatar_path;

            DB::transaction(function () use ($user): void {
                $user->forceFill([
                    'name' => "Deleted Customer #{$user->id}",
                    'email' => null,
                    'phone' => null,
                    'avatar_path' => null,
                    'email_verified_at' => null,
                    'phone_verified_at' => null,
                    'remember_token' => null,
                    'status' => 'banned',
                ])->save();
            });

            if ($avatar !== null) {
                Storage::disk('public')->delete($avatar);
            }

            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return redirect('/');
        }

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
