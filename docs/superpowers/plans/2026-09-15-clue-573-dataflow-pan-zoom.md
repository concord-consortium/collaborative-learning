# CLUE-573 Dataflow Toolbar Pan/Zoom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move dataflow's zoom controls from the stage into the tile toolbar and add a pan flyout, matching the drawing tile's toolbar pattern.

**Architecture:** Four new registered toolbar buttons (`zoom-in`, `zoom-out`, `fit-all`, `pan` flyout) driving the existing rete-manager transform methods; the on-stage control is deleted; `app-config.json` defines the default toolbar placement. Session-only — no persistence changes. Spec: `docs/superpowers/specs/2026-09-15-clue-573-dataflow-pan-zoom-design.md`.

**Spec deviation (approved rationale):** the spec gated buttons on `documentProperties?.dfHasData`; planning research showed NOTHING writes `dfHasData` anywhere in the repo (vestige of the 2022 dataflow import — `git log -S dfHasData` shows only the original import and an unused-code sweep). The stage control's `showZoomControl` gate is dead code and its removal deletes the last reader. The buttons therefore need no document-properties plumbing; note this in the PR.

**Tech Stack:** TypeScript, React function components + mobx-react `observer`, MST, Jest + @testing-library/react, rete.js (transform via `area.area`).

**Key existing code (read before each task):**
- `src/plugins/dataflow/dataflow-toolbar-registration.tsx` — existing buttons (`DeleteNodeButton` shape) + `registerTileToolbarButtons('dataflow', ...)`.
- `src/plugins/dataflow/rete/rete-manager.tsx` — `MAX_ZOOM = 2`/`MIN_ZOOM = .1` (module-private, lines ~54-55), `zoomIn/zoomOut` (~1485-1493), `setZoom` (~1668), `fitContent` (~1547), `pan(dx, dy)` (~604), arrow-key step `40` inline at ~579, `public mstContent` (line ~105).
- `src/plugins/dataflow/model/dataflow-content.ts` — volatile `liveProgramZoom` (~116) with `.scale`, action `setLiveProgramZoom` (~347).
- `src/plugins/graph/components/__tests__/graph-toolbar.test.tsx` — the toolbar-button test scaffold to mirror (`getToolbarButtonInfo` + context providers + testing-library).
- `src/plugins/drawing/toolbar-buttons/zoom-buttons.tsx` and `stamp-button.tsx` — button + palette shapes.
- `src/components/tiles/tile-navigator.tsx` (+ its scss) — pan arrow markup/icons (`NavigatorMoveIcon`, `NavigatorScrollIcon`, `.navigator-panning-button up/right/down/left`).

---

## Task 1: Pin the rete-manager zoom/pan contract; export constants

**Files:**
- Modify: `src/plugins/dataflow/rete/rete-manager.tsx`
- Test: `src/plugins/dataflow/rete/rete-manager.test.ts`

- [ ] **Step 1: Write the failing tests.** The file's existing `makeManagerStub` pattern (`Object.create(ReteManager.prototype)` + minimal stub surface) is the template. Add at the end of the file:

```ts
import { ReteManager, MIN_ZOOM, MAX_ZOOM, kPanStep } from "./rete-manager";

// (merge into the existing import line at the top instead of a second import)

/** Stub with just the surface zoomIn/zoomOut/pan/setZoom touch: the rete area transform + zoom/translate,
 *  and the MST content that receives the live transform. */
function makeTransformStub(k = 1, x = 0, y = 0) {
  const stub: any = Object.create(ReteManager.prototype);
  const calls = { zoom: [] as number[], translate: [] as Array<[number, number]> };
  stub.area = {
    area: {
      transform: { k, x, y },
      zoom: async (scale: number) => { calls.zoom.push(scale); stub.area.area.transform.k = scale; },
      translate: async (tx: number, ty: number) => {
        calls.translate.push([tx, ty]);
        stub.area.area.transform.x = tx; stub.area.area.transform.y = ty;
      }
    }
  };
  stub.mstContent = { setLiveProgramZoom: jest.fn() };
  return { stub: stub as ReteManager, calls };
}

describe("ReteManager zoom/pan (CLUE-573)", () => {
  it("zoomIn steps +0.05", async () => {
    const { stub, calls } = makeTransformStub(1);
    await stub.zoomIn();
    expect(calls.zoom).toEqual([1.05]);
  });

  it("zoomIn clamps at MAX_ZOOM", async () => {
    const { stub, calls } = makeTransformStub(MAX_ZOOM - 0.01);
    await stub.zoomIn();
    expect(calls.zoom).toEqual([MAX_ZOOM]);
  });

  it("zoomOut steps -0.05 and clamps at MIN_ZOOM", async () => {
    const { stub, calls } = makeTransformStub(MIN_ZOOM + 0.01);
    await stub.zoomOut();
    expect(calls.zoom).toEqual([MIN_ZOOM]);
  });

  it("setZoom writes the resulting transform to liveProgramZoom", async () => {
    const { stub } = makeTransformStub(1);
    await (stub as any).setZoom(1.5);
    expect((stub.mstContent.setLiveProgramZoom as jest.Mock))
      .toHaveBeenCalledWith(expect.objectContaining({ k: 1.5 }));
  });

  it("pan translates by exactly the requested delta", async () => {
    const { stub, calls } = makeTransformStub(1, 10, 20);
    await stub.pan(kPanStep, -kPanStep);
    expect(calls.translate).toEqual([[10 + kPanStep, 20 - kPanStep]]);
  });
});
```
Adapt the stub surface to what the real methods actually read (READ `zoomIn`/`zoomOut`/`setZoom`/`pan` first — e.g. if `setZoom` reads `this.area.area.transform` after awaiting `zoom`, the stub above already updates `k`; if it passes the whole transform object, match `expect.objectContaining` accordingly). Do NOT test `fitContent` here — it reads editor nodes and DOM measurements; its no-op-on-empty behavior is covered via the button's disabled state instead (Task 3).

- [ ] **Step 2: Verify failure.** Run: `npx jest src/plugins/dataflow/rete/rete-manager.test.ts -t "CLUE-573"`
Expected: FAIL — `MIN_ZOOM`/`MAX_ZOOM`/`kPanStep` are not exported.

- [ ] **Step 3: Implement.** In `rete-manager.tsx`:
  - Change lines ~54-55 to `export const MAX_ZOOM = 2;` / `export const MIN_ZOOM = .1;`
  - Add below them: `export const kPanStep = 40;`
  - In `setupArrowKeyPan` (~line 579) replace the inline `40` with `kPanStep` (leave `120` as `kPanStep * 3`).
  - Fix any behavior mismatches the tests reveal ONLY by correcting the tests to the actual contract (this task pins existing behavior; it must not change it beyond the exports/constant).

- [ ] **Step 4: Verify pass.** `npx jest src/plugins/dataflow/rete/rete-manager.test.ts` → all green (old + new).

- [ ] **Step 5: Commit.**
```bash
git add src/plugins/dataflow/rete/rete-manager.tsx src/plugins/dataflow/rete/rete-manager.test.ts
git commit -m "CLUE-573: pin rete-manager zoom/pan contract; export zoom clamps and pan step

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: Content model — pan-palette volatile

**Files:**
- Modify: `src/plugins/dataflow/model/dataflow-content.ts`
- Test: `src/plugins/dataflow/model/dataflow-content.test.ts`

- [ ] **Step 1: Write the failing tests.** In `dataflow-content.test.ts` (match the file's existing create/setup idiom — read its beforeEach):

```ts
  describe("pan palette state (CLUE-573)", () => {
    it("defaults closed, toggles via its action, and never appears in snapshots", () => {
      const content = DataflowContentModel.create();
      expect(content.panPaletteOpen).toBe(false);
      const before = JSON.stringify(getSnapshot(content));
      content.setPanPaletteOpen(true);
      expect(content.panPaletteOpen).toBe(true);
      expect(JSON.stringify(getSnapshot(content))).toBe(before);  // volatile: not persisted
      content.setPanPaletteOpen(false);
      expect(content.panPaletteOpen).toBe(false);
    });
  });
```
(`getSnapshot` from `mobx-state-tree` — add to imports if absent. If bare `DataflowContentModel.create()` needs args in this file, reuse however the neighboring tests construct content.)

- [ ] **Step 2: Verify failure.** `npx jest src/plugins/dataflow/model/dataflow-content.test.ts -t "pan palette"` → FAIL.

- [ ] **Step 3: Implement.** In `dataflow-content.ts`:
  - In the `.volatile` block (~line 116), after `liveProgramZoom`:
```ts
    // Whether the toolbar's pan flyout is showing (drawing's openPallette pattern; one palette only).
    panPaletteOpen: false
```
  - Next to `setLiveProgramZoom` (~line 347):
```ts
    setPanPaletteOpen(open: boolean) {
      self.panPaletteOpen = open;
    },
```

- [ ] **Step 4: Verify pass.** `npx jest src/plugins/dataflow/model/dataflow-content.test.ts` → all green.

- [ ] **Step 5: Commit.**
```bash
git add src/plugins/dataflow/model/dataflow-content.ts src/plugins/dataflow/model/dataflow-content.test.ts
git commit -m "CLUE-573: pan-palette open state on the dataflow content model

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 3: Zoom-in / zoom-out / fit-all toolbar buttons

**Files:**
- Create: `src/plugins/dataflow/components/toolbar/dataflow-zoom-pan-buttons.tsx`
- Modify: `src/plugins/dataflow/dataflow-toolbar-registration.tsx`
- Test: `src/plugins/dataflow/components/toolbar/dataflow-toolbar.test.tsx` (new)

- [ ] **Step 1: Write the failing tests.** Mirror `src/plugins/graph/components/__tests__/graph-toolbar.test.tsx`'s scaffold exactly (read it whole first):

```tsx
import React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import { Provider } from "mobx-react";
import { ModalProvider } from "react-modal-hook";

import { TileModelContext } from "../../../../components/tiles/tile-api";
import { TileModel } from "../../../../models/tiles/tile-model";
import { specStores } from "../../../../models/stores/spec-stores";
import { getToolbarButtonInfo } from "../../../../components/toolbar/toolbar-button-manager";
import { DataflowContentModel } from "../../model/dataflow-content";
import { DataflowReteManagerContext } from "../dataflow-rete-manager-context";
import { MIN_ZOOM, MAX_ZOOM, kPanStep } from "../../rete/rete-manager";
import "../../dataflow-toolbar-registration";
import "../../dataflow-registration";

function makeManagerStub(content: any) {
  return {
    mstContent: content,
    zoomIn: jest.fn(), zoomOut: jest.fn(), fitContent: jest.fn(), pan: jest.fn()
  } as any;
}

// Content whose program holds one node — fit-all's enabled case. Mirrors the node-creation idiom in
// dataflow-program-model.test.ts (`makeProgram`). Import DataflowNodeModel from wherever that test
// file imports it.
function createContentWithOneNode() {
  const content = DataflowContentModel.create();
  content.program.addNode(DataflowNodeModel.create({ id: "n1", name: "Number", x: 0, y: 0, data: {} }));
  return content;
}

function renderToolbarButton(buttonName: string, { manager, content }: { manager?: any, content?: any } = {}) {
  const info = getToolbarButtonInfo("dataflow", buttonName);
  if (!info) throw new Error(`Toolbar button '${buttonName}' is not registered for tileType 'dataflow'`);
  const Component = info.component;
  const stores = specStores();
  const theContent = content ?? DataflowContentModel.create();
  const model = TileModel.create({ content: theContent });
  const theManager = manager === null ? null : (manager ?? makeManagerStub(theContent));
  const result = render(
    <ModalProvider>
      <Provider stores={stores}>
        <TileModelContext.Provider value={model}>
          <DataflowReteManagerContext.Provider value={theManager}>
            <Component name={buttonName} />
          </DataflowReteManagerContext.Provider>
        </TileModelContext.Provider>
      </Provider>
    </ModalProvider>
  );
  return { ...result, manager: theManager, content: theContent };
}

describe("Dataflow toolbar zoom buttons (CLUE-573)", () => {
  it.each([["zoom-in", "Zoom In"], ["zoom-out", "Zoom Out"], ["fit-all", "Fit all"], ["pan", "Pan"]])(
    "'%s' is registered and exposes accessible name '%s'", (name, label) => {
      renderToolbarButton(name);
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    });

  it("zoom-in dispatches zoomIn exactly once", () => {
    const { manager } = renderToolbarButton("zoom-in");
    fireEvent.click(screen.getByRole("button", { name: "Zoom In" }));
    expect(manager.zoomIn).toHaveBeenCalledTimes(1);
  });

  it("zoom-out dispatches zoomOut exactly once", () => {
    const { manager } = renderToolbarButton("zoom-out");
    fireEvent.click(screen.getByRole("button", { name: "Zoom Out" }));
    expect(manager.zoomOut).toHaveBeenCalledTimes(1);
  });

  it("fit-all dispatches fitContent exactly once", () => {
    const { manager } = renderToolbarButton("fit-all", { content: createContentWithOneNode() });
    fireEvent.click(screen.getByRole("button", { name: "Fit all" }));
    expect(manager.fitContent).toHaveBeenCalledTimes(1);
  });

  it("all four are disabled with no rete manager in context", () => {
    for (const [name, label] of [["zoom-in", "Zoom In"], ["zoom-out", "Zoom Out"],
                                 ["fit-all", "Fit all"], ["pan", "Pan"]]) {
      const { unmount } = renderToolbarButton(name, { manager: null });
      expect(screen.getByRole("button", { name: label })).toBeDisabled();
      unmount();
    }
  });

  it("zoom-in disables at MAX_ZOOM without disabling zoom-out, and reactively re-enables", () => {
    const content = DataflowContentModel.create();
    content.setLiveProgramZoom({ k: MAX_ZOOM, x: 0, y: 0 } as any);
    renderToolbarButton("zoom-in", { content });
    expect(screen.getByRole("button", { name: "Zoom In" })).toBeDisabled();
    content.setLiveProgramZoom({ k: 1, x: 0, y: 0 } as any);
    expect(screen.getByRole("button", { name: "Zoom In" })).toBeEnabled();  // observer reactivity
  });

  it("zoom-out disables at MIN_ZOOM", () => {
    const content = DataflowContentModel.create();
    content.setLiveProgramZoom({ k: MIN_ZOOM, x: 0, y: 0 } as any);
    renderToolbarButton("zoom-out", { content });
    expect(screen.getByRole("button", { name: "Zoom Out" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Zoom In" })).toBeNull();  // isolation sanity
  });

  it("fit-all disables when the program has no nodes", () => {
    renderToolbarButton("fit-all");  // fresh content: empty program
    expect(screen.getByRole("button", { name: "Fit all" })).toBeDisabled();
  });
});
```
ADAPT the mechanical details to reality (each is a small lookup, keep every behavioral assertion):
- `setLiveProgramZoom`'s parameter type (`Transform` = `{k, x, y}` — read the type import in dataflow-content.ts) and whether `liveProgramZoom.update` maps `k`→`scale`.
- How to add a node to the program for the fit-all enabled case — read `dataflow-program-model.test.ts` for the minimal node-creation idiom and replace the `addNode?.(...)` placeholder with it; if constructing a node is heavy, instead give `DataflowContentModel.create()` a program snapshot containing one minimal node (the program-model test file shows valid node snapshots).
- If `DataflowContentModel.create()` requires environment/args in tests, copy `dataflow-content.test.ts`'s construction.
- The "Pan" registration assertion will stay red until Task 4 — that is expected; keep Task 3's implementation green for the other three and let the pan cases fail (or wrap the pan expectations in the Task 4 commit if the reviewer prefers a fully-green tree per commit: in that case add only the three zoom rows here and add pan rows in Task 4). PREFER the fully-green-per-commit option: include only zoom rows in this task.

- [ ] **Step 2: Verify failure.** `npx jest src/plugins/dataflow/components/toolbar/dataflow-toolbar.test.tsx` → FAIL (buttons not registered).

- [ ] **Step 3: Implement.** New `src/plugins/dataflow/components/toolbar/dataflow-zoom-pan-buttons.tsx`:

```tsx
import React, { useContext } from "react";
import { observer } from "mobx-react";
import { TileToolbarButton } from "../../../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../../components/toolbar/toolbar-button-manager";
import { DataflowReteManagerContext } from "../dataflow-rete-manager-context";
import { MIN_ZOOM, MAX_ZOOM } from "../../rete/rete-manager";

import ZoomInIcon from "../../../../clue/assets/icons/zoom-in-icon.svg";
import ZoomOutIcon from "../../../../clue/assets/icons/zoom-out-icon.svg";
import FitViewIcon from "../../../../clue/assets/icons/fit-view-icon.svg";

export const ZoomInButton = observer(function ZoomInButton({ name }: IToolbarButtonComponentProps) {
  const reteManager = useContext(DataflowReteManagerContext);
  const disabled = !reteManager || reteManager.mstContent.liveProgramZoom.scale >= MAX_ZOOM;
  return (
    <TileToolbarButton name={name} title="Zoom In" onClick={() => reteManager?.zoomIn()} disabled={disabled}>
      <ZoomInIcon />
    </TileToolbarButton>
  );
});

export const ZoomOutButton = observer(function ZoomOutButton({ name }: IToolbarButtonComponentProps) {
  const reteManager = useContext(DataflowReteManagerContext);
  const disabled = !reteManager || reteManager.mstContent.liveProgramZoom.scale <= MIN_ZOOM;
  return (
    <TileToolbarButton name={name} title="Zoom Out" onClick={() => reteManager?.zoomOut()} disabled={disabled}>
      <ZoomOutIcon />
    </TileToolbarButton>
  );
});

export const FitAllButton = observer(function FitAllButton({ name }: IToolbarButtonComponentProps) {
  const reteManager = useContext(DataflowReteManagerContext);
  const disabled = !reteManager || reteManager.mstContent.program.nodes.size === 0;
  return (
    <TileToolbarButton name={name} title="Fit all" onClick={() => reteManager?.fitContent()} disabled={disabled}>
      <FitViewIcon />
    </TileToolbarButton>
  );
});
```
Adapt: `liveProgramZoom.scale` vs `.k` (read `ProgramZoom`'s prop names in dataflow-content.ts — the deprecated model used `dx/dy/scale`); `program.nodes` path (read the program model); relative import depths. In `dataflow-toolbar-registration.tsx`, import the three and append to the registration array:
```ts
  { name: "zoom-in", component: ZoomInButton },
  { name: "zoom-out", component: ZoomOutButton },
  { name: "fit-all", component: FitAllButton }
```

- [ ] **Step 4: Verify pass.** `npx jest src/plugins/dataflow/components/toolbar/dataflow-toolbar.test.tsx src/plugins/dataflow` → green (pan rows deferred to Task 4). `npx eslint` both new/modified files.

- [ ] **Step 5: Commit.**
```bash
git add src/plugins/dataflow
git commit -m "CLUE-573: dataflow toolbar zoom-in/zoom-out/fit-all buttons

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 4: Pan flyout button

**Files:**
- Modify: `src/plugins/dataflow/components/toolbar/dataflow-zoom-pan-buttons.tsx`
- Create: `src/plugins/dataflow/components/toolbar/dataflow-pan-palette.scss` (or extend an existing dataflow scss — follow where dataflow keeps component styles)
- Modify: `src/plugins/dataflow/dataflow-toolbar-registration.tsx`
- Test: `src/plugins/dataflow/components/toolbar/dataflow-toolbar.test.tsx`

- [ ] **Step 1: Write the failing tests.** Add to the describe (and now add the "pan" row to the registration/no-manager cases from Task 3):

```tsx
describe("Dataflow pan flyout (CLUE-573)", () => {
  function openPalette() {
    const r = renderToolbarButton("pan");
    fireEvent.click(screen.getByRole("button", { name: "Pan" }));
    return r;
  }

  it("click opens the palette; second click closes it", () => {
    const { content } = openPalette();
    expect(content.panPaletteOpen).toBe(true);
    expect(screen.getByRole("button", { name: "Pan up" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pan" }));
    expect(content.panPaletteOpen).toBe(false);
    expect(screen.queryByRole("button", { name: "Pan up" })).toBeNull();
  });

  it.each([
    ["Pan up",    [0, -kPanStep]],
    ["Pan down",  [0, kPanStep]],
    ["Pan left",  [-kPanStep, 0]],
    ["Pan right", [kPanStep, 0]],
  ])("'%s' dispatches pan(%p)", (label, [dx, dy]) => {
    const { manager } = openPalette();
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(manager.pan).toHaveBeenCalledTimes(1);
    expect(manager.pan).toHaveBeenCalledWith(dx, dy);
  });

  it("Escape closes the palette", () => {
    const { content } = openPalette();
    fireEvent.keyDown(screen.getByRole("button", { name: "Pan up" }), { key: "Escape" });
    expect(content.panPaletteOpen).toBe(false);
  });

  it("unmounting the toolbar closes the palette (deselecting the tile)", () => {
    const { content, unmount } = openPalette();
    unmount();
    expect(content.panPaletteOpen).toBe(false);
  });

  it("opening is idempotent — reopening after close works", () => {
    const { content } = openPalette();
    fireEvent.click(screen.getByRole("button", { name: "Pan" }));   // close
    fireEvent.click(screen.getByRole("button", { name: "Pan" }));   // reopen
    expect(content.panPaletteOpen).toBe(true);
  });
});
```

- [ ] **Step 2: Verify failure.** `npx jest src/plugins/dataflow/components/toolbar/dataflow-toolbar.test.tsx -t "pan"` → FAIL.

- [ ] **Step 3: Implement.** In `dataflow-zoom-pan-buttons.tsx` add (mirroring stamp-button's open/palette structure, but pan needs no touch-hold — plain click toggles):

```tsx
import { useContext, useEffect } from "react";                       // extend existing import
import { kPanStep } from "../../rete/rete-manager";                  // extend existing import
import NavigatorMoveIcon from "../../../../assets/icons/navigator-move-icon.svg";
import NavigatorScrollIcon from "../../../../assets/icons/navigator-scroll-icon.svg";
import "./dataflow-pan-palette.scss";

const panDirections = [
  { label: "Pan up",    className: "up",    dx: 0,         dy: -kPanStep },
  { label: "Pan down",  className: "down",  dx: 0,         dy: kPanStep },
  { label: "Pan left",  className: "left",  dx: -kPanStep, dy: 0 },
  { label: "Pan right", className: "right", dx: kPanStep,  dy: 0 },
] as const;

export const PanButton = observer(function PanButton({ name }: IToolbarButtonComponentProps) {
  const reteManager = useContext(DataflowReteManagerContext);
  const content = reteManager?.mstContent;
  const isOpen = !!content?.panPaletteOpen;

  // Deselecting the tile unmounts the toolbar; the model volatile would otherwise stay open.
  useEffect(() => () => content?.setPanPaletteOpen(false), [content]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") content?.setPanPaletteOpen(false);
  }

  return (
    <TileToolbarButton name={name} title="Pan" disabled={!reteManager}
        onClick={() => content?.setPanPaletteOpen(!isOpen)}>
      <NavigatorMoveIcon />
      {isOpen &&
        <div className="toolbar-palette dataflow-pan-palette" onKeyDown={handleKeyDown}>
          <div className="palette-buttons">
            {panDirections.map(({ label, className, dx, dy }) => (
              <button key={className} type="button" aria-label={label} title={label}
                  className={`dataflow-pan-button ${className}`}
                  onClick={(e) => { e.stopPropagation(); reteManager?.pan(dx, dy); }}>
                <NavigatorScrollIcon />
              </button>
            ))}
          </div>
        </div>
      }
    </TileToolbarButton>
  );
});
```
ADAPT to reality: match `StampsPalette`'s outer markup classes (`toolbar-palette` + a specific class, read `stamps-palette.tsx` and its scss for positioning conventions); the `stopPropagation` prevents the arrow click from re-toggling via the TileToolbarButton onClick — verify whether TileToolbarButton's onClick fires for child clicks (stamp-button's palette children work this way; follow whatever it does, including `e.stopPropagation()` in `handleTriangleClick`). If `content` should come from `TileModelContext` instead of `reteManager.mstContent` when the manager is null, keep the manager path — a null manager disables the button so the palette can't open.

Scss (`dataflow-pan-palette.scss`): a small cross layout mirroring tile-navigator's arrows — read `tile-navigator.tsx`'s scss for the `NavigatorScrollIcon` rotation idiom (`.up/.right/.down/.left` transforms) and copy the rotation rules; grid-template a 3×3 cross (up in top-middle, left/right in middle row, down in bottom-middle), 26px square buttons, `@include focus-ring(2px)` if the mixin is in scope for dataflow scss (check how other dataflow scss files import mixins).

Register in `dataflow-toolbar-registration.tsx`: `{ name: "pan", component: PanButton }`.

- [ ] **Step 4: Verify pass.** `npx jest src/plugins/dataflow` → ALL green including Task 3's deferred pan registration row. `npx eslint` on touched files. `npm run check:types`.

- [ ] **Step 5: Commit.**
```bash
git add src/plugins/dataflow
git commit -m "CLUE-573: dataflow toolbar pan flyout

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 5: Remove the on-stage zoom control

**Files:**
- Delete: `src/plugins/dataflow/components/ui/dataflow-program-zoom.tsx`, `src/plugins/dataflow/components/ui/dataflow-program-zoom.scss`
- Modify: `src/plugins/dataflow/components/dataflow-program.tsx`, `src/plugins/dataflow/rete/rete-manager.tsx`
- Modify: `cypress/e2e/functional/tile_tests/dataflow_tile_keyboard_spec.js`

- [ ] **Step 1: Remove.**
  - Delete both files (`git rm`).
  - In `dataflow-program.tsx`: remove the `DataflowProgramZoom` import, the `showZoomControl` const (~108) and its JSX render block (~171-176), and the `handleZoomIn`/`handleZoomOut` (or equivalently named) handlers (~258-266) — first grep the file to confirm nothing else calls them. `documentProperties` may now be unused in that component: remove the prop threading ONLY if `dataflow-program.tsx` has no other reader (grep `documentProperties` in the file; if used elsewhere, leave the prop).
  - In `rete-manager.tsx` `setupArrowKeyPan` (~565): remove `.program-editor-zoom` from the accepted-elements selector string.
- [ ] **Step 2: Update the cypress focus-order spec.** In `dataflow_tile_keyboard_spec.js`, delete the two rows `['data-testid', 'zoom-in-button']` / `['data-testid', 'zoom-out-button']` from the `focusOrder` array (~lines 24-25). Grep ALL of cypress for `zoom-in-button|zoom-out-button|program-editor-zoom` and fix any other references.
- [ ] **Step 3: Verify.** `npx jest src/plugins/dataflow` → green. `npm run check:types` → 0 errors. `npx eslint` on modified files. `grep -rn "DataflowProgramZoom\|program-editor-zoom" src cypress` → no hits.
- [ ] **Step 4: Commit.**
```bash
git add -A src/plugins/dataflow cypress
git commit -m "CLUE-573: remove the on-stage dataflow zoom control

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 6: Default toolbar config + drift guard

**Files:**
- Modify: `src/clue/app-config.json` (~line 365-378, `settings.dataflow.tools`)
- Test: add the drift-guard to `src/plugins/dataflow/components/toolbar/dataflow-toolbar.test.tsx`

- [ ] **Step 1: Write the failing test.**
```tsx
import appConfigJson from "../../../../clue/app-config.json";

describe("dataflow toolbar config/registration drift guard (CLUE-573)", () => {
  it("every configured dataflow tool resolves to a registered button", () => {
    const tools: Array<string | string[]> = (appConfigJson as any).config.settings.dataflow.tools;
    const names = tools
      .map(t => Array.isArray(t) ? t[0] : t)
      .filter(name => name !== "|");
    expect(names).toEqual(expect.arrayContaining(["zoom-in", "zoom-out", "fit-all", "pan"]));
    for (const name of names) {
      expect(getToolbarButtonInfo("dataflow", name)).toBeDefined();
    }
  });
});
```
Adapt the JSON path (`config.settings...` vs top-level `settings...` — read app-config.json's actual shape; the explore notes say `settings` lives under `config`).

- [ ] **Step 2: Verify failure.** The arrayContaining assertion fails (config lacks the new names).

- [ ] **Step 3: Implement.** In `app-config.json`, change `settings.dataflow.tools` to:
```json
"tools": [["data-set-view", "Table"], ["data-set-link", "Graph"], "delete", "group", "ungroup",
          "|", "zoom-in", "zoom-out", "fit-all", "pan"]
```
(keeping the file's existing array formatting style).

- [ ] **Step 4: Verify pass.** `npx jest src/plugins/dataflow` → green.

- [ ] **Step 5: Commit.**
```bash
git add src/clue/app-config.json src/plugins/dataflow/components/toolbar/dataflow-toolbar.test.tsx
git commit -m "CLUE-573: dataflow toolbar defaults include zoom and pan; drift guard

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 7: Full verification

- [ ] **Step 1: Suites.** `npx jest src/plugins/dataflow src/components/toolbar` → all green.
- [ ] **Step 2: Whole-tree.** `npm run check:types` (0 errors) and `npm run lint:build` (0 errors) — per repo CLAUDE.md, lint:build is required before finishing.
- [ ] **Step 3: Manual QA on localhost (before any push):**
  - Dataflow demo unit (`?appMode=dev&unit=./curriculum/dataflow/dataflow-example.json` or the `dataflow` unit code): select a dataflow tile → toolbar shows Table/Graph/Delete/Group/Ungroup | +/−/Fit/Pan; zoom in/out steps visibly, disables at the limits; fit-all disabled on empty program, fits after adding nodes; pan flyout opens, four arrows nudge the canvas 40px, Escape and deselect close it; arrow-key pan still works; marquee select still works; NO zoom buttons on the stage.
  - Neural-engineering unit: same checks (it inherits the default tools).
  - Read-only view (published/comparison): toolbar hidden as before, no stage buttons.
- [ ] **Step 4: Do not push** until localhost QA passes and the user OKs.

**Deferred (note in the PR):** a Cypress spec exercising toolbar zoom/pan end-to-end — authored blind if requested (Cypress can't run in this environment), validated by CI's Manual Regression workflow (`gh workflow run manual-regression.yml ... -f test=functional/tile_tests/<spec>.js`; new specs must be added to that workflow's choice list).
