/**
 * Push Notification Service
 * Handles push notifications for m'AI Touch
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

export type NotificationType = 
  | 'booking_confirmation'
  | 'booking_reminder'
  | 'work_order_update'
  | 'maintenance_alert'
  | 'security_alert'
  | 'concierge_update'
  | 'system_announcement';

export interface NotificationData {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: boolean;
  priority?: Notifications.AndroidNotificationPriority;
  badge?: number;
}

export class NotificationService {
  private static instance: NotificationService;
  private isConfigured = false;
  private token: string | null = null;
  private subscriptions: Notifications.EventSubscription[] = [];

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Configure notification settings
   */
  async configure(): Promise<boolean> {
    if (this.isConfigured) return true;

    try {
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Push notification permission not granted');
        return false;
      }

      // Configure notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      // Get push token
      if (Device.isDevice) {
        const token = await Notifications.getExpoPushTokenAsync({
          projectId: 'your-project-id', // Replace with your Expo project ID
        });
        this.token = token.data;
        console.log('Push token:', this.token);
      }

      this.isConfigured = true;
      return true;
    } catch (error) {
      console.error('Failed to configure notifications:', error);
      return false;
    }
  }

  /**
   * Schedule a local notification
   */
  async scheduleLocalNotification(data: NotificationData, trigger?: Notifications.NotificationTriggerInput): Promise<string> {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: data.title,
          body: data.body,
          data: {
            type: data.type,
            ...data.data,
          },
          sound: data.sound !== false,
          badge: data.badge,
          priority: data.priority || 'high',
        },
        trigger: trigger || null,
      });

      return notificationId;
    } catch (error) {
      console.error('Failed to schedule notification:', error);
      throw error;
    }
  }

  /**
   * Send immediate notification
   */
  async sendImmediateNotification(data: NotificationData): Promise<string> {
    return this.scheduleLocalNotification(data);
  }

  /**
   * Schedule booking reminder
   */
  async scheduleBookingReminder(
    bookingId: string,
    amenityName: string,
    date: string,
    time: string,
    minutesBefore: number = 30
  ): Promise<string> {
    const triggerDate = new Date(`${date}T${time}`);
    triggerDate.setMinutes(triggerDate.getMinutes() - minutesBefore);

    return this.scheduleLocalNotification(
      {
        type: 'booking_reminder',
        title: 'Upcoming Booking',
        body: `Your ${amenityName} booking starts in ${minutesBefore} minutes`,
        data: { bookingId, amenityName, date, time },
        sound: true,
      },
      { date: triggerDate, type: Notifications.SchedulableTriggerInputTypes.DATE } as any
    );
  }

  /**
   * Schedule work order update
   */
  async scheduleWorkOrderUpdate(
    workOrderId: string,
    title: string,
    status: string,
    scheduledTime?: Date
  ): Promise<string> {
    return this.scheduleLocalNotification(
      {
        type: 'work_order_update',
        title: 'Work Order Update',
        body: `Your work order "${title}" is now ${status}`,
        data: { workOrderId, title, status },
        sound: true,
      },
      scheduledTime ? ({ date: scheduledTime, type: Notifications.SchedulableTriggerInputTypes.DATE } as any) : undefined
    );
  }

  /**
   * Cancel scheduled notification
   */
  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.error('Failed to cancel notification:', error);
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Failed to cancel all notifications:', error);
    }
  }

  /**
   * Get push token
   */
  getPushToken(): string | null {
    return this.token;
  }

  /**
   * Set badge count
   */
  async setBadgeCount(count: number): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('Failed to set badge count:', error);
    }
  }

  /**
   * Register notification received listener
   */
  addNotificationReceivedListener(
    listener: (notification: Notifications.Notification) => void
  ): Notifications.EventSubscription {
    const subscription = Notifications.addNotificationReceivedListener(listener);
    this.subscriptions.push(subscription);
    return subscription;
  }

  /**
   * Register notification response listener
   */
  addNotificationResponseReceivedListener(
    listener: (response: Notifications.NotificationResponse) => void
  ): Notifications.EventSubscription {
    const subscription = Notifications.addNotificationResponseReceivedListener(listener);
    this.subscriptions.push(subscription);
    return subscription;
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.subscriptions.forEach((subscription) => {
      subscription.remove();
    });
    this.subscriptions = [];
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();
