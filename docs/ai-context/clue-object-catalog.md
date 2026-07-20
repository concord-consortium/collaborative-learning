# CLUE Object Catalog — Dataflow, Simulations, Tables

**Purpose.** This is a reference catalog of the objects an AI system may need to **detect** in, or **create** for, a CLUE document. It covers three tile types — **Dataflow**, **Simulator**, and **Table** — enumerating every object/node/variable type, its internal identifier, and every user-configurable option with its exact allowed values. It is generated from the CLUE source and cites `file:line` so it can be re-verified.

**Conventions.**
- A CLUE document is a set of **tiles**. Each tile has a `content` object with a `type` string (e.g. `"Dataflow"`, `"Simulator"`, `"Table"`).
- "Internal value" = the exact string stored in the model (use these for detect/create). "Display name" = what the user sees (may differ).
- Options are model fields unless noted; allowed values are quoted verbatim from source.

---

# 1. Dataflow tile (`type: "Dataflow"`)

A Dataflow tile holds a **program**: a graph of **nodes** connected by wires. Each node has a `type` string, a set of input/output **sockets**, and type-specific options.

Source of the master option lists: `src/plugins/dataflow/model/utilities/node.ts`. Node models: `src/plugins/dataflow/nodes/*.ts`. Node union: `src/plugins/dataflow/model/dataflow-program-model.ts:58-70`.

## 1.1 Node types

There are **10 node types creatable from the toolbar** (`NodeTypes`, node.ts:62-103). An 11th model, **Counter**, exists in the node union but is **not creatable from the UI** (no toolbar entry).

| `type` (internal) | Toolbar display name | Inputs (sockets) | Output | Plot toggle | Live readout |
|---|---|---|---|---|---|
| `Sensor` | Input | — | `value` | yes | yes |
| `Number` | Number | — | `value` | yes | yes |
| `Generator` | Generator | — | `value` | yes | yes |
| `Timer` | Timer (on/off) | — | `value` | yes | yes (on/off) |
| `Math` | Math | `num1`, `num2` | `value` | yes | yes |
| `Logic` | Logic | `num1`, `num2` | `value` | yes | yes |
| `Transform` | Transform | `num1` | `value` | yes | yes |
| `Control` | Hold | `num1` (Binary), `num2` (Number2) | `value` | yes | yes |
| `Demo Output` | Demo Output | `nodeValue` (+ `tilt` for Advanced Grabber) | — | no | yes |
| `Live Output` | Live Output | `nodeValue` | — | no | yes |
| `Counter` *(not creatable)* | — | — | `value` | no | no |

**Common node fields** (`BaseNodeModel`, `src/plugins/dataflow/nodes/base-node.ts`): `type` (string), `plot` (boolean, default `false` — show/hide minigraph), `orderedDisplayName` (auto-assigned label, e.g. "Math 1"), `tickEntries` (per-tick value history — transient runtime state).

Program-wide: default data/sampling rate = **1000 ms** (node.ts).

## 1.2 Node options and allowed values

### Sensor (`"Sensor"`, display "Input")
`src/plugins/dataflow/nodes/sensor-node.ts`
- **`sensorType`** (dropdown) — `NodeSensorTypes` (node.ts:311-375). Active options (internal `type` → display, units):
  - `temperature` → "Temperature", °C
  - `humidity` → "Humidity", %
  - `CO2` → "CO₂", PPM
  - `light` → "Light", lux
  - `emg-reading` → "EMG", mV (0 dp)
  - `fsr-reading` → "Surface Pressure", psi (0 dp)
  - `pin-reading` → "Pin Reading", mV (0 dp)
  - *(commented-out / not available: `O2`, `soil-moisture`, `particulates`.)*
- **`sensor`** (dropdown) — the specific sensor/channel selection; dynamically populated from available channels (incl. simulation-provided sensor variables). Placeholder: `"Select an input"`.

### Number (`"Number"`)
`src/plugins/dataflow/nodes/number-node.ts`
- **`value`** (numeric input) — any finite number. Default `0`.

### Generator (`"Generator"`)
`src/plugins/dataflow/nodes/generator-node.ts`
- **`generatorType`** (dropdown) — `NodeGeneratorTypes` (node.ts:454-470): `Sine`, `Square`, `Triangle`. Default `Sine`.
- **`amplitude`** (numeric) — default `1`.
- **`period`** (numeric) — default `10`; **`periodUnits`** (dropdown) — `NodePeriodUnits`: `sec`, `min`, `hour`. Default `sec`.

### Timer (`"Timer"`, display "Timer (on/off)")
`src/plugins/dataflow/nodes/timer-node.ts`
- **`timeOn`** (numeric, default `5`) + **`timeOnUnits`** — `sec` | `min` | `hour` (default `sec`).
- **`timeOff`** (numeric, default `5`) + **`timeOffUnits`** — `sec` | `min` | `hour` (default `sec`).
- Output is `1` while on, `0` while off.

### Math (`"Math"`)
`src/plugins/dataflow/nodes/math-node.ts`
- **`mathOperator`** (dropdown) — `NodeOperationTypes` where `type==="math"` (node.ts:105-133): `Add`, `Subtract`, `Multiply`, `Divide`. Default `Add`.

### Logic (`"Logic"`)
`src/plugins/dataflow/nodes/logic-node.ts`
- **`logicOperator`** (dropdown) — `NodeOperationTypes` where `type==="logic"` (node.ts:200-269): `Greater Than`, `Less Than`, `Greater Than Or Equal To`, `Less Than Or Equal To`, `Equal`, `Not Equal`, `And`, `Or`, `Nand`, `Xor`. Default `Greater Than`. (Output is `1`/`0`.)

### Transform (`"Transform"`)
`src/plugins/dataflow/nodes/transform-node.ts`
- **`transformOperator`** (dropdown) — `NodeOperationTypes` where `type==="transform"` (node.ts:134-199): `Absolute Value`, `Negation`, `Not`, `Round`, `Floor`, `Ceil`, `Ramp`. Default `Absolute Value`.

### Control (`"Control"`, display "Hold")
`src/plugins/dataflow/nodes/control-node.ts`
- **`controlOperator`** (dropdown) — `HoldFunctionOptions` (node.ts:272-309), internal → display:
  - `Hold Current` → "Hold this"
  - `Hold Prior` → "Hold previous"
  - `Output Zero` → "Hold 0"
  - Default `Hold Current`. *(Three "…wait" variants are commented out / unavailable.)*
- **`waitDuration`** (numeric, seconds) — default `0`.
- Inputs: `num1` (Binary gate), `num2` (Number to hold).

### Demo Output (`"Demo Output"`)
`src/plugins/dataflow/nodes/demo-output-node.ts`
- **`outputType`** (dropdown) — `NodeDemoOutputTypes` (node.ts:377-400), internal → display: `Light Bulb`; `Grabber` → "Gripper"; `Advanced Grabber` → "Advanced Gripper"; `Fan`; `Humidifier`. Default `Light Bulb`.
- **`tilt`** (numeric, only when `outputType==="Advanced Grabber"`) — restricted to `{-1, 0, 1}`, default `0`; adds a `tilt` input socket.

### Live Output (`"Live Output"`)
`src/plugins/dataflow/nodes/live-output-node.ts`
- **`liveOutputType`** (dropdown) — `NodeLiveOutputTypes` (node.ts:403-440): `Gripper 2.0`; `Grabber` → "Gripper"; `Humidifier`; `Fan`; `Heat Lamp`; `Servo`. Default `Gripper 2.0`.
- **`hubSelect`** (dropdown) — target device/hub. Dynamically populated: micro:bit relay hubs `NodeMicroBitHubs` identifiers `a`–`h` (node.ts:451-452) for relay outputs (Fan/Humidifier/Heat Lamp); physical/simulated gripper/servo options otherwise (`baseLiveOutputOptions`, node.ts:472-502). May show "⚠️ connect device" when no device is present.

### Counter (`"Counter"`, not creatable from toolbar)
`src/plugins/dataflow/nodes/counter-node.ts` — increments an internal `count` each cycle; no user options. Present in the model union only; excluded from `NodeTypes`, so it cannot be added from the UI.

## 1.3 Dataflow ↔ Simulator/variable linkage
When a Simulator tile is present, its variables are exposed to Dataflow: **sensor-input** variables (label `sensor:*`) become selectable in a Sensor node's `sensor` dropdown; **live-output** variables (label `live-output:<Name>`) correspond to Live Output devices of that name (e.g. `live-output:Servo` ↔ Live Output type `Servo`). See §2.4.

---

# 2. Simulator tile (`type: "Simulator"`)

`kSimulatorTileType = "Simulator"` (`src/plugins/simulator/simulator-types.ts:1`). Model: `src/plugins/simulator/model/simulator-content.ts`.

## 2.1 Tile options
- **`simulation`** (string, model prop) — key selecting which simulation is active. If unset, falls back to appConfig `defaultSimulation`, then `defaultSimulationKey`.
- **`type`** — literal `"Simulator"`.
- **`frame`** (volatile) — animation/step counter; not persisted content.
- Default height: `400px` (`simulator-types.ts:3`). User-resizable. Registration/title base "Simulation" (`simulator-registration.ts`).

The tile creates/links a **SharedVariables** model on attach and seeds it from the active simulation's `variables` (only creating variables not already present). If a Dataflow tile exists, it also links to that program's **SharedProgramData**. It calls the simulation's `step()` every `delay` ms.

## 2.2 Simulation registry
`src/plugins/simulator/simulations/simulations.ts` — **3 simulations**. `defaultSimulationKey = "EMG_and_claw"`.

| Key (`simulation`) | Name | `delay` | Variables (exposed/total) | Modes |
|---|---|---|---|---|
| `EMG_and_claw` *(default)* | Brainwaves & Gripper | 67 ms | 5 / 7 | Pressure / Temperature |
| `terrarium` | Terrarium (gecko) | 100 ms | 3 / 6 | — |
| `potentiometer_chip_servo` | Potentiometer & Servo | 67 ms | 3 / 3 | — |

## 2.3 Simulation variables

Each variable is a `VariableSnapshot` (`@concord-consortium/diagram-view`) with: `name` (identifier), `displayName`, `unit`, `value` (initial), and `labels` (roles/formatting). Hidden = no `input`/`output` label, so not shown as a chip.

### `EMG_and_claw` — Brainwaves & Gripper (`.../brainwaves-gripper/brainwaves-gripper.tsx`)
| name | displayName | unit | init | labels |
|---|---|---|---|---|
| `emg_key` | EMG | mV | 40 | `input`, `sensor:emg-reading`, `decimalPlaces:0` |
| `pressure_key` | Surface Pressure | psi | 0 | `input`, `sensor:fsr-reading`, `className:long-name`, `decimalPlaces:0` |
| `temperature_key` | Temperature | °C | 15.5 | `input`, `sensor:temperature` |
| `gripper_key` | Gripper | % closed | 0 | `output`, `live-output:Grabber`, `live-output:Gripper 2.0`, `decimalPlaces:0` |
| `target_emg_key` | Target EMG | — | 40 | *(hidden)* |
| `pan_temperature_key` | Pan Temperature | — | 15.5 | *(hidden; driven by preset boil curve)* |
| `simulation_mode_key` | Simulation Mode | — | 0 | *(hidden; 0=Pressure, 1=Temperature)* |

UI: EMG slider (40–440 mV, step 40); mode buttons Pressure/Temperature.

### `terrarium` — Terrarium (`.../terrarium/terrarium.tsx`)
| name | displayName | unit | init | labels |
|---|---|---|---|---|
| `temperature_key` | Temperature | °C | 21 | `input`, `sensor:temperature` |
| `humidity_key` | Humidity | % | 20 | `input`, `sensor:humidity` |
| `fan_key` | Fan | — | 0 | `output`, `live-output:Fan`, `decimalPlaces:0` |
| `heat_lamp_key` | Heat Lamp | — | 0 | `output`, `live-output:Heat Lamp`, `decimalPlaces:0` |
| `humidifier_key` | Humidifier | — | 0 | `output`, `live-output:Humidifier`, `decimalPlaces:0` |
| `raw_temperature_key` | Raw Temperature | — | 21 | *(hidden internal state)* |

Outputs are on/off (0 = off). No UI controls (driven by Dataflow). Ranges: temp 21–27 °C, humidity 0–90 %.

### `potentiometer_chip_servo` — Potentiometer & Servo (`.../potentiometer-servo/potentiometer-servo.tsx`)
| name | displayName | unit | init | labels |
|---|---|---|---|---|
| `pot_angle_key` | Potentiometer | deg | 0 | `input`, `position`, `decimalPlaces:0` |
| `resist_reading_key` | Pin | — | 0 | `input`, `reading`, `sensor:pin-reading`, `decimalPlaces:0` |
| `servo_angle_key` | Servo | deg | 0 | `output`, `position`, `live-output:Servo`, `decimalPlaces:0` |

UI: potentiometer slider 0–270° (step 5). Pin reading = `round(potAngle/270 * 1023)` (0–1023). Servo 0–180°.

## 2.4 Variable label conventions
Helpers: `src/plugins/shared-variables/simulations/simulation-utilities.ts`.
- **Role:** `input` (read by Dataflow/user) vs `output` (written by Dataflow). `isInputVariable`/`isOutputVariable` test these.
- **Sensor type:** `sensor:<kind>` — e.g. `sensor:temperature`, `sensor:humidity`, `sensor:emg-reading`, `sensor:fsr-reading`, `sensor:pin-reading`. These become selectable in a Dataflow Sensor node.
- **Live output:** `live-output:<Name>` — e.g. `live-output:Fan`, `live-output:Heat Lamp`, `live-output:Humidifier`, `live-output:Servo`, `live-output:Grabber`, `live-output:Gripper 2.0`. Name matches a Dataflow Live Output type.
- **Sub-role:** `position` vs `reading` (adds a display suffix).
- **Formatting:** `decimalPlaces:N` (UI rounding), `className:long-name` (wider layout).

*(Note: a variable's live `value` is runtime state driven by the simulation each step, not authored content, for `sensor:*` and `live-output:*` variables.)*

---

# 3. Table tile (`type: "Table"`)

`kTableTileType = "Table"` (`src/models/tiles/table/table-content.ts:26`). A table is a view over a **DataSet** (columns = **attributes**, rows = **cases**), owned/shared via a **SharedDataSet**.

## 3.1 Structure / object model
**TableContentModel** (`table-content.ts`): `type` `"Table"`; `isImported` (boolean); `importedDataSet` (used during import); `columnWidths` (`Map<attrId, number>`). Default height `160px`. Views: `dataSet`, `sharedModel` (SharedDataSet), `linkedTiles`/`isLinked`, `hasExpressions`.

**DataSet** (`src/models/data/data-set.ts`): `id`, `name` (shown as table title), `attributes[]`, `cases[]`, `sortByAttribute`, `sortDirection` (`ASC`|`DESC`|`NONE`). A **case/row** is `{ __id__: string, [attributeId]: value }`.

**Attribute (column)** (`src/models/data/attribute.ts`):
| field | type | meaning |
|---|---|---|
| `id` | string (`ATTR…`) | column id |
| `name` | string | column header |
| `units` | string | e.g. "meters", "kg" (default "") |
| `formula` | Formula | `.display` holds the expression string |
| `precision` | number? | decimal places (→ d3 format `.{precision}~f`, default `.3~f`) |
| `hidden` | boolean | hide column |
| `values` | (number\|string\|undefined)[] | cell values |
| `title`, `description` | string | optional |

Attribute **type** is inferred as `"numeric"` or `"categorical"` from values. Cell values may be number, string (incl. dates, image URLs), or empty.

**SharedDataSet** (`src/models/shared/shared-data-set.ts`): `type` `"SharedDataSet"`, `providerId` (owning table's tile id), `dataSet`. Consumed by Graph/Geometry/Dataflow tiles for linking.

## 3.2 User-configurable operations
Columns/attributes:
- **Add column** — `addAttribute(id, name)` (auto-name "y", "y2", …).
- **Rename column** — `setAttributeName(id, name)` (edit header).
- **Remove column** — `removeAttributes(ids)`.
- **Resize column** — `setColumnWidth(attrId, width)`; min `80px`.
- **Set formula/expression** — `setExpression(id, expression)`; edited via the "Set expression" modal. Uses the CODAP formula system (`@concord-consortium/codap-formulas`): standard operators `+ - * / ^`, attribute-name references, and library functions. Clearing sets `formula.display` to "". (See `docs/formula-system.md`.)
- **Number format / precision** — per-column `setPrecision(precision?)`; global default from authoring `settings.table.numFormat` (d3-format, default `.1~f`).
- **Units** — `units` string per attribute.

Rows/cases:
- **Add rows** — `addCanonicalCases(cases, beforeID?)`.
- **Edit cell values** — `setCanonicalCaseValues(caseValues)` (inline edit; commit on Enter/Tab/blur, cancel on Esc).
- **Delete rows** — `removeCases(ids)`.

Table-wide:
- **Sort** — `sortCases(attributeId, "ASC"|"DESC")`; header cycles ASC → DESC → NONE.
- **Rename table** — `dataSet.name` / `setContentTitle` (default "Table Data").
- **Selection** — cell/row/column selection sets; "Clear cell" clears selected cells.
- **Import data** — CSV only (papaparse); import snapshot columns support `name`, `width`, `expression`, `values`.
- **Link** — link this table's dataset to other tiles (Graph, Geometry) via SharedDataSet; requires ≥2 attributes and ≥1 linkable (numeric/empty) case.

## 3.3 Toolbar tools (authorable)
Registered buttons (`src/components/tiles/table/table-toolbar-registration.tsx`), selectable via authoring `settings.table.tools`:
| id | label | action |
|---|---|---|
| `delete` | Clear cell | clear selected cell(s) |
| `set-expression` | Set expression | open formula editor for a column |
| `link-tile` | Link table | link to other tiles sharing the dataset |
| `link-graph` | Graph It! | link/create a Graph tile |
| `merge-in` | Add data from… | merge data from another table/document |
| `data-set-view` | *(configurable)* | create a new tile view of the dataset |
| `import-data` | Import data | import a `.csv` |

## 3.4 Authoring settings
`src/authoring/types.ts` — `settings.table`:
- **`numFormat`**: string — d3-format for number display (default `.1~f`).
- **`tools`**: `(string | [string, string])[]` — toolbar button ids, or `[id, "Custom Label"]` tuples, from the table above.

---

## Appendix — quick "create" summary

- **Dataflow node:** `{ type: <one of the 10 type strings>, ...type-specific option fields }`, wired via input/output sockets. Options and allowed values per §1.2.
- **Simulator tile:** `{ type: "Simulator", simulation: <"EMG_and_claw"|"terrarium"|"potentiometer_chip_servo"> }`; variables are seeded from the chosen simulation (§2.3).
- **Table tile:** `{ type: "Table" }` backed by a DataSet of attributes (columns, optionally with `formula`, `units`, `precision`) and cases (rows). Toolbar tools per §3.3.

*Regenerate/verify against source: `src/plugins/dataflow/model/utilities/node.ts`, `src/plugins/simulator/simulations/*`, `src/models/tiles/table/*` and `src/models/data/*`.*
