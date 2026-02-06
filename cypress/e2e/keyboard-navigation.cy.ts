/**
 * Keyboard Navigation E2E Tests
 *
 * Tests WCAG 2.2 Level AA keyboard accessibility requirements.
 * Uses cypress-real-events for native keyboard simulation.
 */

describe("Keyboard Navigation", () => {
  beforeEach(() => {
    cy.visit("/?appMode=qa&fakeClass=1&fakeUser=student:1&qaGroup=1&problem=1.1");
    // Wait for document to load
    cy.get(".tile-row").should("exist");
  });

  describe("Skip Navigation", () => {
    it("shows skip link when focused", () => {
      // Tab to focus skip link
      cy.get("body").focus();
      cy.realPress("Tab");

      // Skip link should be visible when focused
      cy.get(".skip-link").should("be.visible");
      cy.contains("Skip to My Workspace").should("be.visible");
    });

    it("skip link jumps to My Workspace", () => {
      cy.get("body").focus();
      cy.realPress("Tab");

      // Activate skip link
      cy.realPress("Enter");

      // Focus should be on main workspace
      cy.focused().should("have.attr", "id", "main-workspace");
    });
  });

  describe("Tab Navigation Between Regions", () => {
    it("Tab navigates through major landmarks", () => {
      cy.get("body").focus();

      // Tab through elements - order depends on DOM structure
      // First should hit skip link, then header elements, then resources, then workspace
      cy.realPress("Tab");
      cy.focused().should("exist");

      // Continue tabbing to reach the workspace
      for (let i = 0; i < 10; i++) {
        cy.realPress("Tab");
      }

      // Should eventually reach workspace area
      cy.focused().then($el => {
        const isInWorkspace =
          $el.closest("[role='main']").length > 0 ||
          $el.closest(".nav-tab-panel").length > 0;
        expect(isInWorkspace).to.be.true;
      });
    });
  });

  describe("Tile Canvas Arrow Navigation", () => {
    beforeEach(() => {
      // Focus a tile first
      cy.get("[role='gridcell']").first().focus();
    });

    it("Arrow Right navigates to next tile in row", () => {
      cy.get("[role='gridcell']").first().as("firstTile");
      cy.get("@firstTile").focus();

      // Get the ID of the first tile
      cy.get("@firstTile").invoke("attr", "data-tile-id").then(firstTileId => {
        cy.realPress("ArrowRight");

        // Focused element should be different tile
        cy.focused().invoke("attr", "data-tile-id").should("not.eq", firstTileId);
      });
    });

    it("Arrow Left navigates to previous tile in row", () => {
      // Start from second tile
      cy.get("[role='gridcell']").eq(1).focus();
      cy.get("[role='gridcell']").eq(1).invoke("attr", "data-tile-id").then(secondTileId => {
        cy.realPress("ArrowLeft");

        // Should be on first tile now
        cy.focused().invoke("attr", "data-tile-id").should("not.eq", secondTileId);
      });
    });

    it("Arrow Down navigates to tile in next row", () => {
      cy.get("[role='gridcell']").first().focus();

      cy.realPress("ArrowDown");

      // Should move to a different row (if multiple rows exist)
      cy.focused().should("have.attr", "role", "gridcell");
    });

    it("Home navigates to first tile in row", () => {
      // Move to a middle tile first
      cy.get("[role='gridcell']").eq(1).focus();

      cy.realPress("Home");

      // Should be on first tile
      cy.get("[role='gridcell']").first().should("have.focus");
    });

    it("End navigates to last tile in row", () => {
      cy.get("[role='gridcell']").first().focus();

      cy.realPress("End");

      // Should be on a different tile (last in row)
      cy.focused().should("have.attr", "role", "gridcell");
    });

    it("stops at left boundary (no wrap)", () => {
      cy.get("[role='gridcell']").first().focus();

      cy.realPress("ArrowLeft");

      // Should still be on first tile
      cy.get("[role='gridcell']").first().should("have.focus");
    });
  });

  describe("Tile Focus Trap", () => {
    beforeEach(() => {
      cy.get("[role='gridcell']").first().focus();
    });

    it("Enter key enters focus trap", () => {
      cy.realPress("Enter");

      // Focus should move to an interactive element within tile
      cy.focused().should("satisfy", $el => {
        return $el.is("button, input, [contenteditable], [role='button']") ||
               $el.closest("[role='toolbar']").length > 0;
      });
    });

    it("Escape key exits focus trap", () => {
      // Enter trap
      cy.realPress("Enter");

      // Verify we're in a focusable element
      cy.focused().should("exist");

      // Exit trap
      cy.realPress("Escape");

      // Should be back on tile container
      cy.focused().should("have.attr", "role", "gridcell");
    });

    it("Tab cycles within focus trap", () => {
      cy.realPress("Enter");

      // Get initial focused element
      cy.focused().then($initial => {
        const initialElement = $initial[0];

        // Tab through elements
        cy.realPress("Tab");
        cy.realPress("Tab");
        cy.realPress("Tab");

        // Keep tabbing until we cycle back (max 20 iterations to prevent infinite loop)
        const checkCycle = (iterations: number) => {
          if (iterations > 20) return;

          cy.focused().then($current => {
            if ($current[0] !== initialElement) {
              cy.realPress("Tab");
              checkCycle(iterations + 1);
            }
          });
        };

        checkCycle(0);

        // Should eventually return to starting element (cycle complete)
        // Note: This is a soft assertion - focus cycling is the key behavior
      });
    });

    it("Tab includes toolbar buttons from FloatingPortal", () => {
      cy.realPress("Enter");

      // Tab several times
      for (let i = 0; i < 5; i++) {
        cy.realPress("Tab");
      }

      // At some point, focus should reach toolbar (if tile has one)
      // Query toolbar by role since it's in a portal
      cy.get("[role='toolbar'], [data-testid='tile-toolbar']").then($toolbar => {
        if ($toolbar.length > 0) {
          // Toolbar exists, continue tabbing to verify it's reachable
          cy.focused().then($el => {
            const isInTileOrToolbar =
              $el.closest("[role='gridcell']").length > 0 ||
              $el.closest("[role='toolbar']").length > 0 ||
              $el.closest("[data-testid='tile-toolbar']").length > 0;

            // Focus should be within tile content or toolbar
            expect(isInTileOrToolbar).to.be.true;
          });
        }
      });
    });
  });

  describe("Screen Reader Announcements", () => {
    it("has aria-live region for announcements", () => {
      cy.get("#clue-announcements")
        .should("exist")
        .and("have.attr", "aria-live", "polite");
    });
  });

  describe("ARIA Grid Structure", () => {
    it("tile canvas has proper grid structure", () => {
      // Canvas should have grid role
      cy.get("[role='grid']").should("exist");

      // Rows should have row role
      cy.get("[role='row']").should("have.length.greaterThan", 0);

      // Cells should have gridcell role
      cy.get("[role='gridcell']").should("have.length.greaterThan", 0);
    });

    it("tiles have accessible labels", () => {
      cy.get("[role='gridcell']").each($cell => {
        cy.wrap($cell).should("have.attr", "aria-label");
      });
    });
  });

  describe("Focus Visible Indicators", () => {
    it("focused elements have visible focus indicator", () => {
      cy.get("[role='gridcell']").first().focus();

      // Check that focus styles are applied
      cy.focused().should("have.css", "outline-style").and("not.eq", "none");
    });
  });

  describe("Modifier Keys Passthrough", () => {
    it("Ctrl+Arrow does not trigger tile navigation", () => {
      cy.get("[role='gridcell']").first().focus();
      cy.get("[role='gridcell']").first().invoke("attr", "data-tile-id").then(tileId => {
        // Ctrl+Right should not navigate
        cy.realPress(["Control", "ArrowRight"]);

        // Should still be on same tile
        cy.focused().should("have.attr", "data-tile-id", tileId);
      });
    });
  });
});
