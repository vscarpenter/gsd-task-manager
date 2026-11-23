import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import remoteTaskWrites from "./config/eslint/remote-task-writes.mjs";
import instantOrder from "./config/eslint/instant-order.mjs";

const config = [
    {
        ignores: [
            ".next/**",
            ".agents/**",
            ".claude/skills/**",
            ".cursor/**",
            ".pi/**",
            "out/**",
            // Bundled copy of linted TS; byte-for-byte drift and classic-script syntax tested.
            "public/sw-notifications.js",
            "**/coverage/**",
            "worker/.wrangler/**",
            "packages/mcp-server/dist/**",
            "packages/native/ios.backup/build/**",
            "design_handoff_gsd_redesign/**",
            "handoff_gsd_simplified_v9/**",
            "tools/stagehand/evidence/**",
            "tools/stagehand/page-scripts/**",
        ],
    },
    ...nextCoreWebVitals,
    ...nextTypescript,
    {
        // eslint-plugin-react@7.37.5 (pulled via eslint-config-next) auto-detects
        // the React version by calling context.getFilename(), which ESLint 10
        // removed — crashing `react/*` rules. Pinning the version skips detection.
        // Keep in sync with the `react` dependency in package.json.
        settings: {
            react: { version: "19.3.1" },
        },
    },
    {
        plugins: {
            "react-hooks": reactHooksPlugin,
        },
        rules: {
            "@next/next/no-img-element": "off",
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                },
            ],
            "react/jsx-props-no-spreading": "off",
            // Allow setState in effects for legitimate state sync patterns
            // (e.g., resetting form state when dialog closes, syncing derived state)
            "react-hooks/set-state-in-effect": "warn",
            // Allow refs during render for advanced patterns (though generally avoid)
            "react-hooks/refs": "warn",
            // Allow variable access before declaration in effects (common callback pattern)
            "react-hooks/immutability": "warn",
        },
    },
    {
        files: [
            "docker/pb_hooks/**/*.js",
            "docker/pb_migrations/**/*.js",
            "docker/pb_fresh_migrations/**/*.js",
        ],
        rules: {
            "@typescript-eslint/no-require-imports": "off",
            "@typescript-eslint/triple-slash-reference": "off",
        },
    },
    {
        // .cjs files are CommonJS by definition, so require()/module.exports are
        // the correct syntax — the TS no-require-imports rule must not apply.
        files: ["**/*.cjs"],
        rules: {
            "@typescript-eslint/no-require-imports": "off",
        },
    },
    {
        files: ["docker/pb_hooks/**/*.d.ts"],
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
        },
    },
    {
        files: [
            "app/(archive)/archive/page.tsx",
            "app/(sync)/sync-history/page.tsx",
        ],
        rules: {
            "react-hooks/incompatible-library": "off",
        },
    },
    {
        files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
        // Account deletion erases every record on purpose, with no queue row to claim.
        ignores: ["lib/sync/queued-write.ts", "lib/sync/pb-account-deletion.ts"],
        plugins: { "gsd-sync": remoteTaskWrites },
        rules: { "gsd-sync/claimed-task-writes": "error" },
    },
    {
        files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "packages/mcp-server/src/**/*.ts"],
        ignores: ["**/__tests__/**"],
        plugins: { "gsd-time": instantOrder },
        rules: { "gsd-time/instant-order": "error" },
    },
    {
        files: ["packages/mcp-server/src/tools/**/*.ts"],
        rules: {
            "no-restricted-properties": [
                "error",
                {
                    object: "z",
                    property: "object",
                    message: "z.object drops a misspelled argument in silence, so { due_date } cleared due dates on up to 50 tasks. Use z.strictObject, at every nesting level.",
                },
            ],
        },
    },
    {
        files: ["tests/**/*.{ts,tsx,js,jsx}"],
        rules: {
            "@typescript-eslint/no-unused-vars": "off",
        },
    },
];

export default config;
