"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

interface CheckoutButtonProps {
  email: string;
  plan: "lifetime" | "yearly" | "template";
  templateSlug?: string;
  label: string;
}

export const CheckoutButton = ({
  email,
  label,
  plan,
  templateSlug,
}: CheckoutButtonProps) => {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [failure, setFailure] = useState<string | null>(null);

  const handleClick = async () => {
    setState("loading");
    setFailure(null);
    try {
      const response = await fetch("/api/checkout", {
        body: JSON.stringify({ email, plan, templateSlug }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Checkout failed.");
      }
      window.location.href = data.url;
    } catch (error) {
      setState("error");
      setFailure(error instanceof Error ? error.message : "Checkout failed.");
    }
  };

  return (
    <div className="space-y-2">
      <Button
        className="w-full"
        disabled={state === "loading" || !email.trim()}
        onClick={handleClick}
      >
        {state === "loading" ? "Redirecting…" : label}
      </Button>
      {state === "error" && failure ? (
        <p className="text-sm text-red-600">{failure}</p>
      ) : null}
    </div>
  );
};
