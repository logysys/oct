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
        Schema::table('walls', function (Blueprint $table) {
            if (!Schema::hasColumn('walls', 'layout')) {
                $table->string('layout', 50)->nullable()->after('meta');
            }
            if (!Schema::hasColumn('walls', 'fireworks')) {
                $table->boolean('fireworks')->default(false)->after('layout');
            }
            if (!Schema::hasColumn('walls', 'flybees')) {
                $table->boolean('flybees')->default(true)->after('fireworks');
            }
            if (!Schema::hasColumn('walls', 'sound')) {
                $table->boolean('sound')->default(true)->after('flybees');
            }
            if (!Schema::hasColumn('walls', 'language')) {
                $table->string('language', 20)->nullable()->after('sound');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('walls', function (Blueprint $table) {
            $cols = [];
            foreach (['layout', 'fireworks', 'flybees', 'sound', 'language'] as $c) {
                if (Schema::hasColumn('walls', $c)) {
                    $cols[] = $c;
                }
            }
            if (!empty($cols)) {
                $table->dropColumn($cols);
            }
        });
    }
};
