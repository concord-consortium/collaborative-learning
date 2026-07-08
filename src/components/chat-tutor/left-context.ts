import { ProblemModelType } from "../../models/curriculum/problem";

// Serializes the whole problem as structured JSON. Each section's exportAsJson()
// returns a JSON string, so each is parsed into the wrapper and the wrapper is
// stringified once — concatenating the section strings would be invalid JSON.
// Callers must not build LEFT until the problem's sections have loaded
// (problem.sections is a volatile array populated asynchronously).
export function buildLeftContext(problem: ProblemModelType): string {
  const sections = problem.sections
    .filter(section => !!section.content)
    .map(section => ({
      type: section.type,
      title: section.title,
      content: JSON.parse(section.content!.exportAsJson())
    }));
  return JSON.stringify({ sections });
}

export function problemSectionsLoaded(problem: ProblemModelType): boolean {
  return problem.sections.length > 0;
}
