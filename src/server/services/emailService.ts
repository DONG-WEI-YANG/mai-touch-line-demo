/**
 * Email Notification Service
 * Handles sending email notifications for m'AI Touch
 */

import nodemailer from 'nodemailer';
import { env } from '../_core/env';

export type EmailType = 
  | 'booking_confirmation'
  | 'booking_reminder'
  | 'booking_cancellation'
  | 'work_order_created'
  | 'work_order_updated'
  | 'work_order_completed'
  | 'security_alert'
  | 'maintenance_notice'
  | 'system_announcement'
  | 'welcome'
  | 'password_reset';

export interface EmailRecipient {
  name: string;
  email: string;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface EmailOptions {
  to: EmailRecipient | EmailRecipient[];
  type: EmailType;
  subject?: string;
  data?: Record<string, any>;
  attachments?: EmailAttachment[];
  cc?: EmailRecipient | EmailRecipient[];
  bcc?: EmailRecipient | EmailRecipient[];
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export class EmailService {
  private static instance: EmailService;
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured = false;

  private constructor() {
    this.initialize();
  }

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Initialize email transporter
   */
  private async initialize(): Promise<void> {
    try {
      const { emailHost, emailPort, emailUser, emailPass, emailFrom } = env;

      if (!emailHost || !emailPort || !emailUser || !emailPass || !emailFrom) {
        console.warn('Email configuration missing. Email service will run in dry-run mode.');
        this.isConfigured = false;
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: emailHost,
        port: parseInt(emailPort, 10),
        secure: parseInt(emailPort, 10) === 465, // true for 465, false for other ports
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      });

      // Verify connection
      await this.transporter.verify();
      console.log('Email service configured successfully');
      this.isConfigured = true;
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      this.isConfigured = false;
    }
  }

  /**
   * Get email template
   */
  private getTemplate(type: EmailType, data: Record<string, any> = {}): EmailTemplate {
    const templates: Record<EmailType, EmailTemplate> = {
      booking_confirmation: {
        subject: `Booking Confirmation: ${data.amenityName || 'Amenity'}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Booking Confirmation</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #C4A882 0%, #8B7355 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .booking-details { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
              .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #eee; }
              .detail-label { font-weight: 600; color: #666; }
              .detail-value { color: #333; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
              .button { display: inline-block; background: #C4A882; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Booking Confirmed</h1>
                <p>Your reservation has been successfully booked</p>
              </div>
              <div class="content">
                <h2>Hello ${data.userName || 'Valued Resident'},</h2>
                <p>Your booking has been confirmed. Here are the details:</p>
                
                <div class="booking-details">
                  <div class="detail-row">
                    <span class="detail-label">Amenity:</span>
                    <span class="detail-value">${data.amenityName || 'N/A'}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Date:</span>
                    <span class="detail-value">${data.date || 'N/A'}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Time:</span>
                    <span class="detail-value">${data.startTime || 'N/A'} - ${data.endTime || 'N/A'}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Guests:</span>
                    <span class="detail-value">${data.guestCount || 1}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Booking ID:</span>
                    <span class="detail-value">${data.bookingId || 'N/A'}</span>
                  </div>
                </div>
                
                <p>You can view or manage your booking in the m'AI Touch app.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${data.appUrl || '#'}" class="button">View in App</a>
                </div>
                
                <div class="footer">
                  <p>Thank you for using m'AI Touch.</p>
                  <p>If you have any questions, please contact the concierge.</p>
                  <p>© ${new Date().getFullYear()} m'AI Touch. All rights reserved.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Booking Confirmation\n\nHello ${data.userName || 'Valued Resident'},\n\nYour booking for ${data.amenityName} on ${data.date} at ${data.startTime} has been confirmed.\n\nBooking ID: ${data.bookingId}\nGuests: ${data.guestCount}\n\nYou can view or manage your booking in the m'AI Touch app.\n\nThank you for using m'AI Touch.`,
      },

      booking_reminder: {
        subject: `Reminder: Upcoming Booking - ${data.amenityName || 'Amenity'}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Booking Reminder</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #4A90E2 0%, #357ABD 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .reminder { background: #FFF3CD; border-left: 4px solid #FFC107; padding: 15px; margin: 20px 0; border-radius: 4px; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Booking Reminder</h1>
                <p>Your booking is coming up soon</p>
              </div>
              <div class="content">
                <h2>Hello ${data.userName || 'Valued Resident'},</h2>
                <p>This is a friendly reminder about your upcoming booking:</p>
                
                <div class="reminder">
                  <p><strong>${data.amenityName || 'Amenity'}</strong></p>
                  <p>Date: ${data.date || 'N/A'}</p>
                  <p>Time: ${data.startTime || 'N/A'} - ${data.endTime || 'N/A'}</p>
                  <p>Location: ${data.location || 'Check app for details'}</p>
                </div>
                
                <p>The booking will start in ${data.minutesBefore || 30} minutes.</p>
                
                <div class="footer">
                  <p>Thank you for using m'AI Touch.</p>
                  <p>© ${new Date().getFullYear()} m'AI Touch. All rights reserved.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Booking Reminder\n\nHello ${data.userName || 'Valued Resident'},\n\nThis is a reminder about your upcoming booking:\n\n${data.amenityName}\nDate: ${data.date}\nTime: ${data.startTime} - ${data.endTime}\n\nThe booking will start in ${data.minutesBefore || 30} minutes.\n\nThank you for using m'AI Touch.`,
      },

      work_order_created: {
        subject: `Work Order Created: ${data.title || 'Maintenance Request'}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Work Order Created</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #28A745 0%, #1E7E34 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .work-order { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
              .priority { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
              .priority-high { background: #DC3545; color: white; }
              .priority-medium { background: #FFC107; color: #333; }
              .priority-low { background: #28A745; color: white; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Work Order Created</h1>
                <p>Your maintenance request has been logged</p>
              </div>
              <div class="content">
                <h2>Hello ${data.userName || 'Valued Resident'},</h2>
                <p>Your work order has been created and assigned to our team.</p>
                
                <div class="work-order">
                  <h3>${data.title || 'Maintenance Request'}</h3>
                  <p>${data.description || 'No description provided'}</p>
                  
                  <p><strong>Priority:</strong> 
                    <span class="priority priority-${data.priority || 'medium'}">${(data.priority || 'medium').toUpperCase()}</span>
                  </p>
                  
                  <p><strong>Work Order ID:</strong> ${data.workOrderId || 'N/A'}</p>
                  <p><strong>Created:</strong> ${new Date(data.createdAt || Date.now()).toLocaleString()}</p>
                  <p><strong>Estimated Response:</strong> ${data.estimatedResponse || 'Within 24 hours'}</p>
                </div>
                
                <p>You will receive updates as the work progresses.</p>
                
                <div class="footer">
                  <p>Thank you for using m'AI Touch.</p>
                  <p>© ${new Date().getFullYear()} m'AI Touch. All rights reserved.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Work Order Created\n\nHello ${data.userName || 'Valued Resident'},\n\nYour work order has been created:\n\nTitle: ${data.title}\nDescription: ${data.description}\nPriority: ${data.priority}\nWork Order ID: ${data.workOrderId}\n\nEstimated response: ${data.estimatedResponse || 'Within 24 hours'}\n\nYou will receive updates as the work progresses.\n\nThank you for using m'AI Touch.`,
      },

      booking_cancellation: {
        subject: `Booking Cancelled: ${data.amenityName || 'Amenity'}`,
        html: `<h1>Booking Cancelled</h1><p>Your booking for ${data.amenityName || 'the amenity'} on ${data.date || 'N/A'} has been cancelled.</p>`,
        text: `Booking Cancelled\n\nYour booking for ${data.amenityName || 'the amenity'} on ${data.date || 'N/A'} has been cancelled.`,
      },
      work_order_updated: {
        subject: `Work Order Updated: ${data.title || 'Maintenance Request'}`,
        html: `<h1>Work Order Updated</h1><p>Status: ${data.status || 'updated'}</p><p>${data.title || ''}</p>`,
        text: `Work Order Updated\n\nStatus: ${data.status || 'updated'}\n${data.title || ''}`,
      },
      work_order_completed: {
        subject: `Work Order Completed: ${data.title || 'Maintenance Request'}`,
        html: `<h1>Work Order Completed</h1><p>${data.title || ''} has been completed.</p>`,
        text: `Work Order Completed\n\n${data.title || ''} has been completed.`,
      },
      security_alert: {
        subject: "Security Alert",
        html: `<h1>Security Alert</h1><p>${data.message || 'A security alert was triggered.'}</p>`,
        text: `Security Alert\n\n${data.message || 'A security alert was triggered.'}`,
      },
      maintenance_notice: {
        subject: "Maintenance Notice",
        html: `<h1>Maintenance Notice</h1><p>${data.message || 'Scheduled maintenance.'}</p>`,
        text: `Maintenance Notice\n\n${data.message || 'Scheduled maintenance.'}`,
      },
      system_announcement: {
        subject: "System Announcement",
        html: `<h1>System Announcement</h1><p>${data.message || 'New announcement from management.'}</p>`,
        text: `System Announcement\n\n${data.message || 'New announcement from management.'}`,
      },
      welcome: {
        subject: 'Welcome to m\'AI Touch',
        html: '<h1>Welcome to m\'AI Touch</h1><p>Your account has been created successfully.</p>',
        text: 'Welcome to m\'AI Touch. Your account has been created successfully.',
      },

      password_reset: {
        subject: 'Password Reset Request',
        html: '<h1>Password Reset</h1><p>Click the link to reset your password.</p>',
        text: 'Password Reset. Click the link to reset your password.',
      },
    };

    return templates[type] || templates.welcome;
  }

  /**
   * Send email
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const { emailFrom, emailDryRun } = env;
      const from = `${emailFrom || 'm\'AI Touch'} <${emailFrom || 'noreply@example.com'}>`;

      // Get template
      const template = this.getTemplate(options.type, options.data);

      // Prepare recipients
      const to = Array.isArray(options.to) 
        ? options.to.map(r => `${r.name} <${r.email}>`).join(', ')
        : `${options.to.name} <${options.to.email}>`;

      const cc = options.cc 
        ? (Array.isArray(options.cc)
            ? options.cc.map(r => `${r.name} <${r.email}>`).join(', ')
            : `${options.cc.name} <${options.cc.email}>`)
        : undefined;

      const bcc = options.bcc
        ? (Array.isArray(options.bcc)
            ? options.bcc.map(r => `${r.name} <${r.email}>`).join(', ')
            : `${options.bcc.name} <${options.bcc.email}>`)
        : undefined;

      const mailOptions: nodemailer.SendMailOptions = {
        from,
        to,
        cc,
        bcc,
        subject: options.subject || template.subject,
        html: template.html,
        text: template.text,
        attachments: options.attachments,
      };

      // Dry run mode
      if (emailDryRun || !this.isConfigured || !this.transporter) {
        console.log('Email (dry-run):', {
          to: mailOptions.to,
          subject: mailOptions.subject,
          type: options.type,
        });
        return true;
      }

      // Send actual email
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent:', info.messageId);
      return true;

    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  /**
   * Send booking confirmation email
   */
  async sendBookingConfirmation(
    recipient: EmailRecipient,
    bookingData: {
      bookingId: string;
      amenityName: string;
      date: string;
      startTime: string;
      endTime: string;
      guestCount: number;
      userName: string;
      appUrl?: string;
    }
  ): Promise<boolean> {
    return this.sendEmail({
      to: recipient,
      type: 'booking_confirmation',
      data: bookingData,
    });
  }

  /**
   * Send booking reminder email
   */
  async sendBookingReminder(
    recipient: EmailRecipient,
    reminderData: {
      amenityName: string;
      date: string;
      startTime: string;
      endTime: string;
      location?: string;
      minutesBefore: number;
      userName: string;
    }
  ): Promise<boolean> {
    return this.sendEmail({
      to: recipient,
      type: 'booking_reminder',
      data: reminderData,
    });
  }

  /**
   * Send work order notification
   */
  async sendWorkOrderNotification(
    recipient: EmailRecipient,
    workOrderData: {
      workOrderId: string;
      title: string;
      description: string;
      priority: string;
      status: string;
      userName: string;
      createdAt: number;
      estimatedResponse?: string;
    }
  ): Promise<boolean> {
    const type = workOrderData.status === 'created' ? 'work_order_created' :
                 workOrderData.status === 'updated' ? 'work_order_updated' :
                 'work_order_completed';

    return this.sendEmail({
      to: recipient,
      type,
      data: workOrderData,
    });
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(recipient: EmailRecipient, userName: string): Promise<boolean> {
    return this.sendEmail({
      to: recipient,
      type: 'welcome',
      data: { userName },
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(recipient: EmailRecipient, resetLink: string): Promise<boolean> {
    return this.sendEmail({
      to: recipient,
      type: 'password_reset',
      data: { resetLink },
    });
  }

  /**
   * Check if email service is configured
   */
  isServiceConfigured(): boolean {
    return this.isConfigured;
  }
}

// Export singleton instance
export const emailService = EmailService.getInstance();
