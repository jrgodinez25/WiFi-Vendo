# Selected hardware profile

- Controllers: ESP8266 and ESP32.
- Networks: Wi-Fi and Ethernet (ESP32 + W5500).
- Router modes: MikroTik Hotspot and standalone.
- LCD: disabled; no LCD hardware or code is required.
- First target: ESP32 Wi-Fi; next ESP32 W5500; then ESP8266 Wi-Fi.

Pin maps are board-specific. Coin acceptor outputs require proper isolation/level shifting. Never connect 12V pulse signals directly to ESP GPIO. Simulator builds do not energize GPIO, relays or coin hardware.
