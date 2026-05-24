export {
    requireMerchantAuth,
    type MerchantAuthResult,
    type MerchantAuthFailure,
    type MerchantAuthResponse,
    type RequireMerchantAuthOptions,
} from './auth-middleware';

export {
    withStandardResponse,
    createDeprecationWarning,
    createDeprecationWrapper,
    type HandlerContext,
    type SuccessData,
} from './response-utils';

export {
    auditAction,
    auditOrderAction,
    auditStatusTransition,
    auditWaitlistEntry,
    auditTableSession,
    auditServiceRequest,
    type AuditEventParams,
} from './audit-helpers';

export { enforcePilotAccess, checkPilotAccessSync, type PilotGateOptions } from './pilot-gate';
