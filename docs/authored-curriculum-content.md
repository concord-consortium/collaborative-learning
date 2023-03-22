# Authored Curriculumn Content
Authored curriculum content was originally part of the CLUE code repository. The curriculum content files were located at src/public/curriculum.

In 2023, curriculum content was split off into its own repository named clue-curriculum. CLUE now imports most authored content from this external repository, the deployed version of which is located at https://models-resources.concord.org/clue-curriculum.

## File structure of authored curriculum content
In the clue-curriculum repository, each unit's files are located in a subdirectory whose name matches the unit's unit code. For example, the Stretching and Shrinking unit's code is `sas`, and its subdirectory is named `sas`. The unit code value is defined in the root content.json file in each unit subdirectory.

Each unit is made up of a number of investigations that each have a number of problems, and each problem has a number of sections. The content for these problem sections is located in separate files in the unit's subdirectory. The root content.json file contains information about these separate problem section files which CLUE uses to import the content when loading a curriculum unit.

## Loading curriculum content in CLUE
To load a specific curriculum unit's content into CLUE, we set the `unit` URL param value to that unit's unit code. For example, to load the Stretching and Shrinking unit, whose code is `sas`, append `?unit=sas` to the CLUE URL.

In addition to unit codes, you can also use full URLs as the `unit` param's value. For example, appending `?unit=https://models-resources.concord.org/clue-curriculum/branch/my-changes/sas/content.json` to a CLUE URL would load the version of Stretching and Shrinking that exists in a clue-curriculum branch named `my-changes`.

Fetching of curriculum unit content data from the external repository is done by the `getUnitJson` function defined in src/models/curriculum/unit.ts and called from src/models/stores/stores.ts.

### Teacher guides
Curriculum units may or may not have accompanying teacher guides. If a unit has a teacher guide and the CLUE user is a teacher, the teacher guide content data is fetched by the `getGuideJson` function defined in src/models/curriculum/unit.ts and called from src/models/stores/stores.ts.

### Images in unit content
Curriculum content usually contains images. The related image files exist in subdirectories of each unit's directory. The files are referenced within the unit content files using relative URLs. Since the curriculum content exists in an external repository, CLUE needs to convert these relative URLs to absolute URLS. For more information about that process, see images.md and image-map.md.
