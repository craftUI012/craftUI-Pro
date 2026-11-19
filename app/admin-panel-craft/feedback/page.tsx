import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listFeedback } from "@/lib/admin/data";
import { formatDateTime } from "@/lib/admin/format";
import { requireAdminPage } from "@/lib/admin/session";
import { OPINIONS, WANT_MORE, feedbackLabel } from "@/lib/feedback";

const TRIGGER_LABEL = {
  exit_intent: "Leaving the page",
  returned_from_checkout: "Back from checkout",
} as const;

// One question's options with how many answers picked each, most first.
const Tally = ({
  counts,
  options,
  title,
}: {
  counts: Record<string, number>;
  options: readonly { label: string; value: string }[];
  title: string;
}) => {
  const sorted = [...options].toSorted(
    (a, b) => (counts[b.value] ?? 0) - (counts[a.value] ?? 0)
  );
  return (
    <Card className="gap-3 px-5 py-4">
      <h2 className="text-sm font-medium">{title}</h2>
      <ul className="flex flex-col gap-2">
        {sorted.map((option) => (
          <li
            key={option.value}
            className="flex items-center justify-between gap-4 text-sm"
          >
            <span>{option.label}</span>
            <span className="text-muted-foreground tabular-nums">
              {counts[option.value] ?? 0}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
};

const Answers = ({ values }: { values: string[] }) =>
  values.length > 0 ? (
    <div className="flex flex-wrap gap-1">
      {values.map((value) => (
        <Badge key={value} variant="secondary">
          {feedbackLabel(value)}
        </Badge>
      ))}
    </div>
  ) : (
    <span className="text-muted-foreground">None</span>
  );

// The pricing page's exit survey (components/pricing-survey.tsx): how often
// each answer was picked, then every answer, newest first.
const AdminFeedbackPage = async () => {
  await requireAdminPage();
  const { opinionCounts, rows, total, wantCounts, withEmail } =
    await listFeedback();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Feedback</h1>
        <p className="text-muted-foreground text-sm">
          Answers to the pricing page's exit survey, from signed-out visitors
          who left without paying. {total} answers, {withEmail} with an email.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Tally
          title="What they want more of"
          options={WANT_MORE}
          counts={wantCounts}
        />
        <Tally
          title="What they think of the library"
          options={OPINIONS}
          counts={opinionCounts}
        />
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Shown on</TableHead>
              <TableHead>Wants more</TableHead>
              <TableHead>Thinks</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Country</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground py-10 text-center"
                >
                  No answers yet. They appear here as visitors send them.
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((row) => (
              <TableRow key={row._id}>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {formatDateTime(row.createdAt)}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {TRIGGER_LABEL[row.trigger] ?? row.trigger}
                </TableCell>
                <TableCell>
                  <Answers values={row.wantMore} />
                </TableCell>
                <TableCell>
                  <Answers values={row.opinion} />
                </TableCell>
                <TableCell>
                  {row.email ? (
                    <a
                      href={`mailto:${row.email}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {row.email}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.country ?? "Unknown"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default AdminFeedbackPage;
