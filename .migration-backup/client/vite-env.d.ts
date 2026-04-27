/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_KEY: string;
  readonly VITE_EMAIL_API_URL: string;
  readonly VITE_EMAIL_API_KEY: string;
  readonly VITE_FROM_EMAIL: string;
  readonly VITE_FROM_NAME: string;
  readonly VITE_HONEYBADGER_API_KEY: string;
  readonly VITE_SENTRY_DSN: string;
  readonly VITE_MONITORING_ENDPOINT: string;
  readonly VITE_APP_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
