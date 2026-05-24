export type MqttScope =
    | 'orders'
    | 'kds'
    | 'tables'
    | 'printers'
    | 'fiscal'
    | 'audit'
    | 'devices'
    | 'system';

export type MqttChannel =
    | 'commands'
    | 'events'
    | 'jobs'
    | 'status'
    | 'results'
    | 'presence'
    | 'mode';

export interface RestaurantTopicInput {
    restaurantId: string;
    locationId: string;
    scope: MqttScope;
    channel: MqttChannel;
}

export function buildRestaurantTopic(input: RestaurantTopicInput): string {
    return `lole/v1/restaurants/${input.restaurantId}/locations/${input.locationId}/${input.scope}/${input.channel}`;
}

export interface DevicePresenceTopicInput {
    restaurantId: string;
    locationId: string;
    deviceId: string;
}

export function buildDevicePresenceTopic(input: DevicePresenceTopicInput): string {
    return `lole/v1/restaurants/${input.restaurantId}/locations/${input.locationId}/devices/${input.deviceId}/presence`;
}

export function buildGatewayModeTopic(restaurantId: string, locationId: string): string {
    return buildRestaurantTopic({
        restaurantId,
        locationId,
        scope: 'system',
        channel: 'mode',
    });
}

export function buildGatewayDiscoveryTopic(restaurantId: string, locationId: string): string {
    return buildRestaurantTopic({
        restaurantId,
        locationId,
        scope: 'system',
        channel: 'status',
    });
}
