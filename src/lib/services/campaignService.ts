/**
 * Campaign Service
 *
 * Unified campaign delivery for:
 * - SMS via Africa's Talking
 * - Email via Resend
 * - WhatsApp via WhatsApp Business API
 * - Telegram via Telegram Bot API
 */

import { sendSms, SmsSendResult as _SmsSendResult } from '@/lib/notifications/sms';
import { resend, EMAIL_FROM } from '@/lib/email/client';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { logger } from '@/lib/logger';

const log = logger.child('Campaign');

export type Channel = 'sms' | 'email' | 'whatsapp' | 'telegram';

export interface CampaignRecipient {
    guestId: string;
    phone?: string;
    email?: string;
    whatsapp?: string;
    telegramChatId?: string;
    name?: string;
    isVerified: boolean;
}

export interface CampaignMessage {
    subject?: string;
    body: string;
    htmlBody?: string;
}

export interface CampaignDeliveryResult {
    success: boolean;
    channel: Channel;
    guestId: string;
    messageId?: string;
    error?: string;
    deliveredAt?: Date;
}

/**
 * Send a campaign to a single recipient via the specified channel
 */
export async function sendToRecipient(
    recipient: CampaignRecipient,
    channel: Channel,
    message: CampaignMessage
): Promise<CampaignDeliveryResult> {
    const { guestId, phone, email, whatsapp } = recipient;

    try {
        switch (channel) {
            case 'sms':
                if (!phone || !recipient.isVerified) {
                    return {
                        success: false,
                        channel,
                        guestId,
                        error: 'Phone not available or not verified',
                    };
                }
                return await sendSmsCampaign(phone, message.body, guestId);

            case 'email':
                if (!email || !recipient.isVerified) {
                    return {
                        success: false,
                        channel,
                        guestId,
                        error: 'Email not available or not verified',
                    };
                }
                return await sendEmailCampaign(
                    email,
                    message.subject || 'Message',
                    message.htmlBody || message.body,
                    guestId
                );

            case 'whatsapp':
                if (!whatsapp || !recipient.isVerified) {
                    return {
                        success: false,
                        channel,
                        guestId,
                        error: 'WhatsApp not available or not verified',
                    };
                }
                return await sendWhatsAppCampaign(whatsapp, message.body, guestId);

            case 'telegram':
                if (!recipient.telegramChatId) {
                    return { success: false, channel, guestId, error: 'Telegram not linked' };
                }
                return await sendTelegramCampaign(recipient.telegramChatId, message.body, guestId);

            default:
                return { success: false, channel, guestId, error: `Unknown channel: ${channel}` };
        }
    } catch (error) {
        return {
            success: false,
            channel,
            guestId,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Send SMS via Africa's Talking
 */
async function sendSmsCampaign(
    phone: string,
    body: string,
    guestId: string
): Promise<CampaignDeliveryResult> {
    const result = await sendSms(phone, body);

    return {
        success: result.success,
        channel: 'sms',
        guestId,
        error: result.error,
        deliveredAt: result.success ? new Date() : undefined,
    };
}

/**
 * Send Email via Resend
 */
async function sendEmailCampaign(
    toEmail: string,
    subject: string,
    htmlBody: string,
    guestId: string
): Promise<CampaignDeliveryResult> {
    if (!resend) {
        return {
            success: false,
            channel: 'email',
            guestId,
            error: 'Resend not configured',
        };
    }

    try {
        const data = await resend.emails.send({
            from: EMAIL_FROM,
            to: toEmail,
            subject,
            html: htmlBody,
        });

        return {
            success: true,
            channel: 'email',
            guestId,
            messageId: data.data?.id,
            deliveredAt: new Date(),
        };
    } catch (error) {
        return {
            success: false,
            channel: 'email',
            guestId,
            error: error instanceof Error ? error.message : 'Resend error',
        };
    }
}

/**
 * Send WhatsApp (fallback to SMS for now)
 */
async function sendWhatsAppCampaign(
    phone: string,
    body: string,
    guestId: string
): Promise<CampaignDeliveryResult> {
    // TODO: Implement WhatsApp Business API
    // Fall back to SMS for now
    return await sendSmsCampaign(phone, `[WhatsApp]: ${body}`, guestId);
}

/**
 * Send Telegram message
 */
async function sendTelegramCampaign(
    chatId: string,
    body: string,
    guestId: string
): Promise<CampaignDeliveryResult> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
        return {
            success: false,
            channel: 'telegram',
            guestId,
            error: 'Telegram bot token not configured',
        };
    }

    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: body,
                parse_mode: 'HTML',
            }),
        });

        const data = await response.json();

        if (data.ok) {
            return {
                success: true,
                channel: 'telegram',
                guestId,
                messageId: String(data.result.message_id),
                deliveredAt: new Date(),
            };
        } else {
            return {
                success: false,
                channel: 'telegram',
                guestId,
                error: data.description || 'Telegram API error',
            };
        }
    } catch (error) {
        return {
            success: false,
            channel: 'telegram',
            guestId,
            error: error instanceof Error ? error.message : 'Network error',
        };
    }
}

/**
 * Get verified recipients for a campaign from a restaurant
 */
export async function getVerifiedRecipients(
    restaurantId: string,
    options?: {
        segmentId?: string;
        hasPhone?: boolean;
        hasEmail?: boolean;
    }
): Promise<CampaignRecipient[]> {
    const supabase = createServiceRoleClient();

    let query = supabase
        .from('guests')
        .select(
            `
      id,
      name,
      phone,
      email,
      whatsapp,
      is_verified,
      metadata->telegram_chat_id as telegramChatId
    `
        )
        .eq('restaurant_id', restaurantId)
        .eq('is_verified', true);

    if (options?.hasPhone) {
        query = query.not('phone', 'is', null);
    }

    if (options?.hasEmail) {
        query = query.not('email', 'is', null);
    }

    const { data: guests, error } = await query;

    if (error) {
        log.error('Error fetching campaign recipients', error);
        return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (guests || []).map((g: any) => ({
        guestId: g.id,
        phone: g.phone,
        email: g.email,
        whatsapp: g.whatsapp,
        telegramChatId: g.telegramChatId,
        name: g.name,
        isVerified: g.is_verified,
    }));
}

/**
 * Send a marketing campaign to all recipients
 */
export async function sendCampaign(
    campaignId: string,
    restaurantId: string,
    channel: Channel,
    message: CampaignMessage
): Promise<{
    total: number;
    successful: number;
    failed: number;
    results: CampaignDeliveryResult[];
}> {
    const supabase = createServiceRoleClient();

    // Get campaign to track stats
    // HIGH-013: Explicit column selection
    const { data: campaign } = await supabase
        .from('marketing_campaigns')
        .select('id, restaurant_id, status, channel, total_recipients, emails_sent, sms_sent')
        .eq('id', campaignId)
        .single();

    if (!campaign) {
        throw new Error('Campaign not found');
    }

    // Get recipients
    const recipients = await getVerifiedRecipients(restaurantId, {
        [channel === 'sms' || channel === 'whatsapp' ? 'hasPhone' : 'hasEmail']: true,
    });

    const results: CampaignDeliveryResult[] = [];
    let successful = 0;
    let failed = 0;

    // Send to each recipient
    for (const recipient of recipients) {
        const result = await sendToRecipient(recipient, channel, message);
        results.push(result);

        if (result.success) {
            successful++;

            // Record in campaign_recipients
            await supabase.from('campaign_recipients').upsert({
                campaign_id: campaignId,
                restaurant_id: restaurantId,
                guest_id: recipient.guestId,
                status: 'sent',
                sent_at: new Date(),
            });
        } else {
            failed++;

            await supabase.from('campaign_recipients').upsert({
                campaign_id: campaignId,
                restaurant_id: restaurantId,
                guest_id: recipient.guestId,
                status: 'failed',
                bounce_reason: result.error,
            });
        }
    }

    // Update campaign stats
    const channelKey = channel === 'sms' || channel === 'whatsapp' ? 'sms_sent' : 'emails_sent';

    await supabase
        .from('marketing_campaigns')
        .update({
            [channelKey]: successful,
            total_recipients: recipients.length,
            status: 'sent',
            sent_at: new Date(),
        })
        .eq('id', campaignId);

    return { total: recipients.length, successful, failed, results };
}

/**
 * Verify a guest's contact information
 */
export async function sendVerificationCode(
    guestId: string,
    channel: 'sms' | 'email'
): Promise<{ success: boolean; error?: string }> {
    const supabase = createServiceRoleClient();

    // HIGH-013: Explicit column selection
    const { data: guest } = await supabase
        .from('guests')
        .select('id, phone, email, metadata')
        .eq('id', guestId)
        .single();

    if (!guest) {
        return { success: false, error: 'Guest not found' };
    }

    // Generate verification code (6 digits)
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const metadata = guest.metadata || {};

    // Store code in guest metadata
    await supabase
        .from('guests')
        .update({
            metadata: {
                ...metadata,
                verification_code: code,
                verification_expires: new Date(Date.now() + 10 * 60 * 1000),
            },
        })
        .eq('id', guestId);

    // Send verification code
    const message = `Your lole verification code is: ${code}. This code expires in 10 minutes.`;

    if (channel === 'sms' && guest.phone) {
        const result = await sendSms(guest.phone, message);
        return { success: result.success, error: result.error };
    } else if (channel === 'email' && guest.email) {
        if (!resend) {
            return { success: false, error: 'Email not configured' };
        }

        try {
            await resend.emails.send({
                from: EMAIL_FROM,
                to: guest.email,
                subject: 'Verify your contact info',
                html: `<p>${message}</p>`,
            });
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Email error',
            };
        }
    }

    return { success: false, error: 'No contact info available' };
}

/**
 * Verify a guest's contact with code
 */
export async function verifyContact(
    guestId: string,
    code: string
): Promise<{ success: boolean; error?: string; contactType?: string }> {
    const supabase = createServiceRoleClient();

    // HIGH-013: Explicit column selection
    const { data: guest } = await supabase
        .from('guests')
        .select('id, phone, email, metadata')
        .eq('id', guestId)
        .single();

    if (!guest) {
        return { success: false, error: 'Guest not found' };
    }

    const metadata = guest.metadata || {};
    const storedCode = metadata.verification_code;
    const expires = metadata.verification_expires;

    // Check code
    if (!storedCode || storedCode !== code) {
        return { success: false, error: 'Invalid verification code' };
    }

    // Check expiry
    if (expires && new Date(expires) < new Date()) {
        return { success: false, error: 'Verification code expired' };
    }

    // Mark as verified
    await supabase
        .from('guests')
        .update({
            is_verified: true,
            metadata: {
                ...metadata,
                verification_code: null,
                verification_expires: null,
                verified_at: new Date(),
            },
        })
        .eq('id', guestId);

    // Determine what was verified
    let contactType = 'unknown';
    if (guest.phone) contactType = 'phone';
    if (guest.email) contactType = contactType === 'phone' ? 'both' : 'email';

    return { success: true, contactType };
}
