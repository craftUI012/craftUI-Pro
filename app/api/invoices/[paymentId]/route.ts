import { NotFoundError } from "dodopayments";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { ownsPayment } from "@/lib/billing/account";
import { getDodo, isDodoConfigured } from "@/lib/dodo";

// A payment's invoice PDF, from Dodo, for the user it belongs to (the
// dashboard's Download buttons). Checks the session and that the payment was
// charged to one of the user's Dodo customers, so nobody can fetch someone
// else's invoice by guessing an ID.
//
// 401 signed out, 404 not theirs or no such payment, 503 Dodo not set up,
// 502 Dodo failed.
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }
  if (!isDodoConfigured()) {
    return Response.json(
      { error: "Invoices aren't available right now." },
      { status: 503 }
    );
  }

  const { paymentId } = await params;
  const notFound = Response.json(
    { error: "No such invoice." },
    { status: 404 }
  );
  if (!/^[\w-]{1,100}$/.test(paymentId)) {
    return notFound;
  }

  try {
    if (!(await ownsPayment(session.user.id, session.user.email, paymentId))) {
      return notFound;
    }
    const pdf = await getDodo().invoices.payments.retrieve(paymentId);
    return new Response(pdf.body, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="craftui-invoice-${paymentId}.pdf"`,
        "Content-Type": "application/pdf",
      },
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return notFound;
    }
    console.error(
      `[invoices] Couldn't get the invoice for ${paymentId}`,
      error
    );
    return Response.json(
      { error: "Couldn't get the invoice. Try again in a moment." },
      { status: 502 }
    );
  }
};
