# cms-config

I want to preserve the comments in the original config for now:

```ts
// cms-config.ts

// Config for Decap CMS
const cmsConfig: CmsConfig = {
  load_config_file: false,
  ...cmsBackend(),
  media_folder: urlParams.unit ? `curriculum/${urlParams.unit}/images` : `curriculum/images`,
  // The public_folder setting doesn't apply to the top level "Media" dialog.
  // It is configured here for documentation, and in case we start using
  // the media api within out CLUE editor
  public_folder: urlParams.unit ? `${urlParams.unit}/images` : `images`,
  collections: [
    {
      name: "sections",
      label: "Curriculum Sections",
      label_singular: "Curriculum Section",
      identifier_field: "type",
      format: "json",
      folder: urlParams.unit ? `curriculum/${urlParams.unit}` : `curriculum`,
      // create: true
      // adding a nested object will show the collection folder structure
      nested: {
        depth: 6, // max depth to show in the collection tree
      },
      fields: [
        {
          label: "Type",
          name: "type",
          widget: "string"
        },
        {
          label: "Preview Link",
          name: "preview-link",
          required: false,
          widget: "preview-link"
        } as CmsField,
        {
          label: "Content",
          name: "content",
          widget: "clue" as any
        }
      ],
      // adding a meta object with a path property allows editing the path of entries
      // moving an existing entry will move the entire sub tree of the entry to the new location
      // However, this causes the path to be lowercased when publishing an entry.
      // meta: { path: { widget: "hidden", label: "Path", index_file: "content" } }
    }
  ]
};

```
