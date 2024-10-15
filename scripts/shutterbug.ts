// Example executions:
//
// Generate image and print out the url of the image:
//   npx tsx shutterbug.ts /Users/scytacki/Development/ai/dataset1720819925834-mods/documents/document-NePawLNjq3wEjk58TiW.txt
//
// Generate shutterbug.html for checking page locally:
//   npx tsx shutterbug.ts /Users/scytacki/Development/ai/dataset1720819925834-mods/documents/document-NePawLNjq3wEjk58TiW.txt html

import fs from "fs";

const clueCodebase = "https://collaborative-learning.concord.org/branch/shutterbug-support";
// const clueCodebase = "http://localhost:8080";
// const clueCodebase = "https://reimagined-journey-v6q9774jwh6pr4-4000.app.github.dev/";

// const shutterbugServer = "https://api.concord.org/shutterbug-production";
// const shutterbugServer = "http://localhost:4000";
const shutterbugServer = "https://api.concord.org/shutterbug-staging";

function generateHtml(clueDocument: any) {
  return `
    <script>const initialValue=${JSON.stringify(clueDocument)}</script>
    <!-- height will be updated when iframe sends updateHeight message -->
    <iframe id='clue-frame' width='100%' height='500px' style='border:0px'
      allow='serial'
      src='${clueCodebase}/iframe.html?unwrapped&readOnly'
    ></iframe>
    <script>
      const clueFrame = document.getElementById('clue-frame')
      function sendInitialValueToEditor() {
        if (!clueFrame.contentWindow) {
          console.warning("iframe doesn't have contentWindow");
        }

        window.addEventListener("message", (event) => {
          if (event.data.type === "updateHeight") {
            document.getElementById("clue-frame").height = event.data.height + "px";
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

const documentString = fs.readFileSync(fileName, "utf8");
const docObject = JSON.parse(documentString);
const html = generateHtml(docObject);

if (outputHtml) {
  fs.writeFileSync("shutterbug.html", html);
} else {
  postToShutterbug({content: html, height: 500, fullPage: true});
}
//

// Note: you can also change the `.png` to `.html` on the end of the URL returned by shutterbug.
// This will give you the actual html that shutterbug sent to its internal browser

