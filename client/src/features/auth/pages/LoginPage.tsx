import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { usePOS } from "@/features/auth/contexts/POSContext";
import { Button } from "@/components/ui/forms/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/display/card";
import { Users, DollarSign, BarChart3, Building2, Loader2, Delete, LogIn } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type RolType = "MOZO" | "CAJERO" | "DUENO";

const roles = [
  {
    id: "MOZO" as RolType,
    label: "Mozo",
    icon: Users,
    description: "Toma de pedidos y atención de mesas",
    color: "bg-emerald-500/20 border-emerald-500/50 hover:bg-emerald-500/30"
  },
  {
    id: "CAJERO" as RolType,
    label: "Cajero",
    icon: DollarSign,
    description: "Cobro y cierre de cuentas",
    color: "bg-amber-500/20 border-amber-500/50 hover:bg-amber-500/30"
  },
  {
    id: "DUENO" as RolType,
    label: "Dueño",
    icon: BarChart3,
    description: "Dashboard y reportes del negocio",
    color: "bg-blue-500/20 border-blue-500/50 hover:bg-blue-500/30"
  },
];

export default function Login() {
  const [, navigate] = useLocation();
  const { login, isAuthenticated } = usePOS();
  const [selectedRole, setSelectedRole] = useState<RolType | null>(null);
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Obtener empresas disponibles
  const { data: empresas, isLoading: loadingEmpresas } = trpc.empresa.list.useQuery();
  const [selectedEmpresa, setSelectedEmpresa] = useState<number | null>(null);

  // Mutation para login
  const loginMutation = trpc.empleado.loginByPin.useMutation();

  // Redirigir si ya está autenticado
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/mozo");
    }
  }, [isAuthenticated, navigate]);

  // Seleccionar primera empresa por defecto
  useEffect(() => {
    if (empresas && empresas.length > 0 && !selectedEmpresa) {
      setSelectedEmpresa(empresas[0].id);
    }
  }, [empresas, selectedEmpresa]);

  const handlePinInput = (digit: string) => {
    if (!selectedRole) {
      toast.error("Primero seleccione un rol");
      return;
    }
    if (pin.length < 4) {
      setPin(prev => prev + digit);
    }
  };

  const handlePinDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handlePinClear = () => {
    setPin("");
  };

  const handleLogin = async () => {
    if (!selectedRole) {
      toast.error("Primero seleccione un rol");
      return;
    }
    if (!selectedEmpresa || !pin || pin.length !== 4) {
      toast.error("Ingresa un PIN de 4 dígitos");
      return;
    }

    setIsLoading(true);
    try {
      const result = await loginMutation.mutateAsync({
        empresaId: selectedEmpresa,
        pin: pin,
      });

      if (result.success && result.empleado) {
        // Verificar que el rol del empleado coincida con el seleccionado
        const rolEmpleado = result.empleado.rol;
        if (rolEmpleado !== selectedRole) {
          toast.error(`Este PIN pertenece a un ${rolEmpleado}, no a un ${selectedRole}`);
          setPin("");
          setIsLoading(false);
          return;
        }

        const empresa = empresas?.find(e => e.id === selectedEmpresa);
        if (empresa) {
          login(result.empleado, {
            id: empresa.id,
            nombre: empresa.nombre,
            ruc: empresa.ruc,
            razonSocial: empresa.razonSocial || null,
            direccion: empresa.direccion || null,
            telefono: empresa.telefono || null,
            email: empresa.email || null,
            logoUrl: empresa.logoUrl,
            impuestoPorcentaje: empresa.impuestoPorcentaje || "18.00",
            moneda: empresa.moneda || "PEN",
          });

          toast.success(`Bienvenido, ${result.empleado.nombre}!`);

          // Navegar según el rol
          const rol = result.empleado.rol;
          if (rol === "MOZO") navigate("/mozo");
          else if (rol === "CAJERO") navigate("/cajero");
          else navigate("/dashboard");
        }
      } else {
        toast.error(result.error || "PIN inválido");
        setPin("");
      }
    } catch (error) {
      toast.error("Error al iniciar sesión");
      setPin("");
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-submit cuando el PIN tiene 4 dígitos
  useEffect(() => {
    if (pin.length === 4 && selectedEmpresa && selectedRole) {
      handleLogin();
    }
  }, [pin]);

  const currentEmpresa = empresas?.find(e => e.id === selectedEmpresa);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center overflow-hidden">
                {currentEmpresa?.logoUrl ? (
                  <img src={currentEmpresa.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="h-6 w-6 text-white" />
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Comanda Maestra</h1>
                <p className="text-xs text-muted-foreground">Sistema POS para Restaurantes</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container py-8">
        <div className="max-w-4xl mx-auto">
          {/* Empresa Selector */}
          {loadingEmpresas ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : empresas && empresas.length > 0 ? (
            <>
              {/* Empresa Info */}
              <Card className="mb-8 bg-card/50 border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center overflow-hidden border border-primary/30">
                      {currentEmpresa?.logoUrl ? (
                        <img src={currentEmpresa.logoUrl} alt={currentEmpresa.nombre} className="w-full h-full object-cover" />
                      ) : (
                        <Building2 className="h-6 w-6 text-primary" />
                      )}
                    </div>
                    <div>
                      <span className="block">{currentEmpresa?.nombre || "Selecciona una empresa"}</span>
                      {currentEmpresa?.ruc && (
                        <span className="text-xs font-normal text-muted-foreground">RUC: {currentEmpresa.ruc}</span>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
              </Card>

              {/* Role Selection */}
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4 text-foreground">
                  1. Selecciona tu rol <span className="text-red-500">*</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {roles.map((role) => {
                    const Icon = role.icon;
                    const isSelected = selectedRole === role.id;

                    return (
                      <button
                        key={role.id}
                        onClick={() => {
                          setSelectedRole(role.id);
                          setPin(""); // Limpiar PIN al cambiar de rol
                        }}
                        className={cn(
                          "p-6 rounded-xl border-2 transition-all text-left",
                          role.color,
                          isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        )}
                      >
                        <Icon className={cn(
                          "h-10 w-10 mb-3",
                          role.id === "MOZO" && "text-emerald-400",
                          role.id === "CAJERO" && "text-amber-400",
                          role.id === "DUENO" && "text-blue-400"
                        )} />
                        <h3 className="font-semibold text-lg text-foreground">{role.label}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{role.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* PIN Input */}
              <Card className={cn(
                "bg-card/50 border-border/50 transition-all",
                !selectedRole && "opacity-50 pointer-events-none"
              )}>
                <CardHeader className="text-center pb-2">
                  <CardTitle>2. Ingresa tu PIN</CardTitle>
                  <CardDescription>
                    {selectedRole
                      ? `PIN de 4 dígitos para ${selectedRole}`
                      : <span className="text-amber-500 font-medium animate-pulse">⚠️ Primero seleccione un rol arriba</span>
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* PIN Display */}
                  <div className="flex justify-center gap-3 mb-6">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          "w-14 h-14 rounded-lg border-2 flex items-center justify-center text-2xl font-bold transition-all",
                          pin.length > i
                            ? "border-primary bg-primary/20 text-primary"
                            : "border-border bg-muted/50",
                          !selectedRole && "opacity-50"
                        )}
                      >
                        {pin.length > i ? "•" : ""}
                      </div>
                    ))}
                  </div>

                  {/* Numeric Keypad */}
                  <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"].map((key) => (
                      <Button
                        key={key}
                        variant={key === "C" ? "destructive" : key === "⌫" ? "secondary" : "outline"}
                        className={cn(
                          "h-14 text-xl font-semibold",
                          !["C", "⌫"].includes(key) && "hover:bg-primary/20 hover:border-primary"
                        )}
                        onClick={() => {
                          if (key === "C") handlePinClear();
                          else if (key === "⌫") handlePinDelete();
                          else handlePinInput(key);
                        }}
                        disabled={isLoading || !selectedRole}
                      >
                        {key === "⌫" ? <Delete className="h-5 w-5" /> : key}
                      </Button>
                    ))}
                  </div>

                  {/* Login Button */}
                  <Button
                    className="w-full mt-6 h-12 text-lg"
                    onClick={handleLogin}
                    disabled={pin.length !== 4 || isLoading || !selectedEmpresa || !selectedRole}
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                      <LogIn className="h-5 w-5 mr-2" />
                    )}
                    Ingresar
                  </Button>
                </CardContent>
              </Card>

              {/* Demo Info */}
              <Card className="mt-6 bg-muted/30 border-dashed">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">
                    PINs de demostración:
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div className="bg-card/50 rounded px-3 py-2">
                      <span className="text-emerald-400 font-medium">Mozo:</span> 1234
                    </div>
                    <div className="bg-card/50 rounded px-3 py-2">
                      <span className="text-emerald-400 font-medium">Mozo 2:</span> 2345
                    </div>
                    <div className="bg-card/50 rounded px-3 py-2">
                      <span className="text-amber-400 font-medium">Cajero:</span> 3456
                    </div>
                    <div className="bg-card/50 rounded px-3 py-2">
                      <span className="text-blue-400 font-medium">Dueño:</span> 4567
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="bg-card/50">
              <CardContent className="py-12 text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay empresas configuradas</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-4">
        <div className="container text-center text-sm text-muted-foreground">
          Comanda Maestra © 2024 - Sistema POS Profesional
        </div>
      </footer>
    </div>
  );
}
