import { useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { usePOS } from "@/features/auth/contexts/POSContext";
import { BottomNavigation } from "@/components/layout/BottomNavigation";
import { Button } from "@/components/ui/forms/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/display/card";
import { ScrollArea } from "@/components/ui/display/scroll-area";
import {
  BarChart3, DollarSign, Users, TrendingUp, LogOut,
  Loader2, Building2, Clock, ShoppingBag, Award, FileText
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart
} from "recharts";
import { cn } from "@/lib/utils";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { empleado, empresa, logout } = usePOS();

  // Queries
  const { data: ventasTotales, isLoading: loadingVentas } = trpc.analytics.ventasTotales.useQuery(
    { empresaId: empresa?.id || 0 },
    { enabled: !!empresa?.id }
  );

  const { data: productosMasVendidos } = trpc.analytics.productosMasVendidos.useQuery(
    { empresaId: empresa?.id || 0, limit: 5 },
    { enabled: !!empresa?.id }
  );

  const { data: rendimientoMozos } = trpc.analytics.rendimientoMozos.useQuery(
    { empresaId: empresa?.id || 0 },
    { enabled: !!empresa?.id }
  );

  const { data: ventasPorHora } = trpc.analytics.ventasPorHora.useQuery(
    { empresaId: empresa?.id || 0 },
    { enabled: !!empresa?.id }
  );

  const { data: ventasPorCategoria } = trpc.analytics.ventasPorCategoria.useQuery(
    { empresaId: empresa?.id || 0 },
    { enabled: !!empresa?.id }
  );

  const { data: mesas } = trpc.mesa.listByEmpresa.useQuery(
    { empresaId: empresa?.id || 0 },
    { enabled: !!empresa?.id }
  );

  const { data: pedidosActivos } = trpc.pedido.listActivos.useQuery(
    { empresaId: empresa?.id || 0 },
    { enabled: !!empresa?.id }
  );

  // Calcular métricas
  const ticketPromedio = useMemo(() => {
    if (!ventasTotales || ventasTotales.count === 0) return 0;
    return parseFloat(ventasTotales.total) / ventasTotales.count;
  }, [ventasTotales]);

  const mesasOcupadas = useMemo(() => {
    return mesas?.filter(m => m.tableStatus !== "DISPONIBLE").length || 0;
  }, [mesas]);

  const totalMesas = mesas?.length || 0;
  const ocupacionPorcentaje = totalMesas > 0 ? (mesasOcupadas / totalMesas) * 100 : 0;

  // Datos para gráficos
  const ventasHoraData = useMemo(() => {
    if (!ventasPorHora) return [];
    return ventasPorHora.map(v => ({
      hora: `${v.hora}:00`,
      ventas: parseFloat(v.total),
      cantidad: v.cantidad,
    }));
  }, [ventasPorHora]);

  const categoriaData = useMemo(() => {
    if (!ventasPorCategoria) return [];
    return ventasPorCategoria.map(c => ({
      name: c.nombre,
      value: parseFloat(c.total),
      cantidad: c.cantidad,
    }));
  }, [ventasPorCategoria]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  if (!empleado || !empresa) {
    navigate("/");
    return null;
  }

  // Verificar que el rol tenga acceso a esta vista
  if (!['DUENO', 'ADMIN'].includes(empleado.rol)) {
    navigate("/mozo");
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-card/95 backdrop-blur-sm">
        <div className="container py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-500/50 flex items-center justify-center overflow-hidden">
                {empresa.logoUrl ? (
                  <img src={empresa.logoUrl} alt={empresa.nombre} className="w-full h-full object-cover" />
                ) : (
                  <BarChart3 className="h-5 w-5 text-blue-400" />
                )}
              </div>
              <div>
                <h1 className="font-bold text-foreground">{empresa.nombre}</h1>
                <p className="text-xs text-muted-foreground">
                  {empleado.nombre} • <span className="text-blue-400">{empleado.rol}</span>
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ventas Totales</p>
                  <p className="text-xl font-bold text-foreground">
                    {loadingVentas ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      `S/ ${parseFloat(ventasTotales?.total || "0").toFixed(0)}`
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ticket Promedio</p>
                  <p className="text-xl font-bold text-foreground">
                    S/ {ticketPromedio.toFixed(0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <ShoppingBag className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pedidos Activos</p>
                  <p className="text-xl font-bold text-foreground">
                    {pedidosActivos?.length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ocupación</p>
                  <p className="text-xl font-bold text-foreground">
                    {ocupacionPorcentaje.toFixed(0)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gestión Rápida */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Card
            className="bg-amber-500/10 border-amber-500/30 cursor-pointer hover:bg-amber-500/20 transition-colors"
            onClick={() => navigate("/gestion/productos")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Platos</p>
                <p className="text-xs text-muted-foreground">Gestionar menú</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="bg-purple-500/10 border-purple-500/30 cursor-pointer hover:bg-purple-500/20 transition-colors"
            onClick={() => navigate("/gestion/mesas")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Mesas</p>
                <p className="text-xs text-muted-foreground">Cantidad</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="bg-cyan-500/10 border-cyan-500/30 cursor-pointer hover:bg-cyan-500/20 transition-colors"
            onClick={() => navigate("/gestion/categorias")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Categorías</p>
                <p className="text-xs text-muted-foreground">Organizar</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="bg-blue-500/10 border-blue-500/30 cursor-pointer hover:bg-blue-500/20 transition-colors"
            onClick={() => navigate("/facturacion")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Facturación</p>
                <p className="text-xs text-muted-foreground">Comprobantes</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="bg-rose-500/10 border-rose-500/30 cursor-pointer hover:bg-rose-500/20 transition-colors"
            onClick={() => navigate("/configuracion")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-500/20 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-rose-400" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Empresa</p>
                <p className="text-xs text-muted-foreground">Configurar</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Accesos Rápidos */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card
            className="bg-green-500/10 border-green-500/30 cursor-pointer hover:bg-green-500/20 transition-colors"
            onClick={() => navigate("/reservas")}
          >
            <CardContent className="p-3 flex flex-col items-center gap-2 text-center">
              <Clock className="h-6 w-6 text-green-400" />
              <p className="text-sm font-medium text-foreground">Reservas</p>
            </CardContent>
          </Card>

          <Card
            className="bg-blue-500/10 border-blue-500/30 cursor-pointer hover:bg-blue-500/20 transition-colors"
            onClick={() => navigate("/historial")}
          >
            <CardContent className="p-3 flex flex-col items-center gap-2 text-center">
              <TrendingUp className="h-6 w-6 text-blue-400" />
              <p className="text-sm font-medium text-foreground">Historial</p>
            </CardContent>
          </Card>

          <Card
            className="bg-indigo-500/10 border-indigo-500/30 cursor-pointer hover:bg-indigo-500/20 transition-colors"
            onClick={() => navigate("/reportes")}
          >
            <CardContent className="p-3 flex flex-col items-center gap-2 text-center">
              <DollarSign className="h-6 w-6 text-indigo-400" />
              <p className="text-sm font-medium text-foreground">Reportes</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Ventas por Hora */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Ventas por Hora
              </CardTitle>
              <CardDescription>Distribución de ventas durante el día</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                {ventasHoraData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={ventasHoraData}>
                      <defs>
                        <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="hora" stroke="#888" fontSize={12} />
                      <YAxis stroke="#888" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e1e1e',
                          border: '1px solid #333',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number) => [`S/ ${value.toFixed(2)}`, 'Ventas']}
                      />
                      <Area
                        type="monotone"
                        dataKey="ventas"
                        stroke="#3b82f6"
                        fillOpacity={1}
                        fill="url(#colorVentas)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    Sin datos de ventas hoy
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Ventas por Categoría */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-primary" />
                Ventas por Categoría
              </CardTitle>
              <CardDescription>Distribución de ventas por tipo de producto</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                {categoriaData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoriaData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {categoriaData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e1e1e',
                          border: '1px solid #333',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number) => [`S/ ${value.toFixed(2)}`, 'Ventas']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    Sin datos de categorías
                  </div>
                )}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {categoriaData.map((cat, index) => (
                  <div key={cat.name} className="flex items-center gap-1 text-xs">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-muted-foreground">{cat.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tables Row */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Top Productos */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-400" />
                Productos Más Vendidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[280px]">
                <div className="space-y-3">
                  {productosMasVendidos?.map((producto, index) => (
                    <div
                      key={producto.productoId}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                        index === 0 && "bg-amber-500/20 text-amber-400",
                        index === 1 && "bg-slate-400/20 text-slate-400",
                        index === 2 && "bg-orange-600/20 text-orange-400",
                        index > 2 && "bg-muted text-muted-foreground"
                      )}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{producto.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {producto.cantidadVendida} unidades vendidas
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-primary">
                          S/ {parseFloat(producto.totalVendido).toFixed(0)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(!productosMasVendidos || productosMasVendidos.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      Sin datos de productos
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Rendimiento Mozos */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-400" />
                Rendimiento por Mozo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[280px]">
                <div className="space-y-3">
                  {rendimientoMozos?.map((mozo, index) => (
                    <div
                      key={mozo.mozoId}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="font-bold text-primary">
                          {mozo.nombre?.[0]}{mozo.apellido?.[0] || ""}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">
                          {mozo.nombre} {mozo.apellido}
                        </p>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span>{mozo.totalPedidos} pedidos</span>
                          <span>{mozo.mesasAtendidas} mesas</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-emerald-400">
                          S/ {parseFloat(mozo.totalVentas).toFixed(0)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Prom: S/ {parseFloat(mozo.ticketPromedio).toFixed(0)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(!rendimientoMozos || rendimientoMozos.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      Sin datos de mozos
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Mapa de Calor de Mesas */}
        <Card className="bg-card/50 border-border/50 mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-purple-400" />
              Estado de Mesas
            </CardTitle>
            <CardDescription>Vista general de ocupación del restaurante</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mesa-grid">
              {mesas?.sort((a, b) => a.numero - b.numero).map((mesa) => {
                const isOcupada = mesa.tableStatus !== "DISPONIBLE";
                return (
                  <div
                    key={mesa.id}
                    className={cn(
                      "p-4 rounded-xl border-2 text-center transition-all",
                      mesa.tableStatus === "DISPONIBLE" && "bg-emerald-500/10 border-emerald-500/30",
                      mesa.tableStatus === "OCUPADA" && "bg-amber-500/20 border-amber-500/50",
                      mesa.tableStatus === "PIDIENDO_CUENTA" && "bg-red-500/20 border-red-500/50",
                      mesa.tableStatus === "RESERVADA" && "bg-purple-500/20 border-purple-500/50"
                    )}
                  >
                    <span className="text-2xl font-bold">{mesa.numero}</span>
                    <p className={cn(
                      "text-xs mt-1",
                      mesa.tableStatus === "DISPONIBLE" && "text-emerald-400",
                      mesa.tableStatus === "OCUPADA" && "text-amber-400",
                      mesa.tableStatus === "PIDIENDO_CUENTA" && "text-red-400",
                      mesa.tableStatus === "RESERVADA" && "text-purple-400"
                    )}>
                      {mesa.tableStatus === "DISPONIBLE" && "Libre"}
                      {mesa.tableStatus === "OCUPADA" && "Ocupada"}
                      {mesa.tableStatus === "PIDIENDO_CUENTA" && "Cuenta"}
                      {mesa.tableStatus === "RESERVADA" && "Reservada"}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </main>

      <BottomNavigation />
    </div>
  );
}
