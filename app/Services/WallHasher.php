<?php
namespace App\Services;

class WallHasher
{
    public static function me(string $v): string
    {
        return hash('sha256', 'me|' . $v);
    }

    public static function ip(string $v): string
    {
        return hash('sha256', 'ip|' . config('app.key') . '|' . $v);
    }

    public static function owner(string $v): string
    {
        return hash('sha256', 'own|' . config('app.key') . '|' . $v);
    }

    public static function cid(): string
    {
        return bin2hex(random_bytes(8));
    }
}