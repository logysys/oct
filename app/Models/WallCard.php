<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WallCard extends Model
{
    protected $fillable = [
        'wall_id', 'user_id', 'cid', 'me_hash', 'ip_hash', 'raw', 'anchor', 'zone', 'ok', 'status',
    ];

    protected $casts = ['ok' => 'boolean'];

    public function wall()
    {
        return $this->belongsTo(Wall::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function isPending(): bool
    {
        return $this->status === 'pending' || !$this->ok;
    }

    public function isApproved(): bool
    {
        return $this->status === 'approved' || (bool)$this->ok;
    }
}