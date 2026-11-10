import {
  APIError,
  AuthenticationError,
  RateLimitError,
} from "@anthropic-ai/sdk";

import {
  DirectorError,
  DirectorInput,
  directReel,
} from "@/lib/admin/reel-director";
import { getAdminSession } from "@/lib/admin/session";

// The Studio's "Auto-sync with Claude": the browser sends the moments it
// found in a recording (timings, regions, small before/after stills) and
// gets back sound cues and a music brief. Admins only; anyone else gets a
// 404, like the panel's pages.
export const maxDuration = 120;

export const POST = async (request: Request) => {
  if (!(await getAdminSession())) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const parsed = DirectorInput.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return Response.json(
      { error: "The moments didn't come through. Try again." },
      { status: 400 }
    );
  }

  try {
    return Response.json(await directReel(parsed.data));
  } catch (error) {
    if (error instanceof DirectorError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof AuthenticationError) {
      return Response.json(
        { error: "ANTHROPIC_API_KEY is missing or invalid on the server." },
        { status: 500 }
      );
    }
    if (error instanceof RateLimitError) {
      return Response.json(
        { error: "Claude is rate-limited right now. Try again in a minute." },
        { status: 429 }
      );
    }
    if (error instanceof APIError) {
      return Response.json(
        { error: `Claude returned an error (${error.status ?? "network"}).` },
        { status: 502 }
      );
    }
    throw error;
  }
};
