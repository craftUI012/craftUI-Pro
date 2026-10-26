"use client";

import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

// The dashboard's Download invoice button: a plain link to the invoice route
// (app/api/invoices/[paymentId]), which answers with the PDF as a download.
// A client component so the Button and its <a> render together: built in a
// server component, the asChild link hydrated as a mismatch.
export const InvoiceDownloadButton = ({ paymentId }: { paymentId: string }) => (
  <Button asChild size="sm" variant="outline">
    <a href={`/api/invoices/${encodeURIComponent(paymentId)}`} download>
      <DownloadIcon aria-hidden />
      Invoice
    </a>
  </Button>
);
