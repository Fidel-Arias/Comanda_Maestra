import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { usePOS } from "@/features/auth/contexts/POSContext";
import { BottomNavigation } from "@/components/layout/BottomNavigation";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/forms/button";
import { Card, CardContent } from "@/components/ui/display/card";
import { Input } from "@/components/ui/forms/input";
import { Label } from "@/components/ui/forms/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/display/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/feedback/alert-dialog";
import { ArrowLeft, Boxes, Loader2, PackagePlus, Pencil, Plus, ScrollText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { InsumoCodeInput, type InsumoEncontrado } from "../components/InsumoCodeInput";

type Unidad = "UND" | "KG" | "G" | "L" | "ML";
const UNIDADES: Unidad[] = ["UND", "KG", "G", "L", "ML"];

interface InsumoForm {
  nombre: string;
  codigo: string;
  codigoBarras: string;
  unidad: Unidad;
  stockMinimo: string;
}
const initialForm: InsumoForm = { nombre: "", codigo: "", codigoBarras: "", unidad: "UND", stockMinimo: "0" };

type Modo = "INGRESO" | "MERMA" | "AJUSTE";

export default function InsumosPage() {
  const [, navigate] = useLocation();
  const { empleado, empresa } = usePOS();
  const empresaId = empresa?.id || 0;

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<InsumoForm>(initialForm);
  const [ingresoOpen, setIngresoOpen] = useState(false);
  const [seleccionado, setSeleccionado] = useState<InsumoEncontrado | null>(null);
  const [modo, setModo] = useState<Modo>("INGRESO");
  const [cantidad, setCantidad] = useState("");
  const [costo, setCosto] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const cantidadRef = useRef<HTMLInputElement>(null);

  const { data: insumos, isLoading, refetch } = trpc.insumo.listByEmpresa.useQuery(
    { empresaId },
    { enabled: !!empresaId },
  );

  const onError = (e: { message?: string }) => toast.error(e.message || "Error");

  const createMutation = trpc.insumo.create.useMutation({
    onSuccess: () => { toast.success("Insumo creado"); refetch(); closeForm(); },
    onError,
  });
  const updateMutation = trpc.insumo.update.useMutation({
    onSuccess: () => { toast.success("Insumo actualizado"); refetch(); closeForm(); },
    onError,
  });
  const deleteMutation = trpc.insumo.delete.useMutation({
    onSuccess: () => { toast.success("Insumo eliminado"); refetch(); setDeletingId(null); },
    onError,
  });
  const movOpts = {
    onSuccess: () => { toast.success("Stock actualizado"); refetch(); closeIngreso(); },
    onError,
  };
  const ingresoMutation = trpc.insumo.registrarIngreso.useMutation(movOpts);
  const mermaMutation = trpc.insumo.registrarMerma.useMutation(movOpts);
  const ajusteMutation = trpc.insumo.ajustar.useMutation(movOpts);

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(initialForm);
  }
  function closeIngreso() {
    setIngresoOpen(false);
    setSeleccionado(null);
    setCantidad("");
    setCosto("");
    setModo("INGRESO");
  }

  if (!empleado || !empresa) {
    navigate("/");
    return null;
  }
  if (empleado.rol === "MOZO") {
    navigate("/mozo");
    return null;
  }

  const openCreate = (codigoBarras = "") => {
    setEditingId(null);
    setForm({ ...initialForm, codigoBarras });
    setFormOpen(true);
  };
  const openEdit = (i: NonNullable<typeof insumos>[number]) => {
    setEditingId(i.id);
    setForm({
      nombre: i.nombre,
      codigo: i.codigo,
      codigoBarras: i.codigoBarras ?? "",
      unidad: i.unidad,
      stockMinimo: Number(i.stockMinimo).toString(),
    });
    setFormOpen(true);
  };
  const openIngreso = (i?: InsumoEncontrado) => {
    setSeleccionado(i ?? null);
    setModo("INGRESO");
    setIngresoOpen(true);
    if (i) setTimeout(() => cantidadRef.current?.focus(), 50);
  };

  const submitForm = () => {
    const stockMinimo = Number(form.stockMinimo);
    if (!form.nombre.trim() || !form.codigo.trim()) return toast.error("Nombre y código son obligatorios");
    if (!Number.isFinite(stockMinimo) || stockMinimo < 0) return toast.error("Stock mínimo inválido");
    const data = {
      nombre: form.nombre.trim(),
      codigo: form.codigo.trim(),
      codigoBarras: form.codigoBarras.trim(),
      unidad: form.unidad,
      stockMinimo,
      empleadoId: empleado.id,
    };
    if (editingId) updateMutation.mutate({ id: editingId, empresaId, ...data });
    else createMutation.mutate({ empresaId, ...data });
  };

  const confirmarMovimiento = () => {
    if (!seleccionado) return;
    const n = Number(cantidad);
    if (!Number.isFinite(n) || n < 0 || (modo !== "AJUSTE" && n <= 0)) return toast.error("Cantidad inválida");
    const base = { empresaId, insumoId: seleccionado.id, empleadoId: empleado.id };
    if (modo === "INGRESO") {
      const c = costo.trim() === "" ? undefined : Number(costo);
      if (c !== undefined && (!Number.isFinite(c) || c < 0)) return toast.error("Costo inválido");
      ingresoMutation.mutate({ ...base, cantidad: n, costoUnitario: c });
    } else if (modo === "MERMA") {
      mermaMutation.mutate({ ...base, cantidad: n, motivo: "MERMA" });
    } else {
      ajusteMutation.mutate({ ...base, nuevoSaldo: n });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isMoving = ingresoMutation.isPending || mermaMutation.isPending || ajusteMutation.isPending;
  const bajos = (insumos ?? []).filter((i) => Number(i.stock) <= Number(i.stockMinimo)).length;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-card/95 backdrop-blur-sm">
        <div className="container py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center">
              <Boxes className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="font-bold text-foreground">Inventario</h1>
              <p className="text-xs text-muted-foreground">
                {insumos?.length ?? 0} insumos • {bajos} con stock bajo
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" onClick={() => openIngreso()} className="gap-2">
              <PackagePlus className="h-4 w-4" />
              <span className="hidden sm:inline">Ingresar producto</span>
            </Button>
            <Button onClick={() => openCreate()} className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nuevo insumo</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-4">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Mínimo</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(insumos ?? []).map((i) => {
                    const bajo = Number(i.stock) <= Number(i.stockMinimo);
                    return (
                      <TableRow key={i.id} className={cn(bajo && "bg-red-500/10")}>
                        <TableCell className="font-mono text-xs">{i.codigo}</TableCell>
                        <TableCell>{i.nombre}</TableCell>
                        <TableCell className={cn("text-right font-semibold", bajo && "text-red-400")}>
                          {Number(i.stock)} {i.unidad}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{Number(i.stockMinimo)} {i.unidad}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" title="Ingreso / ajuste" onClick={() => openIngreso(i as InsumoEncontrado)}>
                              <PackagePlus className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Kardex" onClick={() => navigate(`/inventario/kardex/${i.id}`)}>
                              <ScrollText className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Editar" onClick={() => openEdit(i)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Eliminar" onClick={() => setDeletingId(i.id)}>
                              <Trash2 className="h-4 w-4 text-red-400" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(insumos ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Aún no hay insumos
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Ingresar producto */}
      <Dialog open={ingresoOpen} onOpenChange={(o) => !o && closeIngreso()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ingresar producto</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Código de barras o código interno</Label>
              <InsumoCodeInput
                autoFocus
                empresaId={empresaId}
                onFound={(i) => { setSeleccionado(i); setTimeout(() => cantidadRef.current?.focus(), 50); }}
                onNotFound={(codigo) => { closeIngreso(); openCreate(codigo); toast.info("Código no registrado: crea el insumo"); }}
              />
            </div>
            {seleccionado && (
              <>
                <div className="rounded-lg border border-border/50 p-3">
                  <p className="font-semibold">{seleccionado.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    Stock actual: {Number(seleccionado.stock)} {seleccionado.unidad}
                  </p>
                </div>
                <div className="flex gap-2">
                  {(["INGRESO", "MERMA", "AJUSTE"] as Modo[]).map((m) => (
                    <Button key={m} type="button" size="sm" variant={modo === m ? "default" : "outline"} onClick={() => setModo(m)}>
                      {m === "INGRESO" ? "Ingreso" : m === "MERMA" ? "Merma" : "Ajustar saldo"}
                    </Button>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label>{modo === "AJUSTE" ? "Nuevo saldo" : "Cantidad"} ({seleccionado.unidad})</Label>
                  <Input
                    ref={cantidadRef}
                    type="number"
                    inputMode="decimal"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmarMovimiento(); } }}
                  />
                </div>
                {modo === "INGRESO" && (
                  <div className="space-y-2">
                    <Label>Costo unitario (opcional)</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={costo}
                      onChange={(e) => setCosto(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmarMovimiento(); } }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeIngreso}>Cancelar</Button>
            <Button onClick={confirmarMovimiento} disabled={!seleccionado || isMoving}>
              {isMoving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alta / edicion */}
      <Dialog open={formOpen} onOpenChange={(o) => !o && closeForm()}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar insumo" : "Nuevo insumo"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Código interno</Label>
                <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Código de barras</Label>
                <Input value={form.codigoBarras} onChange={(e) => setForm({ ...form, codigoBarras: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Unidad</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={form.unidad}
                  onChange={(e) => setForm({ ...form, unidad: e.target.value as Unidad })}
                >
                  {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Stock mínimo</Label>
                <Input type="number" value={form.stockMinimo} onChange={(e) => setForm({ ...form, stockMinimo: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Cancelar</Button>
            <Button onClick={submitForm} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletingId !== null} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar insumo?</AlertDialogTitle>
            <AlertDialogDescription>Se desactivará; el historial del kardex se conserva.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingId && deleteMutation.mutate({ id: deletingId, empresaId, empleadoId: empleado.id })}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNavigation />
    </div>
  );
}
