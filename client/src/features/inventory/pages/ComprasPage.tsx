import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { usePOS } from "@/features/auth/contexts/POSContext";
import { Button } from "@/components/ui/forms/button";
import { Input } from "@/components/ui/forms/input";
import { Label } from "@/components/ui/forms/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/navigation/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/display/table";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";
import { InsumoCodeInput, type InsumoEncontrado } from "../components/InsumoCodeInput";

type Linea = { insumoId: number; nombre: string; unidad: string; cantidad: string; costo: string };

const money = (s: string | number) => Number(s).toFixed(2);

export default function ComprasPage() {
  const [, navigate] = useLocation();
  const { empleado, empresa } = usePOS();
  const empresaId = empresa?.id || 0;
  const utils = trpc.useUtils();

  const hoy = format(new Date(), "yyyy-MM-dd");
  const [fecha, setFecha] = useState(hoy);
  const [proveedor, setProveedor] = useState("");
  const [comprobante, setComprobante] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [desde, setDesde] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [hasta, setHasta] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));

  const { data: gastos, isLoading: cargandoGastos } = trpc.compra.gastos.useQuery(
    { empresaId, desde, hasta },
    { enabled: !!empresaId && !!desde && !!hasta },
  );
  const { data: compras } = trpc.compra.listByEmpresa.useQuery(
    { empresaId, desde, hasta },
    { enabled: !!empresaId && !!desde && !!hasta },
  );

  const create = trpc.compra.create.useMutation({
    onSuccess: (r) => {
      toast.success(`Compra registrada (S/ ${r.total})`);
      setLineas([]);
      setProveedor("");
      setComprobante("");
      void utils.compra.invalidate();
      void utils.insumo.listByEmpresa.invalidate();
    },
    onError: (e) => toast.error(e.message || "Error"),
  });

  if (!empleado || !empresa) {
    navigate("/");
    return null;
  }
  if (empleado.rol === "MOZO") {
    navigate("/mozo");
    return null;
  }

  const agregar = (i: InsumoEncontrado) =>
    setLineas((prev) => {
      const idx = prev.findIndex((l) => l.insumoId === i.id);
      if (idx >= 0) {
        return prev.map((l, k) => (k === idx ? { ...l, cantidad: String((Number(l.cantidad) || 0) + 1) } : l));
      }
      return [...prev, { insumoId: i.id, nombre: i.nombre, unidad: i.unidad, cantidad: "1", costo: String(Number(i.costoPromedio)) }];
    });
  const editar = (idx: number, patch: Partial<Linea>) =>
    setLineas((prev) => prev.map((l, k) => (k === idx ? { ...l, ...patch } : l)));

  const totalEstimado = lineas.reduce((a, l) => a + (Number(l.cantidad) || 0) * (Number(l.costo) || 0), 0);

  const guardar = () => {
    if (!fecha) return toast.error("Fecha obligatoria");
    if (lineas.length === 0) return toast.error("Agrega al menos un insumo");
    const items = lineas.map((l) => ({ insumoId: l.insumoId, cantidad: Number(l.cantidad), costoUnitario: Number(l.costo) }));
    if (items.some((it) => !Number.isFinite(it.cantidad) || it.cantidad <= 0 || !Number.isFinite(it.costoUnitario) || it.costoUnitario < 0)) {
      return toast.error("Revisa cantidades y costos");
    }
    create.mutate({
      empresaId, empleadoId: empleado.id, fecha,
      proveedor: proveedor || undefined, comprobante: comprobante || undefined, items,
    });
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/inventario")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-bold text-foreground">Compras y gastos</h1>
        </div>

        <Tabs defaultValue="compra">
          <TabsList>
            <TabsTrigger value="compra">Nueva compra</TabsTrigger>
            <TabsTrigger value="gastos">Gastos</TabsTrigger>
          </TabsList>

          <TabsContent value="compra" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>Fecha</Label>
                <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Proveedor</Label>
                <Input value={proveedor} maxLength={255} onChange={(e) => setProveedor(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Comprobante</Label>
                <Input value={comprobante} maxLength={50} onChange={(e) => setComprobante(e.target.value)} />
              </div>
            </div>

            <InsumoCodeInput
              empresaId={empresaId}
              autoFocus
              onFound={agregar}
              onNotFound={() => toast.error("Insumo no encontrado")}
            />

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insumo</TableHead>
                  <TableHead className="w-32">Cantidad</TableHead>
                  <TableHead className="w-32">Costo unit.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineas.map((l, idx) => (
                  <TableRow key={l.insumoId}>
                    <TableCell>{l.nombre} <span className="text-xs text-muted-foreground">({l.unidad})</span></TableCell>
                    <TableCell><Input type="number" min="0" step="any" value={l.cantidad} onChange={(e) => editar(idx, { cantidad: e.target.value })} /></TableCell>
                    <TableCell><Input type="number" min="0" step="any" value={l.costo} onChange={(e) => editar(idx, { costo: e.target.value })} /></TableCell>
                    <TableCell className="text-right">{money((Number(l.cantidad) || 0) * (Number(l.costo) || 0))}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => setLineas((p) => p.filter((_, k) => k !== idx))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {lineas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">Escanea o escribe un código para agregar insumos</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between">
              <p className="font-semibold">Total estimado: S/ {money(totalEstimado)}</p>
              <Button onClick={guardar} disabled={create.isPending} className="gap-2">
                {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Registrar compra
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="gastos" className="space-y-4">
            <div className="flex gap-3">
              <div className="space-y-1">
                <Label>Desde</Label>
                <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Hasta</Label>
                <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
              </div>
            </div>

            {cargandoGastos ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <>
                <p className="text-lg font-semibold">Total gastado: S/ {money(gastos?.total ?? 0)}</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <Table>
                    <TableHeader><TableRow><TableHead>Día</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(gastos?.porDia ?? []).map((d) => (
                        <TableRow key={d.fecha}><TableCell>{d.fecha}</TableCell><TableCell className="text-right">{d.total}</TableCell></TableRow>
                      ))}
                      {gastos?.porDia.length === 0 && (
                        <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6">Sin compras en el rango</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                  <Table>
                    <TableHeader><TableRow><TableHead>Insumo</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(gastos?.porInsumo ?? []).map((i) => (
                        <TableRow key={i.insumoId}><TableCell>{i.nombre}</TableCell><TableCell className="text-right">{i.total}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-sm text-muted-foreground">{compras?.length ?? 0} compras en el rango</p>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
