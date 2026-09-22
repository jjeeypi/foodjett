<?php

namespace App\Http\Requests\Auth;

use App\Concerns\PasswordValidationRules;
use App\Concerns\ProfileValidationRules;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RegisterRiderRequest extends FormRequest
{
    use PasswordValidationRules, ProfileValidationRules;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            ...$this->profileRules(),
            'phone' => ['required', 'string', 'max:30', 'unique:users,phone'],
            'password' => $this->passwordRules(),
            'vehicle_type' => ['required', Rule::in(['motorcycle', 'bicycle', 'car'])],
            'plate_number' => ['nullable', 'required_unless:vehicle_type,bicycle', 'string', 'max:30'],
        ];
    }
}
