/**
 * A project path as the inventory spells it: trailing slashes dropped, so
 * `/repo/web/` and `/repo/web` are one project. Shared by Setup's lens,
 * Projects and the sidebar's Recent list.
 */
export const trim = (p: string) => p.replace(/\/+$/, "");
