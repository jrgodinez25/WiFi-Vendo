#include <Arduino.h>
#ifndef WIFI_VENDO_VERSION
#define WIFI_VENDO_VERSION "0.2.0-dev"
#endif
// Safe bring-up firmware. No coin GPIO, relay, or power output is enabled yet.
// LCD support is intentionally disabled in the selected hardware profile.
void setup(){Serial.begin(115200);delay(100);Serial.println();Serial.println("WiFi Vendo firmware");Serial.printf("Version: %s\n",WIFI_VENDO_VERSION);
#if defined(WIFI_VENDO_ESP8266)
Serial.println("Target: ESP8266 Wi-Fi");
#elif defined(WIFI_VENDO_ETH_W5500)
Serial.println("Target: ESP32 + W5500 Ethernet");
#else
Serial.println("Target: ESP32 Wi-Fi");
#endif
Serial.println("Safe mode: hardware outputs disabled; LCD disabled.");}
void loop(){delay(1000);}
