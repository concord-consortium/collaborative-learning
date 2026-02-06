/**
 * Shared ARIA labels object.
 * Co-locates all labels for:
 * - Future localization (i18n) via context
 * - Potential authoring customization via AppConfig
 * - Consistency across components
 *
 * All accessibility strings should flow through these functions for consistent localization.
 */
const ariaLabels = {
  // Landmark regions
  header: "CLUE Header",
  resourcesPane: "Resources",
  workspacePane: "My Workspace",
  documentTiles: "Document tiles",

  // Navigation
  skipToMain: "Skip to My Workspace",
  resourceTabs: "Resource navigation",

  // Dynamic label functions
  tabPanel: (tabName: string) => `${tabName} content`,
  tile: (tileType: string) => `${tileType} tile`,
  chat: (expanded: boolean) => expanded ? "Collapse chat" : "Expand chat",

  // Tile toolbar
  tileToolbar: "Tile toolbar",

  // Chat and resources panel
  openChatPanel: "Open chat panel",
  closeResourcesPanel: "Close resources panel",

  // Live region
  announcements: "Status announcements",

  // Screen reader announcements (for aria-live regions)
  // These MUST be co-located with labels for consistent i18n
  announce: {
    editingTile: (tileType: string) => `Editing ${tileType} tile. Press Escape to exit.`,
    exitedTile: (tileType: string) => `Exited ${tileType} tile. Use arrow keys to navigate.`,
    tileSelected: (tileType: string) => `${tileType} tile selected`,
    tileAdded: (tileType: string) => `${tileType} tile added`,
    tileRemoved: (tileType: string) => `${tileType} tile removed`,
    panelSelected: (panelName: string) => `${panelName} panel selected`,
  },
};

// Type for consumers
export type AriaLabels = typeof ariaLabels;

/**
 * Hook for function components.
 * Future: could pull from i18n context or AppConfig.
 */
export function useAriaLabels(): AriaLabels {
  // Future: could pull from i18n context or AppConfig
  // const { locale } = useI18n();
  // const { ariaOverrides } = useAppConfig();
  return ariaLabels;
}

/**
 * Plain function for class components that can't use hooks.
 * Returns the same labels as useAriaLabels().
 */
export function getAriaLabels(): AriaLabels {
  return ariaLabels;
}
