declare namespace Deno {
  function serve(handler: (req: Request) => Promise<Response> | Response): void;
  namespace env {
    function get(key: string): string | undefined;
  }
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export function createClient(url: string, key: string, options?: any): any;
}

declare module 'https://esm.sh/xlsx@0.18.5' {
  export function read(data: Uint8Array, options?: any): any;
  export namespace utils {
    function sheet_to_json(sheet: any, options?: any): any[];
  }
}
