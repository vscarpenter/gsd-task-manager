import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default [
    ...nextCoreWebVitals,
    ...nextTypescript,
    {
        rules: {
            "@next/next/no-img-element": "off",
            "react/jsx-props-no-spreading": "off",
        },
    },
];