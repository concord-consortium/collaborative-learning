import { resolve } from "path";
import { readFileSync } from "fs";
import { createGenerator } from "ts-json-schema-generator";

const schemaPath = resolve(__dirname, "../../src/public/schemas/seismic-model/v1.json");
const typesPath = resolve(__dirname, "seismic-model-types.ts");

describe("ModelMetadata JSON Schema", () => {
  it("checked-in schema matches the TypeScript ModelMetadata interface", () => {
    const checkedIn = JSON.parse(readFileSync(schemaPath, "utf-8"));

    const generated = createGenerator({
      path: typesPath,
      type: "ModelMetadata",
      tsconfig: resolve(__dirname, "../../tsconfig.json"),
      additionalProperties: true,
    }).createSchema("ModelMetadata");

    expect(generated).toEqual(checkedIn);
  });
});
