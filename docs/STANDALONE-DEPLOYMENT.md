# Standalone Captive Portal Deployment

## What is implemented

The standalone customer flow now has:
- A mobile-first captive portal at `/hotspot/customer.html`, including voucher entry and optional QR scanning.
- Voucher redemption that creates a random 256-bit session token. Only its SHA-256 hash is stored in the application data.
- An `HttpOnly`, `SameSite=Strict` cookie; `Secure` is added when the Node.js connection itself uses TLS.
- Session status, pause, resume, extension and logout APIs that require the cookie. Session IDs are no longer accepted as customer credentials.
- Client-IP binding as an additional check.
- Voucher-attempt throttling (10 failed attempts per client IP per 10 minutes).
- Session expiry and firewall authorization tied to remaining time.
- Captive-network HTTP probe redirects for common Android, Apple and Windows endpoints.
- A Linux nftables adapter that redirects unauthenticated HTTP (TCP/80) to the portal and blocks their forwarded IPv4/IPv6 traffic. Authorized client IPs are held in timeout sets, so access expires automatically even if the app stops polling.

## Important operating modes

The default is **simulation**. It does not block or allow real packets:

```sh
WIFI_VENDO_ENFORCEMENT=simulated npm start
```

Real enforcement is an optional Linux gateway feature. It has not yet been validated against your physical AP, bridge, DHCP/DNS and WAN topology. Do not enable it on a shared production LAN.

## Linux gateway prerequisites

Use a dedicated guest-facing Layer-3 interface or bridge (example: `br-vendo`) that carries only WiFi Vendo customer traffic. The WiFi Vendo Node.js process must run on that gateway host, have permission to manage nftables (root or equivalent `CAP_NET_ADMIN`), and listen on TCP port 3000.

Before enabling enforcement, verify all of the following:

1. The gateway has a separate WAN interface with working IP forwarding and outbound NAT/masquerading.
2. Guest DHCP supplies the gateway as the default route and preferably the gateway's DNS proxy as the DNS server. Permit guest DNS requests to that local resolver; it should forward normal queries upstream. Do not configure a wildcard DNS response to the portal; authorized customers need normal DNS.
3. The gateway input firewall permits guest clients to reach TCP/3000 on the gateway.
4. The configured guest interface is the actual ingress interface seen by the Linux routing stack. Verify it with `ip route` and `tcpdump`; bridge member names and bridge names are not interchangeable. Use stable DHCP leases and client isolation/anti-spoofing on the AP: sessions are bound to the client source IP, so an IP change requires a new voucher session.
5. The admin workstation has a fixed management IP and is not connected through the guest interface.
6. The portal URL resolves/reaches the gateway from the guest network.

## Configuration

Example environment for a dedicated guest bridge at `br-vendo`, gateway address `192.168.50.1`, and admin workstation `192.168.50.10`:

```sh
export PORT=3000
export WIFI_VENDO_ENFORCEMENT=nftables
export WIFI_VENDO_LAN_IFACE=br-vendo
export WIFI_VENDO_PORTAL_URL=http://192.168.50.1:3000/hotspot/customer.html
export WIFI_VENDO_ADMIN_IPS=127.0.0.1,::1,192.168.50.10
npm start
```

The service initializes the dedicated firewall table before opening its HTTP listener. If firewall initialization fails, startup stops without accepting guest traffic. Setup is idempotent and is also checked before lease changes.

The app creates its own nftables table, `inet wifi_vendo`, with:
- IPv4 and IPv6 allow-sets with per-session timeouts.
- A forwarding chain that drops packets entering from the guest interface unless the source address is authorized.
- A prerouting NAT chain that redirects unauthenticated guest HTTP traffic on TCP/80 to the portal on TCP/3000.

The adapter redirects unauthenticated guest HTTP requests to the configured portal URL (or `/hotspot/customer.html`) and redirects TCP/80 to the local portal listener. The adapter does **not** configure the bridge, DHCP, DNS, WAN NAT, WiFi access point, or the gateway's input firewall. It does not intercept HTTPS or decrypt TLS. HTTPS destinations fail until the client is authorized; captive-network detection normally uses HTTP. Once the voucher is accepted, the client's address is added to the allow-set for the session's remaining duration. Pause and logout remove it; resume adds it again; extension refreshes the timeout.

The nftables table is dedicated to WiFi Vendo. Do not manually add unrelated rules to it. To disable enforcement, stop the service and remove only this dedicated table after verifying no clients depend on it:

```sh
sudo nft delete table inet wifi_vendo
```

## Admin interface restriction

The admin dashboard and administrative APIs require both a valid administrator login and an exact source IP allowlist. By default, only loopback addresses can access them. Set `WIFI_VENDO_ADMIN_IPS` to a comma-separated list of trusted management IPs. The customer portal, health endpoint, voucher redemption, customer session endpoints and public promo-rate read remain available to guests.

Set `WIFI_VENDO_ADMIN_PASSWORD` to a unique password of at least 12 characters before starting the service. Use a long random password and inject it through the service manager's protected environment/secret mechanism; do not commit it to Git, place it in the JSON data file, or pass it in a shell command that may be saved in history. Example (interactive shell only):

```sh
read -s -p 'WiFi Vendo admin password: ' WIFI_VENDO_ADMIN_PASSWORD; export WIFI_VENDO_ADMIN_PASSWORD; echo
```

The server derives a scrypt verifier at startup. Login is rate-limited to five failures per source IP per 15 minutes. Successful sessions last eight hours, are bound to the management IP, and are invalidated when the service restarts. Only one shared administrator password is supported; multi-user roles and account recovery are not yet implemented. Do not expose the service to the public internet, and do not add the guest subnet to the admin allowlist.

The app does not trust `X-Forwarded-For`. Do not put it behind a reverse proxy or NAT that hides the original guest source address when using nftables enforcement; the firewall needs the real client IP. The portal cookie is marked `Secure` only when Node.js itself receives TLS. For public/open WiFi, use a trusted TLS deployment before collecting voucher codes, or protect the guest radio with WPA2/WPA3 and treat voucher codes as bearer credentials.

## Validation checklist before customer use

- [ ] Test on an isolated lab VLAN/SSID, not the office/home LAN.
- [ ] Verify unauthorized IPv4 and IPv6 clients cannot forward traffic to WAN.
- [ ] Verify HTTP captive probes open the portal.
- [ ] Verify HTTPS is not intercepted and fails closed before authorization.
- [ ] Redeem a test voucher; verify normal DNS and internet work after authorization.
- [ ] Pause: verify forwarding stops and the timer stops.
- [ ] Resume: verify forwarding returns and the timer resumes.
- [ ] Extend: verify the nftables timeout is refreshed.
- [ ] Logout: verify forwarding stops immediately.
- [ ] Let a session expire without touching the browser; verify the nftables timeout removes access.
- [ ] Reboot the gateway and verify service startup, nftables rules and guest isolation.
- [ ] Verify the admin dashboard is inaccessible from guest clients and accessible only from allowlisted management IPs.

Until this checklist passes on the actual gateway, keep `WIFI_VENDO_ENFORCEMENT=simulated`.
