export async function register() {
  if (process.env.NODE_ENV !== "production") {
    console.info("[instrumentation] MINION observability hooks registered");
  }
}
