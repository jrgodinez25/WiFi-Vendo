# Development and run guide

## Requirements
Node.js 20 or newer. PlatformIO is required only for embedded builds.

## Run simulator
```sh
npm install
npm start
```
Open http://localhost:3000. Run `npm test` for the repository tests. Simulator state is persisted in `web/data.json`.

## Simulator capabilities
Health and dashboard metrics; rates CRUD; voucher batch generation; standalone voucher redemption; simulated coin session start, pulses, cancellation and voucher completion; settings; device inventory; audit log. The simulator does not energize physical GPIO or connect to MikroTik.

## Firmware builds
```sh
cd firmware
pio run -e esp32-wifi
pio run -e esp32-w5500
pio run -e esp8266-wifi
```

## Implementation order
1. Complete standalone authentication/session engine.
2. RouterOS adapter and lab integration tests.
3. Captive portal workflows and remaining customer functions.
4. ESP32 Wi-Fi, ESP32 W5500, ESP8266.
5. OTA, production hardening, installer and full regression.
