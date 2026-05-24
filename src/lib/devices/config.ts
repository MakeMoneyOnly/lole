import { z } from 'zod';

export const SupportedPaymentMethodSchema = z.enum(['cash', 'chapa', 'card', 'other']);
export type SupportedPaymentMethod = z.infer<typeof SupportedPaymentMethodSchema>;

export const HardwareDeviceTypeSchema = z.enum(['pos', 'kds', 'kiosk', 'digital_menu', 'terminal']);
export type HardwareDeviceType = z.infer<typeof HardwareDeviceTypeSchema>;

export const DeviceProfileSchema = z.enum(['cashier', 'waiter', 'kds', 'kiosk']);
export type DeviceProfile = z.infer<typeof DeviceProfileSchema>;

export const TerminalSettlementModeSchema = z.enum(['cashier', 'counter', 'hybrid']);
export type TerminalSettlementMode = z.infer<typeof TerminalSettlementModeSchema>;

export const TerminalReceiptModeSchema = z.enum(['auto', 'prompt', 'disabled']);
export type TerminalReceiptMode = z.infer<typeof TerminalReceiptModeSchema>;

export const ManagedModeSchema = z.enum(['browser', 'pwa', 'dedicated']);
export type ManagedMode = z.infer<typeof ManagedModeSchema>;

export const PrinterConnectionTypeSchema = z.enum(['bluetooth', 'usb', 'network', 'none']);
export type PrinterConnectionType = z.infer<typeof PrinterConnectionTypeSchema>;

export const ManagementProviderSchema = z.enum(['none', 'esper']);
export type ManagementProvider = z.infer<typeof ManagementProviderSchema>;

export const FiscalModeSchema = z.enum(['stub', 'mor_live', 'mor_pending']);
export type FiscalMode = z.infer<typeof FiscalModeSchema>;

export const OtaStatusSchema = z.enum(['current', 'queued', 'installing', 'failed', 'outdated']);
export type OtaStatus = z.infer<typeof OtaStatusSchema>;

export const DeviceRuntimeMetadataSchema = z
    .object({
        route: z.string().trim().max(120).nullable().optional(),
        battery_percent: z.number().min(0).max(100).nullable().optional(),
        app_mode: ManagedModeSchema.nullable().optional(),
        visibility: z.enum(['visible', 'hidden']).nullable().optional(),
        native_platform: z.string().trim().max(40).nullable().optional(),
        native_version: z.string().trim().max(40).nullable().optional(),
        last_heartbeat_at: z.string().datetime().nullable().optional(),
    })
    .passthrough();

export type DeviceRuntimeMetadata = z.infer<typeof DeviceRuntimeMetadataSchema>;

export const DevicePrinterMetadataSchema = z
    .object({
        connection_type: PrinterConnectionTypeSchema.nullable().optional(),
        device_id: z.string().trim().max(120).nullable().optional(),
        device_name: z.string().trim().max(120).nullable().optional(),
        mac_address: z.string().trim().max(64).nullable().optional(),
        vendor_id: z.string().trim().max(40).nullable().optional(),
        product_id: z.string().trim().max(40).nullable().optional(),
        auto_connect: z.boolean().nullable().optional(),
        last_selected_at: z.string().datetime().nullable().optional(),
    })
    .passthrough();

export type DevicePrinterMetadata = z.infer<typeof DevicePrinterMetadataSchema>;

export const DeviceManagementMetadataSchema = z
    .object({
        provider: ManagementProviderSchema.nullable().optional(),
        provider_device_id: z.string().trim().max(120).nullable().optional(),
        blueprint_id: z.string().trim().max(120).nullable().optional(),
        kiosk_mode: z.boolean().nullable().optional(),
        status_bar_locked: z.boolean().nullable().optional(),
        navigation_locked: z.boolean().nullable().optional(),
        app_channel: z.string().trim().max(40).nullable().optional(),
        ota_status: OtaStatusSchema.nullable().optional(),
        target_app_version: z.string().trim().max(40).nullable().optional(),
        ota_requested_at: z.string().datetime().nullable().optional(),
        ota_completed_at: z.string().datetime().nullable().optional(),
        ota_error: z.string().trim().max(240).nullable().optional(),
    })
    .passthrough();

export type DeviceManagementMetadata = z.infer<typeof DeviceManagementMetadataSchema>;

export const DeviceFiscalMetadataSchema = z
    .object({
        mode: FiscalModeSchema.nullable().optional(),
        last_submission_at: z.string().datetime().nullable().optional(),
        last_receipt_id: z.string().trim().max(120).nullable().optional(),
        pending_queue_count: z.number().int().min(0).nullable().optional(),
    })
    .passthrough();

export type DeviceFiscalMetadata = z.infer<typeof DeviceFiscalMetadataSchema>;

export const HardwareDeviceMetadataSchema = z
    .object({
        station_name: z.string().trim().min(2).max(80).optional(),
        settlement_mode: TerminalSettlementModeSchema.optional(),
        allowed_payment_methods: z.array(SupportedPaymentMethodSchema).max(5).optional(),
        receipt_mode: TerminalReceiptModeSchema.optional(),
        managed_mode: ManagedModeSchema.optional(),
        kiosk_required: z.boolean().optional(),
        runtime: DeviceRuntimeMetadataSchema.optional(),
        printer: DevicePrinterMetadataSchema.optional(),
        management: DeviceManagementMetadataSchema.optional(),
        fiscal: DeviceFiscalMetadataSchema.optional(),
    })
    .passthrough();

export type HardwareDeviceMetadata = z.infer<typeof HardwareDeviceMetadataSchema>;

export type PaymentSurface = 'guest_qr' | 'online_order' | 'waiter_pos' | 'terminal';

export interface PaymentMethodOption {
    method: SupportedPaymentMethod;
    label: string;
    enabled: boolean;
    preferred?: boolean;
    description: string;
}

export const DEVICE_PAIRING_CODE_LENGTH = 6;

const PAYMENT_SURFACE_OPTIONS: Record<PaymentSurface, PaymentMethodOption[]> = {
    guest_qr: [
        {
            method: 'chapa',
            label: 'Chapa',
            enabled: true,
            preferred: true,
            description: 'Hosted fallback for broader Ethiopian payment acceptance.',
        },
        {
            method: 'cash',
            label: 'Pay Later',
            enabled: true,
            description: 'Guest orders now and settles with staff before leaving.',
        },
    ],
    online_order: [
        {
            method: 'chapa',
            label: 'Chapa',
            enabled: true,
            preferred: true,
            description: 'Primary prepaid checkout for pickup and delivery orders.',
        },
    ],
    waiter_pos: [
        {
            method: 'cash',
            label: 'Cash',
            enabled: true,
            preferred: true,
            description: 'Fast staff-assisted settlement for dine-in service.',
        },
        {
            method: 'chapa',
            label: 'Chapa',
            enabled: true,
            description: 'Hosted digital payment collection for staff-assisted service.',
        },
        {
            method: 'other',
            label: 'Other',
            enabled: true,
            description: 'Use for manual or restaurant-specific tender handling.',
        },
    ],
    terminal: [
        {
            method: 'cash',
            label: 'Cash',
            enabled: true,
            preferred: true,
            description: 'Primary cashier settlement path for in-person checkout.',
        },
        {
            method: 'chapa',
            label: 'Chapa',
            enabled: true,
            description: 'Hosted digital payment flow for terminal checkout.',
        },
        {
            method: 'other',
            label: 'Other',
            enabled: true,
            description: 'Use for exceptions and restaurant-specific settlement flows.',
        },
    ],
};

export function resolveDeviceProfile(deviceType: HardwareDeviceType): DeviceProfile {
    switch (deviceType) {
        case 'terminal':
            return 'cashier';
        case 'kds':
            return 'kds';
        case 'kiosk':
            return 'kiosk';
        default:
            return 'waiter';
    }
}

export function resolveDeviceTypeForProfile(profile: DeviceProfile): HardwareDeviceType {
    switch (profile) {
        case 'cashier':
            return 'terminal';
        case 'kds':
            return 'kds';
        case 'kiosk':
            return 'kiosk';
        default:
            return 'pos';
    }
}

export function getDeviceTypeLabel(deviceType?: string | null): string {
    switch (deviceType) {
        case 'kds':
            return 'Kitchen Display System';
        case 'pos':
            return 'Waiter POS';
        case 'kiosk':
            return 'Customer Kiosk';
        case 'digital_menu':
            return 'Digital Menu';
        case 'terminal':
            return 'Cashier Terminal';
        default:
            return 'Service Terminal';
    }
}

export function getDeviceProfileLabel(profile?: string | null): string {
    switch (profile) {
        case 'cashier':
            return 'Cashier';
        case 'waiter':
            return 'Waiter';
        case 'kds':
            return 'Kitchen Display';
        case 'kiosk':
            return 'Self-Service Kiosk';
        default:
            return 'Device';
    }
}

export function getPaymentOptionsForSurface(surface: PaymentSurface): PaymentMethodOption[] {
    return PAYMENT_SURFACE_OPTIONS[surface];
}

export function getBootPathForDeviceProfile(profile: DeviceProfile, slug?: string | null): string {
    switch (profile) {
        case 'cashier':
            return '/terminal';
        case 'kds':
            return '/kds';
        case 'kiosk':
            return slug ? `/${slug}?entry=menu` : '/';
        case 'waiter':
        default:
            return '/waiter';
    }
}

export function normalizeDeviceMetadata(
    deviceType: HardwareDeviceType,
    metadata?: HardwareDeviceMetadata | null,
    explicitProfile?: DeviceProfile | null
): HardwareDeviceMetadata {
    const profile = explicitProfile ?? resolveDeviceProfile(deviceType);
    const parsed = HardwareDeviceMetadataSchema.safeParse(metadata ?? {});
    const safeMetadata: HardwareDeviceMetadata = parsed.success ? parsed.data : {};

    const base: HardwareDeviceMetadata = {
        ...safeMetadata,
        managed_mode:
            safeMetadata.managed_mode ??
            (profile === 'kiosk' || deviceType === 'terminal' ? 'dedicated' : 'pwa'),
        printer: safeMetadata.printer
            ? {
                  connection_type: safeMetadata.printer.connection_type ?? 'none',
                  auto_connect: safeMetadata.printer.auto_connect ?? true,
                  ...safeMetadata.printer,
              }
            : undefined,
        management: safeMetadata.management
            ? {
                  provider: safeMetadata.management.provider ?? 'none',
                  kiosk_mode:
                      safeMetadata.management.kiosk_mode ??
                      (profile === 'kiosk' || deviceType === 'terminal'),
                  ...safeMetadata.management,
              }
            : undefined,
        fiscal: safeMetadata.fiscal
            ? {
                  mode: safeMetadata.fiscal.mode ?? 'stub',
                  ...safeMetadata.fiscal,
              }
            : undefined,
    };

    if (deviceType !== 'terminal') {
        return base;
    }

    return {
        ...base,
        station_name: safeMetadata.station_name,
        settlement_mode: safeMetadata.settlement_mode ?? 'cashier',
        allowed_payment_methods: safeMetadata.allowed_payment_methods ?? ['cash', 'chapa'],
        receipt_mode: safeMetadata.receipt_mode ?? 'auto',
        managed_mode: base.managed_mode ?? 'dedicated',
        kiosk_required: safeMetadata.kiosk_required ?? true,
        fiscal: {
            mode: safeMetadata.fiscal?.mode ?? 'mor_pending',
            ...safeMetadata.fiscal,
        },
        printer: {
            connection_type: safeMetadata.printer?.connection_type ?? 'none',
            auto_connect: safeMetadata.printer?.auto_connect ?? true,
            ...safeMetadata.printer,
        },
        management: {
            provider: safeMetadata.management?.provider ?? 'none',
            kiosk_mode: safeMetadata.management?.kiosk_mode ?? true,
            ...safeMetadata.management,
        },
    };
}
