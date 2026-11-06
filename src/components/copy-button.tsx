import { RiFileCopyLine } from "@remixicon/react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function CopyButton({
  text,
  label,
  className,
}: {
  text: string;
  label: string;
  className?: string;
}) {
  const copy = useMutation({
    mutationFn: async () => await navigator.clipboard.writeText(text),
    onSuccess: () => toast.success("Copied to the clipboard"),
  });

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            className={className}
            size="icon-sm"
            variant="ghost"
            onClick={() => copy.mutate()}
          />
        }
      >
        <RiFileCopyLine />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
