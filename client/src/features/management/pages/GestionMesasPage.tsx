import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { usePOS } from "@/features/auth/contexts/POSContext";
import { BottomNavigation } from "@/components/layout/BottomNavigation";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/forms/button";
import { Card, CardContent } from "@/components/ui/display/card";
import { Input } from "@/components/ui/forms/input";
import { Label } from "@/components/ui/forms/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/overlays/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/feedback/alert-dialog";
import { 
  ArrowLeft, Plus, Pencil, Trash2, LayoutGrid, Loader2, Users
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { validarMesaEnZona } from "@shared/zonas";

interface MesaForm {
  numero: string;
  capacidad: string;
  zonaId: string; // "" = sin zona
}

const initialForm: MesaForm = {
  numero: "",
  capacidad: "4",
  zonaId: "",
};

type TipoZona = "SALON" | "TERRAZA" | "BARRA";

interface ZonaForm {
  nombre: string;
  tipo: TipoZona;
  maxMesas: string;
  maxSillas: string;
}

const initialZonaForm: ZonaForm = { nombre: "", tipo: "SALON", maxMesas: "10", maxSillas: "40" };

export default function GestionMesas() {
  const [, navigate] = useLocation();
  const { empleado, empresa } = usePOS();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [form, setForm] = useState<MesaForm>(initialForm);
  const [isZonaDialogOpen, setIsZonaDialogOpen] = useState(false);
  const [editingZonaId, setEditingZonaId] = useState<number | null>(null);
  const [zonaForm, setZonaForm] = useState<ZonaForm>(initialZonaForm);

  // Queries
  const { data: mesas, isLoading, refetch } = trpc.mesa.listByEmpresa.useQuery(
    { empresaId: empresa?.id || 0 },
    { enabled: !!empresa?.id }
  );

  const { data: zonas, refetch: refetchZonas } = trpc.zona.listByEmpresa.useQuery(
    { empresaId: empresa?.id || 0 },
    { enabled: !!empresa?.id }
  );

  const closeZonaDialog = () => {
    setIsZonaDialogOpen(false);
    setEditingZonaId(null);
    setZonaForm(initialZonaForm);
  };

  const zonaMutationOpts = {
    onSuccess: () => {
      toast.success("Zona guardada");
      refetchZonas();
      closeZonaDialog();
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Error al guardar zona");
    },
  };
  const createZonaMutation = trpc.zona.create.useMutation(zonaMutationOpts);
  const updateZonaMutation = trpc.zona.update.useMutation(zonaMutationOpts);
  const deleteZonaMutation = trpc.zona.delete.useMutation({
    onSuccess: () => {
      toast.success("Zona eliminada");
      refetchZonas();
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Error al eliminar zona");
    },
  });

  const handleSubmitZona = () => {
    const maxMesas = parseInt(zonaForm.maxMesas);
    const maxSillas = parseInt(zonaForm.maxSillas);
    if (!zonaForm.nombre.trim()) {
      toast.error("Ingresa el nombre de la zona");
      return;
    }
    if (isNaN(maxMesas) || maxMesas < 1 || isNaN(maxSillas) || maxSillas < 1) {
      toast.error("Los límites deben ser mayores a 0");
      return;
    }
    const data = { nombre: zonaForm.nombre.trim(), tipo: zonaForm.tipo, maxMesas, maxSillas };
    if (editingZonaId) {
      updateZonaMutation.mutate({ id: editingZonaId, empresaId: empresa?.id || 0, ...data });
    } else {
      createZonaMutation.mutate({ empresaId: empresa?.id || 0, ...data });
    }
  };

  const uso = (zonaId: number) => {
    const ms = (mesas ?? []).filter((m) => m.zonaId === zonaId);
    return { mesas: ms.length, sillas: ms.reduce((sum, m) => sum + m.sillas, 0) };
  };

  // Mutations
  const createMutation = trpc.mesa.create.useMutation({
    onSuccess: () => {
      toast.success("Mesa creada exitosamente");
      refetch();
      handleCloseDialog();
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Error al crear mesa");
    },
  });

  const updateMutation = trpc.mesa.update.useMutation({
    onSuccess: () => {
      toast.success("Mesa actualizada exitosamente");
      refetch();
      handleCloseDialog();
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Error al actualizar mesa");
    },
  });

  const deleteMutation = trpc.mesa.delete.useMutation({
    onSuccess: () => {
      toast.success("Mesa eliminada exitosamente");
      refetch();
      setIsDeleteDialogOpen(false);
      setDeletingId(null);
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Error al eliminar mesa");
    },
  });

  const handleOpenCreate = () => {
    // Calcular el siguiente número de mesa
    const maxNumero = mesas?.reduce((max, m) => Math.max(max, m.numero), 0) || 0;
    setForm({ ...initialForm, numero: (maxNumero + 1).toString() });
    setEditingId(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (mesa: NonNullable<typeof mesas>[0]) => {
    setForm({
      numero: mesa.numero.toString(),
      capacidad: mesa.sillas.toString(),
      zonaId: mesa.zonaId ? mesa.zonaId.toString() : "",
    });
    setEditingId(mesa.id);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setForm(initialForm);
    setEditingId(null);
  };

  const zonaSeleccionada = form.zonaId ? zonas?.find((z) => z.id === parseInt(form.zonaId)) : undefined;
  const zonaError = zonaSeleccionada
    ? validarMesaEnZona(
        zonaSeleccionada,
        (mesas ?? []).filter((m) => m.zonaId === zonaSeleccionada.id).map((m) => ({ id: m.id, sillas: m.sillas })),
        { id: editingId ?? undefined, sillas: parseInt(form.capacidad) }
      )
    : null;

  const handleSubmit = () => {
    if (!form.numero || !form.capacidad) {
      toast.error("Completa todos los campos");
      return;
    }

    const numero = parseInt(form.numero);
    const capacidad = parseInt(form.capacidad);

    if (isNaN(numero) || numero <= 0) {
      toast.error("El número de mesa debe ser mayor a 0");
      return;
    }

    if (isNaN(capacidad) || capacidad <= 0) {
      toast.error("La capacidad debe ser mayor a 0");
      return;
    }

    // Verificar que el número no esté duplicado
    const existente = mesas?.find(m => m.numero === numero && m.id !== editingId);
    if (existente) {
      toast.error(`Ya existe una mesa con el número ${numero}`);
      return;
    }

    if (zonaError) {
      toast.error(zonaError);
      return;
    }

    const zonaId = form.zonaId ? parseInt(form.zonaId) : null;
    if (editingId) {
      updateMutation.mutate({ id: editingId, numero, sillas: capacidad, zonaId });
    } else {
      createMutation.mutate({
        empresaId: empresa?.id || 0,
        numero,
        sillas: capacidad,
        zonaId,
      });
    }
  };

  const handleDelete = (id: number) => {
    const mesa = mesas?.find(m => m.id === id);
    if (mesa && mesa.tableStatus !== "DISPONIBLE") {
      toast.error("No se puede eliminar una mesa ocupada");
      return;
    }
    setDeletingId(id);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingId) {
      deleteMutation.mutate({ id: deletingId });
    }
  };

  if (!empleado || !empresa) {
    navigate("/");
    return null;
  }

  if (!['DUENO', 'ADMIN'].includes(empleado.rol)) {
    navigate("/mozo");
    return null;
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Estadísticas
  const totalMesas = mesas?.length || 0;
  const mesasOcupadas = mesas?.filter(m => m.tableStatus !== "DISPONIBLE").length || 0;
  const capacidadTotal = mesas?.reduce((sum, m) => sum + m.capacidad, 0) || 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-card/95 backdrop-blur-sm">
        <div className="container py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/50 flex items-center justify-center">
                <LayoutGrid className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <h1 className="font-bold text-foreground">Gestión de Mesas</h1>
                <p className="text-xs text-muted-foreground">
                  {totalMesas} mesas • {capacidadTotal} personas de capacidad
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button onClick={handleOpenCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Nueva Mesa</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="container py-4 border-b border-border/50">
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{totalMesas}</p>
              <p className="text-xs text-muted-foreground">Total Mesas</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">{totalMesas - mesasOcupadas}</p>
              <p className="text-xs text-muted-foreground">Disponibles</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-amber-400">{mesasOcupadas}</p>
              <p className="text-xs text-muted-foreground">Ocupadas</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Zonas */}
      <section className="container py-4 border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-foreground">Zonas</h2>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setIsZonaDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Nueva zona
          </Button>
        </div>
        {zonas && zonas.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {zonas.map((z) => {
              const u = uso(z.id);
              return (
                <Card key={z.id} className="bg-card/50 border-border/50">
                  <CardContent className="p-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{z.nombre} <span className="text-xs text-muted-foreground">({z.tipo})</span></p>
                      <p className="text-xs text-muted-foreground">
                        Mesas {u.mesas}/{z.maxMesas} · Sillas {u.sillas}/{z.maxSillas}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                        setEditingZonaId(z.id);
                        setZonaForm({ nombre: z.nombre, tipo: z.tipo, maxMesas: String(z.maxMesas), maxSillas: String(z.maxSillas) });
                        setIsZonaDialogOpen(true);
                      }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (u.mesas > 0) {
                            toast.error("No se puede eliminar una zona que tiene mesas");
                            return;
                          }
                          deleteZonaMutation.mutate({ id: z.id, empresaId: empresa?.id || 0 });
                        }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin zonas. Las mesas sin zona no tienen límites.</p>
        )}
      </section>

      {/* Mesas Grid */}
      <main className="container py-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : mesas && mesas.length > 0 ? (
          <div className="mesa-grid">
            {mesas.sort((a, b) => a.numero - b.numero).map((mesa) => {
              const isOcupada = mesa.tableStatus !== "DISPONIBLE";
              
              return (
                <Card 
                  key={mesa.id} 
                  className={cn(
                    "relative overflow-hidden transition-all",
                    mesa.tableStatus === "DISPONIBLE" && "bg-emerald-500/10 border-emerald-500/30",
                    mesa.tableStatus === "OCUPADA" && "bg-amber-500/20 border-amber-500/50",
                    mesa.tableStatus === "PIDIENDO_CUENTA" && "bg-red-500/20 border-red-500/50",
                    mesa.tableStatus === "RESERVADA" && "bg-purple-500/20 border-purple-500/50"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-3xl font-bold text-foreground">{mesa.numero}</span>
                      {!isOcupada && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleOpenEdit(mesa)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(mesa.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>
                        {mesa.sillas} sillas
                        {mesa.zonaId ? ` · ${zonas?.find((z) => z.id === mesa.zonaId)?.nombre ?? ""}` : ""}
                      </span>
                    </div>
                    
                    <div className={cn(
                      "mt-2 text-xs font-medium",
                      mesa.tableStatus === "DISPONIBLE" && "text-emerald-400",
                      mesa.tableStatus === "OCUPADA" && "text-amber-400",
                      mesa.tableStatus === "PIDIENDO_CUENTA" && "text-red-400",
                      mesa.tableStatus === "RESERVADA" && "text-purple-400"
                    )}>
                      {mesa.tableStatus === "DISPONIBLE" && "Disponible"}
                      {mesa.tableStatus === "OCUPADA" && "Ocupada"}
                      {mesa.tableStatus === "PIDIENDO_CUENTA" && "Pidiendo Cuenta"}
                      {mesa.tableStatus === "RESERVADA" && "Reservada"}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="bg-card/50">
            <CardContent className="py-12 text-center">
              <LayoutGrid className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay mesas registradas</p>
              <Button onClick={handleOpenCreate} className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                Agregar primera mesa
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Mesa" : "Nueva Mesa"}
            </DialogTitle>
            <DialogDescription>
              {editingId 
                ? "Modifica los datos de la mesa" 
                : "Completa los datos para agregar una nueva mesa"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="numero">Número de Mesa</Label>
              <Input
                id="numero"
                type="number"
                min="1"
                value={form.numero}
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
                placeholder="1"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="zona">Zona</Label>
              <select
                id="zona"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.zonaId}
                onChange={(e) => setForm({ ...form, zonaId: e.target.value })}
              >
                <option value="">Sin zona</option>
                {zonas?.filter((z) => z.activa).map((z) => (
                  <option key={z.id} value={z.id}>{z.nombre}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="capacidad">Sillas</Label>
              <Input
                id="capacidad"
                type="number"
                min="1"
                max="20"
                value={form.capacidad}
                onChange={(e) => setForm({ ...form, capacidad: e.target.value })}
                placeholder="4"
              />
              {zonaError && <p className="text-xs text-destructive">{zonaError}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !!zonaError}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? "Guardar Cambios" : "Crear Mesa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Zona Dialog */}
      <Dialog open={isZonaDialogOpen} onOpenChange={(o) => (o ? setIsZonaDialogOpen(true) : closeZonaDialog())}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{editingZonaId ? "Editar Zona" : "Nueva Zona"}</DialogTitle>
            <DialogDescription>Define el límite de mesas y sillas de la zona</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="zona-nombre">Nombre</Label>
              <Input id="zona-nombre" value={zonaForm.nombre} onChange={(e) => setZonaForm({ ...zonaForm, nombre: e.target.value })} placeholder="Terraza" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="zona-tipo">Tipo</Label>
              <select
                id="zona-tipo"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={zonaForm.tipo}
                onChange={(e) => setZonaForm({ ...zonaForm, tipo: e.target.value as TipoZona })}
              >
                <option value="SALON">Salón</option>
                <option value="TERRAZA">Terraza</option>
                <option value="BARRA">Barra</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label htmlFor="zona-max-mesas">Máx. mesas</Label>
                <Input id="zona-max-mesas" type="number" min="1" value={zonaForm.maxMesas} onChange={(e) => setZonaForm({ ...zonaForm, maxMesas: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="zona-max-sillas">Máx. sillas</Label>
                <Input id="zona-max-sillas" type="number" min="1" value={zonaForm.maxSillas} onChange={(e) => setZonaForm({ ...zonaForm, maxSillas: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeZonaDialog}>Cancelar</Button>
            <Button onClick={handleSubmitZona} disabled={createZonaMutation.isPending || updateZonaMutation.isPending}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta mesa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La mesa será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNavigation />
    </div>
  );
}
