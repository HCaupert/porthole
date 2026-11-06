import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function Truncated({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className="block max-w-md truncate font-mono text-xs" />}
      >
        {text}
      </TooltipTrigger>
      <TooltipContent>
        <span className="block max-w-xl font-mono break-all">{text}</span>
      </TooltipContent>
    </Tooltip>
  );
}
