import type { Metadata } from "next";

import { ROUTES } from "@/constants/routes";
import { createPageMetadata } from "@/seo/metadata";

// The login page is a client component, so its metadata lives here. Kept out
// of search results: it's a form, not content.
export const metadata: Metadata = createPageMetadata({
  description: "Sign in to craftUI with a magic link.",
  noIndex: true,
  path: ROUTES.LOGIN,
  title: "Sign in",
});

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
