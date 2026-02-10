import { useState } from "react";
import { usePOS } from "@/features/auth/contexts/POSContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/forms/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/display/card";
import { Input } from "@/components/ui/forms/input";
import { Label } from "@/components/ui/forms/label";
import { Textarea } from "@/components/ui/forms/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/overlays/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/forms/select";
import { BottomNavigation } from "@/components/layout/BottomNavigation";
import { useLocation } from "wouter";
import { 
  ArrowLeft, Plus, Pencil, Trash2, 
  UtensilsCrossed, Coffee, Wine, IceCream, Salad, Pizza, 
  Soup, Sandwich, Beef, Fish, Cake, Beer, GlassWater,
  Cookie, Croissant, Egg, Apple, Cherry, Grape, Carrot
} from "lucide-react";
import { toast } from "sonner";

// Iconos disponibles para categorías
const ICONOS_DISPONIBLES = [
  { value: "utensils", label: "Cubiertos", icon: UtensilsCrossed },
  { value: "coffee", label: "Café", icon: Coffee },
  { value: "wine", label: "Vino", icon: Wine },
  { value: "ice-cream", label: "Helado", icon: IceCream },
  { value: "salad", label: "Ensalada", icon: Salad },
  { value: "pizza", label: "Pizza", icon: Pizza },
  { value: "soup", label: "Sopa", icon: Soup },
  { value: "sandwich", label: "Sandwich", icon: Sandwich },
  { value: "beef", label: "Carne", icon: Beef },
  { value: "fish", label: "Pescado", icon: Fish },
  { value: "cake", label: "Pastel", icon: Cake },
  { value: "beer", label: "Cerveza", icon: Beer },
  { value: "water", label: "Agua", icon: GlassWater },
  { value: "cookie", label: "Galleta", icon: Cookie },
  { value: "croissant", label: "Croissant", icon: Croissant },
  { value: "egg", label: "Huevo", icon: Egg },
  { value: "apple", label: "Manzana", icon: Apple },
  { value: "cherry", label: "Cereza", icon: Cherry },
  { value: "grape", label: "Uva", icon: Grape },
  { value: "carrot", label: "Zanahoria", icon: Carrot },
];

const getIconComponent = (iconValue: string | null) => {
  const iconData = ICONOS_DISPONIBLES.find(i => i.value === iconValue);
  return iconData?.icon || UtensilsCrossed;
};

export default function GestionCategorias() {
  const { empleado } = usePOS();
  const [, setLocation] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<{
    id: number;
    nombre: string;
    descripcion: string | null;
    icono: string | null;
    orden: number | null;
  } | null>(null);
  
  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    icono: "utensils",
    orden: 0,
  });

  const utils = trpc.useUtils();
  
  const { data: categorias, isLoading } = trpc.categoria.listByEmpresa.useQuery(
    { empresaId: empleado?.empresaId || 0 },
    { enabled: !!empleado?.empresaId }
  );

  const createMutation = trpc.categoria.create.useMutation({
    onSuccess: () => {
      toast.success("Categoría creada exitosamente");
      utils.categoria.listByEmpresa.invalidate();
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Error al crear categoría: " + error.message);
    },
  });

  const updateMutation = trpc.categoria.update.useMutation({
    onSuccess: () => {
      toast.success("Categoría actualizada exitosamente");
      utils.categoria.listByEmpresa.invalidate();
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Error al actualizar categoría: " + error.message);
    },
  });

  const deleteMutation = trpc.categoria.delete.useMutation({
    onSuccess: () => {
      toast.success("Categoría eliminada exitosamente");
      utils.categoria.listByEmpresa.invalidate();
    },
    onError: (error) => {
      toast.error("Error al eliminar categoría: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({ nombre: "", descripcion: "", icono: "utensils", orden: 0 });
    setEditingCategoria(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nombre.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    if (editingCategoria) {
      updateMutation.mutate({
        id: editingCategoria.id,
        nombre: formData.nombre,
        descripcion: formData.descripcion || null,
        icono: formData.icono,
        orden: formData.orden,
      });
    } else {
      createMutation.mutate({
        empresaId: empleado?.empresaId || 0,
        nombre: formData.nombre,
        descripcion: formData.descripcion || null,
        icono: formData.icono,
        orden: formData.orden,
      });
    }
  };

  const handleEdit = (categoria: typeof editingCategoria) => {
    if (!categoria) return;
    setEditingCategoria(categoria);
    setFormData({
      nombre: categoria.nombre,
      descripcion: categoria.descripcion || "",
      icono: categoria.icono || "utensils",
      orden: categoria.orden || 0,
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("¿Estás seguro de eliminar esta categoría? Los productos asociados quedarán sin categoría.")) {
      deleteMutation.mutate({ id });
    }
  };

  if (!empleado || empleado.rol !== "DUENO") {
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
            <h1 className="text-lg font-semibold text-foreground">Gestión de Categorías</h1>
            <p className="text-sm text-muted-foreground">Administra las categorías de productos</p>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Botón agregar */}
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="w-full gap-2">
              <Plus className="h-4 w-4" />
              Nueva Categoría
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingCategoria ? "Editar Categoría" : "Nueva Categoría"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej: Entradas, Bebidas, Postres"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea
                  id="descripcion"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Descripción opcional de la categoría"
                  rows={2}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Icono</Label>
                <Select
                  value={formData.icono}
                  onValueChange={(value) => setFormData({ ...formData, icono: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un icono" />
                  </SelectTrigger>
                  <SelectContent>
                    {ICONOS_DISPONIBLES.map((icono) => {
                      const IconComponent = icono.icon;
                      return (
                        <SelectItem key={icono.value} value={icono.value}>
                          <div className="flex items-center gap-2">
                            <IconComponent className="h-4 w-4" />
                            <span>{icono.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="orden">Orden de visualización</Label>
                <Input
                  id="orden"
                  type="number"
                  min="0"
                  value={formData.orden}
                  onChange={(e) => setFormData({ ...formData, orden: parseInt(e.target.value) || 0 })}
                />
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingCategoria ? "Guardar Cambios" : "Crear Categoría"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Lista de categorías */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Cargando categorías...
          </div>
        ) : categorias && categorias.length > 0 ? (
          <div className="grid gap-3">
            {categorias.map((categoria) => {
              const IconComponent = getIconComponent(categoria.icono);
              return (
                <Card key={categoria.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <IconComponent className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground">{categoria.nombre}</h3>
                          {categoria.descripcion && (
                            <p className="text-sm text-muted-foreground">{categoria.descripcion}</p>
                          )}
                          <p className="text-xs text-muted-foreground">Orden: {categoria.orden || 0}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(categoria)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(categoria.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <UtensilsCrossed className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No hay categorías configuradas</p>
              <p className="text-sm text-muted-foreground mt-1">
                Crea tu primera categoría para organizar tus productos
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      <BottomNavigation />
    </div>
  );
}
