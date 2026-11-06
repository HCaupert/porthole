import { RiMoonLine, RiSunLine } from "@remixicon/react";

import { ThemeSchema, useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ModeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button aria-label="Toggle theme" size="icon" variant="ghost" />
        }
      >
        <RiSunLine className="dark:hidden" />
        <RiMoonLine className="hidden dark:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => setTheme(ThemeSchema.parse(value))}
        >
          {ThemeSchema.options.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              <span className="capitalize">{option}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
