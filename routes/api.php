<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\DivinationController;
use App\Http\Controllers\NumerologyController;
use App\Http\Controllers\NumerologyOracleController;
use App\Http\Controllers\NumerologyOracleAllController;
use App\Http\Controllers\NumerologyOracleTwoController;
use App\Http\Controllers\CharDivinationController;
use App\Http\Controllers\Api\MessageReactionController;
use App\Http\Controllers\CommentController;
use App\Http\Controllers\Api\FrameCheckController;
use App\Http\Controllers\Api\WallController;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::prefix('divination')->group(function () {
    Route::post('/dual', [DivinationController::class, 'dualAIDivination']);
    Route::post('/offline', [DivinationController::class, 'offlineDivination']);
    Route::get('/history', [DivinationController::class, 'getHistory']);
    Route::get('/favorites', [DivinationController::class, 'getFavorites']);
    Route::delete('/history', [DivinationController::class, 'clearHistory']);
    Route::delete('/favorites', [DivinationController::class, 'clearFavorites']);
    Route::delete('/record/{id}', [DivinationController::class, 'deleteRecord']);
    Route::patch('/favorite/{id}', [DivinationController::class, 'toggleFavorite']);
    Route::get('/stats', [DivinationController::class, 'getGlobalStats']);
});

Route::prefix('numerology')->group(function () {
    Route::post('/predict', [NumerologyController::class, 'predict']);
    Route::get('/history', [NumerologyController::class, 'getHistory']);
    Route::get('/stats', [NumerologyController::class, 'getStats']);
    Route::delete('/clear', [NumerologyController::class, 'clearHistory']);
});

Route::prefix('numerologyhistory')->group(function () {
    Route::post('/predict', [NumerologyOracleController::class, 'predict']);
    Route::get('/history', [NumerologyOracleController::class, 'getHistory']);
    Route::get('/stats', [NumerologyOracleController::class, 'getStats']);
    Route::delete('/clear', [NumerologyOracleController::class, 'clearHistory']);
});

Route::prefix('numerologyall')->group(function () {
    Route::post('/predict', [NumerologyOracleAllController::class, 'predict']);
    Route::get('/history', [NumerologyOracleAllController::class, 'getHistory']);
    Route::get('/stats', [NumerologyOracleAllController::class, 'getStats']);
    Route::delete('/clear', [NumerologyOracleAllController::class, 'clearHistory']);
});

Route::prefix('numerologytwo')->group(function () {
    Route::post('/predict', [NumerologyOracleTwoController::class, 'predict']);
    Route::post('/translate', [NumerologyOracleTwoController::class, 'translate']);
    Route::get('/history', [NumerologyOracleTwoController::class, 'getHistory']);
    Route::get('/stats', [NumerologyOracleTwoController::class, 'getStats']);
    Route::delete('/clear', [NumerologyOracleTwoController::class, 'clearHistory']);
});

Route::prefix('divinationtwo')->group(function () {
    Route::post('/divine', [CharDivinationController::class, 'divine']);
    Route::get('/history', [CharDivinationController::class, 'getHistory']);
    Route::get('/stats', [CharDivinationController::class, 'getStats']);
    Route::delete('/clear', [CharDivinationController::class, 'clearHistory']);
});

Route::prefix('reactions')->group(function () {
    Route::get('/{messageId}', [MessageReactionController::class, 'getReactions']);
    Route::post('/toggle', [MessageReactionController::class, 'toggleReaction']);
    Route::post('/multiple', [MessageReactionController::class, 'getMultipleReactions']);
});

Route::prefix('comments')->group(function () {
    Route::get('/', [CommentController::class, 'getComments']);
    Route::post('/', [CommentController::class, 'store']);
    Route::post('/ask-ai', [\App\Http\Controllers\SearchController::class, 'aiSearch']);
    Route::delete('/{id}', [CommentController::class, 'destroy']);
});

Route::middleware('throttle:120,1')->prefix('wall')->group(function () {
    Route::post  ('auth/send-otp',            [WallController::class, 'sendOtp']);
    Route::post  ('auth/verify-otp',          [WallController::class, 'verifyOtp']);
    Route::get   ('auth/me',                  [WallController::class, 'authMe']);
    Route::get   ('{id}/stream',              [WallController::class, 'stream']);
    Route::get   ('{id}/cards',               [WallController::class, 'getCards']);
    Route::post  ('{id}/cards',               [WallController::class, 'addCard']);
    Route::delete('{id}/cards',               [WallController::class, 'dropAllCards']);
    Route::delete('{id}/cards/{cid}',         [WallController::class, 'dropCard']);
    Route::post  ('{id}/cards/{cid}/approve', [WallController::class, 'approve']);
    Route::get   ('{id}/review',              [WallController::class, 'review']);
    Route::post  ('{id}/settings',            [WallController::class, 'saveSettings']);
    Route::get   ('{id}/settings',            [WallController::class, 'getCards']);
    Route::post  ('{id}/push-to-wall',        [WallController::class, 'pushToWall']);
});

Route::get('/frame-check', [FrameCheckController::class, 'check'])
    ->middleware('throttle:60,1');