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
    // Verifies webhook signatures in webhooks.unwrap().
    webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY ?? null,
  });
  return client;
};
