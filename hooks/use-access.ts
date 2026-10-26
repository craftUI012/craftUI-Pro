"use client";

import { useEffect, useState } from "react";

import { useSession } from "@/lib/auth-client";

// What the signed-in user can use, from /api/access: all-access, the product
// codes of items they bought, the token for their install commands, and
// whether they're an admin (ADMIN_EMAILS).
interface Access {
  hasAllAccess: boolean;
  installToken: string | null;
  isAdmin: boolean;
  itemIds: string[];
}

const NONE: Access = {
  hasAllAccess: false,
  installToken: null,
  isAdmin: false,
  itemIds: [],
};

// One request per signed-in user per page load, shared by every preview on
// the page.
const accessByUser = new Map<string, Promise<Access>>();

const fetchAccess = async (): Promise<Access> => {
  try {
    const response = await fetch("/api/access");
    if (!response.ok) {
      return NONE;
    }
    const data: Partial<Access> = await response.json();
    return {
      hasAllAccess: data.hasAllAccess === true,
      installToken: data.installToken ?? null,
      isAdmin: data.isAdmin === true,
      itemIds: data.itemIds ?? [],
    };
  } catch {
    return NONE;
  }
};

const loadAccess = (userId: string) => {
  let pending = accessByUser.get(userId);
  if (!pending) {
    pending = fetchAccess();
    accessByUser.set(userId, pending);
  }
  return pending;
};

// `ready` is false until the session and access are known; until then treat
// every paid item as locked, so nothing flashes unlocked.
export const useAccess = () => {
  const { data, isPending } = useSession();
  const userId = data?.user.id;
  const [loaded, setLoaded] = useState<{ access: Access; userId: string }>();

  useEffect(() => {
    if (!userId) {
      return;
    }
    let current = true;
    const load = async () => {
      const access = await loadAccess(userId);
      if (current) {
        setLoaded({ access, userId });
      }
    };
    load();
    return () => {
      current = false;
    };
  }, [userId]);

  const access = userId && loaded?.userId === userId ? loaded.access : NONE;

  return {
    ...access,
    // Can this user use the item with this product code?
    canUse: (itemId: string | undefined) =>
      itemId !== undefined &&
      (access.hasAllAccess || access.itemIds.includes(itemId)),
    ready: !isPending && (!userId || loaded?.userId === userId),
    signedIn: Boolean(userId),
  };
};

// A paid item's source, for its owner, from /api/source (docs pages never
// contain it). Fetched once per item per page load; null if refused.
const sourceByItem = new Map<
  string,
  Promise<{ code: string; html: string } | null>
>();

const fetchItemSource = async (name: string) => {
  try {
    const response = await fetch(`/api/source/${encodeURIComponent(name)}`);
    return response.ok
      ? ((await response.json()) as { code: string; html: string })
      : null;
  } catch {
    return null;
  }
};

export const loadItemSource = (name: string) => {
  let pending = sourceByItem.get(name);
  if (!pending) {
    pending = fetchItemSource(name);
    sourceByItem.set(name, pending);
  }
  return pending;
};
