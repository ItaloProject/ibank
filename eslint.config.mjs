import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

// As regras do React Compiler (set-state-in-effect, refs, purity, immutability) são avisos: o projeto
// usa React 18, e alguns padrões antigos (como o foco do MUVO Live) são intencionais. Ficam visíveis
// sem bloquear o lint.
const COMPILER_RULES = {
  "react-hooks/set-state-in-effect": "warn",
  "react-hooks/refs": "warn",
  "react-hooks/purity": "warn",
  "react-hooks/immutability": "warn",
  "react-hooks/preserve-manual-memoization": "warn",
};

export default [
  { ignores: [".next/**", "node_modules/**", "out/**", "coverage/**", "public/**", "scripts/**"] },
  ...coreWebVitals,
  ...typescript,
  { rules: COMPILER_RULES },
];
