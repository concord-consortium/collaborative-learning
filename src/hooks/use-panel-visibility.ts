import { IStores } from "../models/stores/stores";
import { useStores } from "./use-stores";

export interface PanelVisibility {
  showLeftPanel: boolean;
  showRightPanel: boolean;
}

export function getPanelVisibility(stores: IStores): PanelVisibility {
  const { isProblemLoaded, user, appConfig: { navTabs } } = stores;

  // RESEARCHER-ACCESS: this is a temporary solution to show only the nav panel for researchers
  // until we decide where to store researcher docs that are automatically created in the
  // DocumentWorkspaceComponent component.
  return {
    showLeftPanel: isProblemLoaded && (user.isResearcher || navTabs.showNavPanel),
    showRightPanel: !user.isResearcher
  };
}

export function usePanelVisibility(): PanelVisibility {
  const stores = useStores();
  return getPanelVisibility(stores);
}
