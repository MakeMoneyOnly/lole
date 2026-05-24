import type {
    HardwarePeripheralAdapter,
    HardwarePeripheralHandlerMap,
    HardwarePeripheralKind,
    PeripheralRegistration,
} from '@/lib/printer/contracts';

export class HardwareAbstractionRegistry {
    private readonly adapters: HardwarePeripheralAdapter[] = [];

    register(adapter: HardwarePeripheralAdapter): void {
        this.adapters.push(adapter);
    }

    resolve<K extends HardwarePeripheralKind>(
        registration: PeripheralRegistration & { kind: K }
    ): HardwarePeripheralHandlerMap[K] | null {
        const adapter = this.adapters.find(candidate => candidate.supports(registration));
        if (!adapter) {
            return null;
        }

        return adapter.handler as HardwarePeripheralHandlerMap[K];
    }
}

export function createNoopPeripheralAdapter<K extends HardwarePeripheralKind>(input: {
    kind: K;
    driverKind: string;
}): HardwarePeripheralAdapter<K> {
    const now = (): string => new Date().toISOString();

    if (input.kind === 'scanner') {
        return {
            kind: input.kind,
            supports: (registration: PeripheralRegistration) =>
                registration.kind === input.kind && registration.driverKind === input.driverKind,
            handler: {
                read: async () => ({
                    code: 'noop-scan',
                    symbology: 'stub',
                    scannedAt: now(),
                }),
            },
        } as unknown as HardwarePeripheralAdapter<K>;
    }

    if (input.kind === 'cash_drawer') {
        return {
            kind: input.kind,
            supports: (registration: PeripheralRegistration) =>
                registration.kind === input.kind && registration.driverKind === input.driverKind,
            handler: {
                open: async () => ({
                    ok: true,
                    openedAt: now(),
                }),
            },
        } as unknown as HardwarePeripheralAdapter<K>;
    }

    return {
        kind: input.kind,
        supports: (registration: PeripheralRegistration) =>
            registration.kind === input.kind && registration.driverKind === input.driverKind,
        handler: {
            render: async () => ({
                ok: true,
                renderedAt: now(),
            }),
            clear: async () => ({
                ok: true,
                clearedAt: now(),
            }),
        },
    } as unknown as HardwarePeripheralAdapter<K>;
}
