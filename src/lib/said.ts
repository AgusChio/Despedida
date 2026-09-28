export function said(caught: unknown, fallback: string) {
  if (caught instanceof Error && caught.message.trim()) {
    return caught.message.replace(/^Uncaught Error:\s*/, "");
  }
  return fallback;
}
