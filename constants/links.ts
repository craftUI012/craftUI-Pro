export const GITHUB = {
  branch: "main",
  org: "craftUI012",
  repo: "craftUI-Pro",
  user: "craftUI012",
} as const;

const githubUrl = `https://github.com/${GITHUB.org}/${GITHUB.repo}`;

export const LINK = {
  GITHUB: githubUrl,
  GITHUB_ORG: `https://github.com/${GITHUB.org}`,
  LICENSE: `${githubUrl}/blob/${GITHUB.branch}/LICENSE`,
  SHADCN_MCP_DOCS: "https://ui.shadcn.com/docs/mcp",
  SPONSOR: `https://github.com/sponsors/${GITHUB.user}`,
} as const;
