# Woordtrainer setup (installatie / update)

Deze map bevat een installatiescript om de **Woordtrainer**-template in een bestaande Xerte-installatie te plaatsen of bij te werken.

Het script kan:
- Benodigde mappen kopiëren naar je Xerte-installatie.
- Een record toevoegen (of bijwerken) in de database tabel `originaltemplatesdetails`.
- Serverinstellingen beheren (o.a. ElevenLabs voor voorlezen).
- De installatie volledig ongedaan maken met **Reset** (mappen verwijderen + database-record verwijderen).

**Release:** de actuele versie staat op de installatiepagina (badge naast de titel) en in `woordtrainer_setup/config.php` onder `release`.

## Snel na een nieuwe Git-deploy

Na `git pull` (of een nieuwe deploy van deze repo) hoef je meestal **alleen opnieuw te installeren**:

1. Log in als Xerte-admin.
2. Open `/woordtrainer_setup/index.php`.
3. Klik op **Installeer Woordtrainer**.

Dat kopieert de nieuwste bestanden naar de live Xerte-mappen en werkt de template-metadata in de database bij. **Reset is niet nodig** voor een normale update.

Gebruik **Reset** alleen als je de Woordtrainer-bestanden volledig wilt verwijderen of als je een schone herinstallatie wilt na grote structuurwijzigingen.

## Beveiliging

De pagina `woordtrainer_setup/index.php` is afgeschermd. Alleen gebruikers met **adminrechten** mogen de acties uitvoeren.

Als je geen rechten hebt, zie je `403 Forbidden`.

## Wat er wordt gekopieerd

De standaard `config.php` definieert vier bron→doel kopie-operaties:

| Bron (in deze repo) | Doel (live Xerte) |
|---------------------|-------------------|
| `parent_templates/Woordtrainer` | `modules/xerte/parent_templates/Woordtrainer` |
| `themes/Woordtrainer/woordtrainer` | `themes/Woordtrainer/woordtrainer` |
| `templates/Woordtrainer` | `modules/xerte/templates/Woordtrainer` |
| `src/Woordtrainer` | `src/Woordtrainer` |

De map `woordtrainer_setup/` zelf (installatiepagina, API-proxy, instellingen) blijft in de Xerte-root staan en wordt **niet** overschreven door Installeer.

## ElevenLabs (voorlezen, per server)

Voorlezen gebruikt een **server-side proxy**; de API-sleutel staat niet meer in gepubliceerde projecten.

1. Open `/woordtrainer_setup/index.php` als admin.
2. Vul onder **ElevenLabs (voorlezen)** je API-sleutel in (en optioneel een Voice ID).
3. Klik **Opslaan**.

Opslag: `woordtrainer_setup/storage/settings.json` (lokaal per server, niet in git).

Proxy: `woordtrainer_setup/api/elevenlabs_tts.php` — aangeroepen door het Woordtrainer-theme.

## Recente wijzigingen (overzicht)

- **Release-badge** op de installatiepagina (`config.php` → `release`).
- **ElevenLabs per server** via installatiepagina + proxy (geen hardcoded key meer in `woordtrainer.js`).
- **Woord Memory** — optioneel veld **Woorden en betekenissen** op de memory-pagina (`woord:betekenis` per regel); anders woordenlijst Extended/Custom.
- **Titelpagina** — woordenlijst-knop en navigatie naar woordenlijst-pagina’s verbeterd.
- **Colofon** — extra marge bovenin.

Vertalingen tijdens het afspelen gebruiken nog **MyMemory** (gratis, geen aparte sleutel in deze setup).

## Database-update

Tijdens installatie voegt het script een record toe (of werkt het bij) in:

- `originaltemplatesdetails`

Metadata o.a.:

- `template_framework`: `xerte`
- `template_name`: `Woordtrainer`
- `parent_template`: `Woordtrainer`
- `display_name`: `Woordtrainer`
- `active`: `1`
- `template_sub_pages`: `NULL`

`template_sub_pages` blijft `NULL` zodat de Xerte-editor niet onbedoeld in simple_mode-filtering gaat.

## Installeren (eerste keer)

1. Zorg dat de map `woordtrainer_setup` in de root van je Xerte-installatie staat.  
   Bijv. `.../jouw-xerte-installatie/woordtrainer_setup/index.php`
2. Log in als Xerte-admin.
3. Open `/woordtrainer_setup/index.php`.
4. Stel indien nodig **ElevenLabs** in.
5. Klik op **Installeer Woordtrainer**.

## Reset / verwijderen

Reset maakt de template-installatie ongedaan:

- verwijdert de gekopieerde mappen uit je Xerte-installatie;
- verwijdert het bijbehorende record uit `originaltemplatesdetails`.

**Let op:** destructief voor de gekopieerde Woordtrainer-bestanden. `woordtrainer_setup/storage/settings.json` (ElevenLabs) blijft behouden.

## Configuratie

`woordtrainer_setup/config.php` bepaalt:

- `release` — versiecode op de installatiepagina (bump bij elke release);
- bron→doel paden voor kopiëren;
- template-metadata voor de database.

Pas `config.php` aan als je paden of metadata wilt wijzigen.

## Opmerking voor GitHub

Deze repo is bedoeld om naast een draaiende Xerte-installatie te liggen. Het script heeft toegang nodig tot:

- Xerte `config.php` (in de Xerte-root);
- database libraries (`website_code/php/...`).

Gebruik het script alleen binnen een werkende Xerte-omgeving.

## Repo-structuur

```
woordtrainer_setup_git/
├── README.md
└── woordtrainer_setup/          ← bronbestanden + installatiepagina
    ├── index.php
    ├── config.php
    ├── api/elevenlabs_tts.php
    ├── includes/settings.php
    ├── storage/                 ← settings.json (lokaal, gitignored)
    ├── parent_templates/...
    ├── themes/...
    ├── templates/...
    └── src/...
```

Lokaal in Herd/xerte staat vaak ook `xerte/woordtrainer_setup/` als werkmap; houd die in sync met `woordtrainer_setup_git/woordtrainer_setup/` bij wijzigingen.
