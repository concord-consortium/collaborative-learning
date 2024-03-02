/*
  Parameters for development:

  &demoName=Joe2
  &fakeClass=1
  &fakeUser=student:3
  &problem=1.1
  &unit=mothed
  &curriculumBranch=exemplar-3
*/

export function createExemplarDocs(problem: any, documentStore: any){
  const { exemplarsFromSnapshot: exemplarUrls } = problem;
  console.log("| exemplar urls to load and turn into documents in store | ", exemplarUrls);
}
