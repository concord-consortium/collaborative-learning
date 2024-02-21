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

    subgraph ram [Resolve app mode]
      direction TB

      subgraph db [DB Connect]
        direction TB

        unitLoadedPromise([unitLoadedPromise])

        fb(Firebase sign-in)
        fb --> nolisteners & listeners
        nolisteners{{Don't start listeners}}
        subgraph listeners [Start listeners]
          direction TB
          lgroup(Latest group)
          group(Groups)
          prob(Problem docs)
          pers(Personal docs)
          ll(Learning logs)
          pub(Publication)
          spd(Student personal docs)
          supl(Supports)
          lgroup --> group & prob & pers & ll & pub & spd & supl --> next
          next(First batch done)

          com(Comments)
          bm(Bookmarks)
          dc(Documents content)
          next --> com & bm & dc --> finish
          finish(All listeners done)
        end
      end
    end
    callAuthenticate --> ram

    %% LE.start: Loading current activity
    initializePersistentUISync
    %% LE.end: Loading current activity

    ram --> initializePersistentUISync
    unitLoadedPromise --> listeners
  end
  %% LE.end: Connecting

  %% LE.start: Joining group
  renderGroupChooser(Render group chooser)
  %% LE.end: Joining group

  renderApp --> renderGroupChooser
  authAndConnect --> renderGroupChooser

  renderAppContentComponent
  renderGroupChooser --> renderAppContentComponent

  primaryDocumentLoaded
  authAndConnect --> primaryDocumentLoaded

  %% LE.start: Building workspace
  renderDocumentWorkspaceComponentContent(show the real right side content)
  %% LE.end: Building workspace

  renderAppContentComponent --> renderDocumentWorkspaceComponentContent
  primaryDocumentLoaded --> renderDocumentWorkspaceComponentContent
