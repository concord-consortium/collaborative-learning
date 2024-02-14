```mermaid
flowchart TD
  req(Browser requests index.html)
  req --> load

  style load fill:#220000
  subgraph load [LE: Loading the application]
    direction TB
    parse(Load and parse core Javascript)
  end
  load --> init

```
