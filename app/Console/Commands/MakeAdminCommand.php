<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

class MakeAdminCommand extends Command
{
    protected $signature = 'make:admin {name} {email} {password}';

    protected $description = 'Create a verified FoodJett administrator account';

    public function handle(): int
    {
        $data = Validator::make([
            'name' => $this->argument('name'),
            'email' => $this->argument('email'),
            'password' => $this->argument('password'),
        ], [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', Password::default()],
        ])->validate();

        $user = DB::transaction(function () use ($data): User {
            $user = User::create([
                ...$data,
                'role' => 'admin',
                'status' => 'active',
            ]);

            $user->markEmailAsVerified();
            $user->admin()->create();

            return $user;
        });

        $this->components->info("Admin {$user->email} created successfully.");

        return self::SUCCESS;
    }
}
