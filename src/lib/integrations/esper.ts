export type EsperDeviceAction = 'reboot' | 'wipe' | 'push_update';

export interface EsperActionRequest {
    managementDeviceId: string;
    action: EsperDeviceAction;
    packageName?: string | null;
    appVersion?: string | null;
}

export interface EsperActionResult {
    ok: boolean;
    commandId?: string | null;
    raw?: Record<string, unknown> | null;
}

const DEFAULT_ACTION_COMMANDS: Record<EsperDeviceAction, string> = {
    reboot: 'REBOOT',
    wipe: 'WIPE_DEVICE',
    push_update: 'INSTALL',
};

function getEsperEndpoint(): string | null {
    const explicit = process.env.ESPER_API_BASE_URL;
    if (explicit) {
        return explicit.replace(/\/+$/, '');
    }

    const tenant = process.env.ESPER_TENANT_NAME;
    const enterpriseId = process.env.ESPER_ENTERPRISE_ID;
    if (!tenant || !enterpriseId) {
        return null;
    }

    return `https://${tenant}-api.esper.cloud/api/v0/enterprise/${enterpriseId}`;
}

export function isEsperConfigured(): boolean {
    return Boolean(getEsperEndpoint() && process.env.ESPER_API_KEY);
}

export async function dispatchEsperDeviceAction(
    request: EsperActionRequest
): Promise<EsperActionResult> {
    const endpoint = getEsperEndpoint();
    const apiKey = process.env.ESPER_API_KEY;

    if (!endpoint || !apiKey) {
        throw new Error('Esper integration is not configured');
    }

    const command =
        process.env[`ESPER_${request.action.toUpperCase()}_COMMAND`] ??
        DEFAULT_ACTION_COMMANDS[request.action];

    const body: Record<string, unknown> = {
        command_type: 'DEVICE',
        devices: [request.managementDeviceId],
        device_type: 'all',
        command,
    };

    if (request.action === 'push_update' && request.packageName) {
        body.app_package_name = request.packageName;
        body.app_version = request.appVersion ?? undefined;
    }

    const response = await fetch(`${endpoint}/command/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `ApiKey ${apiKey}`,
        },
        body: JSON.stringify(body),
    });

    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    if (!response.ok) {
        throw new Error(String(payload?.detail ?? payload?.message ?? 'Esper command failed'));
    }

    return {
        ok: true,
        commandId:
            payload?.command_id !== undefined
                ? String(payload.command_id)
                : payload?.id !== undefined
                  ? String(payload.id)
                  : null,
        raw: payload,
    };
}
