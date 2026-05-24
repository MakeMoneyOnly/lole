export type PrinterDriverKind = 'network' | 'native_bridge' | 'bluetooth' | 'webhook';
export type PrinterHealthState = 'healthy' | 'degraded' | 'offline' | 'unknown';
export type PrinterSpoolStatus = 'pending' | 'printing' | 'completed' | 'failed' | 'rerouted';

export interface PrinterRouteIntent {
    routeKey: string;
    station: string;
    fallbackRouteKey?: string | null;
    preferredDeviceId?: string | null;
    preferredPrinterName?: string | null;
}

export interface KdsPrintPayload {
    restaurantId: string;
    orderId: string;
    orderNumber: string;
    tableNumber?: number;
    items: Array<{
        name: string;
        name_am?: string;
        quantity: number;
        notes?: string;
        modifiers?: string[];
    }>;
    station: string;
    firedAt: string;
    reason: string;
}

export interface PrinterDispatchPayload {
    jobId: string;
    orderId: string;
    station: string;
    routeKey: string;
    printerDeviceId?: string | null;
    printerName?: string | null;
    payloadJson: string;
}

export interface PrinterDispatchResult {
    ok: boolean;
    state: 'completed' | 'queued' | 'failed';
    driverKind: PrinterDriverKind;
    printerDeviceId?: string | null;
    printerName?: string | null;
    message?: string | null;
}

export interface PrinterHealthSnapshot {
    printerDeviceId: string;
    printerName: string;
    driverKind: PrinterDriverKind;
    state: PrinterHealthState;
    queueDepth: number;
    failedJobs: number;
    pendingJobs: number;
    printingJobs: number;
    lastHeartbeatAt?: string | null;
    lastError?: string | null;
    routeKeys: string[];
}

export interface PrinterDriverAdapter {
    kind: PrinterDriverKind;
    supports(input: { driverKind: PrinterDriverKind }): boolean;
    dispatch(payload: PrinterDispatchPayload): Promise<PrinterDispatchResult>;
    probeHealth?(input: {
        printerDeviceId: string;
        printerName: string;
        routeKeys: string[];
    }): Promise<PrinterHealthSnapshot>;
}

export type HardwarePeripheralKind = 'scanner' | 'cash_drawer' | 'customer_display';

export interface PeripheralRegistration {
    peripheralId: string;
    kind: HardwarePeripheralKind;
    driverKind: string;
    label: string;
    metadata?: Record<string, unknown>;
}

export interface ScannerReadResult {
    code: string;
    symbology?: string | null;
    scannedAt: string;
}

export interface CustomerDisplayFrame {
    title: string;
    lines: string[];
    totalAmount?: number | null;
    currency?: string | null;
}

export interface HardwarePeripheralHandlerMap {
    scanner: {
        read(): Promise<ScannerReadResult>;
    };
    cash_drawer: {
        open(): Promise<{ ok: boolean; openedAt: string }>;
    };
    customer_display: {
        render(frame: CustomerDisplayFrame): Promise<{ ok: boolean; renderedAt: string }>;
        clear(): Promise<{ ok: boolean; clearedAt: string }>;
    };
}

export type HardwarePeripheralAdapter<K extends HardwarePeripheralKind = HardwarePeripheralKind> = {
    kind: K;
    supports(registration: PeripheralRegistration): boolean;
    handler: HardwarePeripheralHandlerMap[K];
};
