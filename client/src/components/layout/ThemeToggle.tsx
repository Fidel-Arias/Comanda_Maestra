import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/forms/button";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
}

export function ThemeToggle({ 
  className, 
  variant = "ghost",
  size = "icon" 
}: ThemeToggleProps) {
  const { theme, toggleTheme, switchable } = useTheme();

  if (!switchable || !toggleTheme) {
    return null;
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={toggleTheme}
      className={cn("relative", className)}
      title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    >
      <Sun className={cn(
        "h-5 w-5 transition-all",
        theme === "dark" ? "rotate-0 scale-100" : "rotate-90 scale-0"
      )} />
      <Moon className={cn(
        "absolute h-5 w-5 transition-all",
        theme === "dark" ? "-rotate-90 scale-0" : "rotate-0 scale-100"
      )} />
      <span className="sr-only">Cambiar tema</span>
    </Button>
  );
}
