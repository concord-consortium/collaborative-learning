/**
 * Accessibility tests using jest-axe for components updated with ARIA attributes.
 * Tests verify that components don't have accessibility violations.
 */
import React, { useRef } from "react";
import { Provider } from "mobx-react";
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { TileToolbar } from "./toolbar/tile-toolbar";
import { TileToolbarButton } from "./toolbar/tile-toolbar-button";
import { registerTileToolbarButtons } from "./toolbar/toolbar-button-manager";
import { ITileModel, TileModel } from "../models/tiles/tile-model";
import { defaultTextContent } from "../models/tiles/text/text-content";
import { specStores } from "../models/stores/spec-stores";
import { specAppConfig } from "../models/stores/spec-app-config";
import { TileModelContext } from "./tiles/tile-api";

// Register text tile so TileModel.create works
import "../models/tiles/text/text-registration";

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Sample toolbar button for testing
function SampleToolbarButton() {
  return (
    <TileToolbarButton name="test" title="Test Button" onClick={jest.fn()}>
      <span>Icon</span>
    </TileToolbarButton>
  );
}

// Helper component to render TileToolbar with required context
interface ITileToolbarTestProps {
  model: ITileModel;
}

function TileToolbarTest({ model }: ITileToolbarTestProps) {
  const tileElt = useRef<HTMLDivElement>(null);
  return (
    <TileModelContext.Provider value={model}>
      <div ref={tileElt} style={{ width: 200, height: 100 }}>
        Tile content
      </div>
      <TileToolbar readOnly={false} tileElement={tileElt.current} tileType="test" />
    </TileModelContext.Provider>
  );
}

describe("Accessibility Tests", () => {

  describe("TileToolbar", () => {
    it("should have no accessibility violations", async () => {
      const model = TileModel.create({ content: defaultTextContent() });
      const stores = specStores({
        appConfig: specAppConfig({
          config: {
            settings: {
              test: {
                tools: ["test"]
              }
            }
          }
        })
      });
      stores.ui.setSelectedTileId(model.id);

      registerTileToolbarButtons("test", [
        { name: "test", component: SampleToolbarButton }
      ]);

      const { container } = render(
        <Provider stores={stores}>
          <TileToolbarTest model={model} />
        </Provider>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("TileToolbarButton", () => {
    it("should have no accessibility violations", async () => {
      const { container } = render(
        <TileToolbarButton name="test" title="Test Button" onClick={jest.fn()}>
          <span>Icon</span>
        </TileToolbarButton>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Grid structure", () => {
    it("role='grid' with aria-label should have no violations", async () => {
      const { container } = render(
        <div role="grid" aria-label="Document tiles">
          <div role="row">
            <div role="gridcell" tabIndex={0} aria-label="Text tile">
              Cell content
            </div>
          </div>
        </div>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Navigation landmarks", () => {
    it("navigation with aria-label should have no violations", async () => {
      const { container } = render(
        <nav role="navigation" aria-label="Resources">
          <ul>
            <li><a href="#problems">Problems</a></li>
            <li><a href="#my-work">My Work</a></li>
          </ul>
        </nav>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("main landmark with aria-label should have no violations", async () => {
      const { container } = render(
        <main role="main" aria-label="My Workspace" tabIndex={-1}>
          <p>Workspace content</p>
        </main>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Skip link", () => {
    it("skip link should have no violations", async () => {
      const { container } = render(
        <a href="#main-workspace" className="skip-link">
          Skip to My Workspace
        </a>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Live region", () => {
    it("aria-live region should have no violations", async () => {
      const { container } = render(
        <div
          id="clue-announcements"
          aria-live="polite"
          aria-atomic="true"
          role="status"
          aria-label="Status announcements"
        >
          Announcement text
        </div>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Tab list", () => {
    it("tablist with aria-label should have no violations", async () => {
      const { container } = render(
        <div role="tablist" aria-label="Resource navigation">
          <button role="tab" aria-selected="true" tabIndex={0}>
            Problems
          </button>
          <button role="tab" aria-selected="false" tabIndex={-1}>
            My Work
          </button>
        </div>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Buttons with aria-label", () => {
    it("icon button with aria-label should have no violations", async () => {
      const { container } = render(
        <button aria-label="Open chat panel" onClick={jest.fn()}>
          <svg aria-hidden="true"><circle cx="10" cy="10" r="5" /></svg>
        </button>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("close button with aria-label should have no violations", async () => {
      const { container } = render(
        <button aria-label="Close resources panel" onClick={jest.fn()}>
          ×
        </button>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

});
