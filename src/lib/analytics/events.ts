/** Amplitude event names — internal notifications dashboard (source: server API routes). */
export const DashboardAnalyticsEvents = {
  LOGIN: 'Notifications Dashboard: Log In',
  ANNOUNCEMENT_CREATED: 'Notifications Dashboard: Announcement Created',
  ANNOUNCEMENT_UPDATED: 'Notifications Dashboard: Announcement Updated',
  ANNOUNCEMENT_DELETED: 'Notifications Dashboard: Announcement Deleted',
  ANNOUNCEMENT_SEND_SUCCESS: 'Notifications Dashboard: Announcement Send Success',
  ANNOUNCEMENT_SEND_FAILURE: 'Notifications Dashboard: Announcement Send Failure',
  AUTOMATED_TRIGGER_UPDATED: 'Notifications Dashboard: Automated Trigger Updated',
} as const

export type DashboardAnalyticsEventName =
  (typeof DashboardAnalyticsEvents)[keyof typeof DashboardAnalyticsEvents]
