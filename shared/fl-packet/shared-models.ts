// Content that is shared between tiles, and therefore cannot be stored inside any one of them,
// lives in a CLUE shared model. That is the whole rule, and it is why ForeverLearning's packet
// grew a shared_models[] array: a Table tile holds column widths while its rows live in a
// SharedDataSet, so without this a table with no data and a table whose data we could not
// transmit are indistinguishable.
//
// Tiles name these by model_id, many-to-many — the SharedVariables a simulator publishes are read
// by the Dataflow program beside it.
//
// None of this is a second copy of the ai-summarizer's work: that summarizer names a dataset
// without its rows, and describes a simulation from its static definition rather than from its
// live variables. Neither the rows nor the readings reach any AI today.

export type SharedModelType =
  "SharedDataSet" | "SharedVariables" | "SharedProgramData" | "SharedCaseMetadata";

export interface ProjectedSharedModel {
  model_id: string;
  type: SharedModelType;
  title?: string;
  content: Record<string, unknown>;
}

export interface ProjectSharedModelsResult {
  shared_models: ProjectedSharedModel[];
  // tile id -> the model ids that tile references, for tile.shared_model_ids
  tileModelIds: Record<string, string[]>;
}

export interface ProjectSharedModelsOptions {
  // A recorded Dataflow run writes a row per tick, so a dataset is the one shared model that grows
  // without bound. The default carries enough rows to show a trend without the packet becoming
  // mostly table.
  caseSampleSize?: number;
}

const kDefaultCaseSampleSize = 50;

// Labels that say what a variable is FOR. The rest — decimalPlaces, className, __volatile__ — are
// rendering hints, and they were most of the raw bulk.
function roleLabels(labels: unknown): string[] {
  if (!Array.isArray(labels)) return [];
  return labels.filter((l): l is string =>
    typeof l === "string" &&
    (l === "input" || l === "output" || l.startsWith("sensor:") || l.startsWith("live-output:")));
}

function projectVariables(model: any): Record<string, unknown> {
  const variables = (model.variables ?? []).map((v: any) => {
    const out: Record<string, unknown> = {
      id: String(v.id ?? ""),
      // The name a student sees, not the internal key — naming a thing to a learner by its
      // internal identifier reads wrong, and the same reasoning put titles in the graph summary.
      name: String(v.displayName ?? v.name ?? ""),
      value: v.value,
    };
    if (v.unit) out.unit = v.unit;
    const role = roleLabels(v.labels);
    if (role.length) out.role = role;
    return out;
  });
  return { variables };
}

function projectDataSet(model: any, sampleSize: number): {
  content: Record<string, unknown>; title?: string;
} {
  const ds = model.dataSet ?? {};
  const rawAttributes: any[] = ds.attributes ?? [];
  const attributes = rawAttributes.map(a => {
    const out: Record<string, unknown> = { id: String(a.id ?? ""), name: String(a.name ?? "") };
    if (a.units) out.units = a.units;
    return out;
  });

  // Values sit on the attributes as parallel arrays and `cases` holds the row identities, so a row
  // is a zip across the attributes.
  const caseCount = Array.isArray(ds.cases)
    ? ds.cases.length
    : rawAttributes.reduce((n, a) => Math.max(n, (a.values ?? []).length), 0);
  const take = Math.min(caseCount, sampleSize);
  const cases: Record<string, unknown>[] = [];
  for (let i = 0; i < take; i++) {
    const row: Record<string, unknown> = {};
    rawAttributes.forEach(a => { row[String(a.name ?? "")] = (a.values ?? [])[i]; });
    cases.push(row);
  }

  const content: Record<string, unknown> = { attributes, case_count: caseCount, cases };
  // Present only when true, so its absence is not a claim either way. case_count stays truthful
  // regardless, which is what makes the truncation visible rather than silent.
  if (take < caseCount) content.cases_truncated = true;
  return { content, title: ds.name ? String(ds.name) : undefined };
}

export function projectSharedModels(
  sharedModelMap: any, opts: ProjectSharedModelsOptions = {}
): ProjectSharedModelsResult {
  const sampleSize = opts.caseSampleSize ?? kDefaultCaseSampleSize;
  const shared_models: ProjectedSharedModel[] = [];
  const tileModelIds: Record<string, string[]> = {};

  for (const [key, entry] of Object.entries((sharedModelMap ?? {}) as Record<string, any>)) {
    const model = entry?.sharedModel;
    if (!model?.type) continue;
    const modelId = String(model.id ?? key);

    let content: Record<string, unknown> = {};
    let title: string | undefined;
    if (model.type === "SharedVariables") {
      content = projectVariables(model);
    } else if (model.type === "SharedDataSet") {
      ({ content, title } = projectDataSet(model, sampleSize));
    }
    // Other shared-model types carry nothing we know how to project yet. They are still worth
    // naming: a model a tile references but that we send empty is visibly different from one we
    // never mentioned at all.

    const projected: ProjectedSharedModel = { model_id: modelId, type: model.type, content };
    if (title !== undefined) projected.title = title;
    shared_models.push(projected);

    for (const tileId of (entry.tiles ?? []) as string[]) {
      (tileModelIds[tileId] ??= []).push(modelId);
    }
  }

  return { shared_models, tileModelIds };
}
