/** Phase 4 — explicit module flags (env optional overrides) */
export const features = {
  stories: import.meta.env.VITE_FEATURE_STORIES === 'true',
  nearby: import.meta.env.VITE_FEATURE_NEARBY === 'true',
  contactDiscovery: import.meta.env.VITE_FEATURE_CONTACTS === 'true',
  semanticSearch: import.meta.env.VITE_FEATURE_SEMANTIC === 'true',
  /** Always on for v2 ship */
  saves: true,
  progress: true,
  people: true,
  tasks: true,
  calendar: true,
  journal: true,
  ideaBoards: true,
  messages: true,
  notifications: true,
} as const
