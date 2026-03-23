/** Amplitude event names — must match mobile/web clients. */
export const AmplitudeEngagementEvents = {
  /** Mobile: push notification open */
  OPEN_PUSH_NOTIFICATION: 'Notifications: Open Push Notification',
  /** Web + mobile: in-app notification tile click */
  CLICK_TILE: 'Notifications: Clicked Tile',
} as const

export const TILE_KIND_ANNOUNCEMENT = 'announcement'
