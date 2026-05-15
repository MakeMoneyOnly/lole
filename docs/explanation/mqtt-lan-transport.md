# MQTT LAN Transport

Date: 2026-04-21
Task: `ENT-004`

## Decision

Use **MQTT** for restaurant LAN transport.

## Why MQTT

- pub/sub fits POS, KDS, printer, handheld fan-out
- QoS levels support at-least-once delivery
- retained presence/config topics help late joiners
- low bandwidth and low overhead for unstable networks
- mature client support across Node, browser bridges, Android runtimes

## Topic Namespace

Base:

`lole/v1/restaurants/{restaurantId}/locations/{locationId}`

Scopes:

- `orders/commands`
- `orders/events`
- `kds/commands`
- `kds/events`
- `tables/commands`
- `tables/events`
- `printers/jobs`
- `printers/status`
- `fiscal/jobs`
- `fiscal/results`
- `audit/events`
- `devices/{deviceId}/presence`
- `system/mode`

## QoS Policy

- commands: QoS 1
- fiscal jobs: QoS 1
- printer jobs: QoS 1
- presence: QoS 0 with retained last state
- health/mode: QoS 0 or 1 depending payload criticality

## Auth Model

- device-scoped client identity
- restaurant-scoped topic authorization
- gateway-issued session material after pairing/bootstrap

## Open Work

- broker placement: embedded in gateway or adjacent sidecar
- offline broker persistence policy
- device cert rotation
