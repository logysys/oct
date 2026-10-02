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
        if (Schema::hasTable('wall_cards') && !Schema::hasColumn('wall_cards', 'status')) {
            Schema::table('wall_cards', function (Blueprint $table) {
                $table->string('status', 20)->default('pending')->after('ok');
                $table->index(['wall_id', 'status']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('wall_cards') && Schema::hasColumn('wall_cards', 'status')) {
            Schema::table('wall_cards', function (Blueprint $table) {
                $table->dropColumn('status');
            });
        }
    }
};
