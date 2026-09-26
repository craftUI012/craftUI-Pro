"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("sending");
    setError(null);

    const { error: authError } = await authClient.signIn.magicLink({
      callbackURL: "/dashboard",
      email: email.trim(),
    });

    if (authError) {
      setStatus("error");
      setError(authError.message ?? "Could not send the link.");
      return;
    }

    setStatus("sent");
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-16">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sign in with a link</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a magic link. No password
            needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "sent" ? (
            <p className="text-sm">
              Check your inbox for a sign-in link sent to{" "}
              <span className="font-medium">{email}</span>.
            </p>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <Input
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <Button
                className="w-full"
                disabled={status === "sending" || !email.trim()}
                type="submit"
              >
                {status === "sending" ? "Sending…" : "Send magic link"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
