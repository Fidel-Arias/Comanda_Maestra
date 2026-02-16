import { useState, useEffect, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { usePOS } from "@/features/auth/contexts/POSContext";
import { Button } from "@/components/ui/forms/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/display/card";
import { Badge } from "@/components/ui/display/badge";
import { Input } from "@/components/ui/forms/input";
import { ScrollArea } from "@/components/ui/display/scroll-area";
import { Separator } from "@/components/ui/display/separator";
import {
  ArrowLeft, Search,
  ShoppingCart,
  Trash2,
  Minus,
  Plus,
  Send,
  Printer,
  ChevronLeft,
  X,
  Split,
  Save,
  Loader2,
  AlertCircle,
  Check,
} from "lucide-react";
import { DividirCuentaDialog } from "../components/DividirCuentaDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/overlays/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ItemPedido {
  id?: number;
  productoId: number;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  notas?: string;
  subCuenta?: number;
  subCuentaNombre?: string;
  pagado?: boolean;
}

export default function TomaPedido() {
  const params = useParams<{ mesaId: string }>();
  const mesaId = parseInt(params.mesaId || "0");
  const [, navigate] = useLocation();
  const { empleado, empresa } = usePOS();
  // Permitimos que el cajero edite para correcciones
  const isCajeroReal = empleado?.rol === "CAJERO";
  const isCajero = isCajeroReal || (typeof window !== 'undefined' && window.location.search.includes("rol=CAJERO"));
  const isCorrectionMode = typeof window !== 'undefined' && window.location.search.includes("mode=correction");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoria, setSelectedCategoria] = useState<number | null>(null);
  const [items, setItems] = useState<ItemPedido[]>([]);
  const [pedidoId, setPedidoId] = useState<number | null>(null);
  const [showDividirCuenta, setShowDividirCuenta] = useState(false);
  const [showAnularConfirm, setShowAnularConfirm] = useState(false);

  const updateSubcuentasMutation = trpc.itemPedido.updateSubcuentas.useMutation({
    onSuccess: () => {
      refetchPedido();
    }
  });

  // Queries
  const { data: mesa } = trpc.mesa.getById.useQuery(
    { id: mesaId },
    { enabled: mesaId > 0 }
  );

  const { data: categorias } = trpc.categoria.listByEmpresa.useQuery(
    { empresaId: empresa?.id || 0 },
    { enabled: !!empresa?.id }
  );

  const { data: productos } = trpc.producto.listByEmpresa.useQuery(
    { empresaId: empresa?.id || 0 },
    { enabled: !!empresa?.id }
  );

  const { data: pedidoActivo, refetch: refetchPedido } = trpc.pedido.getByMesa.useQuery(
    { mesaId },
    { enabled: mesaId > 0 }
  );

  const { data: itemsExistentes } = trpc.itemPedido.listByPedido.useQuery(
    { pedidoId: pedidoActivo?.id || 0 },
    { enabled: !!pedidoActivo?.id }
  );

  // Mutations
  const addItemMutation = trpc.itemPedido.add.useMutation();
  const updateItemMutation = trpc.itemPedido.updateCantidad.useMutation();
  const deleteItemMutation = trpc.itemPedido.delete.useMutation();
  const updateTotalesMutation = trpc.pedido.updateTotales.useMutation();
  const updateEstadoMutation = trpc.pedido.updateEstado.useMutation();
  const deletePedidoMutation = trpc.pedido.delete.useMutation();

  // Cargar items existentes
  useEffect(() => {
    if (pedidoActivo) {
      setPedidoId(pedidoActivo.id);
    }
  }, [pedidoActivo]);

  useEffect(() => {
    if (itemsExistentes && productos) {
      const loadedItems: ItemPedido[] = itemsExistentes.map(item => {
        const producto = productos.find(p => p.id === item.productoId);
        return {
          id: item.id,
          productoId: item.productoId,
          nombre: producto?.nombre || "Producto",
          cantidad: item.cantidad,
          precioUnitario: parseFloat(item.precioUnitario),
          subtotal: parseFloat(item.subtotal),
          notas: item.notas || undefined,
          subCuenta: (item as any).subCuenta || 0,
          subCuentaNombre: (item as any).subCuentaNombre,
          pagado: (item as any).pagado || false,
        };
      });
      setItems(loadedItems);
    }
  }, [itemsExistentes, productos]);

  // Filtrar productos
  const productosFiltrados = useMemo(() => {
    if (!productos) return [];

    return productos.filter(p => {
      const matchSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategoria = !selectedCategoria || p.categoriaId === selectedCategoria;
      return matchSearch && matchCategoria;
    });
  }, [productos, searchTerm, selectedCategoria]);

  // Calcular totales (los precios YA INCLUYEN IGV)
  const { subtotal, impuesto, total } = useMemo(() => {
    const totalConIgv = items.reduce((acc, item) => acc + item.subtotal, 0);
    const igvPorcentaje = parseFloat(empresa?.impuestoPorcentaje || "10.50");
    const factorIgv = 1 + (igvPorcentaje / 100); // 1.105 para 10.5%

    // Desglosar: extraer el IGV del total
    const subtotalSinIgv = totalConIgv / factorIgv;
    const igv = totalConIgv - subtotalSinIgv;

    return {
      subtotal: subtotalSinIgv,
      impuesto: igv,
      total: totalConIgv,
    };
  }, [items, empresa]);

  const itemsGrouped = useMemo(() => {
    const groups: Record<number, { name: string, items: (ItemPedido & { originalIndex: number })[] }> = {};
    items.forEach((item, index) => {
      const subId = item.subCuenta || 0;
      if (!groups[subId]) {
        groups[subId] = {
          name: item.subCuentaNombre || (subId === 0 ? "Cuenta Principal" : `Cuenta ${subId}`),
          items: []
        };
      }
      groups[subId].items.push({ ...item, originalIndex: index });
    });
    // Order keys to ensure Principal (0) is first
    return Object.entries(groups)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([id, group]) => ({ id: Number(id), ...group }));
  }, [items]);

  const getStockStatus = (stock: number | null, stockMinimo: number | null) => {
    const s = stock || 0;
    const min = stockMinimo || 5;

    if (s <= 0) return { label: "Agotado", color: "text-red-400 bg-red-500/20" };
    if (s <= min) return { label: "Poco stock", color: "text-amber-400 bg-amber-500/20" };
    return { label: "Disponible", color: "text-emerald-400 bg-emerald-500/20" };
  };

  const handleAddProducto = (producto: NonNullable<typeof productos>[number]) => {
    if ((producto.stock || 0) <= 0) {
      toast.error("Producto agotado");
      return;
    }

    const existingIndex = items.findIndex(i => i.productoId === producto.id);

    if (existingIndex >= 0) {
      // Incrementar cantidad
      const newItems = [...items];
      newItems[existingIndex].cantidad += 1;
      newItems[existingIndex].subtotal = newItems[existingIndex].cantidad * newItems[existingIndex].precioUnitario;
      setItems(newItems);
    } else {
      // Agregar nuevo item
      const precio = parseFloat(producto.precio);
      setItems([...items, {
        productoId: producto.id,
        nombre: producto.nombre,
        cantidad: 1,
        precioUnitario: precio,
        subtotal: precio,
      }]);
    }
  };

  const handleUpdateCantidad = async (index: number, delta: number) => {
    const newItems = [...items];
    const item = newItems[index];
    const newCantidad = item.cantidad + delta;

    if (newCantidad <= 0) {
      if (item.id) {
        try {
          await deleteItemMutation.mutateAsync({ id: item.id });
        } catch (error) {
          toast.error("Error al eliminar item");
          return;
        }
      }
      newItems.splice(index, 1);
      setItems(newItems);
    } else {
      item.cantidad = newCantidad;
      item.subtotal = newCantidad * item.precioUnitario;
      setItems(newItems);

      if (item.id) {
        try {
          await updateItemMutation.mutateAsync({
            id: item.id,
            cantidad: newCantidad,
            subtotal: item.subtotal.toFixed(2),
          });
        } catch (error) {
          // Silent error or toast
        }
      }
    }
  };

  const handleRemoveItem = async (index: number) => {
    const item = items[index];
    if (item.id) {
      try {
        await deleteItemMutation.mutateAsync({ id: item.id });
      } catch (error) {
        toast.error("Error al eliminar item");
        return;
      }
    }
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const handleEnviarPedido = async () => {
    if (!pedidoId || items.length === 0) {
      toast.error("Agrega productos al pedido");
      return;
    }

    try {
      // Guardar items nuevos
      for (const item of items) {
        if (!item.id) {
          await addItemMutation.mutateAsync({
            pedidoId,
            productoId: item.productoId,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario.toFixed(2),
            subtotal: item.subtotal.toFixed(2),
            notas: item.notas,
          });
        }
      }

      // Actualizar totales
      await updateTotalesMutation.mutateAsync({
        id: pedidoId,
        subtotal: subtotal.toFixed(2),
        impuesto: impuesto.toFixed(2),
        total: total.toFixed(2),
      });

      // Cambiar estado
      if (!isCajeroReal) {
        await updateEstadoMutation.mutateAsync({
          id: pedidoId,
          estado: "PREPARANDO",
        });
        toast.success("Pedido enviado a cocina");
        navigate("/mozo");
      } else {
        // Cajero corrigiendo: aseguramos estado LISTO para cobrar
        await updateEstadoMutation.mutateAsync({
          id: pedidoId,
          estado: "LISTO",
        });
        toast.success("Pedido actualizado");
        navigate("/cajero");
      }
    } catch (error) {
      toast.error("Error al enviar el pedido");
    }
  };

  const handleAnularPedido = () => {
    setShowAnularConfirm(true);
  };

  const confirmAnularPedido = async () => {
    if (!pedidoId) return;

    try {
      await deletePedidoMutation.mutateAsync({ id: pedidoId });
      toast.success("Pedido anulado y mesa liberada");
      setShowAnularConfirm(false);
      navigate(isCajero ? "/cajero" : "/mozo");
    } catch (error) {
      toast.error("Error al anular pedido");
    }
  };

  if (!empleado || !empresa) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-card/95 backdrop-blur-sm">
        <div className="container py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(isCajero ? "/cajero" : "/mozo")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="font-bold text-foreground">Toma de Pedido</h1>
              <p className="text-xs text-muted-foreground">
                Mesa {mesa?.numero} • {empleado.nombre}
              </p>
            </div>

            {pedidoId && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleAnularPedido}
                className="gap-2 bg-red-500 hover:bg-red-600 text-white"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Anular Pedido</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Menu Section - Hidden for Cashiers */}
        {!isCajero && (
          <div className="flex-1 p-4 lg:border-r border-border/50">
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar platos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Categories */}
            <ScrollArea className="w-full whitespace-nowrap mb-4">
              <div className="flex gap-2 pb-2">
                <Button
                  variant={selectedCategoria === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategoria(null)}
                >
                  Todos
                </Button>
                {categorias?.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={selectedCategoria === cat.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategoria(cat.id)}
                  >
                    {cat.nombre}
                  </Button>
                ))}
              </div>
            </ScrollArea>

            {/* Products Grid */}
            <ScrollArea className="h-[calc(100vh-320px)] lg:h-[calc(100vh-250px)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {productosFiltrados.map((producto) => {
                  const stockStatus = getStockStatus(producto.stock, producto.stockMinimo);
                  const isAgotado = (producto.stock || 0) <= 0;

                  return (
                    <button
                      key={producto.id}
                      onClick={() => handleAddProducto(producto)}
                      disabled={isAgotado}
                      className={cn(
                        "p-4 rounded-xl border text-left transition-all product-card",
                        isAgotado
                          ? "opacity-50 cursor-not-allowed bg-muted/20"
                          : "bg-card/50 border-border/50 hover:border-primary/50"
                      )}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-foreground">{producto.nombre}</h3>
                        <Badge variant="outline" className={cn("text-xs", stockStatus.color)}>
                          {stockStatus.label}
                        </Badge>
                      </div>
                      {producto.descripcion && (
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                          {producto.descripcion}
                        </p>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-primary">
                          S/ {parseFloat(producto.precio).toFixed(2)}
                        </span>
                        {!isAgotado && (
                          <Plus className="h-5 w-5 text-primary" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Order Section */}
        <div className={cn("border-t lg:border-t-0 border-border/50 bg-card/30", !isCajero ? "lg:w-96" : "w-full")}>
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg">
                {isCajero ? "Visualizando Pedido" : "Pedido Actual"} - Mesa {mesa?.numero}
              </h2>
              {!isCajero && items.length > 0 && pedidoId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (items.some(i => !i.id)) {
                      toast.warning("Guarda los nuevos items (Enviar a Cocina) antes de dividir.");
                      return;
                    }
                    setShowDividirCuenta(true);
                  }}
                  title="Dividir Cuenta"
                  className="h-8"
                >
                  <Split className="h-4 w-4 mr-2" /> Dividir
                </Button>
              )}
            </div>


            {items.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No hay items en el pedido</p>
                <p className="text-sm">Selecciona items del menú para comenzar</p>
              </div>
            ) : (
              <>
                <ScrollArea className="h-[200px] lg:h-[calc(100vh-450px)]">
                  <div className="space-y-4">
                    {itemsGrouped.map((group) => (
                      <div key={group.id} className="mb-2">
                        {itemsGrouped.length > 1 && (
                          <div className="flex justify-between items-center bg-muted/80 p-2 rounded mb-1">
                            <span className="font-bold text-sm text-primary">{group.name}</span>
                            <span className="text-xs font-mono text-foreground font-semibold">
                              S/ {group.items.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2)}
                            </span>
                          </div>
                        )}
                        <div className="space-y-2">
                          {group.items.map((item) => (
                            <div key={`${item.productoId}-${item.originalIndex}`} className={cn("flex items-center gap-3 p-3 rounded-lg border border-border/40", item.pagado ? "bg-emerald-500/5 border-emerald-500/20" : "bg-card")}>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{item.nombre}</p>
                                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                                  <span>S/ {item.precioUnitario.toFixed(2)} c/u</span>
                                  {item.pagado && <span className="text-emerald-600 font-bold flex items-center text-[10px] bg-emerald-100 px-1.5 py-0.5 rounded-full dark:bg-emerald-900/30 dark:text-emerald-400"><Check className="h-3 w-3 mr-1" />PAGADO</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleUpdateCantidad(item.originalIndex, -1)}
                                  disabled={!!item.pagado}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-6 text-center font-medium">{item.cantidad}</span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleUpdateCantidad(item.originalIndex, 1)}
                                  disabled={!!item.pagado}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                              <div className="text-right min-w-[60px]">
                                <p className="font-semibold text-sm">S/ {item.subtotal.toFixed(2)}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => handleRemoveItem(item.originalIndex)}
                                disabled={!!item.pagado}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <Separator className="my-4" />

                {/* Totals */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>S/ {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IGV (10.5%)</span>
                    <span>S/ {impuesto.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-primary">S/ {total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Actions */}
                {!isCajero ? (
                  <Button
                    className="w-full mt-4 h-12"
                    onClick={handleEnviarPedido}
                    disabled={addItemMutation.isPending || items.length === 0}
                  >
                    {addItemMutation.isPending ? (
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5 mr-2" />
                    )}
                    {isCorrectionMode ? "Corregir Pedido" : (isCajeroReal ? "Guardar Cambios" : "Enviar a Cocina")}
                  </Button>
                ) : (
                  <div className="flex flex-col gap-2 mt-4">
                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={handleEnviarPedido}
                      disabled={addItemMutation.isPending}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Guardar Cambios
                    </Button>
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => {
                        const printWindow = window.open('', '', 'height=600,width=400');
                        if (printWindow) {
                          const logoHtml = empresa.logoUrl ? `<img src="${empresa.logoUrl}" style="max-width: 150px; max-height: 80px; margin-bottom: 5px;" />` : '';

                          printWindow.document.write('<html><head><title>Precuenta</title>');
                          printWindow.document.write('<style>');
                          printWindow.document.write(`
                            @page { size: auto; margin: 0mm; } 
                            body { font-family: 'Courier New', Courier, monospace; font-size: 12px; margin: 5mm; width: 280px; }
                            .header { text-align: center; margin-bottom: 10px; }
                            h3 { margin: 5px 0; font-size: 14px; font-weight: bold; text-transform: uppercase; }
                            p { margin: 2px 0; }
                            .separator { border-top: 1px dashed black; margin: 10px 0; }
                            table { width: 100%; border-collapse: collapse; }
                            th { text-align: left; border-bottom: 1px dashed black; padding-bottom: 3px; font-size: 11px; }
                            td { vertical-align: top; padding: 4px 0; font-size: 11px; }
                            .text-right { text-align: right; }
                            .text-center { text-align: center; }
                            .totals { margin-top: 10px; border-top: 1px dashed black; padding-top: 5px; }
                            .total-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
                            .grand-total { font-weight: bold; font-size: 14px; margin-top: 5px; }
                            .page-break { page-break-after: always; display: block; height: 1px; margin: 20px 0; border-bottom: 1px dotted #ccc; }
                            @media print {
                                .page-break { border: none; margin: 0; }
                            }
                          `);
                          printWindow.document.write('</style>');
                          printWindow.document.write('</head><body>');

                          const igvPorcentaje = parseFloat(empresa?.impuestoPorcentaje || "10.50");
                          const factorIgv = 1 + (igvPorcentaje / 100);

                          itemsGrouped.forEach((group, index) => {
                            if (index > 0) {
                              printWindow.document.write('<div class="page-break"></div>');
                            }

                            const groupTotal = group.items.reduce((acc, item) => acc + item.subtotal, 0);
                            const groupSubtotal = groupTotal / factorIgv;
                            const groupImpuesto = groupTotal - groupSubtotal;

                            // Header
                            printWindow.document.write('<div class="header">');
                            printWindow.document.write(logoHtml);
                            printWindow.document.write(`<h3>${empresa.nombre}</h3>`);
                            if (empresa.ruc) printWindow.document.write(`<p>RUC ${empresa.ruc}</p>`);
                            if (empresa.direccion) printWindow.document.write(`<p>${empresa.direccion}</p>`);
                            if (empresa.telefono) printWindow.document.write(`<p>Tel: ${empresa.telefono}</p>`);
                            printWindow.document.write('<div class="separator"></div>');
                            printWindow.document.write('<h3>PRECUENTA DE CONSUMO</h3>');
                            if (itemsGrouped.length > 1) {
                              printWindow.document.write(`<h3>${group.name.toUpperCase()}</h3>`);
                            }
                            printWindow.document.write(`<p>MESA: ${mesa?.numero} - MOZO: ${empleado.nombre.toUpperCase()}</p>`);
                            printWindow.document.write(`<p>FECHA: ${new Date().toLocaleString()}</p>`);
                            printWindow.document.write('</div>');

                            // Items Table
                            printWindow.document.write('<table>');
                            printWindow.document.write('<thead><tr><th style="width: 50%;">DESCRIPCIÓN</th><th class="text-right">P.U.</th><th class="text-right">TOTAL</th></tr></thead>');
                            printWindow.document.write('<tbody>');
                            group.items.forEach(item => {
                              printWindow.document.write('<tr>');
                              printWindow.document.write(`<td>[${item.cantidad}] ${item.nombre.toUpperCase()}</td>`);
                              printWindow.document.write(`<td class="text-right">${item.precioUnitario.toFixed(2)}</td>`);
                              printWindow.document.write(`<td class="text-right">${item.subtotal.toFixed(2)}</td>`);
                              printWindow.document.write('</tr>');
                            });
                            printWindow.document.write('</tbody></table>');

                            // Totals
                            printWindow.document.write('<div class="totals">');
                            printWindow.document.write('<div class="total-row"><span>GRAVADA:</span><span>S/ ' + groupSubtotal.toFixed(2) + '</span></div>');
                            printWindow.document.write('<div class="total-row"><span>IGV (10.5%):</span><span>S/ ' + groupImpuesto.toFixed(2) + '</span></div>');
                            printWindow.document.write('<div class="total-row grand-total"><span>TOTAL:</span><span>S/ ' + groupTotal.toFixed(2) + '</span></div>');
                            printWindow.document.write('</div>');

                            // Footer
                            printWindow.document.write('<div class="separator"></div>');
                            printWindow.document.write('<div class="text-center">');
                            printWindow.document.write('<p>Gracias por su preferencia</p>');
                            printWindow.document.write('</div>');
                          });

                          printWindow.document.write('</body></html>');

                          printWindow.document.close();

                          // Wait for images to load before printing
                          if (empresa.logoUrl) {
                            setTimeout(() => {
                              printWindow.focus();
                              printWindow.print();
                            }, 500);
                          } else {
                            printWindow.focus();
                            printWindow.print();
                          }
                        }
                      }}
                    >
                      <Printer className="h-5 w-5 mr-2" />
                      Imprimir Precuenta
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <Dialog open={showAnularConfirm} onOpenChange={setShowAnularConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular Pedido Completo</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas anular este pedido?
              <br /><br />
              Esta acción eliminará todos los items registrados y liberará la mesa inmediatamente. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAnularConfirm(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={confirmAnularPedido}
              disabled={deletePedidoMutation.isPending}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {deletePedidoMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sí, Anular Pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DividirCuentaDialog
        open={showDividirCuenta}
        onOpenChange={setShowDividirCuenta}
        items={items.map(i => ({ ...i, nombre: i.nombre || "Item", pagado: i.pagado || false }))}
        onSave={async (updates) => {
          await updateSubcuentasMutation.mutateAsync(updates);
        }}
      />
    </div>
  );
}
