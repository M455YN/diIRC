import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

export const CodeHighlighter = ({ language, children }: { language: string; children: string }) => (
  <SyntaxHighlighter
    language={language}
    style={vscDarkPlus}
    customStyle={{
      margin: 0,
      padding: 0,
      background: "transparent",
      fontSize: "13px",
      lineHeight: "1.25rem",
    }}
    codeTagProps={{
      style: {
        fontFamily: "var(--font-mono, monospace)",
      },
    }}
    PreTag="div"
  >
    {children}
  </SyntaxHighlighter>
);
