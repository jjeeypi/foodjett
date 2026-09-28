<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Settings\ProfileController as BreezeProfileController;
use Illuminate\Http\Request;
use Inertia\Response;

class ProfileController extends BreezeProfileController
{
    public function edit(Request $request): Response
    {
        return $this->customerEdit($request);
    }
}
