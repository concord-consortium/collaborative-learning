# Simplified sequence

This diagram is somewhat abstract, showing only things that conceptually need to be complete before other steps can move forward.  Some boxes are represent multiple concurrent events. Examples are "JWTs for portal and firebase" and "Start listeners".


```mermaid
flowchart TD
%%{init: {"flowchart": {"defaultRenderer": "elk"}} }%%

  req(Load and render index.html)
  req --> load

  load(Load main JS, start React)
  load --> component
  load --> jwts
  load -- if not authed --> oauth
  load -. if student .-> unit

  oauth(OAuth2 redirect and restart)
  oauth -.-> req

  jwts(Get JWTs for portal and firebase)
  jwts --> portal
  jwts --> firebase

  firebase(Connect Firebase)
  firebase --> listeners
  firebase --> ui
  firebase --> group

  portal(Get portal info)
  portal -. if teacher .-> unit
  portal --> group

  unit(Get unit JSON)
  unit --> tiles
  unit --> problem

  component(Create app component)
  component --> group

  listeners[Start listeners]
  listeners --> tabs
  listeners --> work

  group(Join group or show group chooser)
  group ---> work

  tiles(Load tile types)
  tiles --> problem
  tiles --> work
  tiles --> tabs

  ui(Get persistent UI)
  ui --> problem
  ui --> tabs
  ui --> work

  problem(Render problem)

  tabs(Render other left-side content)

  work("Render workspace (right side)")

```
