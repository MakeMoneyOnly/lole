import type { AppError } from '../errors';

/**
 * Notification channel type
 */
export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app' | 'webhook';

/**
 * Notification priority
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Notification recipient DTO
 */
export interface NotificationRecipient {
    id: string;
    email?: string;
    phone?: string;
    name?: string;
    userId?: string;
}

/**
 * Notification template variables
 */
export interface NotificationTemplateVariables {
    [key: string]: unknown;
}

/**
 * Send notification input DTO
 */
export interface SendNotificationInput {
    channel: NotificationChannel;
    recipient: NotificationRecipient;
    subject?: string;
    body: string;
    templateId?: string;
    templateVariables?: NotificationTemplateVariables;
    priority?: NotificationPriority;
    metadata?: Record<string, unknown>;
    attachments?: NotificationAttachment[];
}

/**
 * Notification attachment
 */
export interface NotificationAttachment {
    filename: string;
    contentType: string;
    url: string;
}

/**
 * Send notification output DTO
 */
export interface SendNotificationOutput {
    notificationId: string;
    channel: NotificationChannel;
    status: NotificationStatus;
    delivered?: boolean;
}

/**
 * Notification status
 */
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read';

/**
 * Batch send result
 */
export interface BatchSendResult {
    successful: SendNotificationOutput[];
    failed: Array<{ recipient: NotificationRecipient; error: AppError }>;
}

/**
 * Notification preference DTO
 */
export interface NotificationPreference {
    channel: NotificationChannel;
    enabled: boolean;
    quietHours?: {
        start?: string;
        end?: string;
    };
}

/**
 * User notification settings
 */
export interface UserNotificationSettings {
    userId: string;
    preferences: NotificationPreference[];
}

/**
 * Notification Service Port
 * Defines the contract for unified notification operations
 */
export interface NotificationServicePort {
    /**
     * Send a notification
     * @param input - Notification data
     * @returns Notification result
     * @throws AppError on failure
     */
    sendNotification(input: SendNotificationInput): Promise<SendNotificationOutput>;

    /**
     * Send notifications to multiple recipients
     * @param input - Notification data with multiple recipients
     * @param recipients - Array of recipients
     * @returns Batch send result
     * @throws AppError on failure
     */
    sendBatchNotification(
        input: Omit<SendNotificationInput, 'recipient'>,
        recipients: NotificationRecipient[]
    ): Promise<BatchSendResult>;

    /**
     * Send a notification to all preferred channels
     * @param input - Notification data
     * @returns Array of notification results
     * @throws AppError on failure
     */
    sendMultiChannelNotification(
        input: SendNotificationInput & { channels: NotificationChannel[] }
    ): Promise<SendNotificationOutput[]>;

    /**
     * Get user notification settings
     * @param userId - User identifier
     * @returns User notification settings
     * @throws AppError on failure
     */
    getUserSettings(userId: string): Promise<UserNotificationSettings>;

    /**
     * Update user notification settings
     * @param settings - Updated settings
     * @returns Updated settings
     * @throws AppError on failure
     */
    updateUserSettings(settings: UserNotificationSettings): Promise<UserNotificationSettings>;

    /**
     * Mark notification as read
     * @param notificationId - Notification identifier
     * @returns Updated notification
     * @throws AppError on failure
     */
    markAsRead(notificationId: string): Promise<SendNotificationOutput>;

    /**
     * Get pending notifications for a user
     * @param userId - User identifier
     * @returns Array of pending notifications
     * @throws AppError on failure
     */
    getPendingNotifications(userId: string): Promise<SendNotificationOutput[]>;
}
