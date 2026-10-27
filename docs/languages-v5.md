# Language expansion v5

The picker now offers **15 locales**. The existing seven remain: pt-BR, en, pt-PT, fr, it, ja and de. Eight complete translations were added, each checked against all 170 source keys and their placeholders:

| Locale | Native label | Flag |
| --- | --- | --- |
| es | Español | Spain |
| hi | हिन्दी | India |
| zh-CN | 简体中文 | China |
| id | Bahasa Indonesia | Indonesia |
| ur | اردو | Pakistan |
| bn | বাংলা | Bangladesh |
| ru | Русский | Russia |
| am | አማርኛ | Ethiopia |

Selection uses the ten most populous countries as the scope, using the [INED population projections](https://www.ined.fr/en/all-about-population/data-graphs/projections-countries). Existing English also serves the United States and Nigeria; Brazilian Portuguese already serves Brazil. This chooses a widely used official/working language for each country, not every language spoken there. Spanish was explicitly requested with Spain's flag.

All flags are inline SVG, following the existing simplified flag artwork. Native labels are accessible via each flag button's name and title; the active choice is marked and saved. Automatic browser detection handles regional tags including hi-IN, zh-Hans-CN, id-ID, ur-PK, bn-BD, ru-RU, am-ET and Spanish variants. Chinese variants use the available simplified Chinese translation. Legacy Indonesian `in` tags map to `id`.

Urdu sets the document direction to RTL. The driving HUD, steering/pedal groups and controller buttons retain their physical LTR coordinates so left/right and brake/accelerator cannot swap. Switching back restores LTR. Script-aware system font fallbacks cover Indic, Arabic, Chinese and Ethiopic glyphs while preserving the PISTA 84 logo font.

The original pt-PT partial fallback remains compatible. The eight new locale files are compile-time complete records rather than partial tables. Automated checks verify key coverage, placeholders, absence of emoji, detection, persistence, Spain's flag, RTL direction and phone driving-control positions. Native-speaker editorial review remains a release task; these translations have not been certified by external reviewers.
