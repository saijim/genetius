/// <reference types="astro/client" />

interface ImportMetaEnv {
  ADMIN_USER?: string;
  ADMIN_PASSWORD?: string;
  OPENROUTER_API_KEY?: string;
}

interface ImportMeta {
  env: ImportMetaEnv;
}
