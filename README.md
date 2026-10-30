# WiFi Vendo

An independent coin-operated Wi-Fi vending platform with two operating modes: MikroTik RouterOS Hotspot integration and standalone operation.

## Selected hardware profile

- **Controllers:** ESP8266 and ESP32.
- **Networks:** Wi-Fi and Ethernet using ESP32 + W5500.
- **Router modes:** MikroTik Hotspot and standalone.
- **LCD:** None. LCD support is disabled by design.

## Start the development simulator

Requires Node.js 20 or newer.

```sh
npm start
```

Open the admin dashboard at http://localhost:3000 and customer portal at http://localhost:3000/customer.html. Run tests with `npm test`.

The development app includes dashboard metrics, promo-rate management, voucher batch generation, simulated coin transactions, a responsive customer captive portal, cookie-authenticated standalone sessions (pause/resume/logout/extend), settings, device inventory and activity history. An optional Linux nftables adapter can redirect unauthenticated HTTP traffic and enforce IPv4/IPv6 session access on a dedicated guest interface. Coin simulation now uses a server-configured pulse denomination (client-supplied values are ignored), bounded pulse batches, a capped session timeout, and temporary client lockouts after repeated abandoned/expired transactions.

**Important:** The default mode is simulated and does not enforce real internet access. The optional nftables adapter is not yet validated on a physical gateway; it requires an isolated Linux guest interface and manual DHCP/DNS/WAN/input-firewall setup. Admin authentication, physical coin hardware, RouterOS integration and OTA updates are still incomplete. Do not expose the app to the public internet or connect payment hardware. Follow [Standalone deployment](docs/STANDALONE-DEPLOYMENT.md), [Security](docs/SECURITY.md) and [Feature acceptance matrix](docs/FEATURE-MATRIX.md).

## Firmware targets

PlatformIO environments are defined for:
- `esp32-wifi`
- `esp32-w5500`
- `esp8266-wifi`

The firmware is currently a safe bring-up stub with hardware outputs disabled.

## Development documents

- [Hardware configuration](docs/HARDWARE-CONFIG.md)
- [Feature acceptance matrix](docs/FEATURE-MATRIX.md)
- [Development guide](docs/DEVELOPMENT.md)
- [RouterOS integration plan](docs/ROUTEROS-SETUP.md)
- [Standalone captive portal deployment](docs/STANDALONE-DEPLOYMENT.md)\n- [Security requirements](docs/SECURITY.md)
- [Test plan](docs/TEST-PLAN.md)

JuanFi is used as a functional reference for requirements. WiFi Vendo is implemented independently; original project assets and source are not copied.
