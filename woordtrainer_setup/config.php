<?php
/**
 * Configuratie voor de Woordtrainer installatiescript.
 *
 * Pas dit bestand alleen aan als je paden wilt wijzigen of de
 * template‑metadata wilt overschrijven.
 */

// Basispad van deze setup-map en van de Xerte-installatie
$wt_setup_root = __DIR__;
$wt_xerte_root = dirname(__DIR__);

return [
    // Bump this when you ship a new Woordtrainer release (shown on the install page).
    'release' => '2026.06.19',

    // Mappen die gekopieerd moeten worden.
    // Elke entry krijgt een absolute bron- en doelmap.
    // In deze setup gebruiken we vier mappen (zoals ze in deze map staan):
    // - parent_templates/Woordtrainer      → modules/xerte/parent_templates/Woordtrainer
    // - templates/Woordtrainer             → modules/xerte/templates/Woordtrainer
    // - themes/Woordtrainer/woordtrainer   → themes/Woordtrainer/woordtrainer
    // - src/Woordtrainer                   → src/Woordtrainer
    'paths' => [
        [
            'source' => $wt_setup_root . '/parent_templates/Woordtrainer',
            'target' => $wt_xerte_root . '/modules/xerte/parent_templates/Woordtrainer',
        ],
        [
            'source' => $wt_setup_root . '/themes/Woordtrainer/woordtrainer',
            'target' => $wt_xerte_root . '/themes/Woordtrainer/woordtrainer',
        ],
        [
            'source' => $wt_setup_root . '/templates/Woordtrainer',
            'target' => $wt_xerte_root . '/modules/xerte/templates/Woordtrainer',
        ],
        [
            'source' => $wt_setup_root . '/src/Woordtrainer',
            'target' => $wt_xerte_root . '/src/Woordtrainer',
        ],
    ],

    // Templategegevens voor de database‑insert in originaltemplatesdetails
    'template' => [
        'template_framework' => 'xerte',
        'template_name'      => 'Woordtrainer',
        'parent_template'    => 'Woordtrainer',
        'description'        => 'Template voor de woordtrainer',
        'display_name'       => 'Woordtrainer',
        'display_id'         => 0,
        'access_rights'      => '*',
        'active'             => 1,
        // Zet dit op NULL zodat de editor "simple_mode" niet aanzet.
        // Als het DB-veld niet-leeg is (bijv. '0' of '{}'), filtert de editor menu-items weg.
        'template_sub_pages' => null,
    ],
];

