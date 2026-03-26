/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_DATA_PROVIDER: string;
  readonly VITE_MEDIA_PROVIDER: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_ANTHROPIC_API_KEY: string;
  readonly VITE_ANTHROPIC_MODEL: string;
  readonly VITE_OPENAI_API_KEY: string;
  readonly VITE_OPENAI_BASE_URL: string;
  readonly VITE_BUILD_ID: string;
  readonly REACT_APP_API_BASE_URL: string;
  readonly REACT_APP_DATA_PROVIDER: string;
  readonly REACT_APP_MEDIA_PROVIDER: string;
  readonly REACT_APP_GOOGLE_CLIENT_ID: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
