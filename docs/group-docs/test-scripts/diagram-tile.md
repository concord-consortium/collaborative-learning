# Diagram Tile — Test Scripts

See [README.md](README.md) for the single-person testing technique and reporting guidelines.

The diagram tile's variable references are a `types.reference`, so concurrent variable deletions cause the tile to crash on next render. That case lives in [shared-variables.md script 2](shared-variables.md) since it's primarily about the SharedVariables lifecycle.
