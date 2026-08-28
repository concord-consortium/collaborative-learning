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

import { escapeHtmlAttribute, escapeJsonForScript } from "../shared/escape-for-html";

// The released CLUE build does not include a top-level iframe.html; the authoring-iframe entry
// point is built from the same source. Branch and local builds have iframe.html directly.
const clueIframePage = "https://collaborative-learning.concord.org/authoring-iframe/index.html";
// const clueIframePage = "http://localhost:8080/iframe.html";
// const clueIframePage = "https://collaborative-learning.concord.org/branch/master/iframe.html";

// const shutterbugServer = "https://api.concord.org/shutterbug-production";
// const shutterbugServer = "http://localhost:4000";
const shutterbugServer = "https://api.concord.org/shutterbug-staging";

// This page is a near-copy of generateHtml in functions-v2/src/on-analysis-document-pending.ts,
// which is the one the AI analysis pipeline actually uses. They are separate because this script
// targets a different CLUE build and Shutterbug server and asks for a full-page capture. Keep
// fixes to one in step with the other until they are unified.
function generateHtml(clueDocument: any, unit: string) {
  const source = escapeHtmlAttribute(
    `${clueIframePage}?unit=${encodeURIComponent(unit)}&unwrapped&readOnly`);
  return `
    <script>const initialValue=${escapeJsonForScript(JSON.stringify(clueDocument))}</script>
    <!-- height will be updated when iframe sends updateHeight message -->
    <iframe id='clue-frame' width='100%' height='500px' style='border:0px'
      allow='serial'
      src="${source}"
    ></iframe>
    <script>
      const clueFrame = document.getElementById('clue-frame')
      function sendInitialValueToEditor() {
        if (!clueFrame.contentWindow) {
          console.warn("iframe doesn't have contentWindow");
          return;
        }

        window.addEventListener("message", (event) => {
          if (event.data?.type === "updateHeight") {
            // A height of 0, or anything that is not a positive number, would collapse the
            // iframe and hide the document the screenshot is meant to show.
            const height = event.data.height;
            if (!Number.isFinite(height) || height <= 0) return;
            document.getElementById("clue-frame").height = height + "px";
          }
        })

        clueFrame.contentWindow.postMessage(
          { initialValue: JSON.stringify(initialValue) },
          "*"
        );
      }
      clueFrame.addEventListener('load', sendInitialValueToEditor);
    </script>
  `;
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

