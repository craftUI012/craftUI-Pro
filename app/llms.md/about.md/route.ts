import { aboutMarkdown } from "@/lib/agent-discovery/pages";
import { requestOrigin } from "@/lib/agent-discovery/request-origin";
import { markdownResponse } from "@/lib/api";

// The about page as Markdown, for AI agents (see proxy.ts).

export const revalidate = false;

export const GET = (request: Request) =>
  markdownResponse(aboutMarkdown(requestOrigin(request)), true);

export const HEAD = (request: Request) =>
  markdownResponse(aboutMarkdown(requestOrigin(request)), false);
