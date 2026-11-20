"use client";

import {
  Activity01Icon,
  AiVoiceIcon,
  Alert02Icon,
  Analytics01Icon,
  CallIcon,
  CloudServerIcon,
  CommandLineIcon,
  Database01Icon,
  DashboardSquare01Icon,
  File01Icon,
  HelpCircleIcon,
  Home01Icon,
  Invoice01Icon,
  Key01Icon,
  Leaf01Icon,
  Message01Icon,
  PackageIcon,
  Settings02Icon,
  ShoppingBag01Icon,
  UserGroupIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";

import { DashboardShell } from "./variants/dashboard-shell";
import { VariantFrame } from "./variants/shared";
import { V2Usage } from "./variants/v2-usage";
import { V3Bills } from "./variants/v3-bills";
import { V4Payouts } from "./variants/v4-payouts";
import { V5Credits } from "./variants/v5-credits";

// Prototype: five billing pages, one per industry, each inside the app
// it belongs to. The summary row on top, its history underneath.
const Page = () => (
  <div className="bg-muted/40 flex min-h-dvh flex-col items-center gap-16 px-4 py-12">
    <VariantFrame
      name="2 · Usage-based"
      idea="Spend so far with a daily chart and forecast, the budget, the daily average, and where the money went (Snowflake, Laravel Cloud, Cofounder)."
    >
      <div className="w-full max-w-[80rem]">
        <DashboardShell
          brand="Northwind Cloud"
          brandColor="#0EA5E9"
          active="usage"
          trail={["northwind-prod", "Usage"]}
          title="Usage and billing"
          description="November so far, and where it's heading."
          user={{ email: "sam@northwind.dev", name: "Sam Ortiz" }}
          groups={[
            {
              items: [
                {
                  icon: DashboardSquare01Icon,
                  id: "overview",
                  label: "Overview",
                },
                { icon: CloudServerIcon, id: "services", label: "Services" },
                { icon: Database01Icon, id: "databases", label: "Databases" },
                { icon: CommandLineIcon, id: "logs", label: "Logs" },
              ],
            },
            {
              items: [
                { icon: Activity01Icon, id: "usage", label: "Usage" },
                { icon: Key01Icon, id: "tokens", label: "API tokens" },
                { icon: UserGroupIcon, id: "team", label: "Team" },
              ],
              label: "Project",
            },
          ]}
        >
          <V2Usage />
        </DashboardShell>
      </div>
    </VariantFrame>

    <VariantFrame
      name="3 · Bills"
      idea="Amount due with Pay now, autopay in plain words, last bill against the month before (utilities, telecom, insurance)."
    >
      <div className="w-full max-w-[80rem]">
        <DashboardShell
          brand="Brightline Energy"
          brandColor="#16A34A"
          active="bills"
          trail={["Account 4410-2291", "Bills and payments"]}
          title="Bills and payments"
          description="12 Harbor Street · Electricity and gas"
          user={{ email: "jo.ellis@mail.com", name: "Jo Ellis" }}
          groups={[
            {
              items: [
                { icon: Home01Icon, id: "home", label: "Home" },
                {
                  icon: Invoice01Icon,
                  id: "bills",
                  label: "Bills and payments",
                },
                { icon: Analytics01Icon, id: "energy", label: "Energy use" },
                { icon: Leaf01Icon, id: "plans", label: "Plans" },
              ],
            },
            {
              items: [
                { icon: Alert02Icon, id: "outages", label: "Outages" },
                { icon: HelpCircleIcon, id: "help", label: "Help" },
              ],
              label: "Support",
            },
          ]}
        >
          <V3Bills />
        </DashboardShell>
      </div>
    </VariantFrame>

    <VariantFrame
      name="4 · Payouts"
      idea="Balance you can withdraw, money clearing, money in transit, and the payouts that already went out (Fiverr, Stripe, ElevenLabs)."
    >
      <div className="w-full max-w-[80rem]">
        <DashboardShell
          brand="Makerly"
          brandColor="#E11D48"
          active="earnings"
          trail={["Seller", "Earnings"]}
          title="Earnings"
          description="What you've earned, what's clearing and what's on its way."
          user={{ email: "ravi@studio-ravi.com", name: "Ravi Patel" }}
          groups={[
            {
              items: [
                {
                  icon: DashboardSquare01Icon,
                  id: "dashboard",
                  label: "Dashboard",
                },
                { icon: ShoppingBag01Icon, id: "orders", label: "Orders" },
                { icon: PackageIcon, id: "listings", label: "Listings" },
                { icon: Message01Icon, id: "messages", label: "Messages" },
              ],
            },
            {
              items: [
                { icon: Wallet01Icon, id: "earnings", label: "Earnings" },
                { icon: Analytics01Icon, id: "analytics", label: "Analytics" },
              ],
              label: "Business",
            },
          ]}
        >
          <V4Payouts />
        </DashboardShell>
      </div>
    </VariantFrame>

    <VariantFrame
      name="5 · Credits"
      idea="Credit balance and how long it lasts, buy a pack, auto top-up, and what used them (Vapi, Lovable, Manus)."
    >
      <div className="w-full max-w-[80rem]">
        <DashboardShell
          brand="Echo"
          brandColor="#F59E0B"
          active="credits"
          trail={["Echo", "Credits"]}
          title="Credits"
          description="Calls spend credits by the minute."
          user={{ email: "lena@kitebase.io", name: "Lena Novak" }}
          groups={[
            {
              items: [
                { icon: AiVoiceIcon, id: "agents", label: "Agents" },
                { icon: CallIcon, id: "calls", label: "Calls" },
                { icon: File01Icon, id: "knowledge", label: "Knowledge" },
              ],
            },
            {
              items: [
                { icon: Wallet01Icon, id: "credits", label: "Credits" },
                { icon: Key01Icon, id: "keys", label: "API keys" },
                { icon: Settings02Icon, id: "settings", label: "Settings" },
              ],
              label: "Account",
            },
          ]}
        >
          <V5Credits />
        </DashboardShell>
      </div>
    </VariantFrame>
  </div>
);

export default Page;
