// Ports Layer - External Integration Contracts
// Hexagonal Architecture: Ports define interfaces for external dependencies

// Email Service Port
export type {
    SendEmailInput,
    SendEmailOutput,
    EmailAttachment,
    EmailValidationResult,
} from './email.port';
export type { EmailServicePort } from './email.port';

// SMS Service Port
export type {
    SendSmsInput,
    SendSmsOutput,
    SmsStatus,
    SmsCost,
    SmsValidationResult,
} from './sms.port';
export type { SmsServicePort } from './sms.port';

// Payment Provider Port
export type {
    PaymentAmount,
    PaymentCustomer,
    PaymentMetadata,
    CreatePaymentInput,
    CreatePaymentOutput,
    PaymentStatus,
    PaymentNextAction,
    CapturePaymentInput,
    CapturePaymentOutput,
    RefundPaymentInput,
    RefundPaymentOutput,
    RefundStatus,
    PaymentIntentResult,
    PaymentMethodDetails,
} from './payment.port';
export type { PaymentProviderPort } from './payment.port';

// Notification Service Port
export type {
    NotificationChannel,
    NotificationPriority,
    NotificationRecipient,
    NotificationTemplateVariables,
    SendNotificationInput,
    SendNotificationOutput,
    NotificationStatus,
    BatchSendResult,
    NotificationPreference,
    UserNotificationSettings,
} from './notification.port';
export type { NotificationServicePort } from './notification.port';

// File Storage Service Port
export type {
    FileMetadata,
    UploadFileInput,
    UploadFileOutput,
    DownloadFileOutput,
    DeleteFileResult,
    ListFilesInput,
    ListFilesOutput,
    FileValidationResult,
    StorageConfig,
} from './storage.port';
export type { FileStorageServicePort } from './storage.port';

// Cache Service Port
export type {
    CacheEntry,
    GetCacheInput,
    SetCacheInput,
    DeleteCacheInput,
    CacheOperationResult,
    CacheGetResult,
    IncrementCacheInput,
    CacheStats,
} from './cache.port';
export type { CacheServicePort } from './cache.port';
