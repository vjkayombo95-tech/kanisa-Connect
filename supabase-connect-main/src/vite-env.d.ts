/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV?: 'production' | 'staging' | 'development' | 'test';
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_EXPECTED_SUPABASE_PROJECT_REF?: string;
  readonly VITE_PRODUCTION_SUPABASE_PROJECT_REF?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
