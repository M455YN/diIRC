export const isPermissionGranted = async () => "Notification" in window && Notification.permission === "granted";
export const requestPermission = async () => ("Notification" in window ? Notification.requestPermission() : "denied");
export const sendNotification = (o: { title: string; body?: string } | string) =>
  typeof o === "string" ? new Notification(o) : new Notification(o.title, { body: o.body });
