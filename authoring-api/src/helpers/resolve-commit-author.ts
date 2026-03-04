import {Octokit} from "@octokit/rest";

interface CommitAuthor {
  name: string;
  email: string;
}

/**
 * Resolve the Git commit author from a Firebase decoded token, falling back to the GitHub API
 * when the token is missing name or email (which depends on the user's GitHub profile settings).
 */
export async function resolveCommitAuthor(
  decodedToken: { name?: string; email?: string } | undefined,
  octokit: Octokit
): Promise<CommitAuthor | undefined> {
  let name = decodedToken?.name;
  let email = decodedToken?.email;

  if (!name || !email) {
    try {
      const {data: ghUser} = await octokit.rest.users.getAuthenticated();
      name = name || ghUser.name || ghUser.login;
      email = email || ghUser.email || `${ghUser.login}@users.noreply.github.com`;
    } catch (e) {
      console.error("Failed to fetch GitHub user info for commit author:", e);
    }
  }

  return name && email ? {name, email} : undefined;
}
