import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface Empleado {
  id: number;
  nombre: string;
  apellido: string | null;
  rol: "MOZO" | "CAJERO" | "DUENO" | "ADMIN";
  empresaId: number;
}

interface Empresa {
  id: number;
  nombre: string;
  ruc: string | null;
  razonSocial: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  logoUrl: string | null;
  impuestoPorcentaje: string;
  moneda: string;
}

interface POSContextType {
  empleado: Empleado | null;
  empresa: Empresa | null;
  isAuthenticated: boolean;
  login: (empleado: Empleado, empresa: Empresa) => void;
  logout: () => void;
  setEmpresa: (empresa: Empresa) => void;
}

const POSContext = createContext<POSContextType | undefined>(undefined);

const STORAGE_KEY = "comanda_maestra_session";

export function POSProvider({ children }: { children: ReactNode }) {
  const [empleado, setEmpleado] = useState<Empleado | null>(null);
  const [empresa, setEmpresaState] = useState<Empresa | null>(null);

  // Cargar sesión del localStorage al iniciar
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const session = JSON.parse(stored);
        if (session.empleado && session.empresa) {
          setEmpleado(session.empleado);
          setEmpresaState(session.empresa);
        }
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const login = (emp: Empleado, empr: Empresa) => {
    setEmpleado(emp);
    setEmpresaState(empr);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ empleado: emp, empresa: empr }));
  };

  const logout = () => {
    setEmpleado(null);
    setEmpresaState(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const setEmpresa = (empr: Empresa) => {
    setEmpresaState(empr);
    if (empleado) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ empleado, empresa: empr }));
    }
  };

  return (
    <POSContext.Provider
      value={{
        empleado,
        empresa,
        isAuthenticated: !!empleado,
        login,
        logout,
        setEmpresa,
      }}
    >
      {children}
    </POSContext.Provider>
  );
}

export function usePOS() {
  const context = useContext(POSContext);
  if (context === undefined) {
    throw new Error("usePOS must be used within a POSProvider");
  }
  return context;
}
