// Example executions:
//
// Generate image and print out the url of the image:
//   npx tsx shutterbug.ts /Users/scytacki/Development/ai/dataset1720819925834-mods/documents/document-NePawLNjq3wEjk58TiW.txt
//
// Generate shutterbug.html for checking page locally:
//   npx tsx shutterbug.ts /Users/scytacki/Development/ai/dataset1720819925834-mods/documents/document-NePawLNjq3wEjk58TiW.txt html
//
// Render with a specific unit (defaults to "mods"); pass "" as the second argument to skip the html output:
//   npx tsx shutterbug.ts /path/to/document.txt "" msa

import fs from "fs";

import { generateRenderHtml } from "../shared/render-page";

// The released CLUE build does not include a top-level iframe.html; the authoring-iframe entry
// point is built from the same source. Branch and local builds have iframe.html directly.
const clueIframePage = "https://collaborative-learning.concord.org/authoring-iframe/index.html";
// const clueIframePage = "http://localhost:8080/iframe.html";
// const clueIframePage = "https://collaborative-learning.concord.org/branch/master/iframe.html";

// const shutterbugServer = "https://api.concord.org/shutterbug-production";
// const shutterbugServer = "http://localhost:4000";
const shutterbugServer = "https://api.concord.org/shutterbug-staging";

// The page is built by the same generator the AI analysis pipeline and the harness use, so there
// is no copy here to drift. With the constants above left at their defaults it is production's
// page; what this script does differently is the Shutterbug server and the full-page capture in
// the request below.
function generateHtml(clueDocument: any, unit: string) {
  return generateRenderHtml({ content: clueDocument, clueUrl: clueIframePage, unit });
}

export async function postToShutterbug(body: any) {
  const response = await fetch(shutterbugServer,
    {
      method: "POST",
      body: JSON.stringify(body)
    }
  );
  const json = await response.json();
  console.log(json);
}

const fileName = process.argv[2];
const outputHtml = process.argv[3];
// Tile types are registered from the loaded unit, so the document renders correctly only with a
// unit whose toolbar lists every tile type it uses. Defaults to production's fallback unit.
const clueUnit = process.argv[4] || "mods";

const documentString = fs.readFileSync(fileName, "utf8");
const docObject = JSON.parse(documentString);
const html = generateHtml(docObject, clueUnit);

if (outputHtml) {
  fs.writeFileSync("shutterbug.html", html);
} else {
  postToShutterbug({content: html, height: 500, fullPage: true});
}
//

// Note: you can also change the `.png` to `.html` on the end of the URL returned by shutterbug.
// This will give you the actual html that shutterbug sent to its internal browser

