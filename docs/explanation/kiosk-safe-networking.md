# Kiosk-Safe Networking

Date: 2026-04-21
Tasks: `ENT-011`, `ENT-012`

## Required LAN Capabilities

Esper-managed store devices must allow:

- outbound WebSocket MQTT to local gateway broker
- outbound HTTPS or HTTP to local gateway health and bootstrap endpoints
- LAN DNS resolution for gateway hostnames when used
- local subnet traffic between POS, KDS, handheld, and gateway

## Required Ports

- `1884` TCP: local MQTT over WebSocket broker
- `8787` TCP: gateway health and bootstrap endpoint

## Optional Discovery

- retained MQTT discovery topic can replace multicast for restrictive kiosk profiles
- if multicast allowed later, mDNS may be added as secondary discovery channel

## Policy Rules

- do not block local subnet egress from kiosk apps
- allow WebView/WebSocket access to private RFC1918 addresses
- preserve stored device identity/session material across app restarts
- do not require WAN reachability for app launch or terminal pairing after bootstrap

## Security Rules

- every device uses signed gateway session token
- MQTT scope restricted to restaurant/location topics
- expired session tokens must force re-bootstrap or refresh
