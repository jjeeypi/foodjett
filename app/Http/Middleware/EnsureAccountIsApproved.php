<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAccountIsApproved
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next, string $profile): Response
    {
        abort_unless(in_array($profile, ['restaurant', 'rider'], true), 500);

        $account = match ($profile) {
            'restaurant' => $request->user()?->restaurant,
            'rider' => $request->user()?->rider,
        };

        if ($account?->approval_status !== 'approved') {
            /** @var RedirectResponse $response */
            $response = to_route("{$profile}.pending");

            return $response;
        }

        return $next($request);
    }
}
