import "./dot-env.js";

async function fetchPortalEntity(portal: string, entityType: string, resourceId: string) {
  const accessToken = process.env.PORTAL_ACCESS_TOKEN;
  const fetchURL = `${portal}/api/v1/${entityType}/${resourceId}`;
  console.log("Fetching", fetchURL);
  const response = await fetch(fetchURL,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );
  const json = await response.json();
  if ("success" in json && !json.success) {
    throw new Error(`Failed to fetch ${entityType}`, {cause: json});
  }
  return json;
}

export async function fetchPortalOffering(portal: string, offeringId: string) {
  return fetchPortalEntity(portal, "offerings", offeringId);
}

export async function fetchPortalClass(portal: string, classId: string) {
  return fetchPortalEntity(portal, "classes", classId);
}
