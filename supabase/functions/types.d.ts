// This file helps VS Code (without Deno extension) understand Deno globals
// It prevents "Cannot find name 'Deno'" errors in the editor

declare const Deno: {
  env: {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    toObject(): { [key: string]: string };
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
  // Add other Deno APIs as needed
};

// Silence errors for URL imports if Deno extension is not active
declare module "https://esm.sh/@supabase/supabase-js@2.45.4" {
  export const createClient: (url: string, key: string, options?: any) => any;
}
