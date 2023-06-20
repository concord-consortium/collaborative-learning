# Shared Variables
`SharedVariables` is a type of `SharedModel` (see `shared-models.md`). Defined in `src/plugins/shared-variables/`, this model wraps an array of `Variable`s, which are defined in the `quantity-playground` repository and exported and imported via the `diagram-view` library.

## Basic Concept
`SharedVariables` is used to allow tiles to communicate to each other about variables and their relationships.

## Use Cases
Currently, there are two main use cases, with each case having a centerpiece tile.

### Case 1: User Defined Variables and the Diagram Tile
The first use case involves users defining their own variables and relationships between them. Here, the `SharedVariable` model generally starts empty, but is built up as the user creates new variables and then defines them in terms of each other.

#### Diagram Tile
The Diagram Tile is the centerpiece of this use case. It allows the user to easily create new variables, then define their relationships by linking independent variables to the dependent variables they influence.

Most of the Diagram Tile is defined in the `quantity-playground` repository and is exported and imported via the `diagram-view` library.

#### Text Tile
When set up properly in a curriculum's unit file, the Text Tile can include `VariableChip`s. These render as html elements that represent a variable and include its name, value, and unit, as available. `VariableChips` update automatically as a variable's name, value, and unit change.

Including `VariableChip`s in the Text Tile allows a student to write about variables and their relationships.

#### Drawing Tile
Much like the Text Tile, `VariableChip`s are available in the Drawing Tile when it is set up properly in the curriculum's unit file. See the `m2studio` unit file for an example of how to properly set this up.

#### Variable Dialogs
While users often use the Diagram Tile to create and modify variables, there are two dialogs which let users create and modify variables via the toolbars of Text and Drawing Tiles (when they are set up properly).

### Case 2: Simulations and the Simulator Tile
The second use case involves premade simulations, which users access through Simulator Tiles. Here, the `SharedVariable` model starts with built in variables defined by a developer, and the user generally does not add additional variables or directly modify variables. Instead, the user uses a Dataflow Tile to import data from certain variables, modifies the data via a dataflow program, then sends values to output variables.

#### Simulations
Simulations are at the heart of this use case. They are defined in the `src/plugins/simulator/simulation/` directory, and generally 

#### Simulator Tile
The Simulator Tile is a very thin tile with three main jobs. First, it loads a _simulation_ (see below), setting up its predefined variables in a `SharedVariable` model. Second, it runs the simulation, periodically updating the predifined variables. Finally, it uses one or more animations or graphics to display to the user the value of the variables.

The Simulator Tile is defined in `src/plugins/simulator/`.