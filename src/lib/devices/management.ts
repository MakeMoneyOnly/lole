import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';
import { writeAuditLog } from '@/lib/api/audit';
import { dispatchEsperDeviceAction } from '@/lib/integrations/esper';
import { isEnterpriseDeviceSchemaError } from '@/lib/devices/schema-compat';

export type ManagedDeviceAction = 'reboot' | 'wipe' | 'push_update';

function readRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

export async function queueAndDispatchManagedDeviceAction(args: {
    admin: SupabaseClient<Database>;
    restaurantId: string;
    userId: string;
    device: Record<string, unknown>;
    action: ManagedDeviceAction;
    packageName?: string | null;
    appVersion?: string | null;
    appChannel?: string | null;
}): Promise<{ actionId: string; providerJobId: string | null; status: 'dispatched' }> {
    const now = new Date().toISOString();
    const db = args.admin;
    const currentMetadata = readRecord(args.device.metadata);
    const currentManagement = readRecord(currentMetadata.management);
    const appChannel =
        typeof args.appChannel === 'string' && args.appChannel.trim().length > 0
            ? args.appChannel.trim()
            : typeof currentManagement.app_channel === 'string'
              ? currentManagement.app_channel
              : 'stable';
    const targetAppVersion =
        typeof args.appVersion === 'string' && args.appVersion.trim().length > 0
            ? args.appVersion.trim()
            : null;
    const packageName =
        args.packageName?.trim() ||
        process.env.ESPER_APP_PACKAGE_NAME?.trim() ||
        process.env.CAPACITOR_APP_ID?.trim() ||
        'com.lole.device';

    const { data: queuedAction, error: queueError } = await db
        .from('device_management_actions')
        .insert({
            restaurant_id: args.restaurantId,
            hardware_device_id: String(args.device.id),
            requested_by: args.userId,
            provider: 'esper',
            action_type: args.action,
            status: 'queued',
            request_payload: {
                package_name: args.action === 'push_update' ? packageName : null,
                app_version: targetAppVersion,
                app_channel: appChannel,
            },
        })
        .select('id')
        .single();

    if (queueError || !queuedAction) {
        throw new Error(queueError?.message ?? 'Failed to queue device action');
    }

    try {
        const result = await dispatchEsperDeviceAction({
            managementDeviceId: String(args.device.management_device_id),
            action: args.action,
            packageName: args.action === 'push_update' ? packageName : undefined,
            appVersion: args.appVersion,
        });

        const nextManagementMetadata = {
            ...currentManagement,
            provider: 'esper',
            app_channel: args.action === 'push_update' ? appChannel : currentManagement.app_channel,
            ota_status:
                args.action === 'push_update'
                    ? 'queued'
                    : (currentManagement.ota_status ?? 'current'),
            target_app_version:
                args.action === 'push_update'
                    ? targetAppVersion
                    : (currentManagement.target_app_version ?? null),
            ota_requested_at:
                args.action === 'push_update' ? now : (currentManagement.ota_requested_at ?? null),
            ota_completed_at:
                args.action === 'push_update' ? null : (currentManagement.ota_completed_at ?? null),
            ota_error: null,
        };

        await db
            .from('device_management_actions')
            .update({
                status: 'dispatched',
                provider_job_id: result.commandId ?? null,
                response_payload: (result.raw ?? {}) as unknown as Json,
            })
            .eq('id', queuedAction.id);

        let { error: deviceUpdateError } = await db
            .from('hardware_devices')
            .update({
                management_status: 'managed',
                app_channel: args.action === 'push_update' ? appChannel : undefined,
                target_app_version: args.action === 'push_update' ? targetAppVersion : undefined,
                ota_status: args.action === 'push_update' ? 'queued' : undefined,
                ota_requested_at: args.action === 'push_update' ? now : undefined,
                ota_completed_at: args.action === 'push_update' ? null : undefined,
                ota_error: args.action === 'push_update' ? null : undefined,
                metadata: {
                    ...currentMetadata,
                    management: nextManagementMetadata,
                } as unknown as Json,
            })
            .eq('id', String(args.device.id))
            .eq('restaurant_id', args.restaurantId);

        if (deviceUpdateError && isEnterpriseDeviceSchemaError(deviceUpdateError.message)) {
            const legacyResult = await db
                .from('hardware_devices')
                .update({
                    metadata: {
                        ...currentMetadata,
                        management: nextManagementMetadata,
                    } as unknown as Json,
                })
                .eq('id', String(args.device.id))
                .eq('restaurant_id', args.restaurantId);

            deviceUpdateError = legacyResult.error;
        }

        if (deviceUpdateError) {
            throw new Error(deviceUpdateError.message);
        }

        await writeAuditLog(args.admin, {
            restaurant_id: args.restaurantId,
            user_id: args.userId,
            action: 'device_management_action_dispatched',
            entity_type: 'hardware_devices',
            entity_id: String(args.device.id),
            metadata: {
                action: args.action,
                provider: 'esper',
                provider_job_id: result.commandId ?? null,
                app_version: targetAppVersion,
                app_channel: appChannel,
            },
        });

        return {
            actionId: queuedAction.id,
            providerJobId: result.commandId ?? null,
            status: 'dispatched' as const,
        };
    } catch (error) {
        const failureMessage =
            error instanceof Error ? error.message : 'Failed to dispatch remote device action';

        await db
            .from('device_management_actions')
            .update({
                status: 'failed',
                response_payload: {
                    error: failureMessage,
                } as Json,
                completed_at: now,
            })
            .eq('id', queuedAction.id);

        if (args.action === 'push_update') {
            const { error: otaError } = await db
                .from('hardware_devices')
                .update({
                    ota_status: 'failed',
                    ota_error: failureMessage,
                    metadata: {
                        ...currentMetadata,
                        management: {
                            ...currentManagement,
                            provider: 'esper',
                            ota_status: 'failed',
                            target_app_version: targetAppVersion,
                            ota_requested_at: now,
                            ota_error: failureMessage,
                        },
                    } as unknown as Json,
                })
                .eq('id', String(args.device.id))
                .eq('restaurant_id', args.restaurantId);

            if (otaError && isEnterpriseDeviceSchemaError(otaError.message)) {
                await db
                    .from('hardware_devices')
                    .update({
                        metadata: {
                            ...currentMetadata,
                            management: {
                                ...currentManagement,
                                provider: 'esper',
                                ota_status: 'failed',
                                target_app_version: targetAppVersion,
                                ota_requested_at: now,
                                ota_error: failureMessage,
                            },
                        } as unknown as Json,
                    })
                    .eq('id', String(args.device.id))
                    .eq('restaurant_id', args.restaurantId);
            }
        }

        throw error;
    }
}
