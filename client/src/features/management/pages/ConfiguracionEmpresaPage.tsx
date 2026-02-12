import { useState, useEffect } from "react";
import { usePOS } from "@/features/auth/contexts/POSContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/forms/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/display/card";
import { Input } from "@/components/ui/forms/input";
import { Label } from "@/components/ui/forms/label";
import { Textarea } from "@/components/ui/forms/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/forms/select";
import { BottomNavigation } from "@/components/layout/BottomNavigation";
import { useLocation } from "wouter";
import {
  ArrowLeft, Building2, Save, Receipt,
  Phone, Mail, MapPin, FileText, Percent, Coins
} from "lucide-react";
import { toast } from "sonner";

export default function ConfiguracionEmpresa() {
  const { empleado, empresa, setEmpresa } = usePOS();
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    nombre: "",
    ruc: "",
    razonSocial: "",
    direccion: "",
    telefono: "",
    email: "",
    logoUrl: "",
    impuestoPorcentaje: "10.50",
    moneda: "PEN",
  });

  const updateEmpresa = trpc.configuracion.updateEmpresa.useMutation({
    onSuccess: () => {
      toast.success("Configuración guardada exitosamente");
      // Actualizar el contexto con los nuevos datos
      if (empresa) {
        setEmpresa({
          ...empresa,
          nombre: formData.nombre,
          ruc: formData.ruc || null,
          razonSocial: formData.razonSocial || null,
          direccion: formData.direccion || null,
          telefono: formData.telefono || null,
          email: formData.email || null,
          logoUrl: formData.logoUrl || null,
          impuestoPorcentaje: formData.impuestoPorcentaje,
          moneda: formData.moneda,
        });
      }
    },
    onError: (error) => {
      toast.error(`Error al guardar: ${error.message}`);
    },
  });

  useEffect(() => {
    if (empresa) {
      setFormData({
        nombre: empresa.nombre || "",
        ruc: empresa.ruc || "",
        razonSocial: empresa.razonSocial || "",
        direccion: empresa.direccion || "",
        telefono: empresa.telefono || "",
        email: empresa.email || "",
        logoUrl: empresa.logoUrl || "",
        impuestoPorcentaje: empresa.impuestoPorcentaje || "10.50",
        moneda: empresa.moneda || "PEN",
      });
    }
  }, [empresa]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa) return;

    setIsLoading(true);
    try {
      await updateEmpresa.mutateAsync({
        id: empresa.id,
        ...formData,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const monedas = [
    { value: "PEN", label: "Soles (S/)", symbol: "S/" },
    { value: "USD", label: "Dólares ($)", symbol: "$" },
    { value: "EUR", label: "Euros (€)", symbol: "€" },
  ];

  if (!empleado || !["DUENO", "ADMIN"].includes(empleado.rol)) {
    setLocation("/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Configuración de Empresa</h1>
            <p className="text-sm text-muted-foreground">Edita los datos de tu negocio</p>
          </div>
        </div>
      </header>

      <main className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Información básica */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Información Básica
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre del Negocio *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => handleChange("nombre", e.target.value)}
                  placeholder="Ej: Restaurante El Buen Sabor"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="razonSocial">Razón Social</Label>
                <Input
                  id="razonSocial"
                  value={formData.razonSocial}
                  onChange={(e) => handleChange("razonSocial", e.target.value)}
                  placeholder="Ej: Restaurante El Buen Sabor S.A.C."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ruc" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  RUC
                </Label>
                <Input
                  id="ruc"
                  value={formData.ruc}
                  onChange={(e) => handleChange("ruc", e.target.value)}
                  placeholder="Ej: 20123456789"
                  maxLength={11}
                />
              </div>
            </CardContent>
          </Card>

          {/* Contacto */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Contacto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="direccion" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Dirección
                </Label>
                <Textarea
                  id="direccion"
                  value={formData.direccion}
                  onChange={(e) => handleChange("direccion", e.target.value)}
                  placeholder="Ej: Av. Principal 123, Lima"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefono" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Teléfono
                </Label>
                <Input
                  id="telefono"
                  value={formData.telefono}
                  onChange={(e) => handleChange("telefono", e.target.value)}
                  placeholder="Ej: 01-234-5678"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="Ej: contacto@restaurante.com"
                />
              </div>
            </CardContent>
          </Card>

          {/* Configuración fiscal */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Configuración Fiscal
              </CardTitle>
              <CardDescription>
                Configura el impuesto y moneda para los cálculos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="impuestoPorcentaje" className="flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Porcentaje de Impuesto (IGV)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="impuestoPorcentaje"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.impuestoPorcentaje}
                    onChange={(e) => handleChange("impuestoPorcentaje", e.target.value)}
                    className="w-24"
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  El IGV en Perú es 10.5% para restaurantes. Ajusta según tu país.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="moneda" className="flex items-center gap-2">
                  <Coins className="h-4 w-4" />
                  Moneda
                </Label>
                <Select
                  value={formData.moneda}
                  onValueChange={(value) => handleChange("moneda", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona moneda" />
                  </SelectTrigger>
                  <SelectContent>
                    {monedas.map((moneda) => (
                      <SelectItem key={moneda.value} value={moneda.value}>
                        {moneda.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Logo (opcional) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Logo (Opcional)</CardTitle>
              <CardDescription>
                URL de la imagen del logo de tu negocio
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="logoUrl">URL del Logo</Label>
                <Input
                  id="logoUrl"
                  type="url"
                  value={formData.logoUrl}
                  onChange={(e) => handleChange("logoUrl", e.target.value)}
                  placeholder="https://ejemplo.com/logo.png"
                />
              </div>
              {formData.logoUrl && (
                <div className="mt-4 flex justify-center">
                  <img
                    src={formData.logoUrl}
                    alt="Logo preview"
                    className="max-h-24 object-contain rounded-lg border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Botón guardar */}
          <Button
            type="submit"
            className="w-full gap-2"
            size="lg"
            disabled={isLoading || !formData.nombre}
          >
            <Save className="h-5 w-5" />
            {isLoading ? "Guardando..." : "Guardar Configuración"}
          </Button>
        </form>
      </main>

      <BottomNavigation />
    </div>
  );
}
