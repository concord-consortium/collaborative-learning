// Content that is shared between tiles, and therefore cannot be stored inside any one of them,
// lives in a CLUE shared model. That is the whole rule, and it is why ForeverLearning's packet
// grew a shared_models[] array: a Table tile holds column widths while its rows live in a
// SharedDataSet, so without this a table with no data and a table whose data we could not
// transmit are indistinguishable.
//
// Tiles name these by model_id, many-to-many — the SharedVariables a simulator publishes are read
// by the Dataflow program beside it.
//
// Extraction is the ai-summarizer's normalize(), not a second copy of it: normalize() already
// reads both shared model types this understands, and teaching it the rest benefits every AI
// consumer rather than this one. What is left here is projection — choosing what a diagnostic
// reader needs and dropping the rest.

import {
  NormalizedDataSet, NormalizedModel, NormalizedVariable, SharedModelMapEntry
} from "../ai-summarizer/ai-summarizer-types";

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

// Labels that say what a variable is FOR. normalize() passes every label through, because which
// ones matter is the consumer's call; here the rest — decimalPlaces, className, __volatile__ — are
// rendering hints, and they were most of the raw bulk.
function roleLabels(labels: string[] | undefined): string[] {
  if (!Array.isArray(labels)) return [];
  return labels.filter(l =>
    typeof l === "string" &&
    (l === "input" || l === "output" || l.startsWith("sensor:") || l.startsWith("live-output:")));
}

function projectVariables(vars: NormalizedVariable[]): Record<string, unknown> {
  const variables = vars.map(v => {
    const out: Record<string, unknown> = {
      id: v.id,
      // The name a student sees, not the internal key — naming a thing to a learner by its
      // internal identifier reads wrong, and the same reasoning put titles in the graph summary.
      name: v.displayName ?? v.name ?? "",
      value: v.value,
    };
    if (v.unit) out.unit = v.unit;
    const role = roleLabels(v.labels);
    if (role.length) out.role = role;
    return out;
  });
  return { variables };
}

function projectDataSet(ds: NormalizedDataSet, sampleSize: number): {
  content: Record<string, unknown>; title?: string;
} {
  const attributes = ds.attributes.map(a => {
    const out: Record<string, unknown> = { id: a.id, name: a.name };
    if (a.units) out.units = a.units;
    if (a.formula) out.formula = a.formula;
    return out;
  });

  // normalize() zips the attributes' parallel value arrays into positional rows; a reader with no
  // column order needs them named.
  const take = Math.min(ds.numCases, sampleSize);
  const cases = ds.data.slice(0, take).map(row => {
    const out: Record<string, unknown> = {};
    ds.attributes.forEach((a, i) => { out[a.name] = row[i]; });
    return out;
  });

  const content: Record<string, unknown> = { attributes, case_count: ds.numCases, cases };
  // Present only when true, so its absence is not a claim either way. case_count stays truthful
  // regardless, which is what makes the truncation visible rather than silent.
  if (take < ds.numCases) content.cases_truncated = true;
  return { content, title: ds.name || undefined };
}

/**
 * Projects the shared models of one document.
 *
 * `normalized` supplies the content, but the raw `sharedModelMap` is what we walk: normalize()
 * understands two of the four shared model types, and a model a tile references that we send empty
 * is visibly different from one we never mentioned at all.
 */
export function projectSharedModels(
  normalized: NormalizedModel, sharedModelMap: unknown, opts: ProjectSharedModelsOptions = {}
): ProjectSharedModelsResult {
  const sampleSize = opts.caseSampleSize ?? kDefaultCaseSampleSize;
  const shared_models: ProjectedSharedModel[] = [];
  const tileModelIds: Record<string, string[]> = {};

  const dataSetsByKey = new Map<string, NormalizedDataSet>();
  normalized.dataSets.forEach(ds => {
    if (ds.sharedDataSetId) dataSetsByKey.set(ds.sharedDataSetId, ds);
  });
  const varsByModel = new Map<string, NormalizedVariable[]>();
  normalized.variables.forEach(v => {
    if (!v.sharedModelId) return;
    const list = varsByModel.get(v.sharedModelId) ?? [];
    list.push(v);
    varsByModel.set(v.sharedModelId, list);
  });

  const entries = Object.entries((sharedModelMap ?? {}) as Record<string, SharedModelMapEntry>);
  for (const [key, entry] of entries) {
    const model = entry?.sharedModel;
    if (!model?.type) continue;
    const modelId = model.id ?? key;

    let content: Record<string, unknown> = {};
    let title: string | undefined;
    if (model.type === "SharedVariables") {
      content = projectVariables(varsByModel.get(modelId) ?? []);
    } else if (model.type === "SharedDataSet") {
      const ds = dataSetsByKey.get(key);
      if (ds) ({ content, title } = projectDataSet(ds, sampleSize));
    }
    // Other shared-model types carry nothing we know how to project yet. They are still worth
    // naming, per the doc comment above.

    const projected: ProjectedSharedModel = {
      model_id: modelId, type: model.type as SharedModelType, content
    };
    if (title !== undefined) projected.title = title;
    shared_models.push(projected);

    for (const tileId of entry.tiles ?? []) {
      (tileModelIds[tileId] ??= []).push(modelId);
    }
  }

  return { shared_models, tileModelIds };
}
