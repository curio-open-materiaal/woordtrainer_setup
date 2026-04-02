# Woordtrainer setup (installatie/reset)

Deze map bevat een eenvoudig installatiescript om de **Woordtrainer** template in een bestaande Xerte-installatie te plaatsen.

Het script kan:
- Benodigde mappen kopieren naar je Xerte-installatie.
- Een record toevoegen (of bijwerken) in de database tabel `originaltemplatesdetails`.
- De installatie weer ongedaan maken met een **reset** (mappen verwijderen + database record verwijderen).

## Beveiliging

De pagina `woordtrainer_setup/index.php` is afgeschermd.
Alleen gebruikers met **admin rechten** mogen de acties uitvoeren.

Als je geen rechten hebt zie je `403 Forbidden`.

## Wat er wordt gekopieerd

De standaard `config.php` definieert vier bron->doel kopie-operaties:
- `parent_templates/Woordtrainer`  
  -> `modules/xerte/parent_templates/Woordtrainer`
- `themes/Woordtrainer/woordtrainer`  
  -> `themes/Woordtrainer/woordtrainer`
- `templates/Woordtrainer`  
  -> `modules/xerte/templates/Woordtrainer`
- `src/Woordtrainer`  
  -> `src/Woordtrainer`

## Database update

Tijdens installatie voegt het script een record toe (of update) aan:
- `originaltemplatesdetails`

Met de volgende metadata:
- `template_framework`: `xerte`
- `template_name`: `Woordtrainer`
- `parent_template`: `Woordtrainer`
- `display_name`: `Woordtrainer`
- `active`: `1`
- `template_sub_pages`: `NULL`

`template_sub_pages` wordt op `NULL` gezet om te voorkomen dat de Xerte editor onbedoeld in "simple_mode" gaat filteren.

## Installeren

1. Zorg dat deze map `woordtrainer_setup` in de root van je Xerte-installatie staat.
   - Dus: `.../jouw-xerte-installatie/woordtrainer_setup/index.php`
2. Log in als een Xerte admin.
3. Open in je browser:
   - `/woordtrainer_setup/index.php`
4. Klik op **Install**.

## Reset / verwijderen

De reset knop maakt de installatie ongedaan:
- verwijdert de gekopieerde mappen uit je Xerte-installatie
- verwijdert het bijbehorende record uit `originaltemplatesdetails`

Let op: dit is destructief voor de gekopieerde bestanden. Maak eventueel een backup als je dat nodig vindt.

## Configuratie

`woordtrainer_setup/config.php` bepaalt:
- De bron->doel paden voor kopieren
- Welke template metadata er in de database wordt gezet

Pas `config.php` alleen aan als je paden wilt wijzigen of als je de template metadata expliciet wilt overschrijven.

## Opmerking voor GitHub

Deze map is bedoeld om te worden meegeleverd met je project.
Het installatiescript heeft server side toegang nodig tot:
- de Xerte configuratie (`config.php` in de Xerte root)
- de database libraries

Daarom moet je het script alleen gebruiken binnen de context van een draaiende Xerte-installatie.

