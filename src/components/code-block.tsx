import { CopyButton } from "@/components/copy-button";

function pretty(body: string) {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

export function CodeBlock({ body }: { body: string }) {
  const text = pretty(body);

  return (
    <div className="relative">
      <pre className="bg-muted/50 max-h-96 overflow-auto rounded-lg border p-3 font-mono text-xs break-all whitespace-pre-wrap">
        {text || "(empty)"}
      </pre>
      {text && (
        <CopyButton
          className="absolute top-2 right-2"
          label="Copy body"
          text={text}
        />
      )}
    </div>
  );
}
