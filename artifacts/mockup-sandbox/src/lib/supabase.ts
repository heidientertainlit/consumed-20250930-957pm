/** Inert preview shim so importing the admin component cannot make network calls. */
export const supabase = {
  functions: {
    invoke: async (..._args: unknown[]): Promise<{ data: any; error: Error }> => ({
      data: null,
      error: new Error("Network actions are disabled in the mockup sandbox."),
    }),
  },
};
