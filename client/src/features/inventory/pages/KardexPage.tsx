import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { usePOS } from "@/features/auth/contexts/POSContext";
import { Button } from "@/components/ui/forms/button";
import { Input } from "@/components/ui/forms/input";
import { Label } from "@/components/ui/forms/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/display/table";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

export default function KardexPage() {
  const [, navigate] = useLocation();
  const params = useParams<{ insumoId: string }>();
  const { empleado, empresa } = usePOS();
  const insumoId = Number(params.insumoId);
  const [desde, setDesde] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [hasta, setHasta] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));

  // T00:00:00 fuerza hora local (igual que en reportes)
  const desdeDate = new Date(`${desde}T00:00:00`);
  const hastaDate = new Date(`${hasta}T23:59:59.999`);
  const valido = !isNaN(desdeDate.getTime()) && !isNaN(hastaDate.getTime());

  const { data, isLoading } = trpc.insumo.kardex.useQuery(
    { empresaId: empresa?.id || 0, insumoId, desde: desdeDate, hasta: hastaDate },
    { enabled: !!empresa?.id && valido && Number.isFinite(insumoId) },
  );
  const { data: insumos } = trpc.insumo.listByEmpresa.useQuery(
    { empresaId: empresa?.id || 0 },
    { enabled: !!empresa?.id },
  );
  const insumo = insumos?.find((i) => i.id === insumoId);

  if (!empleado || !empresa) {
    navigate("/");
    return null;
  }
  if (empleado.rol === "MOZO") {
    navigate("/mozo");
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container space-y-4">
        <div className="flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/inventario")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-bold text-foreground">Kardex físico</h1>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
        </div>

        <div>
          <h2 className="text-lg font-semibold">{insumo ? `${insumo.nombre} (${insumo.codigo})` : `Insumo #${insumoId}`}</h2>
          <p className="text-sm text-muted-foreground">{empresa.nombre} • {desde} al {hasta}</p>
        </div>

        <div className="flex gap-3 print:hidden">
          <div className="space-y-1">
            <Label>Desde</Label>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Hasta</Label>
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo / Motivo</TableHead>
                <TableHead className="text-right">Entrada</TableHead>
                <TableHead className="text-right">Salida</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right">Costo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="font-semibold">
                <TableCell colSpan={4}>Saldo inicial</TableCell>
                <TableCell className="text-right">{Number(data?.saldoInicial ?? 0)}</TableCell>
                <TableCell />
              </TableRow>
              {(data?.filas ?? []).map((f, idx) => (
                <TableRow key={idx}>
                  <TableCell>{format(new Date(f.fecha), "dd/MM/yyyy HH:mm")}</TableCell>
                  <TableCell>
                    {f.tipo} / {f.motivo}
                    {f.referencia && <span className="text-xs text-muted-foreground"> ({f.referencia})</span>}
                  </TableCell>
                  <TableCell className="text-right">{Number(f.entrada) || ""}</TableCell>
                  <TableCell className="text-right">{Number(f.salida) || ""}</TableCell>
                  <TableCell className="text-right font-semibold">{Number(f.saldo)}</TableCell>
                  <TableCell className="text-right">{f.costoUnitario ? Number(f.costoUnitario).toFixed(2) : "-"}</TableCell>
                </TableRow>
              ))}
              {data && data.filas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sin movimientos en el rango</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
