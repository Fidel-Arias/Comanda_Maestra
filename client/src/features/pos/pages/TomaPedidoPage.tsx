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
  ArrowLeft, Search, Plus, Minus, Trash2,
  Send, Loader2, AlertCircle, Check
} from "lucide-react";
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
}

export default function TomaPedido() {
  const params = useParams<{ mesaId: string }>();
  const mesaId = parseInt(params.mesaId || "0");
  const [, navigate] = useLocation();
  const { empleado, empresa } = usePOS();
  const isCajero = empleado?.rol === "CAJERO";

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoria, setSelectedCategoria] = useState<number | null>(null);
  const [items, setItems] = useState<ItemPedido[]>([]);
  const [pedidoId, setPedidoId] = useState<number | null>(null);

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

  const { data: pedidoActivo } = trpc.pedido.getByMesa.useQuery(
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

  const handleUpdateCantidad = (index: number, delta: number) => {
    const newItems = [...items];
    const newCantidad = newItems[index].cantidad + delta;

    if (newCantidad <= 0) {
      newItems.splice(index, 1);
    } else {
      newItems[index].cantidad = newCantidad;
      newItems[index].subtotal = newCantidad * newItems[index].precioUnitario;
    }

    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
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

      // Cambiar estado a PREPARANDO
      await updateEstadoMutation.mutateAsync({
        id: pedidoId,
        estado: "PREPARANDO",
      });

      toast.success("Pedido enviado a cocina");
      navigate("/mozo");
    } catch (error) {
      toast.error("Error al enviar el pedido");
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
            <Button variant="ghost" size="icon" onClick={() => navigate("/mozo")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-bold text-foreground">Toma de Pedido</h1>
              <p className="text-xs text-muted-foreground">
                Mesa {mesa?.numero} • {empleado.nombre}
              </p>
            </div>
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
        <div className={cn("lg:w-96 border-t lg:border-t-0 border-border/50 bg-card/30", isCajero && "w-full")}>
          <div className="p-4">
            <h2 className="font-bold text-lg mb-4">
              {isCajero ? "Visualizando Pedido" : "Pedido Actual"} - Mesa {mesa?.numero}
            </h2>
            {isCajero && (
              <Badge variant="outline" className="mb-4 text-amber-400 border-amber-500/50">
                Modo Solo Lectura
              </Badge>
            )}

            {items.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No hay items en el pedido</p>
                <p className="text-sm">Selecciona items del menú para comenzar</p>
              </div>
            ) : (
              <>
                <ScrollArea className="h-[200px] lg:h-[calc(100vh-450px)]">
                  <div className="space-y-3">
                    {items.map((item, index) => (
                      <div
                        key={`${item.productoId}-${index}`}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.nombre}</p>
                          <p className="text-xs text-muted-foreground">
                            S/ {item.precioUnitario.toFixed(2)} c/u
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!isCajero && (
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleUpdateCantidad(index, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                          )}
                          <span className="w-6 text-center font-medium">{item.cantidad}</span>
                          {!isCajero && (
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleUpdateCantidad(index, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <div className="text-right min-w-[60px]">
                          <p className="font-semibold text-sm">
                            S/ {item.subtotal.toFixed(2)}
                          </p>
                        </div>
                        {!isCajero && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleRemoveItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
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

                {/* Actions - Hidden for Cashiers */}
                {!isCajero && (
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
                    Enviar a Cocina
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
