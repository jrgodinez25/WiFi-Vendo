# WiFi Vendo Captive Portal

This folder contains the standalone customer-facing captive portal, separated from the administrator dashboard.

- `customer.html`: voucher entry, QR scanning, and customer session UI.
- `customer.js`: same-origin API client and session controls.
- `portal.css`: responsive portal-only stylesheet.

The Node server serves these assets at `/hotspot/customer.html`, `/hotspot/customer.js`, and `/hotspot/portal.css`. The legacy `/customer.html` route remains available during migration. Customer API endpoints remain under `/api`.
