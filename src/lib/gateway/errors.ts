export enum GatewayErrorCode {
    BROKER_UNAVAILABLE = 'BROKER_UNAVAILABLE',
    SESSION_EXPIRED = 'SESSION_EXPIRED',
    UNAUTHORIZED_DEVICE = 'UNAUTHORIZED_DEVICE',
    TOPIC_ACL_REJECTED = 'TOPIC_ACL_REJECTED',
    COMMAND_DISPATCH_FAILED = 'COMMAND_DISPATCH_FAILED',
    JOURNAL_WRITE_FAILED = 'JOURNAL_WRITE_FAILED',
    BROKER_START_FAILED = 'BROKER_START_FAILED',
    SHUTDOWN_TIMEOUT = 'SHUTDOWN_TIMEOUT',
    INVALID_CONFIG = 'INVALID_CONFIG',
}

export class GatewayError extends Error {
    readonly code: GatewayErrorCode;
    readonly context: Record<string, unknown>;
    readonly tenantId?: string;

    constructor(
        code: GatewayErrorCode,
        message: string,
        context?: Record<string, unknown>,
        tenantId?: string
    ) {
        super(message);
        this.name = 'GatewayError';
        this.code = code;
        this.context = context ?? {};
        this.tenantId = tenantId;
    }
}

export function isGatewayError(error: unknown): error is GatewayError {
    return error instanceof GatewayError;
}
