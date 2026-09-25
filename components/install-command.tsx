import { CodeBlockCommand } from "@/components/code-block-command";
import { SITE } from "@/constants/site";
import { cn } from "@/lib/utils";

// MDX `<InstallCommand name="status-badge" />`: the shadcn install command for
// a registry item, built from NEXT_PUBLIC_SITE_URL instead of a hard-coded
// domain.
export const InstallCommand = ({
  name,
  className,
}: {
  name: string;
  className?: string;
}) => {
  const args = `shadcn@latest add ${SITE.URL}/r/${name}.json`;

  return (
    <CodeBlockCommand
      className={cn("mt-6", className)}
      __npm__={`npx ${args}`}
      __yarn__={`yarn dlx ${args}`}
      __pnpm__={`pnpm dlx ${args}`}
      __bun__={`bunx --bun ${args}`}
    />
  );
};
