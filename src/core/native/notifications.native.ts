import { NativeModules } from 'react-native';
import { SpotterNotifications } from '..';

export class NotificationsNative implements SpotterNotifications {
  private notifications = NativeModules.Notifications;

  show(title: string, subtitle: string) {
    this.notifications.show(title, subtitle);
  }

}
