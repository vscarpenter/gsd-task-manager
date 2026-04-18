import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import reactHooksPlugin from "eslint-plugin-react-hooks";

const config = [
    {
        ignores: [
            ".next/**",
            "out/**",
            "coverage/**",
            "worker/.wrangler/**",
            "packages/mcp-server/dist/**",
            "packages/native/ios.backup/build/**",
            "design_handoff_gsd_redesign/**",
        ],
    },
    ...nextCoreWebVitals,
    ...nextTypescript,
    {
        plugins: {
            "react-hooks": reactHooksPlugin,
        },
        rules: {
            "@next/next/no-img-element": "off",
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
            "app/(archive)/archive/page.tsx",
            "app/(sync)/sync-history/page.tsx",
        ],
        rules: {
            "react-hooks/incompatible-library": "off",
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
