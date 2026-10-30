# WiFi Vendo Feature Acceptance Matrix

## Hardware
- [ ] ESP8266 Wi-Fi
- [ ] ESP32 Wi-Fi
- [ ] ESP32 W5500 Ethernet
- [ ] DHCP/static IPv4 and recovery AP
- [ ] Reconnect/health diagnostics
- [ ] LCD explicitly disabled in selected profile
- [ ] Coin input, status LEDs, manual insert and optional relay; board-specific pin maps and polarity

## Coin engine
- [ ] Pulse interrupt/debounce/validation and denomination mapping
- [ ] Session start, poll, cancel, timeout and commit
- [ ] Partial payment and codeless voucher issue
- [ ] Abuse threshold, temporary ban and concurrency lock
- [ ] Development-only pulse simulation
- [ ] Lifetime/current sales and customers served; independent reset

## Router and standalone
- [ ] MikroTik API/API-SSL, credential test, least-privilege account
- [ ] Hotspot profiles and voucher user creation
- [ ] Username-only and username/password login
- [ ] Voucher redeem, extend, pause/resume, logout, session status
- [ ] Validity stacking policies and data quota
- [ ] Standalone local authentication and session enforcement

## Customer portal
- [ ] Responsive captive login, voucher input and QR scan
- [ ] Optional member login and disabled voucher input
- [ ] Internet and charging promo rates
- [ ] Coin top-up modal, pulse feedback, cancel and auto-login
- [ ] Extend, pause/resume, logout
- [ ] Multi-vendo selector and remembered selection
- [ ] Remaining time, expiry, data quota and optional audio feedback

## Admin
- [ ] First-run setup and secure login/logout
- [ ] Dashboard: sales, customers, uptime, device/router/internet status
- [ ] System settings: SSID, network addressing, router, coin timeout, abuse, pins, LED polarity, voucher prefix/login/profile/validity
- [ ] Promo-rate CRUD: name, price, minutes, validity, quota, profile, category
- [ ] Batch voucher generation, sales inclusion, print/export/append layout
- [ ] Firmware/filesystem OTA, integrity checks and recovery
- [ ] Backup/restore, audit log, diagnostics, About/version

## Quality
- [ ] Unit/API tests, hardware-in-loop tests, MikroTik lab tests, installation and troubleshooting guides
