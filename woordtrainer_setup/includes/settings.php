<?php
/**
 * Woordtrainer server settings (ElevenLabs TTS). Stored outside deployed theme files.
 */

define('WT_SETTINGS_DIR', dirname(__DIR__) . '/storage');
define('WT_SETTINGS_FILE', WT_SETTINGS_DIR . '/settings.json');
define('WT_DEFAULT_VOICE_ID', 'yO6w2xlECAQRFP6pX7Hw');

function wt_ensure_storage_dir()
{
    if (!is_dir(WT_SETTINGS_DIR)) {
        mkdir(WT_SETTINGS_DIR, 0750, true);
    }
}

function wt_default_settings()
{
    return [
        'elevenlabs_api_key' => '',
        'elevenlabs_voice_id' => WT_DEFAULT_VOICE_ID,
    ];
}

function wt_load_settings()
{
    wt_ensure_storage_dir();
    if (!is_file(WT_SETTINGS_FILE)) {
        return wt_default_settings();
    }

    $raw = @file_get_contents(WT_SETTINGS_FILE);
    if ($raw === false || $raw === '') {
        return wt_default_settings();
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        return wt_default_settings();
    }

    return array_merge(wt_default_settings(), $data);
}

function wt_save_settings(array $settings)
{
    wt_ensure_storage_dir();
    $current = wt_load_settings();

    $apiKey = trim($settings['elevenlabs_api_key'] ?? '');
    if ($apiKey !== '') {
        $current['elevenlabs_api_key'] = $apiKey;
    }

    $voiceId = trim($settings['elevenlabs_voice_id'] ?? '');
    if ($voiceId !== '') {
        $current['elevenlabs_voice_id'] = $voiceId;
    } elseif (isset($settings['elevenlabs_voice_id'])) {
        $current['elevenlabs_voice_id'] = WT_DEFAULT_VOICE_ID;
    }

    $json = json_encode($current, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        return false;
    }

    return file_put_contents(WT_SETTINGS_FILE, $json, LOCK_EX) !== false;
}

function wt_mask_api_key($key)
{
    $key = (string) $key;
    if ($key === '') {
        return '';
    }
    if (strlen($key) <= 8) {
        return str_repeat('•', strlen($key));
    }
    return substr($key, 0, 4) . str_repeat('•', max(4, strlen($key) - 8)) . substr($key, -4);
}

function wt_has_elevenlabs_key()
{
    $settings = wt_load_settings();
    return trim($settings['elevenlabs_api_key'] ?? '') !== '';
}
