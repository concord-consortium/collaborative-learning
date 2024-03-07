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

  subgraph loadUnitProblem [Load unit and problem]
    direction TB

    %% LE.start: Loading curriculum unit
    unit(Get unit JSON)
    unit --> tiles
    unit --> sections
    %% LE.end: Loading curriculum uit

    %% LE.start: Setting up curriculum content
    %% LE.start: Loading tile types
    tiles("Register tile types")
    tiles --> resolveUnitLoadedPromise
    tiles --> configStores
    %% LE.end: Loading tile types

    %% LE.start: Loading curriculum sections
    sections("Load active sections JSON")
    sections --> resolveSectionsLoadedPromise([resolve sectionsLoadedPromise])
    %% LE.end: Loading curriculum sections

    resolveUnitLoadedPromise([resolve unitLoadedPromise])

    configStores(Configure some stores)
    %% LE.end: Setting up curriculum content (this does not wait for sections)
  end

  %% some invisible links to get the layout to be more compact
  req ~~~ loadUnitProblem
  loadUnitProblem ~~~ authenticate

  subgraph authenticate [Authenticate]
    direction TB
    type{{appMode}}
    type -- demo/qa/dev --> demo
    type -- auth --> real1
    demo(Returns fake auth)
    real1(Fetch JWT from portal) --> real2(Get class info)
    real3(Get Firebase JWT)
    real4(Get portal offerings)
    real5(Get offering problem ID)
    real2 --> real3 & real4 & real5 --> real6
    real6(Return real auth)
  end

  %% LE.start: Connecting
  subgraph authAndConnect [AuthAndConnect]
    direction TB

    callAuthenticate{{"call authenticate"}}

    callLoadUnitProblem2{{"call loadUnitProblem"}}
    callAuthenticate --"if not started loading"--> callLoadUnitProblem2
    callLoadUnitProblem2 ~~~ ram

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

  sectionsLoadedPromise([sectionsLoadedPromise])
  %% fake link just to improve the layout
  authAndConnect ~~~ sectionsLoadedPromise

  sectionsLoadedPromise --> guaranteeInitialDocuments
  guaranteeInitialDocuments("if necessary create problem, learningLog, and planning docs")

  primaryDocumentLoaded
  authAndConnect --> primaryDocumentLoaded
  guaranteeInitialDocuments --> primaryDocumentLoaded

  %% LE.start: Building workspace
  renderDocumentWorkspaceComponentContent(show the real right side content)
  %% LE.end: Building workspace

  renderAppContentComponent --> renderDocumentWorkspaceComponentContent
  primaryDocumentLoaded --> renderDocumentWorkspaceComponentContent

```
