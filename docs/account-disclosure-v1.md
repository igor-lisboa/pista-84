# Signed-in account disclosure review

The signed-in account dialog initially shows the account name, a collapsed
**Change password** action and a separate highlighted logout section. Password
fields are created only when the disclosure opens, and are removed when it closes.
The logout warning stays with its own logout button.

Reviewed Chromium captures at 390×844, 844×390 and 1440×900:

- [Portrait account](screenshots/account-disclosure-v1/portrait.png)
- [Landscape account](screenshots/account-disclosure-v1/landscape.png)
- [Desktop account](screenshots/account-disclosure-v1/desktop.png)

`tests/browser/account-password.spec.ts` checks that the fields are absent on open,
that the sections stay distinct, and that disclosure, password validation/change and
reauthentication work. The existing localized labels are reused in all fifteen
locales; this layout review does not constitute native-speaker or physical-device
validation.
