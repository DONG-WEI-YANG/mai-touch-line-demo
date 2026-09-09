import { Alert as NativeAlert, Platform, type AlertButton, type AlertOptions } from 'react-native';

type Dialog = { title: string; message?: string; buttons: AlertButton[]; options?: AlertOptions };
let queue: Dialog[] = [];
const listeners = new Set<() => void>();
export const dialogStore = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  getSnapshot: () => queue[0] ?? null,
  dismiss(index?: number) {
    const current = queue[0];
    if (!current) return;
    queue = queue.slice(1);
    listeners.forEach(listener => listener());
    if (index === undefined) current.options?.onDismiss?.();
    else current.buttons[index]?.onPress?.();
  },
};
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
    if (Platform.OS !== 'web') return NativeAlert.alert(title, message, buttons, options);
    queue = [...queue, { title, message, buttons: buttons?.length ? buttons : [{ text: '知道了' }], options }];
    listeners.forEach(listener => listener());
  },
};
