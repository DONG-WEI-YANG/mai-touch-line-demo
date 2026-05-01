/**
 * SMS Notification Service
 * Handles sending SMS notifications for m'AI Touch
 */

import twilio from 'twilio';
import { env } from '../_core/env';

export type SmsType = 
  | 'booking_confirmation'
  | 'booking_reminder'
  | 'booking_cancellation'
  | 'work_order_update'
  | 'security_alert'
  | 'maintenance_notice'
  | 'verification_code'
  | 'emergency_alert';

export interface SmsOptions {
  to: string; // Phone number in E.164 format (+1234567890)
  type: SmsType;
  data?: Record<string, any>;
}

export interface SmsTemplate {
  body: string;
}

export class SmsService {
  private static instance: SmsService;
  private client: twilio.Twilio | null = null;
  private isConfigured = false;
  private fromNumber: string = '';

  private constructor() {
    this.initialize();
  }

  static getInstance(): SmsService {
    if (!SmsService.instance) {
      SmsService.instance = new SmsService();
    }
    return SmsService.instance;
  }

  /**
   * Initialize Twilio client
   */
  private async initialize(): Promise<void> {
    try {
      const { twilioAccountSid, twilioAuthToken, twilioPhoneNumber } = env;

      if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
        console.warn('SMS configuration missing. SMS service will run in dry-run mode.');
        this.isConfigured = false;
        return;
      }

      this.client = twilio(twilioAccountSid, twilioAuthToken);
      this.fromNumber = twilioPhoneNumber;
      this.isConfigured = true;

      console.log('SMS service configured successfully');
    } catch (error) {
      console.error('Failed to initialize SMS service:', error);
      this.isConfigured = false;
    }
  }

  /**
   * Get SMS template
   */
  private getTemplate(type: SmsType, data: Record<string, any> = {}): SmsTemplate {
    const templates: Record<SmsType, SmsTemplate> = {
      booking_confirmation: {
        body: `✅ Booking Confirmed\n\n${data.amenityName}\n📅 ${data.date}\n⏰ ${data.startTime}-${data.endTime}\n👥 ${data.guestCount} guest(s)\n\nBooking ID: ${data.bookingId}\n\nView in app: ${data.appUrl || 'm\'AI Touch'}`,
      },

      booking_reminder: {
        body: `⏰ Booking Reminder\n\nYour ${data.amenityName} booking starts in ${data.minutesBefore || 30} minutes.\n\n📅 ${data.date}\n⏰ ${data.startTime}-${data.endTime}\n📍 ${data.location || 'Check app for location'}`,
      },

      booking_cancellation: {
        body: `❌ Booking Cancelled\n\nYour ${data.amenityName} booking on ${data.date} at ${data.startTime} has been cancelled.\n\nBooking ID: ${data.bookingId}\n\nContact concierge if this was a mistake.`,
      },

      work_order_update: {
        body: `🔧 Work Order Update\n\n${data.title}\nStatus: ${data.status}\nPriority: ${data.priority}\n\nWork Order ID: ${data.workOrderId}\n\n${data.notes || 'No additional notes'}`,
      },

      security_alert: {
        body: `🚨 Security Alert\n\n${data.message || 'Security incident detected'}\n\nLocation: ${data.location || 'Unknown'}\nTime: ${new Date().toLocaleTimeString()}\n\nPlease check the app for details.`,
      },

      maintenance_notice: {
        body: `⚠️ Maintenance Notice\n\n${data.message || 'Scheduled maintenance'}\n\nDate: ${data.date || 'TBD'}\nTime: ${data.time || 'TBD'}\nAffected: ${data.affectedAreas || 'Various areas'}\n\nWe apologize for any inconvenience.`,
      },

      verification_code: {
        body: `🔐 Verification Code\n\nYour m'AI Touch verification code is: ${data.code}\n\nThis code will expire in ${data.expiryMinutes || 10} minutes.\n\nIf you didn't request this, please ignore.`,
      },

      emergency_alert: {
        body: `🚨 EMERGENCY ALERT\n\n${data.message || 'Emergency situation'}\n\nLocation: ${data.location || 'Unknown'}\nInstructions: ${data.instructions || 'Follow emergency procedures'}\n\nStay safe and follow instructions.`,
      },
    };

    return templates[type] || { body: `Notification: ${type}` };
  }

  /**
   * Validate phone number
   */
  private validatePhoneNumber(phoneNumber: string): boolean {
    // Basic E.164 format validation
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phoneNumber);
  }

  /**
   * Format phone number to E.164
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters except leading +
    let formatted = phoneNumber.replace(/[^\d+]/g, '');

    // Add + if not present and number starts with 1 (US/Canada)
    if (!formatted.startsWith('+')) {
      if (formatted.startsWith('1') && formatted.length === 11) {
        formatted = '+' + formatted;
      } else if (formatted.length === 10) {
        formatted = '+1' + formatted; // Assume US/Canada
      }
    }

    return formatted;
  }

  /**
   * Send SMS
   */
  async sendSms(options: SmsOptions): Promise<boolean> {
    try {
      const { smsDryRun } = env;

      // Format phone number
      const formattedTo = this.formatPhoneNumber(options.to);
      
      if (!this.validatePhoneNumber(formattedTo)) {
        console.error('Invalid phone number format:', options.to);
        return false;
      }

      // Get template
      const template = this.getTemplate(options.type, options.data);

      // Dry run mode
      if (smsDryRun || !this.isConfigured || !this.client) {
        console.log('SMS (dry-run):', {
          to: formattedTo,
          body: template.body,
          type: options.type,
        });
        return true;
      }

      // Send actual SMS
      const message = await this.client.messages.create({
        body: template.body,
        from: this.fromNumber,
        to: formattedTo,
      });

      console.log('SMS sent:', message.sid);
      return true;

    } catch (error) {
      console.error('Failed to send SMS:', error);
      return false;
    }
  }

  /**
   * Send booking confirmation SMS
   */
  async sendBookingConfirmationSms(
    phoneNumber: string,
    bookingData: {
      bookingId: string;
      amenityName: string;
      date: string;
      startTime: string;
      endTime: string;
      guestCount: number;
      appUrl?: string;
    }
  ): Promise<boolean> {
    return this.sendSms({
      to: phoneNumber,
      type: 'booking_confirmation',
      data: bookingData,
    });
  }

  /**
   * Send booking reminder SMS
   */
  async sendBookingReminderSms(
    phoneNumber: string,
    reminderData: {
      amenityName: string;
      date: string;
      startTime: string;
      endTime: string;
      location?: string;
      minutesBefore: number;
    }
  ): Promise<boolean> {
    return this.sendSms({
      to: phoneNumber,
      type: 'booking_reminder',
      data: reminderData,
    });
  }

  /**
   * Send work order update SMS
   */
  async sendWorkOrderUpdateSms(
    phoneNumber: string,
    workOrderData: {
      workOrderId: string;
      title: string;
      status: string;
      priority: string;
      notes?: string;
    }
  ): Promise<boolean> {
    return this.sendSms({
      to: phoneNumber,
      type: 'work_order_update',
      data: workOrderData,
    });
  }

  /**
   * Send verification code SMS
   */
  async sendVerificationCodeSms(
    phoneNumber: string,
    code: string,
    expiryMinutes: number = 10
  ): Promise<boolean> {
    return this.sendSms({
      to: phoneNumber,
      type: 'verification_code',
      data: { code, expiryMinutes },
    });
  }

  /**
   * Send emergency alert SMS
   */
  async sendEmergencyAlertSms(
    phoneNumber: string,
    alertData: {
      message: string;
      location: string;
      instructions: string;
    }
  ): Promise<boolean> {
    return this.sendSms({
      to: phoneNumber,
      type: 'emergency_alert',
      data: alertData,
    });
  }

  /**
   * Send bulk SMS
   */
  async sendBulkSms(
    phoneNumbers: string[],
    type: SmsType,
    data: Record<string, any>
  ): Promise<{ success: number; failed: number }> {
    const results = await Promise.allSettled(
      phoneNumbers.map(phone => this.sendSms({ to: phone, type, data }))
    );

    const success = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const failed = results.length - success;

    return { success, failed };
  }

  /**
   * Check if SMS service is configured
   */
  isServiceConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * Get remaining SMS balance (Twilio specific)
   */
  async getBalance(): Promise<number | null> {
    try {
      if (!this.client || !this.isConfigured) {
        return null;
      }

      const balance = await this.client.balance.fetch();
      return parseFloat(balance.balance);
    } catch (error) {
      console.error('Failed to get SMS balance:', error);
      return null;
    }
  }
}

// Export singleton instance
export const smsService = SmsService.getInstance();
