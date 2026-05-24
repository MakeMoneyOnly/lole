export type ActivityType = 'order' | 'kitchen' | 'staff' | 'request';

export interface ActivityItem {
    id: string;
    type: ActivityType;
    user: string;
    action: string;
    target: string;
    time: string;
    timestamp: Date;
    avatar?: string;
    message?: string;
    hasMessage?: boolean;
    hasFile?: boolean;
    fileName?: string;
    fileSize?: string;
}
