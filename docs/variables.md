# Shared Variables
`SharedVariables` is a type of `SharedModel` (see `shared-models.md`). Defined in `src/plugins/shared-variables/`, this model wraps an array of `Variable`s, which are defined in the `quantity-playground` repository and exported and imported via the `diagram-view` library.

## Basic Concept
`SharedVariables` is used to allow tiles to communicate with each other about variables and their relationships.

## Use Cases
Currently, there are two main use cases. Each case has a centerpiece tile.

### Case 1: User Defined Variables and the Diagram Tile
The first use case involves users defining their own variables and relationships between them. Here, the `SharedVariable` model generally starts empty, but is built up as the user creates new variables and then defines them in terms of each other.

#### Diagram Tile
The Diagram Tile is the centerpiece of this use case. It allows the user to easily create new variables, then define their relationships by linking independent variables to the dependent variables they influence.

Most of the Diagram Tile is defined in the `quantity-playground` repository and is exported and imported via the `diagram-view` library.

#### Text Tile
When set up properly in a curriculum's unit file, the Text Tile can include `VariableChip`s. These render as html elements that represent a variable and can include its name, value, and unit. `VariableChip`s update automatically as a variable changes.

Including `VariableChip`s in the Text Tile allows a student to write about variables and their relationships.

See the `m2studio` unit file for an example of how to properly set this and the Drawing Tile up.

#### Drawing Tile
Much like the Text Tile, `VariableChip`s are available in the Drawing Tile when it is set up properly in the curriculum's unit file.

#### Variable Dialogs
While users often use the Diagram Tile to create and modify variables, there are two dialogs which let users create and modify variables via the toolbars of Text and Drawing Tiles when they are set up properly.

#### Graph Tile
The graph tile uses a `PlottedFunctionAdornment` to display functions of variables in terms of each other. This allows students to visualize the relationships between different variables.

Because most units will not use this feature, and including it will bring in all of `quantity-playground`, we're trying to keep references to `SharedVariables` out of the core graph tile code. However, during development, we're cutting corners to get something out sooner. Below is a list of locations in the codebase with references to `SharedVariables` that we'll need to clean up before releasing this work.
- `graph-model.ts` has a reaction set up in `afterAttach` which displays a `PlottedFunctionAdornment` based on whether any `sharedVariables` are attached or not. We have no plan for how to handle this reference at the moment.
- `plotted-variables-adornment-component.tsx` uses the expression of the y variable in a reaction to update the plot. This reference should be handled when we make the `PlottedFunctionAdornment` a plugin for the graph.
- `plotted-variables-adornment-model.ts` references the `SharedVariables` in `computePoints` to display a function defined by variables if the graph tile is linked to a `SharedVariables`. This reference should be handled when we make the `PlottedFunctionAdornment` a plugin for the graph.

### Case 2: Simulations and the Simulator Tile
The second use case involves premade simulations, which users access through Simulator Tiles. Here, the `SharedVariable` model starts with built in variables defined by a developer, and the user generally does not add additional variables or directly modify variables. Instead, the user uses a Dataflow Tile to import data from certain variables into sensor nodes, modifies the data via a dataflow program, then sends values to output variables via live output nodes.

#### Simulations
Simulations are at the heart of this use case. They are defined in the `src/plugins/simulator/simulation/` directory, and generally describe how a simulation should work. Each simulation contains several properties:
- delay: The number of milliseconds between steps of the simulation.
- variables: A list of `Variable` snapshots that will be defined when the simulation is initialized. Each should have an `name` (which should be unique so the variable can be identified), a `displayName`, and a `value`. A `unit` is optional. These will often also include relevant `labels` (see _Dataflow Tile_ below), as well as an `icon`.
- values: A dictionary containing values to assign to variables. Each key should be a variable's name, and each value is a list containing values that will be assigned to the variable in sequence as the simulation progresses. Each step, the variable is assigned the next value in its list, and the values are repeated indefinitely while the simulation runs. For example, `values: { "input_test": [0, 1] }` will make the variable with name "input_test" have value 0 on the first step, 1 on the second step, 0 on the third, etc.
- step: An optional custom function run on each step. It receives a dictionay containing `frame` and `variables` as a parameter. This function can be used to update variables in terms of each other, for example. It is called after values are updated using _values_ as described above.
- component: A component used to display the state of the simulation in the Simulator Tile. It receives `frame` and `variables` as props. This will ususally involve animations and visualizations that are controlled by the variables.

#### Simulator Tile
The Simulator Tile is the centerpiece of this use case. It's very simple, with three main jobs:
1. It loads a simulation (see above), setting up its predefined variables in a `SharedVariable` model.
2. It runs the simulation, periodically updating the variables.
3. It renders the state of the simulation using its component, as well as listing all input and output variables in the simulation and their values. If a variable has an icon specified, these will be displayed next to the variable's display name.

The Simulator Tile is defined in `src/plugins/simulator/`.

#### Dataflow Tile
The Dataflow Tile allows a user to access a simulation's input variables and set its output variables. It will automatically connect to any `SharedVariables` model in the document.

*Input Variables* These can be accessed via sensor nodes in the Dataflow Tile. Variables with the `input` label are input variables and will show up in the dropdown menu for sensor nodes. To connect a variable with a particular type of sensor, add a label like `sensor:emg-reading`, where the part of the string after the colon matches the type of a node sensor (see `NodeSensorTypes` in `plugins/dataflow/model/utilities/node.ts`).

*Output Variables* These can be defined via live output nodes in the Dataflow Tile. Variables with the `output` label are output variables. To connect a variable with a particular live output type, add a label like `live-output:Gripper 2.0`, where the part of the string after the colon matches the name of a live output type (see `NodeLiveOutputTypes` in `plugins/dataflow/model/utilities/node.ts`). Once these two labels are set up, the user should see an option to connect a live output ndoe in dataflow of the correct type to the variable. Then the output variable will acquire the live output node's value every time the dataflow tile ticks. It's possible to include multiple `live-output:` labels in an output variable, in which case the variable can be connected to any of the types specified.
