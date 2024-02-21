# CLUE Startup sequence

Look at the diagram source to see the loading events

```mermaid
flowchart TB

  req(Browser requests index.html)
  req --> parse

  %% LE.start: Loading the application
  parse(Load and parse core Javascript)
  parse --> indextsx
  %% LE.end: Loading the application

  %% LE.start: Initializing
  indextsx("Runs React (index.tsx)")
  indextsx --> ia
  ia("initializeAuthorization (OAuth2)")
  restart{{may redirect}}
  ia -.-> restart
  ia --> cs
  cs(Create stores)
  %% LE.end: Initializing

  component("Create app component")
  cs --> component

  callLoadUnitProblem1{{"call loadUnitProblem"}}
  cs --"if != auth or unit param"--> callLoadUnitProblem1

  component --> authAndConnect
  component --> renderApp
  renderApp(RenderApp)

  %% LE.start: Connecting
  subgraph authAndConnect [AuthAndConnect]
    direction TB

    callAuthenticate{{"call authenticate"}}

    callLoadUnitProblem2{{"call loadUnitProblem"}}
    callAuthenticate --"if not started loading"--> callLoadUnitProblem2
  end
