import { Polar } from "@polar-sh/sdk";

export const polarServer =
  process.env.POLAR_SERVER === "production" ? "production" : "sandbox";

export const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN ?? "",
  server: polarServer,
});

export const isPolarConfigured = () => Boolean(process.env.POLAR_ACCESS_TOKEN);
