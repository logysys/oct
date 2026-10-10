<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WallCard extends Model
{
    protected $fillable = [
        'wall_id', 'user_id', 'cid', 'me_hash', 'ip_hash', 'raw', 'content', 'anchor', 'zone', 'type', 'ok', 'status',
    ];

    protected $attributes = [
        'type' => 'wiki',
        'status' => 'approved',
        'ok' => true,
    ];

    protected $casts = ['ok' => 'boolean'];

    public function getTypeAttribute()
    {
        return $this->attributes['type'] ?? 'wiki';
    }

    public function setTypeAttribute($value)
    {
        $this->attributes['type'] = $value ?: 'wiki';
    }

    public function getContentAttribute()
    {
        return $this->attributes['content'] ?? $this->attributes['raw'] ?? null;
    }

    public function setContentAttribute($value)
    {
        $this->attributes['content'] = $value;
        $this->attributes['raw'] = $value;
    }

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