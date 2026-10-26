// Who may open the admin panel (/admin-panel-craft): the emails in
// ADMIN_EMAILS, comma-separated, e.g. "nil@craftui.space,me@gmail.com".
// Empty or unset means nobody. Kept free of other imports: lib/auth.ts reads
// it too (admins may sign in without a purchase).
export const isAdminEmail = (email: string) => {
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.trim().toLowerCase());
};
