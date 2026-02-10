import { Toaster } from "@/components/ui/feedback/sonner";
import { TooltipProvider } from "@/components/ui/overlays/tooltip";
import NotFound from "./pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/shared/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { POSProvider } from "./features/auth/contexts/POSContext";

// Pages
import Login from "./features/auth/pages/LoginPage";
import Mozo from "./features/pos/pages/MozoPage";
import TomaPedido from "./features/pos/pages/TomaPedidoPage";
import Cajero from "./features/cashier/pages/CajeroPage";
import Dashboard from "./features/dashboard/pages/DashboardPage";
import GestionProductos from "./features/management/pages/GestionProductosPage";
import GestionMesas from "./features/management/pages/GestionMesasPage";
import GestionCategorias from "./features/management/pages/GestionCategoriasPage";
import Reservas from "./features/reservations/pages/ReservasPage";
import HistorialVentas from "./features/cashier/pages/HistorialVentasPage";
import Reportes from "./features/dashboard/pages/ReportesPage";
import ConfiguracionEmpresa from "./features/management/pages/ConfiguracionEmpresaPage";
import Facturacion from "./features/billing/pages/InvoicesPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/mozo" component={Mozo} />
      <Route path="/pedido/:mesaId" component={TomaPedido} />
      <Route path="/cajero" component={Cajero} />
      <Route path="/dashboard" component={Dashboard} />
      {/* Gestión */}
      <Route path="/gestion/productos" component={GestionProductos} />
      <Route path="/gestion/mesas" component={GestionMesas} />
      <Route path="/gestion/categorias" component={GestionCategorias} />
      {/* Facturación */}
      <Route path="/facturacion" component={Facturacion} />
      {/* Reservas */}
      <Route path="/reservas" component={Reservas} />
      {/* Historial y Reportes */}
      <Route path="/historial" component={HistorialVentas} />
      <Route path="/reportes" component={Reportes} />
      {/* Configuración */}
      <Route path="/configuracion" component={ConfiguracionEmpresa} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <POSProvider>
          <TooltipProvider>
            <Toaster position="top-center" richColors />
            <Router />
          </TooltipProvider>
        </POSProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
