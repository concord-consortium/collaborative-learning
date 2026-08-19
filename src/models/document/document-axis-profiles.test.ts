import { typecheck } from "mobx-state-tree";
import { DocumentMetadataModel } from "./document-metadata-model";
import {
  kClassWideProfile, kDocumentAxisProfiles, kGroupProfile, kPersonalLikeProfile, kProblemLikeProfile
} from "./document-axis-profiles";

describe("document axis profiles", () => {
  it("lists every profile, each with a distinct name", () => {
    // The stored name identifies a document's cohort for migrations, so two profiles sharing one would
    // merge cohorts that are not the same set of documents.
    const names = kDocumentAxisProfiles.map(p => p.name);
    expect(names).toEqual(["problemLike", "personalLike", "group", "classWide"]);
    expect(new Set(names).size).toBe(names.length);
  });

  it("pins each profile's position on the axes", () => {
    // These are the axis combinations the application creates documents at. A change here changes what
    // some existing document means, so it should be a deliberate edit with a migration behind it.
    expect(kProblemLikeProfile).toEqual({
      name: "problemLike", ownerType: "user", containerType: "offering"
    });
    expect(kPersonalLikeProfile).toEqual({
      name: "personalLike", ownerType: "user", containerType: "class"
    });
    expect(kGroupProfile).toEqual({
      name: "group", ownerType: "group", containerType: "offering", concurrent: true
    });
    expect(kClassWideProfile).toEqual({
      name: "classWide", ownerType: "class", containerType: "classUnit", concurrent: true
    });
  });

  it("does not reach the runtime metadata model", () => {
    // `axisProfile` is stamped into Firestore but declared on no runtime type, so the running app cannot
    // read it and cannot come to depend on it. DocumentMetadataStore validates raw Firestore data against
    // this model, so the field has to survive validation while staying undeclared.
    expect(() => typecheck(DocumentMetadataModel, {
      uid: "class_c1", type: "group", key: "dqb-1", axisProfile: "classWide"
    } as any)).not.toThrow();
    expect(DocumentMetadataModel.create({ uid: "class_c1", type: "group", key: "dqb-1" }))
      .not.toHaveProperty("axisProfile");
  });
});
