# Security requirements and current controls

## Implemented controls

- Customer sessions use random 256-bit bearer tokens in `HttpOnly`, `SameSite=Strict` cookies. The server stores only a SHA-256 token hash; it does not return session IDs as credentials.
- Customer session operations require the cookie, check the source IP, and validate the session state on the server.
- Voucher redemption requires same-origin JSON when an Origin header is present and limits failed attempts to 10 per source IP per 10 minutes.
- Session pause/logout remove the client from the standalone firewall allow-set. Resume reauthorizes the client. Extension refreshes the authorization timeout.
- The optional nftables adapter uses a dedicated table, a dedicated guest ingress interface, IPv4 and IPv6 allow-sets, per-session expiry timeouts, HTTP captive redirection and a fail-closed forwarding drop for unauthenticated guest clients.
- Admin pages and administrative APIs are restricted to exact source IPs in `WIFI_VENDO_ADMIN_IPS`; default is loopback only.
- API and static responses include restrictive content-security and browser security headers. Cross-origin CORS access is not enabled.
- RouterOS passwords are not returned by the settings API.

## Still required before production

- Implement administrator login, secure password hashing (scrypt/Argon2id), session rotation, roles, CSRF protection and recovery.
- Encrypt RouterOS credentials at rest; never return secrets from settings APIs.
- Run the service over trusted TLS. The session cookie receives the Secure attribute only when Node.js itself terminates TLS.
- Add persistent, distributed rate limiting and stronger voucher brute-force controls.
- Add durable database transactions and concurrency controls; the current JSON-file store is a development store, not a production database.
- Restrict RouterOS API to a trusted management network and use a least-privilege RouterOS account.
- Disable simulator pulse endpoints in production builds and validate coin pulses in an ISR-safe hardware path.
- Validate OTA board type, image size and cryptographic integrity; support recovery.
- Add automated firewall cleanup/reconciliation, operational monitoring and backup/restore.
- Complete hardware-in-loop tests, IPv4/IPv6 firewall tests, gateway reboot tests and MikroTik lab tests.

## Deployment warnings

- The default `WIFI_VENDO_ENFORCEMENT=simulated` mode does not enforce network access.
- `WIFI_VENDO_ENFORCEMENT=nftables` is an optional Linux gateway adapter and has not yet been validated on a physical network. Use a dedicated isolated guest interface only.
- The adapter does not configure DHCP, DNS, WiFi, WAN NAT or the gateway input firewall. It redirects HTTP only; it does not intercept HTTPS.
- Do not trust client-supplied IP headers. The firewall needs the real guest source IP.
- Do not expose the unauthenticated admin interface to the guest network or public internet. The IP allowlist is only a network boundary, not administrator authentication.
- Voucher codes are bearer credentials. Protect the guest network and use TLS where a trusted certificate can be provisioned.
