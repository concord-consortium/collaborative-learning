import {resolveCommitAuthor} from "./resolve-commit-author";

// Minimal mock matching the Octokit shape used by resolveCommitAuthor
function mockOctokit(userData: {name?: string | null; email?: string | null; login: string}) {
  return {
    rest: {
      users: {
        getAuthenticated: jest.fn().mockResolvedValue({data: userData}),
      },
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function failingOctokit() {
  return {
    rest: {
      users: {
        getAuthenticated: jest.fn().mockRejectedValue(new Error("API error")),
      },
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("resolveCommitAuthor", () => {
  it("returns token name and email when both are present", async () => {
    const octokit = mockOctokit({name: "GH User", email: "gh@example.com", login: "ghuser"});
    const result = await resolveCommitAuthor({name: "Token User", email: "token@example.com"}, octokit);
    expect(result).toEqual({name: "Token User", email: "token@example.com"});
    expect(octokit.rest.users.getAuthenticated).not.toHaveBeenCalled();
  });

  it("falls back to GitHub API when token is missing name", async () => {
    const octokit = mockOctokit({name: "GH User", email: "gh@example.com", login: "ghuser"});
    const result = await resolveCommitAuthor({email: "token@example.com"}, octokit);
    expect(result).toEqual({name: "GH User", email: "token@example.com"});
  });

  it("falls back to GitHub API when token is missing email", async () => {
    const octokit = mockOctokit({name: "GH User", email: "gh@example.com", login: "ghuser"});
    const result = await resolveCommitAuthor({name: "Token User"}, octokit);
    expect(result).toEqual({name: "Token User", email: "gh@example.com"});
  });

  it("falls back to GitHub API when token is missing both", async () => {
    const octokit = mockOctokit({name: "GH User", email: "gh@example.com", login: "ghuser"});
    const result = await resolveCommitAuthor({}, octokit);
    expect(result).toEqual({name: "GH User", email: "gh@example.com"});
  });

  it("uses GitHub login as name fallback when GitHub name is null", async () => {
    const octokit = mockOctokit({name: null, email: "gh@example.com", login: "ghuser"});
    const result = await resolveCommitAuthor({}, octokit);
    expect(result).toEqual({name: "ghuser", email: "gh@example.com"});
  });

  it("uses noreply email fallback when GitHub email is null", async () => {
    const octokit = mockOctokit({name: "GH User", email: null, login: "ghuser"});
    const result = await resolveCommitAuthor({}, octokit);
    expect(result).toEqual({name: "GH User", email: "ghuser@users.noreply.github.com"});
  });

  it("returns undefined when GitHub API fails and token has no info", async () => {
    const octokit = failingOctokit();
    const result = await resolveCommitAuthor({}, octokit);
    expect(result).toBeUndefined();
  });

  it("handles undefined decodedToken", async () => {
    const octokit = mockOctokit({name: "GH User", email: "gh@example.com", login: "ghuser"});
    const result = await resolveCommitAuthor(undefined, octokit);
    expect(result).toEqual({name: "GH User", email: "gh@example.com"});
  });
});
