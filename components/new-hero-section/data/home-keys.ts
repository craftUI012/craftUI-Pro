// Plain helpers shared by server and client code. They live outside the
// "use client" modules so the server entry (new-home.tsx) can call them.

// Key for an item across libraries (item ids are only unique within one),
// e.g. for the rail's What's new list.
export const recentKey = (library: string, id: string) => `${library}:${id}`;
