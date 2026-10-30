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

The simulator includes dashboard metrics, promo-rate management, voucher batch generation, simulated coin transactions, voucher redemption, standalone customer session controls (pause/resume/logout/extend), settings, device inventory and activity history.

**Important:** This is an early development simulator. It does not yet control a physical coin acceptor, provide live internet enforcement, connect to RouterOS, or perform OTA updates. Do not expose it to the public internet or connect payment hardware. See [Security](docs/SECURITY.md) and [Feature acceptance matrix](docs/FEATURE-MATRIX.md).

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
- [Security requirements](docs/SECURITY.md)
- [Test plan](docs/TEST-PLAN.md)

JuanFi is used as a functional reference for requirements. WiFi Vendo is implemented independently; original project assets and source are not copied.
