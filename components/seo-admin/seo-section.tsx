import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";

// A titled block of /seo-admin, laid out like the design admin's kit
// sections: index, heading-section title, one-line description.
export const SeoSection = ({
  aside,
  children,
  description,
  id,
  index,
  title,
}: {
  aside?: React.ReactNode;
  children: React.ReactNode;
  description: React.ReactNode;
  id: string;
  index: string;
  title: string;
}) => (
  <section id={id} className="flex scroll-mt-20 flex-col gap-6">
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div className="flex flex-col gap-1">
        <span
          className={cn(
            TYPE.cardCaption,
            "text-muted-foreground font-mono tabular-nums"
          )}
        >
          {index}
        </span>
        <h2 className={cn(TYPE.headingSection, "text-balance")}>{title}</h2>
        <p
          className={cn(
            TYPE.cardBody,
            "text-muted-foreground max-w-2xl text-pretty"
          )}
        >
          {description}
        </p>
      </div>
      {aside}
    </div>
    {children}
  </section>
);

// Raw file contents (robots.txt, the manifest, JSON-LD), scrollable.
export const SeoCode = ({
  children,
  className,
}: {
  children: string;
  className?: string;
}) => (
  <pre
    className={cn(
      TYPE.cardCaption,
      "bg-muted/50 max-h-96 overflow-auto rounded-lg border p-4 font-mono whitespace-pre",
      className
    )}
  >
    {children}
  </pre>
);
