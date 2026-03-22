declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_BUILD_NUMBER?: string;
    NEXT_PUBLIC_BUILD_DATE?: string;
    readonly NEXT_PUBLIC_POCKETBASE_URL?: string;
    readonly NEXT_PUBLIC_BASE_URL?: string;
  }
}
