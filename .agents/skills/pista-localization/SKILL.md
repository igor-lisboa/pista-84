---
name: pista-localization
description: Add or revise player-facing PISTA 84 translations across all fifteen supported locales, including regional Portuguese, RTL and small-screen validation.
---

Read specs 04 and `docs/languages-v5.md`; follow `pista-docs`. Use pt-BR as the meaning source and preserve exact keys/placeholders across en, pt-PT, fr, it, ja, de, es, hi, zh-CN, id, ur, bn, ru and am. New or changed keys must have explicit entries in every locale, including the legacy partial pt-PT table. Do not complete unrelated fallback keys by copying Brazilian Portuguese and claiming editorial review.

Translate meaning naturally, preserving optional-account tone, action consequences and technical units. Use European Portuguese vocabulary for pt-PT. Keep vehicle/model names stable; translate explanatory taglines. Put no player text in UI/physics code; use locale keys. Use SVG icons rather than emoji. Never truncate important consequences merely to fit a button.

Run i18n tests for coverage/unknown keys/placeholders and inspect changed text at iPhone SE 375x667 and 667x375, tablet and desktop in both orientations. Test Urdu RTL while keeping driving directions/pedals physically LTR, and font fallbacks for Indic, Arabic, Chinese, Japanese and Ethiopic scripts. Minimize scroll through layout and concise wording while keeping long settings accessible from their top. Record screenshots and disclose that browser emulation/automated checks are not native-speaker review or hardware validation. Keep I18N-01 pending until actual reviewer sign-offs exist.
