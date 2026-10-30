# Security requirements before production

- Replace development-only/no-auth admin access with authenticated sessions and roles.
- Hash admin passwords with Argon2id or scrypt; add CSRF protection and rate limits.
- Encrypt RouterOS credentials at rest; never return secrets from settings APIs.
- Bind coin sessions to client/device and validate pulse timing in an ISR-safe path.
- Disable simulator pulse endpoints in production builds.
- Compute prices, profiles and entitlements server-side.
- Validate OTA board type, image size and cryptographic integrity; support recovery.
- Use atomic settings writes and flash-wear-aware persistence.
- Restrict RouterOS API to a trusted management network.
- Redact credentials and voucher secrets from logs.
- Use HTTPS outside localhost. The current simulator is for trusted local development only.
