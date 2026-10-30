# RouterOS integration plan

WiFi Vendo supports MikroTik Hotspot mode and standalone mode. In MikroTik mode, Hotspot remains the authentication and traffic enforcement authority. A dedicated adapter will create/manage users and profiles, redeem vouchers, extend validity, pause/resume sessions and log out clients. In standalone mode, WiFi Vendo owns local voucher authentication and session policy.

Before connecting a live router: back up RouterOS; verify Hotspot independently; create a least-privilege API account; restrict API/API-SSL access to the management VLAN; never expose API to WAN; test against CHR or a lab router first.

Router API transport is not implemented in this simulator build. `/api/router/test` intentionally returns HTTP 501 instead of claiming a connection succeeded.
