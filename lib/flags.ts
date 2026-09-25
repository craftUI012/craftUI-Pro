export const showMcpDocs = true;

// The internal /docs-admin handbook is only reachable (and linked in the
// navbar) when `environment=development` is set in .env.
export const showDocsAdmin = process.env.environment === "development";
