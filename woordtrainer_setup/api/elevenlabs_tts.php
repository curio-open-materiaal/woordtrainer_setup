<?php
/**
 * Server-side ElevenLabs TTS proxy for Woordtrainer.
 * API key is read from woordtrainer_setup/storage/settings.json (set via index.php).
 */

require_once dirname(__DIR__) . '/includes/settings.php';

header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Accept');
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$rawBody = file_get_contents('php://input');
$payload = json_decode($rawBody, true);
if (!is_array($payload)) {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Invalid JSON body']);
    exit;
}

$text = isset($payload['text']) ? trim((string) $payload['text']) : '';
if ($text === '') {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Missing text']);
    exit;
}

if (function_exists('mb_strlen')) {
    $textLen = mb_strlen($text);
} else {
    $textLen = strlen($text);
}
if ($textLen > 500) {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Text too long']);
    exit;
}

$settings = wt_load_settings();
$apiKey = trim($settings['elevenlabs_api_key'] ?? '');
$voiceId = trim($settings['elevenlabs_voice_id'] ?? '') ?: WT_DEFAULT_VOICE_ID;

if ($apiKey === '') {
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'ElevenLabs API key not configured. Set it in Woordtrainer installatie.']);
    exit;
}

$requestBody = json_encode([
    'text' => $text,
    'model_id' => 'eleven_turbo_v2_5',
    'language_code' => 'nl',
    'voice_settings' => [
        'stability' => 0.5,
        'similarity_boost' => 0.75,
        'style' => 0.0,
        'use_speaker_boost' => true,
    ],
]);

$url = 'https://api.elevenlabs.io/v1/text-to-speech/' . rawurlencode($voiceId);

if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $requestBody,
        CURLOPT_HTTPHEADER => [
            'xi-api-key: ' . $apiKey,
            'Content-Type: application/json',
            'Accept: audio/mpeg',
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_TIMEOUT => 30,
    ]);
    $response = curl_exec($ch);
    $errno = curl_errno($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);

    if ($errno || $response === false) {
        http_response_code(502);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'TTS upstream request failed']);
        exit;
    }

    $responseHeaders = substr($response, 0, $headerSize);
    $responseBody = substr($response, $headerSize);

    if ($httpCode < 200 || $httpCode >= 300) {
        http_response_code(502);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'ElevenLabs API error', 'status' => $httpCode]);
        exit;
    }

    header('Content-Type: audio/mpeg');
    header('Cache-Control: no-store');
    echo $responseBody;
    exit;
}

// Fallback without cURL (stream context)
$context = stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => "xi-api-key: {$apiKey}\r\nContent-Type: application/json\r\nAccept: audio/mpeg\r\n",
        'content' => $requestBody,
        'timeout' => 30,
        'ignore_errors' => true,
    ],
]);

$responseBody = @file_get_contents($url, false, $context);
if ($responseBody === false) {
    http_response_code(502);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'TTS upstream request failed']);
    exit;
}

$statusLine = $http_response_header[0] ?? '';
if (!preg_match('/\s200\s/', $statusLine)) {
    http_response_code(502);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'ElevenLabs API error']);
    exit;
}

header('Content-Type: audio/mpeg');
header('Cache-Control: no-store');
echo $responseBody;
