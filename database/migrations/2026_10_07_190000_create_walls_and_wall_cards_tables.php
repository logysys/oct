<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('walls')) {
            Schema::create('walls', function (Blueprint $table) {
                $table->id();
                $table->string('slug', 255)->unique();
                $table->string('owner_hash', 255)->nullable();
                $table->json('meta')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('wall_cards')) {
            Schema::create('wall_cards', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('wall_id');
                $table->unsignedBigInteger('user_id')->nullable();
                $table->string('cid', 255);
                $table->string('me_hash', 255)->nullable();
                $table->string('ip_hash', 255)->nullable();
                $table->longText('raw')->nullable();
                $table->longText('content')->nullable();
                $table->string('anchor', 255)->nullable();
                $table->string('zone', 50)->default('b');
                $table->string('type', 50)->default('wiki');
                $table->boolean('ok')->default(true);
                $table->string('status', 20)->default('approved');
                $table->timestamps();

                $table->index(['wall_id', 'status']);
                $table->index(['wall_id', 'zone']);
                $table->index('cid');
            });
        } else {
            Schema::table('wall_cards', function (Blueprint $table) {
                if (!Schema::hasColumn('wall_cards', 'type')) {
                    $table->string('type', 50)->default('wiki')->after('zone');
                }
                if (!Schema::hasColumn('wall_cards', 'content')) {
                    $table->longText('content')->nullable()->after('raw');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('wall_cards') && Schema::hasColumn('wall_cards', 'type')) {
            Schema::table('wall_cards', function (Blueprint $table) {
                $table->dropColumn('type');
            });
        }
    }
};
