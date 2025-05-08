import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { Extension } from "@codemirror/state";

/**
 * Get appropriate language extension based on file path
 */
export function getLanguages(path: string): Extension {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  
  // JavaScript/TypeScript
  if (["js", "jsx", "ts", "tsx"].includes(ext)) {
    return javascript({ jsx: ext.includes("x"), typescript: ext.includes("ts") });
  }
  
  // HTML
  if (["html", "htm"].includes(ext)) {
    return html();
  }
  
  // CSS
  if (ext === "css") {
    return css();
  }
  
  // JSON
  if (ext === "json") {
    return json();
  }
  
  // Markdown
  if (["md", "markdown"].includes(ext)) {
    return markdown();
  }
  
  // Default to JavaScript
  return javascript();
} 