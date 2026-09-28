"use client";

import { createContext, use } from "react";

// The search query from the top bar, read by the active feed to filter cards.
export const BrowseQueryContext = createContext("");

export const useBrowseQuery = () => use(BrowseQueryContext);
