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

### Case 2: Simulations and the Simulator Tile
The second use case involves premade simulations, which users access through Simulator Tiles. Here, the `SharedVariable` model starts with built in variables defined by a developer, and the user generally does not add additional variables or directly modify variables. Instead, the user uses a Dataflow Tile to import data from certain variables into sensor nodes, modifies the data via a dataflow program, then sends values to output variables via live output nodes.

#### Simulations
Simulations are at the heart of this use case. They are defined in the `src/plugins/simulator/simulation/` directory, and generally describe how a simulation should work. Each simulation contains several properties:
- delay: The number of milliseconds between steps of the simulation.
- variables: A list of `Variable` snapshots that will be defined when the simulation is initialized. Each should have a name and a value. A unit is optional.
- values: A dictionary containing values to assign to variables. Each key should be a variable's name, and each value is a list containing values that will be assigned to the variable in sequence as the simulation progresses. Each step, the variable is assigned the next value in its list, and the values are repeated indefinitely while the simulation runs. For example, `values: { "input_test": [0, 1] }` will make the variable with name "input_test" have value 0 on the first step, 1 on the second step, 0 on the third, etc.
- step: _NOT CURRENTLY IMPLEMENTED_ An optional custom function run on each step. This can be used to update variables in terms of each other, for example. This is called after values are updated using _values_ as described above.
- component: _NOT CURRENTLY IMPLEMENTED_ A component used to display the state of the simulation in the Simulator Tile. This will ususally involve animations and visualizations that are controlled by the variables.

#### Simulator Tile
The Simulator Tile is the centerpiece of this use case. It's very simple, with three main jobs:
1. It loads a simulation (see above), setting up its predefined variables in a `SharedVariable` model.
2. It runs the simulation, periodically updating the variables.
3. It renders the state of the simulation using its component.

The Simulator Tile is defined in `src/plugins/simulator/`.

#### Dataflow Tile
The Dataflow Tile allows a user to access a simulation's input variables and set its output variables. It will automatically connect to any `SharedVariables` model in the document.

*Input Variables* These can be accessed via sensor nodes in the Dataflow Tile. Currently, variables with names starting with "input_" are input variables and will show up in the dropdown menu for sensor nodes.

*Output Variables* These can be defined via live output nodes in the Dataflow Tile. Currently, variables with names starting with "output_" are output variables. A live output with a type matching the second part of the variable's name will automatically update its value on every tick of the dataflow program; a user doesn't need to explicitly connect the live output node to the variable for this to work. For example, a variable named "output_LightBulb" will automatically update with values from a "Light Bulb" live output node.