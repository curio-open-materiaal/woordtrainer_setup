<?php
/**
 * Eenvoudig installatiescript voor de Woordtrainer‑template.
 *
 * Functies:
 * - Kopieert de benodigde mappen (theme + template) naar de Xerte‑installatie.
 * - Voegt (indien nog niet aanwezig) een regel toe aan originaltemplatesdetails.
 * - Kan de plaatsing weer "resetten" (mappen verwijderen + DB‑record verwijderen).
 *
 * Plaats deze map `woordtrainer_setup` in de root van je Xerte‑installatie
 * en surf naar `/woordtrainer_setup/index.php`.
 */

// Laad Xerte‑configuratie en database‑library
require_once dirname(__DIR__) . '/config.php';

// Laad setup‑config
$setupConfig = require __DIR__ . '/config.php';
require_once __DIR__ . '/includes/settings.php';

// Prevent public access to this install/reset script.
// Only allow site administrators (or "super"/elevated users) to continue.
require_once dirname(__DIR__) . '/website_code/php/user_library.php';
if (!isset($_SESSION['toolkits_logon_id']) || !is_user_admin()) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Forbidden';
    exit;
}

// Helpers
function wt_recursive_copy($src, $dst, &$log)
{
    if (!is_dir($src)) {
        $log[] = "Bronmap bestaat niet en wordt overgeslagen: {$src}";
        return;
    }

    if (!file_exists($dst)) {
        if (!mkdir($dst, 0777, true) && !is_dir($dst)) {
            $log[] = "Kan doelmap niet aanmaken: {$dst}";
            return;
        }
    }

    $dir = opendir($src);
    if ($dir === false) {
        $log[] = "Kan bronmap niet openen: {$src}";
        return;
    }

    while (($file = readdir($dir)) !== false) {
        if ($file === '.' || $file === '..') {
            continue;
        }

        $srcPath = $src . DIRECTORY_SEPARATOR . $file;
        $dstPath = $dst . DIRECTORY_SEPARATOR . $file;

        if (is_dir($srcPath)) {
            wt_recursive_copy($srcPath, $dstPath, $log);
        } else {
            if (!copy($srcPath, $dstPath)) {
                $log[] = "Fout bij kopiëren van {$srcPath} naar {$dstPath}";
            }
        }
    }
    closedir($dir);
}

function wt_recursive_remove($dir, &$log)
{
    if (!is_dir($dir)) {
        $log[] = "Map bestaat niet (overgeslagen): {$dir}";
        return;
    }

    $items = scandir($dir);
    if ($items === false) {
        $log[] = "Kan map niet lezen: {$dir}";
        return;
    }

    foreach ($items as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }
        $path = $dir . DIRECTORY_SEPARATOR . $item;
        if (is_dir($path)) {
            wt_recursive_remove($path, $log);
        } else {
            if (!unlink($path)) {
                $log[] = "Kon bestand niet verwijderen: {$path}";
            }
        }
    }

    if (!rmdir($dir)) {
        $log[] = "Kon map niet verwijderen (controleer rechten): {$dir}";
    }
}

function wt_install_files(array $paths)
{
    $log = [];
    foreach ($paths as $entry) {
        $src = $entry['source'] ?? null;
        $dst = $entry['target'] ?? null;
        if (!$src || !$dst) {
            $log[] = 'Ongeldige padconfiguratie (source/target ontbreekt).';
            continue;
        }
        wt_recursive_copy($src, $dst, $log);
        $log[] = "Gekopieerd: {$src} → {$dst}";
    }
    return $log;
}

function wt_reset_files(array $paths)
{
    $log = [];
    foreach ($paths as $entry) {
        $dst = $entry['target'] ?? null;
        if (!$dst) {
            $log[] = 'Ongeldige padconfiguratie (target ontbreekt).';
            continue;
        }
        wt_recursive_remove($dst, $log);
    }
    return $log;
}

function wt_install_template_db(array $templateConfig)
{
    global $xerte_toolkits_site;
    $messages = [];

    $prefix = $xerte_toolkits_site->database_table_prefix;
    $table  = $prefix . 'originaltemplatesdetails';

    $framework   = $templateConfig['template_framework'];
    $name        = $templateConfig['template_name'];
    $parent      = $templateConfig['parent_template'];
    $description = $templateConfig['description'];
    $displayName = $templateConfig['display_name'];
    $displayId   = (int)$templateConfig['display_id'];
    $access      = $templateConfig['access_rights'];
    $active      = (int)$templateConfig['active'];
    $subPagesRaw = $templateConfig['template_sub_pages'];
    // NULL keeps template_sub_pages empty in DB so editor doesn't enable simple_mode filtering.
    $subPages = ($subPagesRaw === '' || $subPagesRaw === null) ? null : $subPagesRaw;

    // Bestaat hij al?
    $existing = db_query_one(
        "SELECT template_type_id FROM {$table} WHERE template_framework = ? AND template_name = ?",
        [$framework, $name]
    );

    if ($existing && isset($existing['template_type_id'])) {
        // Template record bestaat al: update de kritieke metadata zodat de editor de juiste parent template kan laden.
        $ok = db_query(
            "UPDATE {$table}
             SET parent_template = ?,
                 description = ?,
                 display_name = ?,
                 display_id = ?,
                 access_rights = ?,
                 active = ?,
                 template_sub_pages = ?
             WHERE template_framework = ? AND template_name = ?",
            [
                $parent,
                $description,
                $displayName,
                $displayId,
                $access,
                $active,
                $subPages,
                $framework,
                $name,
            ]
        );

        if ($ok === false) {
            $messages[] = "FOUT: bestaande template '{$name}' kon niet worden geupdate (zie server-logs).";
        } else {
            $messages[] = "Template '{$name}' bestond al in {$table}; metadata is geupdate.";
        }

        return $messages;
    }

    $ok = db_query(
        "INSERT INTO {$table}
            (template_framework, template_name, parent_template, description, date_uploaded,
             display_name, display_id, access_rights, active, template_sub_pages)
         VALUES
            (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)",
        [
            $framework,
            $name,
            $parent,
            $description,
            $displayName,
            $displayId,
            $access,
            $active,
            $subPages,
        ]
    );

    if ($ok === false) {
        $messages[] = "FOUT: invoegen in {$table} is mislukt (zie server‑logs).";
    } else {
            $messages[] = "Template '{$name}' succesvol toegevoegd aan {$table}.";
    }

    return $messages;
}

function wt_reset_template_db(array $templateConfig)
{
    global $xerte_toolkits_site;
    $messages = [];

    $prefix = $xerte_toolkits_site->database_table_prefix;
    $table  = $prefix . 'originaltemplatesdetails';

    $framework = $templateConfig['template_framework'];
    $name      = $templateConfig['template_name'];

    $ok = db_query(
        "DELETE FROM {$table} WHERE template_framework = ? AND template_name = ?",
        [$framework, $name]
    );

    if ($ok === false) {
        $messages[] = "FOUT: verwijderen uit {$table} is mislukt (zie server‑logs).";
    } else {
        $messages[] = "Eventuele bestaande regels voor '{$name}' zijn uit {$table} verwijderd.";
    }

    return $messages;
}

function wt_validate_install()
{
    $messages = [];
    $wt_setup_root = __DIR__;
    $wt_xerte_root = dirname(__DIR__);

    $checks = [
        $wt_xerte_root . '/modules/xerte/parent_templates/Woordtrainer/wizards/en-GB/data.xwd' => 'parent_templates/Woordtrainer wizards data.xwd',
        $wt_xerte_root . '/modules/xerte/parent_templates/Woordtrainer/Woordtrainer.rlt' => 'parent_templates/Woordtrainer.rlt',
        $wt_xerte_root . '/modules/xerte/parent_templates/Woordtrainer/models_html5/herhaalDeZin.html' => 'models_html5/herhaalDeZin.html',
        $wt_xerte_root . '/modules/xerte/templates/Woordtrainer/Woordtrainer.info' => 'modules/xerte/templates/Woordtrainer/Woordtrainer.info',
        $wt_xerte_root . '/src/Woordtrainer/wizards/en-GB/introPage.xwd' => 'src/Woordtrainer/wizards introPage.xwd',
        $wt_xerte_root . '/themes/Woordtrainer/woordtrainer/woordtrainer.js' => 'themes/Woordtrainer/woordtrainer/woordtrainer.js',
    ];

    foreach ($checks as $path => $label) {
        if (file_exists($path)) {
            $messages[] = "OK: {$label}";
        } else {
            $messages[] = "MISS: {$label} (" . $path . ')';
        }
    }

    return $messages;
}

// Actie afhandelen
$action   = $_POST['action'] ?? null;
$messages = [];
$settings = wt_load_settings();

if ($action === 'save_settings') {
    $ok = wt_save_settings([
        'elevenlabs_api_key' => $_POST['elevenlabs_api_key'] ?? '',
        'elevenlabs_voice_id' => $_POST['elevenlabs_voice_id'] ?? '',
    ]);
    $settings = wt_load_settings();
    if ($ok) {
        $messages[] = 'ElevenLabs-instellingen opgeslagen.';
    } else {
        $messages[] = 'FOUT: instellingen konden niet worden opgeslagen (controleer schrijfrechten op storage/).';
    }
} elseif ($action === 'install') {
    $messages[] = 'Installatie gestart...';
    $messages   = array_merge($messages, wt_install_files($setupConfig['paths']));
    $messages   = array_merge($messages, wt_install_template_db($setupConfig['template']));
    $messages   = array_merge($messages, wt_validate_install());
    $messages[] = 'Installatie voltooid.';
} elseif ($action === 'reset') {
    $messages[] = 'Reset gestart...';
    $messages   = array_merge($messages, wt_reset_files($setupConfig['paths']));
    $messages   = array_merge($messages, wt_reset_template_db($setupConfig['template']));
    $messages[] = 'Reset voltooid.';
}

?>
<!DOCTYPE html>
<html lang="nl">
<head>
    <meta charset="utf-8">
    <title>Woordtrainer installatie</title>
    <style>
        body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: #f5f5f7;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 720px;
            margin: 3rem auto;
            background: #ffffff;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.15);
            padding: 2rem 2.5rem;
        }
        h1 {
            margin-top: 0;
            font-size: 1.8rem;
            color: #111827;
        }
        p {
            color: #4b5563;
            line-height: 1.5;
        }
        .actions {
            margin-top: 1.5rem;
            display: flex;
            gap: 1rem;
            flex-wrap: wrap;
        }
        button {
            border: none;
            border-radius: 999px;
            padding: 0.75rem 1.75rem;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.1s ease, box-shadow 0.1s ease, background-color 0.2s ease;
        }
        button.primary {
            background: #7E1AE3;
            color: #ffffff;
            box-shadow: 0 8px 20px rgba(126, 26, 227, 0.35);
        }
        button.primary:hover {
            background: #6b16c3;
            transform: translateY(-1px);
            box-shadow: 0 10px 25px rgba(126, 26, 227, 0.5);
        }
        button.secondary {
            background: #f97373;
            color: #fff;
            box-shadow: 0 6px 16px rgba(248, 113, 113, 0.4);
        }
        button.secondary:hover {
            background: #ef4444;
            transform: translateY(-1px);
            box-shadow: 0 8px 20px rgba(220, 38, 38, 0.5);
        }
        .messages {
            margin-top: 1.5rem;
            padding: 1rem 1.25rem;
            border-radius: 8px;
            background: #f3f4ff;
            color: #111827;
            font-size: 0.95rem;
        }
        .messages ul {
            margin: 0.5rem 0 0;
            padding-left: 1.25rem;
        }
        .warning {
            margin-top: 1rem;
            font-size: 0.9rem;
            color: #b91c1c;
        }
        code {
            background: #e5e7eb;
            border-radius: 4px;
            padding: 0.1rem 0.35rem;
            font-size: 0.9em;
        }
        h2 {
            margin-top: 2rem;
            font-size: 1.25rem;
            color: #111827;
        }
        .settings-form {
            margin-top: 1rem;
            padding: 1.25rem;
            border-radius: 8px;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
        }
        .settings-form label {
            display: block;
            font-weight: 600;
            color: #374151;
            margin-bottom: 0.35rem;
            font-size: 0.95rem;
        }
        .settings-form input[type="text"],
        .settings-form input[type="password"] {
            width: 100%;
            box-sizing: border-box;
            padding: 0.6rem 0.75rem;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            font-size: 0.95rem;
            margin-bottom: 1rem;
        }
        .settings-form .hint {
            font-size: 0.85rem;
            color: #6b7280;
            margin: -0.5rem 0 1rem;
        }
        .status-ok { color: #047857; font-weight: 600; }
        .status-miss { color: #b45309; font-weight: 600; }
        button.settings {
            background: #2563eb;
            color: #fff;
            box-shadow: 0 6px 16px rgba(37, 99, 235, 0.35);
        }
        button.settings:hover {
            background: #1d4ed8;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Woordtrainer installatie</h1>
        <p>
            Met deze pagina kun je de Woordtrainer‑template installeren in deze Xerte‑omgeving.
            De benodigde mappen worden gekopieerd en er wordt een regel toegevoegd aan
            de tabel <code>originaltemplatesdetails</code> (indien nog niet aanwezig).
        </p>

        <form method="post">
            <div class="actions">
                <button type="submit" name="action" value="install" class="primary">
                    Installeer Woordtrainer
                </button>
                <button type="submit" name="action" value="reset" class="secondary"
                        onclick="return confirm('Weet je zeker dat je de Woordtrainer‑bestanden en het DB‑record wilt verwijderen?');">
                    Reset installatie
                </button>
            </div>
        </form>

        <h2>ElevenLabs (voorlezen)</h2>
        <p>
            Stel hier de ElevenLabs API-sleutel in voor deze Xerte-server.
            Oefeningen gebruiken een server-proxy; de sleutel staat niet meer in gepubliceerde projecten.
        </p>
        <p>
            Status:
            <?php if (wt_has_elevenlabs_key()): ?>
                <span class="status-ok">API-sleutel ingesteld (<?php echo htmlspecialchars(wt_mask_api_key($settings['elevenlabs_api_key']), ENT_QUOTES, 'UTF-8'); ?>)</span>
            <?php else: ?>
                <span class="status-miss">Nog geen API-sleutel ingesteld — voorlezen werkt niet tot je deze invult.</span>
            <?php endif; ?>
        </p>

        <form method="post" class="settings-form">
            <input type="hidden" name="action" value="save_settings">
            <label for="elevenlabs_api_key">ElevenLabs API-sleutel</label>
            <input type="password" id="elevenlabs_api_key" name="elevenlabs_api_key" autocomplete="new-password"
                   placeholder="<?php echo wt_has_elevenlabs_key() ? 'Laat leeg om huidige sleutel te behouden' : 'sk_...'; ?>">
            <p class="hint">Haal je sleutel op via <a href="https://elevenlabs.io" target="_blank" rel="noopener">elevenlabs.io</a> → Profile → API key.</p>

            <label for="elevenlabs_voice_id">Voice ID (optioneel)</label>
            <input type="text" id="elevenlabs_voice_id" name="elevenlabs_voice_id"
                   value="<?php echo htmlspecialchars($settings['elevenlabs_voice_id'] ?? WT_DEFAULT_VOICE_ID, ENT_QUOTES, 'UTF-8'); ?>"
                   placeholder="<?php echo htmlspecialchars(WT_DEFAULT_VOICE_ID, ENT_QUOTES, 'UTF-8'); ?>">
            <p class="hint">Standaard Nederlandse stem voor Woordtrainer. Alleen wijzigen als je een andere stem wilt gebruiken.</p>

            <button type="submit" class="settings">Opslaan</button>
        </form>

        <p class="warning">
            Let op: de reset‑optie verwijdert de doelmappen volledig. Gebruik dit alleen in een test‑ of ontwikkelomgeving,
            of als je zeker weet dat er geen andere aanpassingen in die mappen staan.
        </p>

        <?php if (!empty($messages)): ?>
            <div class="messages">
                <strong>Log:</strong>
                <ul>
                    <?php foreach ($messages as $msg): ?>
                        <li><?php echo htmlspecialchars($msg, ENT_QUOTES, 'UTF-8'); ?></li>
                    <?php endforeach; ?>
                </ul>
            </div>
        <?php endif; ?>
    </div>
</body>
</html>

