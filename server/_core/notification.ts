export type NotificationPayload = {
  title: string;
  content: string;
};

/**
 * Local stub: Manus's owner-notification service is no longer available.
 * Logs instead of sending. Wire up email/Slack/webhook here if needed.
 */
export async function notifyOwner(
  payload: NotificationPayload
): Promise<boolean> {
  console.log("[Notification]", payload.title, "-", payload.content);
  return true;
}
