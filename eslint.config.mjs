import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      ".claude/**",
      ".codex/**",
      ".cursor/**",
      ".next/**",
      ".vercel/**",
      "artifacts/**",
      "coverage/**",
      "dist/**",
      "docs/**",
      // Expo uses its own config via the mobile lint step in npm run lint.
      "mobile/**",
      "next-env.d.ts",
      "node_modules/**",
      "out/**",
      "output/**",
      "tmp/**",
      "tools/shorts-studio/**",
      "tsconfig.tsbuildinfo",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];

export default eslintConfig;
