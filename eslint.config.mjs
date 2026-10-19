import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      ".agents/**",
      ".claude/**",
      ".codex/**",
      ".codex-remote-attachments/**",
      ".cursor/**",
      ".next/**",
      ".tmp/**",
      ".tmp-*/**",
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
      "test-results/**",
      "playwright-report/**",
      "tools/shorts-studio/**",
      "tsconfig.tsbuildinfo",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    files: ["app/**/*.tsx", "components/**/*.tsx"],
    ignores: ["components/ui/table.tsx"],
    rules: {
      "no-restricted-syntax": ["error", {
        selector: "JSXOpeningElement[name.name=/^(table|thead|tbody|tr|th|td)$/]",
        message: "표는 components/ui/table 또는 DataTable을 재사용하세요.",
      }],
    },
  },
  {
    files: ["app/**/*.tsx", "components/**/*.tsx"],
    ignores: ["app/admin/**", "components/ui/table.tsx"],
    rules: {
      "no-restricted-syntax": ["error", {
        selector: "JSXOpeningElement[name.name=/^(table|thead|tbody|tr|th|td|select)$/]",
        message: "표는 Table/DataTable, 셀렉트는 FilterDropdown을 재사용하세요.",
      }],
    },
  },
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
