export const showMcpDocs = true;

// The internal /docs-admin handbook is only reachable (and linked in the
// navbar) when `environment=development` is set in .env.
export const showDocsAdmin = process.env.environment === "development";

// Same gate for the /design-admin token + component showcase.
export const showDesignAdmin = process.env.environment === "development";
