import { renderHook } from "@testing-library/react-hooks";
import { getPanelVisibility, usePanelVisibility } from "./use-panel-visibility";
import { IStores } from "../models/stores/stores";

const mockUseStores = jest.fn();
jest.mock("./use-stores", () => ({
  useStores: () => mockUseStores()
}));

function createMockStores(overrides: {
  isProblemLoaded?: boolean;
  isResearcher?: boolean;
  showNavPanel?: boolean;
} = {}): IStores {
  const {
    isProblemLoaded = true,
    isResearcher = false,
    showNavPanel = true
  } = overrides;

  return {
    isProblemLoaded,
    user: { isResearcher },
    appConfig: { navTabs: { showNavPanel } }
  } as unknown as IStores;
}

describe("usePanelVisibility", () => {
  beforeEach(() => {
    mockUseStores.mockReset();
  });

  describe("getPanelVisibility", () => {
    describe("showLeftPanel", () => {
      it("should be true when problem is loaded and showNavPanel is true", () => {
        const stores = createMockStores({
          isProblemLoaded: true,
          showNavPanel: true,
          isResearcher: false
        });
        const result = getPanelVisibility(stores);
        expect(result.showLeftPanel).toBe(true);
      });

      it("should be false when problem is not loaded", () => {
        const stores = createMockStores({
          isProblemLoaded: false,
          showNavPanel: true,
          isResearcher: false
        });
        const result = getPanelVisibility(stores);
        expect(result.showLeftPanel).toBe(false);
      });

      it("should be false when problem is loaded but showNavPanel is false and user is not researcher", () => {
        const stores = createMockStores({
          isProblemLoaded: true,
          showNavPanel: false,
          isResearcher: false
        });
        const result = getPanelVisibility(stores);
        expect(result.showLeftPanel).toBe(false);
      });
    });

    describe("showRightPanel", () => {
      it("should be true when user is not a researcher", () => {
        const stores = createMockStores({ isResearcher: false });
        const result = getPanelVisibility(stores);
        expect(result.showRightPanel).toBe(true);
      });

      it("should be false when user is a researcher", () => {
        const stores = createMockStores({ isResearcher: true });
        const result = getPanelVisibility(stores);
        expect(result.showRightPanel).toBe(false);
      });

      it("should be independent of isProblemLoaded", () => {
        const storesLoaded = createMockStores({ isProblemLoaded: true, isResearcher: false });
        const storesNotLoaded = createMockStores({ isProblemLoaded: false, isResearcher: false });
        expect(getPanelVisibility(storesLoaded).showRightPanel).toBe(true);
        expect(getPanelVisibility(storesNotLoaded).showRightPanel).toBe(true);
      });

      it("should be independent of showNavPanel", () => {
        const storesNavVisible = createMockStores({ showNavPanel: true, isResearcher: false });
        const storesNavHidden = createMockStores({ showNavPanel: false, isResearcher: false });
        expect(getPanelVisibility(storesNavVisible).showRightPanel).toBe(true);
        expect(getPanelVisibility(storesNavHidden).showRightPanel).toBe(true);
      });
    });
  });

  describe("usePanelVisibility hook", () => {
    it("should return panel visibility from stores", () => {
      mockUseStores.mockReturnValue(createMockStores({
        isProblemLoaded: true,
        showNavPanel: true,
        isResearcher: false
      }));

      const { result } = renderHook(() => usePanelVisibility());
      expect(result.current).toEqual({
        showLeftPanel: true,
        showRightPanel: true
      });
    });

    it("should reflect problem not loaded state", () => {
      mockUseStores.mockReturnValue(createMockStores({
        isProblemLoaded: false,
        showNavPanel: true,
        isResearcher: false
      }));

      const { result } = renderHook(() => usePanelVisibility());
      expect(result.current).toEqual({
        showLeftPanel: false,
        showRightPanel: true
      });
    });
  });
});
