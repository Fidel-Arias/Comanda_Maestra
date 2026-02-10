import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { usePOS } from "@/features/auth/contexts/POSContext";
import { BottomNavigation } from "@/components/layout/BottomNavigation";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/forms/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/display/card";
import { Input } from "@/components/ui/forms/input";
import { Label } from "@/components/ui/forms/label";
import { Textarea } from "@/components/ui/forms/textarea";
import { ScrollArea } from "@/components/ui/display/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  ArrowLeft, Plus, Pencil, Trash2, Package, Loader2, Search,
  DollarSign, Hash, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ProductoForm {
  nombre: string;
  descripcion: string;
  precio: string;
  precioCosto: string;
  stock: string;
  stockMinimo: string;
  categoriaId: string;
  imagenUrl: string;
}

const initialForm: ProductoForm = {
  nombre: "",
  descripcion: "",
  precio: "",
  precioCosto: "",
  stock: "100",
  stockMinimo: "5",
  categoriaId: "",
  imagenUrl: "",
};

export default function GestionProductos() {
  const [, navigate] = useLocation();
  const { empleado, empresa } = usePOS();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoria, setSelectedCategoria] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductoForm>(initialForm);

  // Queries
  const { data: productos, isLoading, refetch } = trpc.producto.listByEmpresa.useQuery(
    { empresaId: empresa?.id || 0 },
    { enabled: !!empresa?.id }
  );

  const { data: categorias } = trpc.categoria.listByEmpresa.useQuery(
    { empresaId: empresa?.id || 0 },
    { enabled: !!empresa?.id }
  );

  // Mutations
  const createMutation = trpc.producto.create.useMutation({
    onSuccess: () => {
      toast.success("Producto creado exitosamente");
      refetch();
      handleCloseDialog();
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Error al crear producto");
    },
  });

  const updateMutation = trpc.producto.update.useMutation({
    onSuccess: () => {
      toast.success("Producto actualizado exitosamente");
      refetch();
      handleCloseDialog();
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Error al actualizar producto");
    },
  });

  const deleteMutation = trpc.producto.delete.useMutation({
    onSuccess: () => {
      toast.success("Producto eliminado exitosamente");
      refetch();
      setIsDeleteDialogOpen(false);
      setDeletingId(null);
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Error al eliminar producto");
    },
  });

  // Filtrar productos
  const filteredProductos = productos?.filter((p) => {
    const matchesSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategoria = selectedCategoria === "all" || p.categoriaId === parseInt(selectedCategoria);
    return matchesSearch && matchesCategoria;
  });

  const handleOpenCreate = () => {
    setForm(initialForm);
    setEditingId(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (producto: NonNullable<typeof productos>[0]) => {
    setForm({
      nombre: producto.nombre,
      descripcion: producto.descripcion || "",
      precio: producto.precio,
      precioCosto: producto.precioCosto || "",
      stock: producto.stock?.toString() || "100",
      stockMinimo: producto.stockMinimo?.toString() || "5",
      categoriaId: producto.categoriaId.toString(),
      imagenUrl: producto.imagenUrl || "",
    });
    setEditingId(producto.id);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setForm(initialForm);
    setEditingId(null);
  };

  const handleSubmit = () => {
    if (!form.nombre || !form.precio || !form.categoriaId) {
      toast.error("Completa los campos requeridos");
      return;
    }

    const data = {
      empresaId: empresa?.id || 0,
      nombre: form.nombre,
      descripcion: form.descripcion || null,
      precio: form.precio,
      precioCosto: form.precioCosto || null,
      stock: parseInt(form.stock) || 100,
      stockMinimo: parseInt(form.stockMinimo) || 5,
      categoriaId: parseInt(form.categoriaId),
      imagenUrl: form.imagenUrl || null,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: number) => {
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
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/50 flex items-center justify-center">
                <Package className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h1 className="font-bold text-foreground">Gestión de Platos</h1>
                <p className="text-xs text-muted-foreground">
                  {productos?.length || 0} productos registrados
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button onClick={handleOpenCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Nuevo Plato</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="container py-4 border-b border-border/50">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar platos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategoria} onValueChange={setSelectedCategoria}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Todas las categorías" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categorias?.map((cat) => (
                <SelectItem key={cat.id} value={cat.id.toString()}>
                  {cat.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Products List */}
      <main className="container py-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredProductos && filteredProductos.length > 0 ? (
          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="grid gap-3">
              {filteredProductos.map((producto) => {
                const categoria = categorias?.find(c => c.id === producto.categoriaId);
                const stockBajo = (producto.stock || 0) <= (producto.stockMinimo || 5);
                
                return (
                  <Card key={producto.id} className="bg-card/50 border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Image or Icon */}
                        <div className="w-16 h-16 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {producto.imagenUrl ? (
                            <img 
                              src={producto.imagenUrl} 
                              alt={producto.nombre}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="h-8 w-8 text-muted-foreground" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-semibold text-foreground truncate">
                                {producto.nombre}
                              </h3>
                              {categoria && (
                                <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                  {categoria.nombre}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleOpenEdit(producto)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(producto.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          {producto.descripcion && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                              {producto.descripcion}
                            </p>
                          )}

                          <div className="flex items-center gap-4 mt-2">
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4 text-emerald-400" />
                              <span className="font-semibold text-emerald-400">
                                S/ {parseFloat(producto.precio).toFixed(2)}
                              </span>
                            </div>
                            <div className={cn(
                              "flex items-center gap-1",
                              stockBajo ? "text-destructive" : "text-muted-foreground"
                            )}>
                              {stockBajo && <AlertTriangle className="h-4 w-4" />}
                              <Hash className="h-4 w-4" />
                              <span className="text-sm">
                                Stock: {producto.stock}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <Card className="bg-card/50">
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchTerm || selectedCategoria !== "all" 
                  ? "No se encontraron productos con esos filtros"
                  : "No hay productos registrados"}
              </p>
              <Button onClick={handleOpenCreate} className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                Agregar primer plato
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Plato" : "Nuevo Plato"}
            </DialogTitle>
            <DialogDescription>
              {editingId 
                ? "Modifica los datos del plato" 
                : "Completa los datos para agregar un nuevo plato al menú"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Ceviche Clásico"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="categoria">Categoría *</Label>
              <Select 
                value={form.categoriaId} 
                onValueChange={(v) => setForm({ ...form, categoriaId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categorias?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Descripción del plato..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="precio">Precio de Venta *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    S/
                  </span>
                  <Input
                    id="precio"
                    type="number"
                    step="0.01"
                    value={form.precio}
                    onChange={(e) => setForm({ ...form, precio: e.target.value })}
                    className="pl-10"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="precioCosto">Precio de Costo</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    S/
                  </span>
                  <Input
                    id="precioCosto"
                    type="number"
                    step="0.01"
                    value={form.precioCosto}
                    onChange={(e) => setForm({ ...form, precioCosto: e.target.value })}
                    className="pl-10"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="stock">Stock Actual</Label>
                <Input
                  id="stock"
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  placeholder="100"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="stockMinimo">Stock Mínimo</Label>
                <Input
                  id="stockMinimo"
                  type="number"
                  value={form.stockMinimo}
                  onChange={(e) => setForm({ ...form, stockMinimo: e.target.value })}
                  placeholder="5"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="imagenUrl">URL de Imagen</Label>
              <Input
                id="imagenUrl"
                value={form.imagenUrl}
                onChange={(e) => setForm({ ...form, imagenUrl: e.target.value })}
                placeholder="https://ejemplo.com/imagen.jpg"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? "Guardar Cambios" : "Crear Plato"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este plato?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El plato será eliminado permanentemente del menú.
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
