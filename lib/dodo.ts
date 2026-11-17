import DodoPayments from "dodopayments";

// Dodo Payments (server only). `DODO_PAYMENTS_ENVIRONMENT` picks test or
// live mode, and the API key and webhook secret must come from that same
// mode in the Dodo dashboard. Anything but "live_mode" means test mode, so
// a missing variable never charges real cards.
export const dodoEnvironment =
  process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode"
    ? "live_mode"
    : "test_mode";

export const isDodoConfigured = () =>
  Boolean(process.env.DODO_PAYMENTS_API_KEY);

// Created on first use, so importing this file never needs the key.
let client: DodoPayments | undefined;

export const getDodo = () => {
  client ??= new DodoPayments({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY ?? "",
    environment: dodoEnvironment,
    // The SDK's defaults (a minute per try, two retries) could leave a buyer
    // on "Redirecting…" for minutes if Dodo is slow. 15s and one retry: a
    // slow call fails while they're still there, with a message to retry.
    maxRetries: 1,
    timeout: 15_000,
    // Verifies webhook signatures in webhooks.unwrap().
    webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY ?? null,
  });
  return client;
};
