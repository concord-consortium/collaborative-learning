import "./dot-env.js";

export async function fetchOffering(portal: string, offeringId: string) {
  const accessToken = process.env.PORTAL_ACCESS_TOKEN;
  const fetchURL = `${portal}/api/v1/offerings/${offeringId}`;
  console.log("Fetching", fetchURL);
  const response = await fetch(fetchURL,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );
  const json = await response.json();
  if ('success' in json && !json.success) {
    throw new Error("Failed to fetch offering", {cause: json});
  }
  return json;
}
