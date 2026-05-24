declare module 'mqtt' {
    export interface IClientOptions {
        clientId?: string;
        username?: string;
        password?: string;
        keepalive?: number;
        reconnectPeriod?: number;
        connectTimeout?: number;
        clean?: boolean;
    }

    export interface IClientPublishOptions {
        qos?: 0 | 1 | 2;
        retain?: boolean;
    }

    export interface ISubscriptionGrant {
        topic: string;
        qos: 0 | 1 | 2;
    }

    export interface MqttClient {
        on(event: 'connect' | 'reconnect', callback: () => void): void;
        on(event: 'error', callback: (error: Error) => void): void;
        publish(
            topic: string,
            message: string,
            options: IClientPublishOptions,
            callback: (error?: Error | null) => void
        ): void;
        subscribe(
            topic: string,
            options: { qos: 0 | 1 | 2 },
            callback: (error: Error | null, granted: ISubscriptionGrant[]) => void
        ): void;
        end(
            force?: boolean,
            options?: Record<string, never>,
            callback?: (error?: Error | null) => void
        ): void;
    }

    export function connect(url: string, options?: IClientOptions): MqttClient;
}
