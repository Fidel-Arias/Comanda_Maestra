import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { usePOS } from "@/features/auth/contexts/POSContext";
import { BottomNavigation } from "@/components/layout/BottomNavigation";
import { Button } from "@/components/ui/forms/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/display/card";
import { Badge } from "@/components/ui/display/badge";
import { Input } from "@/components/ui/forms/input";
import { Label } from "@/components/ui/forms/label";
import { Textarea } from "@/components/ui/forms/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/overlays/dialog";
import {
  DollarSign, CreditCard, Smartphone, LogOut,
  Loader2, Check, Receipt, Banknote, Clock, Users,
  LockOpen, Lock, AlertTriangle, Calculator, Wallet, Search, History, RotateCcw, Eye, Edit
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type MetodoPago = "EFECTIVO" | "TARJETA" | "YAPE" | "PLIN";

const metodosPago: { id: MetodoPago; label: string; icon: React.ElementType; color: string }[] = [
  { id: "EFECTIVO", label: "Efectivo", icon: Banknote, color: "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" },
  { id: "YAPE", label: "Yape", icon: Smartphone, color: "bg-purple-500/20 border-purple-500/50 text-purple-400" },
  { id: "PLIN", label: "Plin", icon: Smartphone, color: "bg-cyan-500/20 border-cyan-500/50 text-cyan-400" },
  { id: "TARJETA", label: "Tarjeta", icon: CreditCard, color: "bg-blue-500/20 border-blue-500/50 text-blue-400" },
];

export default function Cajero() {
  const [, navigate] = useLocation();
  const { empleado, empresa, logout } = usePOS();
  const [selectedPedido, setSelectedPedido] = useState<number | null>(null);
  const [selectedMetodo, setSelectedMetodo] = useState<MetodoPago>("EFECTIVO");
  const [montoPagado, setMontoPagado] = useState("");
  const [showPagoDialog, setShowPagoDialog] = useState(false);

  // Estados para apertura/cierre de caja
  const [showAbrirCajaDialog, setShowAbrirCajaDialog] = useState(false);
  const [showCerrarCajaDialog, setShowCerrarCajaDialog] = useState(false);
  const [montoInicial, setMontoInicial] = useState("");
  const [montoFinalContado, setMontoFinalContado] = useState("");
  const [observacionesCierre, setObservacionesCierre] = useState("");
  const [activeTab, setActiveTab] = useState<'cobrar' | 'historial'>('cobrar');

  // Estados para facturación
  const [tipoComprobante, setTipoComprobante] = useState<"TICKET" | "BOLETA" | "FACTURA">("BOLETA");
  const [rucCliente, setRucCliente] = useState("");
  const [nombreCliente, setNombreCliente] = useState("");
  const [direccionCliente, setDireccionCliente] = useState("");

  // Queries
  const { data: pedidosActivos, isLoading, refetch } = trpc.pedido.listActivos.useQuery(
    { empresaId: empresa?.id || 0 },
    { enabled: !!empresa, refetchInterval: 5000 }
  );

  const { data: historialVentas, refetch: refetchHistorial } = trpc.billing.listVentasHistorial.useQuery(
    { empresaId: empresa?.id || 0 },
    { enabled: !!empresa && activeTab === 'historial' }
  );

  // Detalles Venta
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedVentaId, setSelectedVentaId] = useState<number | null>(null);

  const { data: ventaDetails } = trpc.billing.getVentaDetails.useQuery(
    { ventaId: selectedVentaId! },
    { enabled: !!selectedVentaId && showDetailsDialog }
  );

  // Estados Anulación
  const [showAnularDialog, setShowAnularDialog] = useState(false);
  const [ventaToAnularId, setVentaToAnularId] = useState<number | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");

  const anularVentaMutation = trpc.billing.anularVenta.useMutation({
    onSuccess: (data: any) => {
      toast.success("Venta anulada. Redirigiendo a edición...");
      refetchHistorial();
      refetch();
      if (data.mesaId) {
        // Redirigir a la edición del pedido en modo corrección
        navigate(`/pedido/${data.mesaId}?mode=correction`);
      }
    },
    onError: (e) => toast.error(e.message)
  });

  const handleAnularVenta = (ventaId: number) => {
    setVentaToAnularId(ventaId);
    setMotivoAnulacion("");
    setShowAnularDialog(true);
  };

  const confirmarAnulacion = () => {
    if (!ventaToAnularId || !motivoAnulacion.trim()) {
      toast.error("Debe ingresar un motivo de anulación");
      return;
    }
    anularVentaMutation.mutate({
      ventaId: ventaToAnularId,
      motivo: motivoAnulacion
    });
    setShowAnularDialog(false);
  };

  const { data: mesas } = trpc.mesa.listByEmpresa.useQuery(
    { empresaId: empresa?.id || 0 },
    { enabled: !!empresa?.id }
  );

  const { data: empleados } = trpc.empleado.listByEmpresa.useQuery(
    { empresaId: empresa?.id || 0 },
    { enabled: !!empresa?.id }
  );

  // Query para caja abierta
  const { data: cajaAbierta, refetch: refetchCaja } = trpc.caja.getCajaAbiertaByEmpresa.useQuery(
    { empresaId: empresa?.id || 0 },
    { enabled: !!empresa?.id }
  );

  // Query para el último cierre
  const { data: ultimoCierre } = trpc.caja.getUltimoCierre.useQuery(
    { empresaId: empresa?.id || 0 },
    { enabled: !!empresa?.id && !cajaAbierta }
  );

  // Query para ventas desde apertura de caja
  const { data: ventasCaja, refetch: refetchVentas } = trpc.caja.getVentasDesdeFecha.useQuery(
    {
      empresaId: empresa?.id || 0,
      fechaDesde: cajaAbierta?.fechaApertura?.toISOString() || new Date().toISOString()
    },
    { enabled: !!empresa?.id && !!cajaAbierta }
  );

  // Mutations
  const createPagoMutation = trpc.pago.create.useMutation();
  const abrirCajaMutation = trpc.caja.abrir.useMutation();
  const cerrarCajaMutation = trpc.caja.cerrar.useMutation();
  const createVentaMutation = trpc.billing.createVenta.useMutation();
  const generateComprobanteMutation = trpc.billing.generateComprobante.useMutation();
  const consultarEntidadMutation = trpc.billing.consultarEntidad.useMutation({
    onSuccess: (data) => {
      if (data) {
        setNombreCliente(data.razon_social);
        if (data.direccion) setDireccionCliente(data.direccion);
        toast.success("Contribuyente encontrado");
      }
    },
    onError: (error) => {
      toast.error(`Error al consultar: ${error.message}`);
    }
  });

  const handleConsultarEntidad = () => {
    if (rucCliente.length < 8) {
      toast.error("Ingrese un documento válido (8 o 11 dígitos)");
      return;
    }
    consultarEntidadMutation.mutate({ numero: rucCliente });
  };

  const pedidoSeleccionado = useMemo(() => {
    return pedidosActivos?.find(p => p.id === selectedPedido);
  }, [pedidosActivos, selectedPedido]);

  const getMesaNumero = (mesaId: number) => {
    return mesas?.find(m => m.id === mesaId)?.numero || mesaId;
  };

  const getMozoNombre = (mozoId: number) => {
    const mozo = empleados?.find(e => e.id === mozoId);
    return mozo ? `${mozo.nombre} ${mozo.apellido?.[0] || ""}.` : "N/A";
  };

  const calcularVuelto = () => {
    if (!pedidoSeleccionado) return 0;
    const total = parseFloat(pedidoSeleccionado.total || "0");
    const pagado = parseFloat(montoPagado) || 0;
    return Math.max(0, pagado - total);
  };

  // Calcular resumen de caja para cierre
  const resumenCaja = useMemo(() => {
    if (!cajaAbierta || !ventasCaja) return null;

    const montoInicialNum = parseFloat(cajaAbierta.montoInicial || "0");
    const totalVentas = parseFloat(ventasCaja.total || "0");
    const totalEfectivo = parseFloat(ventasCaja.efectivo || "0");
    const totalTarjeta = parseFloat(ventasCaja.tarjeta || "0");
    const totalYape = parseFloat(ventasCaja.yape || "0");
    const totalPlin = parseFloat(ventasCaja.plin || "0");
    const esperadoEnCaja = montoInicialNum + totalEfectivo;
    const montoContado = parseFloat(montoFinalContado) || 0;
    const diferencia = montoContado - esperadoEnCaja;

    return {
      montoInicial: montoInicialNum,
      totalVentas,
      totalEfectivo,
      totalTarjeta,
      totalYape,
      totalPlin,
      esperadoEnCaja,
      diferencia,
      cantidadVentas: ventasCaja.count || 0
    };
  }, [cajaAbierta, ventasCaja, montoFinalContado]);

  const handleSelectPedido = (pedidoId: number) => {
    if (!cajaAbierta) {
      toast.error("Debe abrir la caja antes de procesar pagos");
      return;
    }
    setSelectedPedido(pedidoId);
    const pedido = pedidosActivos?.find(p => p.id === pedidoId);
    if (pedido) {
      setMontoPagado(pedido.total || "0");
    }
    setShowPagoDialog(true);
  };

  const handleProcesarPago = async () => {
    if (!pedidoSeleccionado || !empleado || !empresa || !cajaAbierta) return;

    const total = parseFloat(pedidoSeleccionado.total || "0");
    const pagado = parseFloat(montoPagado) || 0;

    if (selectedMetodo === "EFECTIVO" && pagado < total) {
      toast.error("El monto recibido es menor al total");
      return;
    }

    try {
      setShowPagoDialog(false); // Cerrar modal inmediatamente para mostrar carga en tarjeta

      // 1. Registrar el Pago en caja
      await createPagoMutation.mutateAsync({
        empresaId: empresa.id,
        pedidoId: pedidoSeleccionado.id,
        cajeroId: empleado.id,
        metodoPago: selectedMetodo,
        monto: total.toFixed(2),
        montoPagado: (selectedMetodo === "EFECTIVO" ? pagado : total).toFixed(2),
        vuelto: (selectedMetodo === "EFECTIVO" ? (pagado - total) : 0).toFixed(2),
      });

      // 2. Crear Registro de Venta Fiscal
      const venta = await createVentaMutation.mutateAsync({
        empresaId: empresa.id,
        pedidoId: pedidoSeleccionado.id,
        total: total.toFixed(2),
        subtotal: (total / 1.18).toFixed(2),
        igv: (total - (total / 1.18)).toFixed(2),
      });

      // 3. Generar Comprobante Electrónico (Boleta/Factura)
      if (tipoComprobante !== "TICKET") {
        await generateComprobanteMutation.mutateAsync({
          empresaId: empresa.id,
          ventaId: venta.id,
          tipo: tipoComprobante,
          serie: tipoComprobante === "FACTURA" ? "FFF1" : "BBB1",
          rucCliente: rucCliente || undefined,
          nombreCliente: nombreCliente || undefined,
        });
        toast.success(`${tipoComprobante} generada correctamente`);
      }

      toast.success(`Pago procesado con éxito`);
      setShowPagoDialog(false);
      setSelectedPedido(null);
      setMontoPagado("");
      setTipoComprobante("TICKET");
      setRucCliente("");
      setNombreCliente("");
      refetch();
      refetchVentas();
    } catch (error) {
      console.error(error);
      toast.error("Error al procesar el pago y facturación");
    }
  };

  const handleAbrirCaja = async () => {
    if (!empleado || !empresa) return;

    const monto = parseFloat(montoInicial) || 0;
    if (monto < 0) {
      toast.error("El monto inicial no puede ser negativo");
      return;
    }

    try {
      const result = await abrirCajaMutation.mutateAsync({
        empresaId: empresa.id,
        cajeroId: empleado.id,
        montoInicial: monto.toFixed(2),
      });

      if (result.success) {
        toast.success("Caja abierta correctamente");
        setShowAbrirCajaDialog(false);
        setMontoInicial("");
        refetchCaja();
      } else {
        toast.error(result.error || "Error al abrir la caja");
      }
    } catch (error) {
      toast.error("Error al abrir la caja");
    }
  };

  const handleCerrarCaja = async () => {
    if (!cajaAbierta || !resumenCaja) return;

    const montoContado = parseFloat(montoFinalContado) || 0;
    if (montoContado < 0) {
      toast.error("El monto contado no puede ser negativo");
      return;
    }

    try {
      await cerrarCajaMutation.mutateAsync({
        cajaId: cajaAbierta.id,
        montoFinal: montoContado.toFixed(2),
        totalVentas: resumenCaja.totalVentas.toFixed(2),
        totalEfectivo: resumenCaja.totalEfectivo.toFixed(2),
        totalTarjeta: resumenCaja.totalTarjeta.toFixed(2),
        totalYape: resumenCaja.totalYape.toFixed(2),
        totalPlin: resumenCaja.totalPlin.toFixed(2),
        diferencia: resumenCaja.diferencia.toFixed(2),
        observaciones: observacionesCierre || undefined,
      });

      toast.success("Caja cerrada correctamente");
      setShowCerrarCajaDialog(false);
      setMontoFinalContado("");
      setObservacionesCierre("");
      refetchCaja();
    } catch (error) {
      toast.error("Error al cerrar la caja");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  if (!empleado || !empresa) {
    navigate("/");
    return null;
  }

  // Verificar que el rol tenga acceso a esta vista
  if (!['CAJERO', 'DUENO', 'ADMIN'].includes(empleado.rol)) {
    navigate("/mozo");
    return null;
  }

  // Filtrar pedidos que están listos para cobrar
  const pedidosParaCobrar = pedidosActivos?.filter(
    p => p.orderStatus === "PREPARANDO" || p.orderStatus === "LISTO" || p.orderStatus === "PENDIENTE" || p.orderStatus === "ENTREGADO"
  ) || [];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-card/95 backdrop-blur-sm">
        <div className="container py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/50 flex items-center justify-center overflow-hidden">
                {empresa.logoUrl ? (
                  <img src={empresa.logoUrl} alt={empresa.nombre} className="w-full h-full object-cover" />
                ) : (
                  <DollarSign className="h-5 w-5 text-amber-400" />
                )}
              </div>
              <div>
                <h1 className="font-bold text-foreground">{empresa.nombre}</h1>
                <p className="text-xs text-muted-foreground">
                  {empleado.nombre} • <span className="text-amber-400">{empleado.rol}</span>
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        {/* Estado de Caja */}
        <Card className={cn(
          "mb-6 border-2",
          cajaAbierta
            ? "bg-emerald-500/10 border-emerald-500/50"
            : "bg-red-500/10 border-red-500/50"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-12 h-12 rounded-lg flex items-center justify-center",
                  cajaAbierta ? "bg-emerald-500/20" : "bg-red-500/20"
                )}>
                  {cajaAbierta ? (
                    <LockOpen className="h-6 w-6 text-emerald-400" />
                  ) : (
                    <Lock className="h-6 w-6 text-red-400" />
                  )}
                </div>
                <div>
                  <h2 className={cn(
                    "font-bold text-lg",
                    cajaAbierta ? "text-emerald-400" : "text-red-400"
                  )}>
                    {cajaAbierta ? "CAJA ABIERTA" : "CAJA CERRADA"}
                  </h2>
                  {cajaAbierta ? (
                    <p className="text-xs text-muted-foreground">
                      Abierta: {new Date(cajaAbierta.fechaApertura).toLocaleString('es-PE')}
                      {" • "}Monto inicial: S/ {parseFloat(cajaAbierta.montoInicial || "0").toFixed(2)}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Debe abrir la caja para procesar pagos
                    </p>
                  )}
                </div>
              </div>
              <div>
                {cajaAbierta ? (
                  <Button
                    variant="outline"
                    className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                    onClick={() => setShowCerrarCajaDialog(true)}
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    Cerrar Caja
                  </Button>
                ) : (
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => setShowAbrirCajaDialog(true)}
                  >
                    <LockOpen className="h-4 w-4 mr-2" />
                    Abrir Caja
                  </Button>
                )}
              </div>
            </div>

            {/* Resumen de ventas si la caja está abierta */}
            {cajaAbierta && ventasCaja && (
              <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="text-center p-2 rounded-lg bg-background/50">
                  <p className="text-xs text-muted-foreground">Ventas</p>
                  <p className="text-lg font-bold text-foreground">{ventasCaja.count}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-background/50">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-lg font-bold text-emerald-400">S/ {parseFloat(ventasCaja.total || "0").toFixed(0)}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-background/50">
                  <p className="text-xs text-muted-foreground">Efectivo</p>
                  <p className="text-lg font-bold text-foreground">S/ {parseFloat(ventasCaja.efectivo || "0").toFixed(0)}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-background/50">
                  <p className="text-xs text-muted-foreground">Yape/Plin</p>
                  <p className="text-lg font-bold text-foreground">
                    S/ {(parseFloat(ventasCaja.yape || "0") + parseFloat(ventasCaja.plin || "0")).toFixed(0)}
                  </p>
                </div>
                <div className="text-center p-2 rounded-lg bg-background/50">
                  <p className="text-xs text-muted-foreground">Tarjeta</p>
                  <p className="text-lg font-bold text-foreground">S/ {parseFloat(ventasCaja.tarjeta || "0").toFixed(0)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Receipt className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {pedidosParaCobrar.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Cuentas activas</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    S/ {pedidosParaCobrar.reduce((acc, p) => acc + parseFloat(p.total || "0"), 0).toFixed(0)}
                  </div>
                  <div className="text-xs text-muted-foreground">Por cobrar</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navegación y Contenido */}
        <div className="flex bg-muted/20 p-1 rounded-lg w-fit mb-6 mt-6">
          <button onClick={() => setActiveTab('cobrar')} className={cn("px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2", activeTab === 'cobrar' ? "bg-background shadow text-primary" : "text-muted-foreground hover:bg-muted/50")}>
            <Receipt className="h-4 w-4" /> Cuentas por Cobrar
          </button>
          <button onClick={() => setActiveTab('historial')} className={cn("px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2", activeTab === 'historial' ? "bg-background shadow text-primary" : "text-muted-foreground hover:bg-muted/50")}>
            <History className="h-4 w-4" /> Historial de Ventas
          </button>
        </div>

        {activeTab === 'cobrar' ? (
          <>
            {!cajaAbierta && (
              <Card className="mb-4 bg-amber-500/10 border-amber-500/50"><CardContent className="p-4 flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-amber-400" /><p className="text-sm text-amber-400">Debe abrir la caja antes de procesar pagos</p></CardContent></Card>
            )}

            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : pedidosParaCobrar.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed"><Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No hay cuentas pendientes de cobro</p></div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pedidosParaCobrar.map((pedido) => (
                  <Card key={pedido.id} className={cn("relative cursor-pointer hover:border-primary transition-colors", !cajaAbierta && "opacity-50 cursor-not-allowed")} onClick={() => handleSelectPedido(pedido.id)}>
                    {createPagoMutation.isPending && createPagoMutation.variables?.pedidoId === pedido.id && (
                      <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10 rounded-xl backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <span className="text-sm font-medium text-primary">Procesando...</span>
                        </div>
                      </div>
                    )}
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg">Mesa {getMesaNumero(pedido.mesaId)}</h3>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-muted" onClick={(e) => { e.stopPropagation(); navigate(`/pedido/${pedido.mesaId}`); }} title="Editar Pedido">
                              <Edit className="h-3 w-3 text-muted-foreground hover:text-primary" />
                            </Button>
                            <Badge variant="outline" className={cn("text-xs", pedido.orderStatus === "LISTO" && "text-emerald-400 border-emerald-500/50", pedido.orderStatus === "PREPARANDO" && "text-amber-400 border-amber-500/50", pedido.orderStatus === "PENDIENTE" && "text-blue-400 border-blue-500/50", pedido.orderStatus === "ENTREGADO" && "text-green-400 border-green-500/50")}>
                              {pedido.orderStatus === "ENTREGADO" ? "CONSUMIENDO" : pedido.orderStatus}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{getMozoNombre(pedido.mozoId)}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(pedido.createdAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">S/ {parseFloat(pedido.total || "0").toFixed(2)}</div>
                          <Button size="sm" className="mt-2" disabled={!cajaAbierta}>Cobrar</Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="border rounded-lg overflow-hidden bg-card animate-in fade-in slide-in-from-bottom-2">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Fecha</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Hora</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Comprobante</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-right">Total</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Estado</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-foreground">
                  {(!historialVentas || historialVentas.length === 0) && (
                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No hay ventas registradas hoy</td></tr>
                  )}
                  {historialVentas?.map((item: any) => (
                    <tr key={item.ventas.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3 text-sm">{new Date(item.ventas.createdAt).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(item.ventas.createdAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true })}</td>
                      <td className="px-4 py-3 font-mono">
                        {item.comprobantes ? (
                          <div>
                            <span className="font-bold">{item.comprobantes.serie}-{item.comprobantes.numero}</span>
                            <div className="text-[10px] text-muted-foreground">{item.comprobantes.tipo}</div>
                          </div>
                        ) : <span className="text-muted-foreground italic">Ticket</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium truncate max-w-[150px]">{item.clientes?.nombre || item.comprobantes?.rucCliente || 'Público General'}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-500">S/ {parseFloat(item.ventas.total).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        {item.ventas.estado === 'ANULADA' ? (
                          <Badge variant="destructive" className="text-[10px]">ANULADA</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-500 bg-emerald-500/10">PAGADO</Badge>
                        )}
                        {item.comprobantes?.sunatStatus === 'ANULADO' && <div className="text-[10px] text-red-400 mt-1">SUNAT: BAJA</div>}
                      </td>
                      <td className="px-4 py-3 text-center flex items-center justify-center gap-1">
                        <Button
                          variant="ghost" size="sm"
                          className="text-blue-400 hover:text-blue-500 hover:bg-blue-500/10 h-8 w-8 p-0"
                          onClick={() => { setSelectedVentaId(item.ventas.id); setShowDetailsDialog(true); }}
                          title="Ver Productos"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        {item.ventas.estado !== 'ANULADA' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-500 hover:bg-red-500/10 h-8 text-xs ml-1"
                            onClick={() => handleAnularVenta(item.ventas.id)}
                            disabled={anularVentaMutation.isPending}
                          >
                            {anularVentaMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3 mr-2" />}
                            Anular
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Dialog de Abrir Caja */}
      <Dialog open={showAbrirCajaDialog} onOpenChange={setShowAbrirCajaDialog}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LockOpen className="h-5 w-5 text-emerald-400" />
              Abrir Caja
            </DialogTitle>
            <DialogDescription>
              Ingrese el monto inicial en efectivo para comenzar el turno
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {ultimoCierre && (
              <Card className="bg-muted/30 border-dashed">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Clock className="h-4 w-4" />
                    Último Cierre Registrado
                  </div>
                  <div className="grid grid-cols-2 gap-y-1 text-sm text-white">
                    <span className="text-white/70">Fecha:</span>
                    <span className="text-right">{new Date(ultimoCierre.fechaCierre!).toLocaleDateString('es-PE')}</span>
                    <span className="text-white/70">Monto Final:</span>
                    <span className="text-right font-bold text-emerald-400">S/ {parseFloat(ultimoCierre.montoFinal || "0").toFixed(2)}</span>
                    <span className="text-white/70">Ventas:</span>
                    <span className="text-right">S/ {parseFloat(ultimoCierre.totalVentas || "0").toFixed(2)}</span>
                  </div>
                  <div className="pt-2 border-t border-border/50">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-8 text-xs text-primary hover:bg-primary/10 text-white/70"
                      onClick={() => setMontoInicial(parseFloat(ultimoCierre.montoFinal || "0").toString())}
                    >
                      Usar como monto inicial
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div>
              <Label htmlFor="montoInicial">Monto Inicial en Efectivo</Label>
              <div className="relative mt-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">S/</span>
                <Input
                  id="montoInicial"
                  type="number"
                  step="0.01"
                  min="0"
                  value={montoInicial}
                  onChange={(e) => setMontoInicial(e.target.value)}
                  className="pl-10 text-lg"
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Este es el dinero que hay en caja al iniciar el turno
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAbrirCajaDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAbrirCaja}
              disabled={abrirCajaMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {abrirCajaMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <LockOpen className="h-4 w-4 mr-2" />
              )}
              Abrir Caja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Cerrar Caja */}
      <Dialog open={showCerrarCajaDialog} onOpenChange={setShowCerrarCajaDialog}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-red-400" />
              Cerrar Caja
            </DialogTitle>
            <DialogDescription>
              Revise el resumen y cuente el efectivo en caja
            </DialogDescription>
          </DialogHeader>

          {resumenCaja && (
            <div className="py-4 space-y-4">
              {/* Resumen de ventas */}
              <div className="p-4 rounded-xl bg-muted/30 space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Resumen del Turno
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monto inicial:</span>
                    <span>S/ {resumenCaja.montoInicial.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ventas totales:</span>
                    <span className="text-emerald-400 font-medium">S/ {resumenCaja.totalVentas.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Efectivo:</span>
                    <span>S/ {resumenCaja.totalEfectivo.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tarjeta:</span>
                    <span>S/ {resumenCaja.totalTarjeta.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Yape:</span>
                    <span>S/ {resumenCaja.totalYape.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Plin:</span>
                    <span>S/ {resumenCaja.totalPlin.toFixed(2)}</span>
                  </div>
                </div>
                <div className="pt-3 border-t border-border/50">
                  <div className="flex justify-between font-semibold">
                    <span>Esperado en caja (efectivo):</span>
                    <span className="text-primary">S/ {resumenCaja.esperadoEnCaja.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Conteo de efectivo */}
              <div>
                <Label htmlFor="montoContado" className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Monto Contado en Caja
                </Label>
                <div className="relative mt-2">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">S/</span>
                  <Input
                    id="montoContado"
                    type="number"
                    step="0.01"
                    min="0"
                    value={montoFinalContado}
                    onChange={(e) => setMontoFinalContado(e.target.value)}
                    className="pl-10 text-lg"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Diferencia */}
              {montoFinalContado && (
                <div className={cn(
                  "p-4 rounded-xl",
                  resumenCaja.diferencia === 0 && "bg-emerald-500/20 border border-emerald-500/50",
                  resumenCaja.diferencia > 0 && "bg-blue-500/20 border border-blue-500/50",
                  resumenCaja.diferencia < 0 && "bg-red-500/20 border border-red-500/50"
                )}>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Diferencia:</span>
                    <span className={cn(
                      "text-xl font-bold",
                      resumenCaja.diferencia === 0 && "text-emerald-400",
                      resumenCaja.diferencia > 0 && "text-blue-400",
                      resumenCaja.diferencia < 0 && "text-red-400"
                    )}>
                      {resumenCaja.diferencia >= 0 ? "+" : ""}S/ {resumenCaja.diferencia.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {resumenCaja.diferencia === 0 && "Cuadre perfecto"}
                    {resumenCaja.diferencia > 0 && "Sobrante en caja"}
                    {resumenCaja.diferencia < 0 && "Faltante en caja"}
                  </p>
                </div>
              )}

              {/* Observaciones */}
              <div>
                <Label htmlFor="observaciones">Observaciones (opcional)</Label>
                <Textarea
                  id="observaciones"
                  value={observacionesCierre}
                  onChange={(e) => setObservacionesCierre(e.target.value)}
                  className="mt-2"
                  placeholder="Notas sobre el cierre de caja..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCerrarCajaDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCerrarCaja}
              disabled={cerrarCajaMutation.isPending || !montoFinalContado}
              className="bg-red-600 hover:bg-red-700"
            >
              {cerrarCajaMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Lock className="h-4 w-4 mr-2" />
              )}
              Cerrar Caja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Pago */}
      <Dialog open={showPagoDialog} onOpenChange={setShowPagoDialog}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Procesar Pago - Mesa {pedidoSeleccionado && getMesaNumero(pedidoSeleccionado.mesaId)}
            </DialogTitle>
          </DialogHeader>

          {pedidoSeleccionado && (
            <div className="py-4 space-y-6">
              {/* Total */}
              <div className="text-center p-4 rounded-xl bg-muted/30">
                <p className="text-sm text-muted-foreground mb-1">Total a pagar</p>
                <p className="text-4xl font-bold text-primary">
                  S/ {parseFloat(pedidoSeleccionado.total || "0").toFixed(2)}
                </p>
              </div>

              {/* Método de pago */}
              <div>
                <Label className="mb-3 block">Método de pago</Label>
                <div className="grid grid-cols-2 gap-2">
                  {metodosPago.map((metodo) => {
                    const Icon = metodo.icon;
                    return (
                      <button
                        key={metodo.id}
                        onClick={() => setSelectedMetodo(metodo.id)}
                        className={cn(
                          "p-3 rounded-lg border-2 transition-all flex items-center gap-2",
                          metodo.color,
                          selectedMetodo === metodo.id && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="font-medium">{metodo.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Monto pagado (solo para efectivo) */}
              {selectedMetodo === "EFECTIVO" && (
                <div>
                  <Label htmlFor="montoPagado">Monto recibido</Label>
                  <Input
                    id="montoPagado"
                    type="number"
                    step="0.01"
                    value={montoPagado}
                    onChange={(e) => setMontoPagado(e.target.value)}
                    className="mt-2 text-lg"
                    placeholder="0.00"
                  />
                  {calcularVuelto() > 0 && (
                    <div className="mt-3 p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/50">
                      <p className="text-sm text-muted-foreground">Vuelto</p>
                      <p className="text-2xl font-bold text-emerald-400">
                        S/ {calcularVuelto().toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Tipo de Comprobante */}
              <div className="pt-4 border-t border-border">
                <Label className="mb-3 block">Tipo de Comprobante</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["BOLETA", "FACTURA"] as const).map((tipo) => (
                    <button
                      key={tipo}
                      onClick={() => setTipoComprobante(tipo)}
                      className={cn(
                        "p-2 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all",
                        tipoComprobante === tipo
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/50"
                      )}
                    >
                      <span className="text-xs font-bold">{tipo}</span>
                    </button>
                  ))}
                </div>

                <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2">
                  <div>
                    <Label htmlFor="ruc">{tipoComprobante === "FACTURA" ? "RUC" : "DNI/RUC"} del Cliente</Label>
                    <div className="relative mt-1">
                      <Input
                        id="ruc"
                        placeholder={tipoComprobante === "FACTURA" ? "Ingrese RUC (11 dígitos)" : "Ingrese documento (opcional)"}
                        value={rucCliente}
                        onChange={(e) => setRucCliente(e.target.value)}
                        maxLength={11}
                        className="pr-10"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleConsultarEntidad();
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full w-10 text-muted-foreground hover:text-primary"
                        onClick={handleConsultarEntidad}
                        disabled={consultarEntidadMutation.isPending}
                      >
                        {consultarEntidadMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="razon">{tipoComprobante === "FACTURA" ? "Razón Social" : "Nombre del Cliente"}</Label>
                    <Input
                      id="razon"
                      placeholder={tipoComprobante === "FACTURA" ? "Razón Social" : "Nombre (opcional)"}
                      value={nombreCliente}
                      onChange={(e) => setNombreCliente(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  {tipoComprobante === "FACTURA" && (
                    <div>
                      <Label htmlFor="direccion">Dirección Fiscal</Label>
                      <Input
                        id="direccion"
                        value={direccionCliente}
                        onChange={(e) => setDireccionCliente(e.target.value)}
                        className="mt-1"
                        placeholder="Dirección completa"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPagoDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleProcesarPago}
              disabled={createPagoMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {createPagoMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Confirmar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Detalle Venta */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="bg-card border-border max-w-xl">
          <DialogHeader>
            <DialogTitle>Detalle de Venta</DialogTitle>
            <DialogDescription>Productos incluidos en la venta</DialogDescription>
          </DialogHeader>

          <div className="border rounded-lg overflow-hidden mt-4">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Producto</th>
                  <th className="px-4 py-2 text-center font-medium">Cant.</th>
                  <th className="px-4 py-2 text-right font-medium">P. Unit</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ventaDetails?.map((d: any) => (
                  <tr key={d.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-2 font-medium">{d.descripcion}</td>
                    <td className="px-4 py-2 text-center">{d.cantidad}</td>
                    <td className="px-4 py-2 text-right">S/ {parseFloat(d.precioUnitario).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-medium text-emerald-500">S/ {parseFloat(d.subtotal).toFixed(2)}</td>
                  </tr>
                ))}
                {!ventaDetails && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Cargando detalles...</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Anulación */}
      <Dialog open={showAnularDialog} onOpenChange={setShowAnularDialog}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Confirmar Anulación</DialogTitle>
            <DialogDescription>
              Esta acción anulará la venta y el comprobante asociado. El pedido será restaurado a "Cuentas por Cobrar" para su corrección.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-2">
            <Label htmlFor="motivoAnulacion">Motivo de Anulación</Label>
            <Textarea
              id="motivoAnulacion"
              placeholder="Ej: Error en el cobro, cliente devolvió producto..."
              value={motivoAnulacion}
              onChange={(e) => setMotivoAnulacion(e.target.value)}
              className="mt-2 min-h-[100px]"
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAnularDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmarAnulacion}
              disabled={anularVentaMutation.isPending}
            >
              {anularVentaMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar Anulación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNavigation />
    </div >
  );
}
