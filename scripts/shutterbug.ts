import fs from "fs";

function generateHtml(clueDocument: any) {
  return `
    <script>const initialValue=${JSON.stringify(clueDocument)}</script>
    <iframe id='clue-frame' width='100%' height='1500px' style='border:0px'
      allow='serial'
      src='https://collaborative-learning.concord.org/branch/shutterbug-support/cms-editor.html'
    ></iframe>
    <script>
      const clueFrame = document.getElementById('clue-frame')
      function sendInitialValueToEditor() {
        if (!clueFrame.contentWindow) {
          console.warning("iframe doesn't have contentWindow");
        }

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
  const fetchURL = "https://api.concord.org/shutterbug-production";
  console.log("Fetching", fetchURL);
  const response = await fetch(fetchURL,
    {
      method: "POST",
      body: JSON.stringify(body)
    }
  );
  const json = await response.json();
  console.log(json);
}

const fileName = process.argv[2];

const documentString = fs.readFileSync(fileName, "utf8");
const docObject = JSON.parse(documentString);
const html = generateHtml(docObject);

// uncomment this line if you want to generate a local html file
// this file can be opened in a web browser to see roughly what
// shutterbug is seeing.
// fs.writeFileSync("shutterbug.html", html);

// Note: you can also change the `.png` to `.html` on the end of the URL returned by shutterbug.
// This will give you the actual html that shutterbug sent to its internal browser

postToShutterbug({content: html, height: 1500});

// Example execution
// npx tsx shutterbug.ts /Users/scytacki/Development/ai/dataset1720819925834-mods/documents/document-NePawLNjq3wEjk58TiW.txt
