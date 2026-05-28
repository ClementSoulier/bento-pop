// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  extends: 'expo',
  // supabase/functions = code Deno (Edge Functions) — exclu du lint / typecheck
  // Node car les imports `https://...` et le runtime Deno ne se résolvent pas.
  ignorePatterns: ['/dist/*', 'supabase/functions/**'],
};
