<?php
// config/cors.php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | The standalone wall is copied to arbitrary domains — a visitor's blog,
    | a GitHub Pages site, a local file — and each of those calls back here.
    | So the API must be reachable cross-origin. Credentials are NOT used:
    | the wall identifies itself with two custom headers (x-wall-me and
    | x-wall-owner), not with cookies, which is what keeps this safe.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Paths
    |--------------------------------------------------------------------------
    |
    | Only the API surface the wall talks to. Keep 'sanctum/csrf-cookie' out
    | unless you actually use Sanctum cookie auth — the wall doesn't.
    |
    */

    'paths' => [
        'api/*',
    ],

    /*
    |--------------------------------------------------------------------------
    | Allowed HTTP Methods
    |--------------------------------------------------------------------------
    |
    | The wall issues GET (stream, review, frame-check), POST (cards,
    | approve), and DELETE (drop). HEAD/OPTIONS come from the CORS preflight
    | and from the frame-check probe.
    |
    */

    'allowed_methods' => [
        'GET',
        'POST',
        'DELETE',
        'HEAD',
        'OPTIONS',
    ],

    /*
    |--------------------------------------------------------------------------
    | Allowed Origins
    |--------------------------------------------------------------------------
    |
    | '*' is required because embedded walls run on visitor-owned domains we
    | cannot enumerate. This is safe here because:
    |   - supports_credentials = false  → browsers will not send cookies
    |   - auth is by custom header      → no ambient authority to steal
    |   - the API is rate-limited       → spam is bounded
    |
    | If you later add a private/protected mode, replace '*' with an explicit
    | list or use allowed_origins_patterns.
    |
    */

    'allowed_origins' => [
        '*',
    ],

    /*
    |--------------------------------------------------------------------------
    | Allowed Origins Patterns
    |--------------------------------------------------------------------------
    |
    | Use these to allow subdomains without listing each one. Example: allow
    | any tenant subdomain of ez.wiki. Left empty because '*' already covers
    | the public wall. Enable when you move to per-tenant restrictions.
    |
    */

    'allowed_origins_patterns' => [
        // '#^https://([a-z0-9-]+\.)?ez\.wiki$#',
    ],

    /*
    |--------------------------------------------------------------------------
    | Allowed Headers
    |--------------------------------------------------------------------------
    |
    | Listed explicitly instead of '*'. The wall sends:
    |   Content-Type   — on POST/PUT bodies (application/json)
    |   Accept         — fetch default
    |   Origin         — browsers add this automatically on cross-origin calls
    |   x-wall-me      — visitor identity (UUID in localStorage)
    |   x-wall-owner   — owner token, only present for the wall's owner
    |   last-event-id  — SSE reconnect cursor, added by EventSource
    |
    | Anything not listed here is blocked at preflight, which is what we want:
    | if a future header is needed, add it here on purpose.
    |
    */

    'allowed_headers' => [
        'Content-Type',
        'Accept',
        'Origin',
        'X-Requested-With',
        'x-wall-me',
        'x-wall-owner',
        'Last-Event-ID',
    ],

    /*
    |--------------------------------------------------------------------------
    | Exposed Headers
    |--------------------------------------------------------------------------
    |
    | Headers the browser is allowed to read from the response. The wall
    | reads none of them today, so this stays empty. Add 'X-RateLimit-*' here
    | if you later want the client to back off intelligently on 429.
    |
    */

    'exposed_headers' => [
        // 'X-RateLimit-Limit',
        // 'X-RateLimit-Remaining',
        // 'X-RateLimit-Reset',
        // 'Retry-After',
    ],

    /*
    |--------------------------------------------------------------------------
    | Max Age
    |--------------------------------------------------------------------------
    |
    | How long the browser may cache the preflight response, in seconds.
    | Every wall page load triggers a preflight for POST /cards (because of
    | the custom headers), and preflight is a full round trip. Caching it for
    | an hour saves a request per visitor per action.
    |
    | 0 disables preflight caching entirely (the stock default). Use 3600.
    |
    */

    'max_age' => 3600,

    /*
    |--------------------------------------------------------------------------
    | Supports Credentials
    |--------------------------------------------------------------------------
    |
    | Must stay false. With '*' in allowed_origins, browsers refuse to send
    | cookies anyway, and the wall was designed so it does not need them.
    | Turning this on would require replacing '*' with an explicit origin
    | list, and would re-introduce CSRF as a concern.
    |
    */

    'supports_credentials' => false,

];