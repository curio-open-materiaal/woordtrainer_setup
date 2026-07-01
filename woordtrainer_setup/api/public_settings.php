<?php
/**
 * Public Woordtrainer settings for published exercises (no secrets).
 */

require_once dirname(__DIR__) . '/includes/settings.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$settings = wt_load_settings();
$homeUrl = trim($settings['home_url'] ?? '');

echo json_encode([
    'home_url' => $homeUrl,
], JSON_UNESCAPED_SLASHES);
