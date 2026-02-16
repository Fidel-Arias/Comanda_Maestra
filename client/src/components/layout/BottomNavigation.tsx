import { useLocation, Link } from "wouter";
import { Users, DollarSign, BarChart3, CalendarDays, FileText } from "lucide-react";
import { usePOS } from "@/features/auth/contexts/POSContext";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";

const navItems = [
  {
    path: "/mozo",
    label: "Mozo",
    icon: Users,
    roles: ["MOZO", "CAJERO", "DUENO", "ADMIN"]
  },
  {
    path: "/cajero",
    label: "Cajero",
    icon: DollarSign,
    roles: ["CAJERO", "DUENO", "ADMIN"]
  },
  {
    path: "/facturacion",
    label: "Facturas",
    icon: FileText,
    roles: ["CAJERO", "DUENO", "ADMIN"]
  },
  {
    path: "/dashboard",
    label: "Dueño",
    icon: BarChart3,
    roles: ["DUENO", "ADMIN"]
  },

];

export function BottomNavigation() {
  const [location] = useLocation();
  const { empleado } = usePOS();

  if (!empleado) return null;

  const visibleItems = navItems.filter(item =>
    item.roles.includes(empleado.rol)
  );

  return (
    <nav className="bottom-nav z-50">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
        {visibleItems.map((item) => {
          const isActive = location.startsWith(item.path);
          const Icon = item.icon;

          return (
            <Link key={item.path} href={item.path}>
              <button
                className={cn(
                  "flex flex-col items-center justify-center w-16 h-full transition-colors relative",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5 mb-1", isActive && "text-primary")} />
                <span className={cn(
                  "text-xs font-medium",
                  isActive && "text-primary"
                )}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="absolute bottom-0 w-10 h-0.5 bg-primary rounded-full" />
                )}
              </button>
            </Link>
          );
        })}

        {/* Theme Toggle */}
        <div className="flex flex-col items-center justify-center w-16 h-full">
          <ThemeToggle size="sm" className="h-8 w-8" />
          <span className="text-xs font-medium text-muted-foreground mt-0.5">Tema</span>
        </div>
      </div>
    </nav>
  );
}
