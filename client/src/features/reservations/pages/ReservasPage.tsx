import { useState } from "react";
import { usePOS } from "@/features/auth/contexts/POSContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/forms/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/display/card";
import { Input } from "@/components/ui/forms/input";
import { Label } from "@/components/ui/forms/label";
import { Textarea } from "@/components/ui/forms/textarea";
import { Badge } from "@/components/ui/display/badge";
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
  ArrowLeft, Plus, Calendar, Clock, Users, Phone, Mail,
  CheckCircle, XCircle, AlertCircle, Pencil, Trash2
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const STATUS_CONFIG = {
  PENDIENTE: { label: "Pendiente", color: "bg-yellow-500", icon: AlertCircle },
  CONFIRMADA: { label: "Confirmada", color: "bg-green-500", icon: CheckCircle },
  CANCELADA: { label: "Cancelada", color: "bg-red-500", icon: XCircle },
  COMPLETADA: { label: "Completada", color: "bg-blue-500", icon: CheckCircle },
};

export default function Reservas() {
  const { empleado } = usePOS();
  const isCajero = empleado?.rol === "CAJERO";
  const [, setLocation] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [editingReserva, setEditingReserva] = useState<{
    id: number;
    mesaId: number;
    clienteNombre: string;
    clienteTelefono: string | null;
    clienteEmail: string | null;
    fechaReserva: Date;
    horaInicio: string;
    personas: number;
    notas: string | null;
    reservaStatus: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    mesaId: 0,
    clienteNombre: "",
    clienteTelefono: "",
    clienteEmail: "",
    fechaReserva: format(new Date(), "yyyy-MM-dd"),
    horaInicio: "12:00",
    personas: 2,
    notas: "",
  });

  const utils = trpc.useUtils();

  const { data: reservas, isLoading } = trpc.reserva.listByFecha.useQuery(
    { empresaId: empleado?.empresaId || 0, fecha: selectedDate },
    { enabled: !!empleado?.empresaId }
  );

  const { data: mesas } = trpc.mesa.listByEmpresa.useQuery(
    { empresaId: empleado?.empresaId || 0 },
    { enabled: !!empleado?.empresaId }
  );

  const createMutation = trpc.reserva.create.useMutation({
    onSuccess: () => {
      toast.success("Reserva creada exitosamente");
      utils.reserva.listByFecha.invalidate();
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Error al crear reserva: " + error.message);
    },
  });

  const updateMutation = trpc.reserva.update.useMutation({
    onSuccess: () => {
      toast.success("Reserva actualizada exitosamente");
      utils.reserva.listByFecha.invalidate();
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Error al actualizar reserva: " + error.message);
    },
  });

  const updateStatusMutation = trpc.reserva.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Estado actualizado");
      utils.reserva.listByFecha.invalidate();
    },
    onError: (error) => {
      toast.error("Error: " + error.message);
    },
  });

  const confirmArrivalMutation = trpc.reserva.confirmArrival.useMutation({
    onSuccess: () => {
      toast.success("Cliente ha llegado. Mesa ocupada.");
      utils.reserva.listByFecha.invalidate();
      // También invalidar mesas para ver el cambio de estado
      utils.mesa.listByEmpresa.invalidate();
    },
    onError: (error) => {
      toast.error("Error al confirmar llegada: " + error.message);
    },
  });

  const deleteMutation = trpc.reserva.delete.useMutation({
    onSuccess: () => {
      toast.success("Reserva eliminada");
      utils.reserva.listByFecha.invalidate();
    },
    onError: (error) => {
      toast.error("Error: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      mesaId: 0,
      clienteNombre: "",
      clienteTelefono: "",
      clienteEmail: "",
      fechaReserva: selectedDate,
      horaInicio: "12:00",
      personas: 2,
      notas: "",
    });
    setEditingReserva(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.clienteNombre.trim()) {
      toast.error("El nombre del cliente es requerido");
      return;
    }
    if (!formData.mesaId) {
      toast.error("Selecciona una mesa");
      return;
    }

    if (editingReserva) {
      updateMutation.mutate({
        id: editingReserva.id,
        clienteNombre: formData.clienteNombre,
        clienteTelefono: formData.clienteTelefono || null,
        clienteEmail: formData.clienteEmail || null,
        fechaReserva: formData.fechaReserva,
        horaInicio: formData.horaInicio,
        personas: formData.personas,
        notas: formData.notas || null,
      });
    } else {
      createMutation.mutate({
        empresaId: empleado?.empresaId || 0,
        mesaId: formData.mesaId,
        clienteNombre: formData.clienteNombre,
        clienteTelefono: formData.clienteTelefono || null,
        clienteEmail: formData.clienteEmail || null,
        fechaReserva: formData.fechaReserva,
        horaInicio: formData.horaInicio,
        personas: formData.personas,
        notas: formData.notas || null,
      });
    }
  };

  const handleEdit = (reserva: typeof editingReserva) => {
    if (!reserva) return;
    setEditingReserva(reserva);
    setFormData({
      mesaId: reserva.mesaId,
      clienteNombre: reserva.clienteNombre,
      clienteTelefono: reserva.clienteTelefono || "",
      clienteEmail: reserva.clienteEmail || "",
      fechaReserva: format(new Date(reserva.fechaReserva), "yyyy-MM-dd"),
      horaInicio: reserva.horaInicio,
      personas: reserva.personas,
      notas: reserva.notas || "",
    });
    setDialogOpen(true);
  };

  const handleStatusChange = (id: number, status: "PENDIENTE" | "CONFIRMADA" | "CANCELADA" | "COMPLETADA") => {
    updateStatusMutation.mutate({ id, status });
  };

  const handleConfirmArrival = (id: number) => {
    confirmArrivalMutation.mutate({ id });
  };

  const handleDelete = (id: number) => {
    if (confirm("¿Estás seguro de eliminar esta reserva?")) {
      deleteMutation.mutate({ id });
    }
  };

  if (!empleado || !["DUENO", "ADMIN", "CAJERO"].includes(empleado.rol)) {
    setLocation("/mozo");
    return null;
  }

  const getMesaNumero = (mesaId: number) => {
    const mesa = mesas?.find(m => m.id === mesaId);
    return mesa?.numero || mesaId;
  };

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
            <h1 className="text-lg font-semibold text-foreground">Reservas</h1>
            <p className="text-sm text-muted-foreground">Gestiona las reservas de mesas</p>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Selector de fecha */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Calendar className="h-5 w-5 text-primary" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Botón agregar */}
        {isCajero && (
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="w-full gap-2">
                <Plus className="h-4 w-4" />
                Nueva Reserva
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingReserva ? "Editar Reserva" : "Nueva Reserva"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Mesa *</Label>
                  <Select
                    value={formData.mesaId.toString()}
                    onValueChange={(value) => setFormData({ ...formData, mesaId: parseInt(value) })}
                    disabled={!!editingReserva}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una mesa" />
                    </SelectTrigger>
                    <SelectContent>
                      {mesas?.map((mesa) => (
                        <SelectItem key={mesa.id} value={mesa.id.toString()}>
                          Mesa {mesa.numero} - {mesa.capacidad} personas
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clienteNombre">Nombre del Cliente *</Label>
                  <Input
                    id="clienteNombre"
                    value={formData.clienteNombre}
                    onChange={(e) => setFormData({ ...formData, clienteNombre: e.target.value })}
                    placeholder="Nombre completo"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clienteTelefono">Teléfono</Label>
                    <Input
                      id="clienteTelefono"
                      value={formData.clienteTelefono}
                      onChange={(e) => setFormData({ ...formData, clienteTelefono: e.target.value })}
                      placeholder="999-999-999"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clienteEmail">Email</Label>
                    <Input
                      id="clienteEmail"
                      type="email"
                      value={formData.clienteEmail}
                      onChange={(e) => setFormData({ ...formData, clienteEmail: e.target.value })}
                      placeholder="email@ejemplo.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fechaReserva">Fecha *</Label>
                  <Input
                    id="fechaReserva"
                    type="date"
                    value={formData.fechaReserva}
                    onChange={(e) => setFormData({ ...formData, fechaReserva: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="horaInicio">Hora Inicio *</Label>
                    <Input
                      id="horaInicio"
                      type="time"
                      value={formData.horaInicio}
                      onChange={(e) => setFormData({ ...formData, horaInicio: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="personas">Número de Personas *</Label>
                  <Input
                    id="personas"
                    type="number"
                    min="1"
                    max="20"
                    value={formData.personas}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        setFormData({ ...formData, personas: "" as any });
                      } else {
                        setFormData({ ...formData, personas: parseInt(val) || 1 });
                      }
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notas">Notas</Label>
                  <Textarea
                    id="notas"
                    value={formData.notas}
                    onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                    placeholder="Notas adicionales (cumpleaños, alergias, etc.)"
                    rows={2}
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
                    {editingReserva ? "Guardar Cambios" : "Crear Reserva"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* Lista de reservas */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Cargando reservas...
          </div>
        ) : reservas && reservas.length > 0 ? (
          <div className="space-y-3">
            {reservas.map((reserva: any) => {
              const statusConfig = STATUS_CONFIG[reserva.reservaStatus as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.PENDIENTE;
              const StatusIcon = statusConfig.icon;

              return (
                <Card key={reserva.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge className={`${statusConfig.color} text-white`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
                        <span className="text-sm font-medium">Mesa {getMesaNumero(reserva.mesaId)}</span>
                      </div>
                      {isCajero && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(reserva)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDelete(reserva.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-foreground font-medium">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {reserva.clienteNombre} ({reserva.personas} personas)
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {reserva.horaInicio}
                      </div>

                      {reserva.clienteTelefono && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          {reserva.clienteTelefono}
                        </div>
                      )}

                      {reserva.clienteEmail && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          {reserva.clienteEmail}
                        </div>
                      )}

                      {reserva.notas && (
                        <p className="text-sm text-muted-foreground italic mt-2">
                          "{reserva.notas}"
                        </p>
                      )}
                    </div>

                    {/* Acciones de estado */}
                    {isCajero && reserva.reservaStatus !== "COMPLETADA" && reserva.reservaStatus !== "CANCELADA" && (
                      <div className="flex gap-2 mt-4 pt-3 border-t border-border">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-green-600 border-green-600 hover:bg-green-50"
                          onClick={() => handleConfirmArrival(reserva.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Confirmar Llegada
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-red-600 border-red-600 hover:bg-red-50"
                          onClick={() => handleStatusChange(reserva.id, "CANCELADA")}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No hay reservas para esta fecha</p>
              <p className="text-sm text-muted-foreground mt-1">
                {format(new Date(selectedDate), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      <BottomNavigation />
    </div>
  );
}
