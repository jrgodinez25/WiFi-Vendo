# Test plan

## Simulator/API
- health and mode reporting
- rate CRUD and invalid rate rejection
- voucher batch quantity bounds, prefix and sales inclusion
- coin session start, partial pulses, paid state, timeout, cancellation and completion
- duplicate active session rejection
- voucher redemption and duplicate redemption rejection
- independent statistics reset
- settings secret redaction
- audit event generation

## Firmware/HIL
- ESP8266 Wi-Fi recovery AP and reconnect
- ESP32 Wi-Fi reconnect
- ESP32 W5500 link, DHCP and static addressing
- coin acceptor isolation, polarity, pulse width and debounce
- LED/relay fail-safe behavior

## RouterOS lab
- API authentication and permission boundaries
- voucher create/redeem/extend
- active session query and logout
- pause/resume expiry semantics
- router down, authentication denied and API timeout

Every feature requires implementation, tests and operator documentation. Hardware and RouterOS functions require hardware-in-loop/lab-router verification before production.
