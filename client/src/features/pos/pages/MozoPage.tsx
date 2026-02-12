import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { usePOS } from "@/features/auth/contexts/POSContext";
import { BottomNavigation } from "@/components/layout/BottomNavigation";
import { Button } from "@/components/ui/forms/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/display/card";
import { Badge } from "@/components/ui/display/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/overlays/dialog";
import { Input } from "@/components/ui/forms/input";
import { Label } from "@/components/ui/forms/label";
import {
  Users, Clock, DollarSign, LogOut, Plus,
  Loader2, UtensilsCrossed, Building2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type MesaEstado = "DISPONIBLE" | "OCUPADA" | "PIDIENDO_CUENTA" | "RESERVADA";

const estadoConfig: Record<MesaEstado, { label: string; color: string; bgColor: string }> = {
  DISPONIBLE: { label: "Libre", color: "text-emerald-400", bgColor: "bg-emerald-500/20 border-emerald-500/50" },
  OCUPADA: { label: "Ocupada", color: "text-amber-400", bgColor: "bg-amber-500/20 border-amber-500/50" },
  PIDIENDO_CUENTA: { label: "Cuenta", color: "text-red-400", bgColor: "bg-red-500/20 border-red-500/50" },
  RESERVADA: { label: "Reservada", color: "text-rose-300", bgColor: "bg-rose-400/30 border-rose-400/60" },
};

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/overlays/sheet";
import { Bell, ChefHat, Wine, CheckSquare, Coffee } from "lucide-react";

export default function Mozo() {
  const [, navigate] = useLocation();
  const { empleado, empresa, logout } = usePOS();
  const [selectedMesa, setSelectedMesa] = useState<number | null>(null);
  const [personas, setPersonas] = useState("2");
  const [showOcuparDialog, setShowOcuparDialog] = useState(false);

  // Queries
  const { data: mesas, isLoading, refetch } = trpc.mesa.listByEmpresa.useQuery(
    { empresaId: empresa?.id || 0 },
    { enabled: !!empresa?.id }
  );

  const { data: empleados } = trpc.empleado.listByEmpresa.useQuery(
    { empresaId: empresa?.id || 0 },
    { enabled: !!empresa?.id }
  );

  // Mutations
  const updateMesaMutation = trpc.mesa.updateEstado.useMutation();
  const createPedidoMutation = trpc.pedido.create.useMutation();

  const handleMesaClick = (mesaId: number, estado: MesaEstado) => {
    setSelectedMesa(mesaId);

    if (estado === "DISPONIBLE") {
      // Los cajeros no pueden ocupar mesas nuevas, solo verlas
      if (empleado?.rol === "CAJERO") {
        toast.info("La asignación de mesas corresponde al Mozo");
        return;
      }
      setShowOcuparDialog(true);
    } else if (estado === "RESERVADA") {
      toast.info("Mesa reservada. El Cajero debe confirmar la llegada desde el panel de Reservas.");
      return;
    } else if (estado === "OCUPADA" || estado === "PIDIENDO_CUENTA") {
      navigate(`/pedido/${mesaId}`);
    }
  };



  const { data: pedidosListos, refetch: refetchListos } = trpc.pedido.listPedidosListos.useQuery(
    { empresaId: empresa?.id || 0 },
    {
      enabled: !!empresa?.id,
      refetchInterval: 5000
    }
  );

  const updateItemStatusMutation = trpc.itemPedido.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Marcado como entregado");
      refetchListos();
    }
  });

  const handleEntregar = (itemId: number) => {
    updateItemStatusMutation.mutate({ id: itemId, estado: "ENTREGADO" });
  };

  const handleOcuparMesa = async () => {
    if (!selectedMesa || !empleado || !empresa) return;

    try {
      // Crear pedido y ocupar mesa
      await createPedidoMutation.mutateAsync({
        empresaId: empresa.id,
        mesaId: selectedMesa,
        mozoId: empleado.id,
      });

      await updateMesaMutation.mutateAsync({
        id: selectedMesa,
        estado: "OCUPADA",
        mozoId: empleado.id,
        personas: parseInt(personas) || 2,
      });

      toast.success("Mesa ocupada correctamente");
      setShowOcuparDialog(false);
      refetch();

      // Ir a toma de pedido
      navigate(`/pedido/${selectedMesa}`);
    } catch (error) {
      toast.error("Error al ocupar la mesa");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const getMozoNombre = (mozoId: number | null) => {
    if (!mozoId || !empleados) return null;
    const mozo = empleados.find(e => e.id === mozoId);
    return mozo ? `${mozo.nombre} ${mozo.apellido?.[0] || ""}.` : null;
  };

  const calcularTiempo = (fechaOcupacion: Date | null) => {
    if (!fechaOcupacion) return null;
    const ahora = new Date();
    const ocupacion = new Date(fechaOcupacion);
    const diffMs = ahora.getTime() - ocupacion.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) return `${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  };

  if (!empleado || !empresa) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-card/95 backdrop-blur-sm">
        <div className="container py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center overflow-hidden">
                {empresa.logoUrl ? (
                  <img src={empresa.logoUrl} alt={empresa.nombre} className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="h-5 w-5 text-white" />
                )}
              </div>
              <div>
                <h1 className="font-bold text-foreground">{empresa.nombre}</h1>
                <p className="text-xs text-muted-foreground">
                  {empleado.nombre} • <span className="text-emerald-400">{empleado.rol}</span>
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {pedidosListos && pedidosListos.length > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white animate-pulse">
                        {pedidosListos.length}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Pedidos Listos</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 flex flex-col gap-4">
                    {pedidosListos?.length === 0 ? (
                      <div className="text-center text-muted-foreground py-10">
                        <CheckSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        <p>No hay pedidos pendientes de entrega</p>
                      </div>
                    ) : (
                      pedidosListos?.map((item: any) => (
                        <div key={item.id} className="p-3 border rounded-lg bg-card shadow-sm flex justify-between items-center">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline">Mesa {item.mesaNumero}</Badge>
                              {item.area === "COCINA" ? (
                                <ChefHat className="h-4 w-4 text-orange-500" />
                              ) : (
                                <Wine className="h-4 w-4 text-purple-500" />
                              )}
                            </div>
                            <p className="font-medium text-sm">{item.cantidad} x {item.productoNombre}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 w-8 p-0"
                            onClick={() => handleEntregar(item.id)}
                          >
                            <CheckSquare className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </SheetContent>
              </Sheet>

              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-400">
                {mesas?.filter(m => m.tableStatus === "DISPONIBLE").length || 0}
              </div>
              <div className="text-xs text-muted-foreground">Libres</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-400">
                {mesas?.filter(m => m.tableStatus === "OCUPADA").length || 0}
              </div>
              <div className="text-xs text-muted-foreground">Ocupadas</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-400">
                {mesas?.filter(m => m.tableStatus === "PIDIENDO_CUENTA").length || 0}
              </div>
              <div className="text-xs text-muted-foreground">Por cobrar</div>
            </CardContent>
          </Card>
        </div>

        {/* Mesa Grid */}
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <UtensilsCrossed className="h-5 w-5 text-primary" />
          Mapa de Mesas
        </h2>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="mesa-grid">
            {(mesas as any[])?.sort((a, b) => a.numero - b.numero).map((mesa) => {
              const config = estadoConfig[mesa.tableStatus as MesaEstado] || estadoConfig.DISPONIBLE;
              const mozoNombre = getMozoNombre(mesa.mozoAsignadoId);
              const tiempo = calcularTiempo(mesa.fechaOcupacion);
              const reservaInfo = mesa.reservaInfo;

              return (
                <button
                  key={mesa.id}
                  onClick={() => handleMesaClick(mesa.id, mesa.tableStatus as MesaEstado)}
                  className={cn(
                    "p-4 rounded-xl border-2 transition-all text-left product-card",
                    config.bgColor
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-bold text-foreground">
                      {mesa.numero}
                    </span>
                    <Badge variant="outline" className={cn("text-xs", config.color)}>
                      {config.label}
                    </Badge>
                  </div>

                  {mesa.tableStatus !== "DISPONIBLE" && mesa.tableStatus !== "RESERVADA" && (
                    <div className="space-y-1 text-xs">
                      {mozoNombre && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Users className="h-3 w-3" />
                          <span>{mozoNombre}</span>
                        </div>
                      )}
                      {mesa.personas && mesa.personas > 0 && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Users className="h-3 w-3" />
                          <span>{mesa.personas} personas</span>
                        </div>
                      )}
                      {tiempo && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{tiempo}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {mesa.tableStatus === "RESERVADA" && reservaInfo && (
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-1 text-rose-200 font-bold truncate">
                        <Users className="h-3 w-3" />
                        <span>{reservaInfo.nombre}</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <span>{reservaInfo.personas} personas</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground font-medium">
                        <Clock className="h-3 w-3" />
                        <span>{reservaInfo.hora}</span>
                      </div>
                    </div>
                  )}

                  {mesa.tableStatus === "DISPONIBLE" && empleado?.rol !== "CAJERO" && (
                    <div className="flex items-center justify-center mt-2">
                      <Plus className="h-5 w-5 text-emerald-400" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* Dialog para ocupar mesa */}
      <Dialog open={showOcuparDialog} onOpenChange={setShowOcuparDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Ocupar Mesa {selectedMesa}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="personas">Número de personas</Label>
            <Input
              id="personas"
              type="number"
              min="1"
              max="20"
              value={personas}
              onChange={(e) => setPersonas(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOcuparDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleOcuparMesa} disabled={createPedidoMutation.isPending}>
              {createPedidoMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Ocupar Mesa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNavigation />
    </div>
  );
}
