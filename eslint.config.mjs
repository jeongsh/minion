import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      "out/**",
      "dist/**",
      "next-env.d.ts",
      "node_modules/**",
    ],
  },
  {
    rules: {
      // _prev, _stageId 처럼 밑줄로 시작하는 이름은 콜백 시그니처를 맞추기 위해
      // 일부러 안 쓰는 인자/변수라는 기존 컨벤션을 그대로 인정한다.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default eslintConfig;
