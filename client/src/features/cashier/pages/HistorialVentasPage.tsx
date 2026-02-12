import { useState, useMemo } from "react";
import { usePOS } from "@/features/auth/contexts/POSContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/forms/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/display/card";
import { Input } from "@/components/ui/forms/input";
import { Label } from "@/components/ui/forms/label";
import { Badge } from "@/components/ui/display/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/overlays/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/forms/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/display/table";
import { BottomNavigation } from "@/components/layout/BottomNavigation";
import { useLocation } from "wouter";
import {
  ArrowLeft, Filter, Eye, Receipt, Calendar,
  DollarSign, User, Loader2
} from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, startOfMonth, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

type FilterPreset = "hoy" | "ayer" | "semana" | "mes" | "custom";

export default function HistorialVentas() {
  const { empleado, empresa } = usePOS();
  const [, setLocation] = useLocation();
  const [filterPreset, setFilterPreset] = useState<FilterPreset>("hoy");
  const [fechaInicio, setFechaInicio] = useState(format(new Date(), "yyyy-MM-dd"));
  const [fechaFin, setFechaFin] = useState(format(new Date(), "yyyy-MM-dd"));
  const [mozoFilter, setMozoFilter] = useState<string>("all");
  const [selectedVenta, setSelectedVenta] = useState<number | null>(null);
  const [detalleOpen, setDetalleOpen] = useState(false);

  // Calcular fechas según el preset seleccionado
  const fechasCalculadas = useMemo(() => {
    const hoy = new Date();

    switch (filterPreset) {
      case "hoy":
        return {
          inicio: format(startOfDay(hoy), "yyyy-MM-dd"),
          fin: format(endOfDay(hoy), "yyyy-MM-dd")
        };
      case "ayer":
        const ayer = subDays(hoy, 1);
        return {
          inicio: format(startOfDay(ayer), "yyyy-MM-dd"),
          fin: format(endOfDay(ayer), "yyyy-MM-dd")
        };
      case "semana":
        return {
          inicio: format(startOfWeek(hoy, { weekStartsOn: 1 }), "yyyy-MM-dd"),
          fin: format(endOfDay(hoy), "yyyy-MM-dd")
        };
      case "mes":
        return {
          inicio: format(startOfMonth(hoy), "yyyy-MM-dd"),
          fin: format(endOfDay(hoy), "yyyy-MM-dd")
        };
      case "custom":
      default:
        return {
          inicio: fechaInicio,
          fin: fechaFin
        };
    }
  }, [filterPreset, fechaInicio, fechaFin]);

  // Query con fechas corregidas - usar ISO string completo
  const { data: ventas, isLoading, refetch } = trpc.historial.getVentas.useQuery(
    {
      empresaId: empleado?.empresaId || 0,
      fechaInicio: fechasCalculadas.inicio,
      fechaFin: fechasCalculadas.fin,
      mozoId: mozoFilter !== "all" ? parseInt(mozoFilter) : undefined,
    },
    {
      enabled: !!empleado?.empresaId,
      refetchOnWindowFocus: true,
    }
  );

  const { data: empleados } = trpc.empleado.listByEmpresa.useQuery(
    { empresaId: empleado?.empresaId || 0 },
    { enabled: !!empleado?.empresaId }
  );

  const { data: detalleVenta } = trpc.historial.getDetalleVenta.useQuery(
    { pedidoId: selectedVenta || 0 },
    { enabled: !!selectedVenta }
  );

  const mozos = empleados?.filter(e => e.userRole === "MOZO") || [];

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return `S/ ${num.toFixed(2)}`;
  };

  const totalVentas = ventas?.reduce((sum, v) => sum + parseFloat(v.total || "0"), 0) || 0;

  const handlePresetChange = (preset: FilterPreset) => {
    setFilterPreset(preset);
    if (preset !== "custom") {
      // Actualizar fechas visibles para el usuario
      const hoy = new Date();
      switch (preset) {
        case "hoy":
          setFechaInicio(format(hoy, "yyyy-MM-dd"));
          setFechaFin(format(hoy, "yyyy-MM-dd"));
          break;
        case "ayer":
          const ayer = subDays(hoy, 1);
          setFechaInicio(format(ayer, "yyyy-MM-dd"));
          setFechaFin(format(ayer, "yyyy-MM-dd"));
          break;
        case "semana":
          setFechaInicio(format(startOfWeek(hoy, { weekStartsOn: 1 }), "yyyy-MM-dd"));
          setFechaFin(format(hoy, "yyyy-MM-dd"));
          break;
        case "mes":
          setFechaInicio(format(startOfMonth(hoy), "yyyy-MM-dd"));
          setFechaFin(format(hoy, "yyyy-MM-dd"));
          break;
      }
    }
  };

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
            <h1 className="text-lg font-semibold text-foreground">Historial de Ventas</h1>
            <p className="text-sm text-muted-foreground">Consulta los pedidos cerrados</p>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Filtros rápidos */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { id: "hoy" as FilterPreset, label: "Hoy" },
            { id: "ayer" as FilterPreset, label: "Ayer" },
            { id: "semana" as FilterPreset, label: "Esta semana" },
            { id: "mes" as FilterPreset, label: "Este mes" },
            { id: "custom" as FilterPreset, label: "Personalizado" },
          ].map((preset) => (
            <Button
              key={preset.id}
              variant={filterPreset === preset.id ? "default" : "outline"}
              size="sm"
              onClick={() => handlePresetChange(preset.id)}
              className={cn(
                "whitespace-nowrap",
                filterPreset === preset.id && "bg-primary"
              )}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        {/* Filtros detallados */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fechaInicio">Fecha Inicio</Label>
                <Input
                  id="fechaInicio"
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => {
                    setFechaInicio(e.target.value);
                    setFilterPreset("custom");
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fechaFin">Fecha Fin</Label>
                <Input
                  id="fechaFin"
                  type="date"
                  value={fechaFin}
                  onChange={(e) => {
                    setFechaFin(e.target.value);
                    setFilterPreset("custom");
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Filtrar por Mozo</Label>
              <Select value={mozoFilter} onValueChange={setMozoFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los mozos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los mozos</SelectItem>
                  {mozos.map((mozo) => (
                    <SelectItem key={mozo.id} value={mozo.id.toString()}>
                      {mozo.nombre} {mozo.apellido}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="w-full"
            >
              <Filter className="h-4 w-4 mr-2" />
              Aplicar Filtros
            </Button>
          </CardContent>
        </Card>

        {/* Resumen */}
        <Card className="bg-primary/10 border-primary/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">Total del período:</span>
              </div>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(totalVentas)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {ventas?.length || 0} ventas encontradas
              {filterPreset === "hoy" && " (hoy)"}
              {filterPreset === "ayer" && " (ayer)"}
              {filterPreset === "semana" && " (esta semana)"}
              {filterPreset === "mes" && " (este mes)"}
            </p>
          </CardContent>
        </Card>

        {/* Lista de ventas */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Cargando historial...</p>
          </div>
        ) : ventas && ventas.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Mesa</TableHead>
                      <TableHead>Mozo</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ventas.map((venta: any) => (
                      <TableRow key={venta.pedidoId}>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm">
                              {format(new Date(venta.fecha), "dd/MM/yyyy")}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(venta.fecha), "HH:mm")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            Mesa {venta.mesaNumero}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {venta.mozoNombre || "N/A"}
                        </TableCell>
                        <TableCell className="text-right font-medium text-primary">
                          {formatCurrency(venta.total)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedVenta(venta.pedidoId);
                              setDetalleOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Receipt className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground font-medium">No hay ventas en el período seleccionado</p>
              <p className="text-xs text-muted-foreground mt-2">
                {filterPreset === "hoy" && "No se han registrado ventas hoy"}
                {filterPreset === "ayer" && "No se registraron ventas ayer"}
                {filterPreset === "semana" && "No hay ventas esta semana"}
                {filterPreset === "mes" && "No hay ventas este mes"}
                {filterPreset === "custom" && `Período: ${fechaInicio} al ${fechaFin}`}
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Dialog de detalle */}
      <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Detalle de Venta #{selectedVenta}
            </DialogTitle>
          </DialogHeader>

          {detalleVenta && (
            <div className="space-y-4">
              {/* Info del pedido */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {detalleVenta.pedido?.createdAt && format(new Date(detalleVenta.pedido.createdAt), "PPpp", { locale: es })}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  Mesa: {detalleVenta.pedido?.mesaId || 'N/A'}
                </div>
              </div>

              {/* Items */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-center">Cant.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalleVenta.items.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.productoNombre}</p>
                            {item.notas && (
                              <p className="text-xs text-muted-foreground italic">{item.notas}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{item.cantidad}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.subtotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Totales */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(detalleVenta.pedido?.subtotal || '0')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">IGV (10.5%)</span>
                  <span>{formatCurrency(detalleVenta.pedido?.impuesto || '0')}</span>
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(detalleVenta.pedido?.total || '0')}</span>
                </div>
              </div>

              {/* Info de pago */}
              {detalleVenta.pago && (
                <div className="pt-2 border-t space-y-2">
                  <h4 className="font-medium text-sm">Información de Pago</h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Método</span>
                      <Badge variant="outline">{detalleVenta.pago.paymentMethod}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monto pagado</span>
                      <span>{formatCurrency(detalleVenta.pago.montoPagado || '0')}</span>
                    </div>
                    {detalleVenta.pago.vuelto && parseFloat(detalleVenta.pago.vuelto) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Vuelto</span>
                        <span>{formatCurrency(detalleVenta.pago.vuelto || '0')}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNavigation />
    </div>
  );
}
