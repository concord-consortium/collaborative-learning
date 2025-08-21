This is a very basic tile that can be used to start work on a new tile.

# Demo

This starter tile can be demo'd with these URL params:
`?demo&unit=example`

Look for the `St` tool, that is how you can add this tile to the document.

# Making a new tile based on this one

- You should copy the `starter` folder.
- rename all text `starter` and `Starter`
- rename all filenames with the word `starter` in them
- update `src/register-tile-types.ts` to import your new tile's registration module.
- to give your new tile basic icons open both `*-icon.svg` and `*-tile-id.svg` and change the `St` in the text element to a short string for your tile
