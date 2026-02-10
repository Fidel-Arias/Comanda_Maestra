-- ============================================
-- COMANDA MAESTRA - SISTEMA POS
-- Script de Base de Datos para PostgreSQL
-- ============================================

-- ============================================
-- CREAR TIPOS ENUM
-- ============================================

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('MOZO', 'CAJERO', 'DUENO', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE table_status AS ENUM ('DISPONIBLE', 'OCUPADA', 'PIDIENDO_CUENTA', 'RESERVADA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('PENDIENTE', 'PREPARANDO', 'LISTO', 'ENTREGADO', 'CANCELADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('EFECTIVO', 'TARJETA', 'YAPE', 'PLIN', 'TRANSFERENCIA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('PENDIENTE', 'PAGADO', 'PARCIAL', 'CANCELADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE comprobante_type AS ENUM ('BOLETA', 'FACTURA', 'TICKET');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE system_role AS ENUM ('user', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE reservation_status AS ENUM ('PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'COMPLETADA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- TABLA: EMPRESAS (Multi-tenancy)
-- ============================================
CREATE TABLE IF NOT EXISTS empresas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    ruc VARCHAR(11),
    razon_social VARCHAR(255),
    direccion TEXT,
    telefono VARCHAR(20),
    email VARCHAR(255),
    logo_url TEXT,
    activa BOOLEAN DEFAULT true,
    impuesto_porcentaje DECIMAL(5,2) DEFAULT 18.00,
    moneda VARCHAR(3) DEFAULT 'PEN',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================
-- TABLA: EMPLEADOS (Usuarios POS con PIN)
-- ============================================
CREATE TABLE IF NOT EXISTS empleados (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id),
    nombre VARCHAR(255) NOT NULL,
    apellido VARCHAR(255),
    pin VARCHAR(4) NOT NULL,
    user_role user_role DEFAULT 'MOZO' NOT NULL,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================
-- TABLA: MESAS
-- ============================================
CREATE TABLE IF NOT EXISTS mesas (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id),
    numero INTEGER NOT NULL,
    capacidad INTEGER DEFAULT 4 NOT NULL,
    table_status table_status DEFAULT 'DISPONIBLE',
    mozo_asignado_id INTEGER REFERENCES empleados(id),
    personas INTEGER DEFAULT 0,
    fecha_ocupacion TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================
-- TABLA: CATEGORIAS
-- ============================================
CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id),
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    icono VARCHAR(50),
    orden INTEGER DEFAULT 0,
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================
-- TABLA: PRODUCTOS
-- ============================================
CREATE TABLE IF NOT EXISTS productos (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id),
    categoria_id INTEGER NOT NULL REFERENCES categorias(id),
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10,2) NOT NULL,
    precio_costo DECIMAL(10,2),
    stock INTEGER DEFAULT 100,
    stock_minimo INTEGER DEFAULT 5,
    imagen_url TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================
-- TABLA: PEDIDOS
-- ============================================
CREATE TABLE IF NOT EXISTS pedidos (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id),
    mesa_id INTEGER NOT NULL REFERENCES mesas(id),
    mozo_id INTEGER NOT NULL REFERENCES empleados(id),
    order_status order_status DEFAULT 'PENDIENTE',
    subtotal DECIMAL(10,2) DEFAULT 0.00,
    impuesto DECIMAL(10,2) DEFAULT 0.00,
    total DECIMAL(10,2) DEFAULT 0.00,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================
-- TABLA: ITEMS_PEDIDO
-- ============================================
CREATE TABLE IF NOT EXISTS items_pedido (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
    producto_id INTEGER NOT NULL REFERENCES productos(id),
    cantidad INTEGER DEFAULT 1 NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================
-- TABLA: CLIENTES
-- ============================================
CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id),
    nombre VARCHAR(255) NOT NULL,
    apellido VARCHAR(255),
    email VARCHAR(255),
    telefono VARCHAR(20),
    dni VARCHAR(8),
    ruc VARCHAR(11),
    direccion TEXT,
    tipo_cliente VARCHAR(50) DEFAULT 'CONSUMIDOR_FINAL',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================
-- TABLA: PAGOS
-- ============================================
CREATE TABLE IF NOT EXISTS pagos (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id),
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
    cliente_id INTEGER REFERENCES clientes(id),
    cajero_id INTEGER NOT NULL REFERENCES empleados(id),
    payment_method payment_method NOT NULL,
    payment_status payment_status DEFAULT 'PENDIENTE',
    monto DECIMAL(10,2) NOT NULL,
    monto_pagado DECIMAL(10,2) DEFAULT 0.00,
    vuelto DECIMAL(10,2) DEFAULT 0.00,
    referencia_pago VARCHAR(255),
    fecha_pago TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================
-- TABLA: COMPROBANTES
-- ============================================
CREATE TABLE IF NOT EXISTS comprobantes (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id),
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
    cliente_id INTEGER REFERENCES clientes(id),
    tipo comprobante_type NOT NULL,
    numero_serie VARCHAR(50),
    numero_comprobante VARCHAR(50),
    ruc_cliente VARCHAR(11),
    monto_total DECIMAL(10,2) NOT NULL,
    fecha_emision TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================
-- TABLA: RESERVAS
-- ============================================
CREATE TABLE IF NOT EXISTS reservas (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id),
    mesa_id INTEGER NOT NULL REFERENCES mesas(id),
    cliente_nombre VARCHAR(255) NOT NULL,
    cliente_telefono VARCHAR(50),
    cliente_email VARCHAR(255),
    fecha_reserva DATE NOT NULL,
    hora_reserva TIME NOT NULL,
    num_personas INTEGER DEFAULT 2,
    notas TEXT,
    reservation_status reservation_status DEFAULT 'PENDIENTE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================
-- TABLA: USERS (OAuth - Sistema)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    open_id VARCHAR(64) NOT NULL UNIQUE,
    name TEXT,
    email VARCHAR(320),
    login_method VARCHAR(64),
    role system_role DEFAULT 'user' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_signed_in TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================
-- DATOS DE DEMOSTRACIÓN
-- ============================================

-- Empresa Demo
INSERT INTO empresas (nombre, ruc, razon_social, direccion, telefono, email, impuesto_porcentaje, moneda) 
VALUES ('Restaurante Demo', '20123456789', 'Restaurante Demo S.A.C.', 'Av. Principal 123, Lima', '01-234-5678', 'contacto@restaurantedemo.com', 18.00, 'PEN')
ON CONFLICT DO NOTHING;

-- Empleados Demo
INSERT INTO empleados (empresa_id, nombre, apellido, pin, user_role) VALUES
(1, 'Carlos', 'Rodríguez', '1234', 'MOZO'),
(1, 'María', 'García', '2345', 'MOZO'),
(1, 'Juan', 'López', '3456', 'CAJERO'),
(1, 'Ana', 'Martínez', '4567', 'DUENO')
ON CONFLICT DO NOTHING;

-- Mesas Demo
INSERT INTO mesas (empresa_id, numero, capacidad, table_status) VALUES
(1, 1, 4, 'DISPONIBLE'),
(1, 2, 4, 'DISPONIBLE'),
(1, 3, 6, 'DISPONIBLE'),
(1, 4, 4, 'DISPONIBLE'),
(1, 5, 2, 'DISPONIBLE'),
(1, 6, 8, 'DISPONIBLE'),
(1, 7, 4, 'DISPONIBLE'),
(1, 8, 4, 'DISPONIBLE'),
(1, 9, 6, 'DISPONIBLE'),
(1, 10, 4, 'DISPONIBLE'),
(1, 11, 4, 'DISPONIBLE'),
(1, 12, 2, 'DISPONIBLE')
ON CONFLICT DO NOTHING;

-- Categorías Demo
INSERT INTO categorias (empresa_id, nombre, descripcion, icono, orden) VALUES
(1, 'Entradas', 'Platos para comenzar', 'utensils', 1),
(1, 'Fondos', 'Platos principales', 'beef', 2),
(1, 'Bebidas', 'Refrescos y bebidas', 'glass-water', 3),
(1, 'Postres', 'Dulces y postres', 'cake', 4),
(1, 'Cervezas', 'Cervezas nacionales e importadas', 'beer', 5)
ON CONFLICT DO NOTHING;

-- Productos Demo - Entradas
INSERT INTO productos (empresa_id, categoria_id, nombre, descripcion, precio, stock) VALUES
(1, 1, 'Papa a la Huancaína', 'Papas con salsa de ají amarillo y queso', 18.00, 50),
(1, 1, 'Causa Limeña', 'Puré de papa amarilla con pollo o atún', 22.00, 40),
(1, 1, 'Anticuchos', 'Brochetas de corazón de res con papas', 25.00, 30),
(1, 1, 'Tamales', 'Tamales criollos con salsa criolla', 12.00, 25),
(1, 1, 'Ocopa Arequipeña', 'Papas con salsa de huacatay', 18.00, 35)
ON CONFLICT DO NOTHING;

-- Productos Demo - Fondos
INSERT INTO productos (empresa_id, categoria_id, nombre, descripcion, precio, stock) VALUES
(1, 2, 'Lomo Saltado', 'Lomo de res saltado con papas fritas y arroz', 38.00, 40),
(1, 2, 'Arroz Chaufa', 'Arroz frito estilo oriental con pollo', 32.00, 50),
(1, 2, 'Ceviche', 'Pescado fresco marinado en limón', 42.00, 25),
(1, 2, 'Ají de Gallina', 'Pollo deshilachado en salsa de ají amarillo', 28.00, 35),
(1, 2, 'Pollo a la Brasa', 'Pollo entero a la brasa con papas', 55.00, 20),
(1, 2, 'Tacu Tacu', 'Arroz con frijoles fritos con lomo o huevo', 35.00, 30),
(1, 2, 'Arroz con Mariscos', 'Arroz con variedad de mariscos', 48.00, 25),
(1, 2, 'Carapulcra', 'Papa seca guisada con cerdo', 32.00, 20)
ON CONFLICT DO NOTHING;

-- Productos Demo - Bebidas
INSERT INTO productos (empresa_id, categoria_id, nombre, descripcion, precio, stock) VALUES
(1, 3, 'Inca Kola', 'Gaseosa peruana 500ml', 6.00, 100),
(1, 3, 'Chicha Morada', 'Bebida de maíz morado', 8.00, 80),
(1, 3, 'Limonada', 'Limonada natural', 7.00, 60),
(1, 3, 'Agua Mineral', 'Agua San Luis 500ml', 4.00, 100),
(1, 3, 'Jugo de Maracuyá', 'Jugo natural de maracuyá', 9.00, 40)
ON CONFLICT DO NOTHING;

-- Productos Demo - Postres
INSERT INTO productos (empresa_id, categoria_id, nombre, descripcion, precio, stock) VALUES
(1, 4, 'Suspiro a la Limeña', 'Dulce de leche con merengue', 15.00, 30),
(1, 4, 'Mazamorra Morada', 'Postre de maíz morado con frutas', 12.00, 25),
(1, 4, 'Picarones', 'Donuts de camote con miel', 14.00, 20),
(1, 4, 'Arroz con Leche', 'Arroz cocido en leche con canela', 10.00, 35),
(1, 4, 'Crema Volteada', 'Flan de vainilla con caramelo', 12.00, 30)
ON CONFLICT DO NOTHING;

-- Productos Demo - Cervezas
INSERT INTO productos (empresa_id, categoria_id, nombre, descripcion, precio, stock) VALUES
(1, 5, 'Pilsen', 'Cerveza Pilsen Callao 620ml', 12.00, 50),
(1, 5, 'Cristal', 'Cerveza Cristal 620ml', 11.00, 60),
(1, 5, 'Cusqueña', 'Cerveza Cusqueña Dorada 620ml', 14.00, 40),
(1, 5, 'Corona', 'Cerveza Corona Extra 355ml', 15.00, 30)
ON CONFLICT DO NOTHING;

-- ============================================
-- ÍNDICES PARA MEJORAR RENDIMIENTO
-- ============================================

CREATE INDEX IF NOT EXISTS idx_empleados_empresa ON empleados(empresa_id);
CREATE INDEX IF NOT EXISTS idx_empleados_pin ON empleados(empresa_id, pin);
CREATE INDEX IF NOT EXISTS idx_mesas_empresa ON mesas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_categorias_empresa ON categorias(empresa_id);
CREATE INDEX IF NOT EXISTS idx_productos_empresa ON productos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_empresa ON pedidos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_mesa ON pedidos(mesa_id);
CREATE INDEX IF NOT EXISTS idx_items_pedido ON items_pedido(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pagos_empresa ON pagos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pagos_pedido ON pagos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_reservas_empresa ON reservas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_reservas_mesa ON reservas(mesa_id);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha ON reservas(fecha_reserva);



-- 1. AGREGAR TIPO ENUM PARA CAJA
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'caja_status') THEN
        CREATE TYPE caja_status AS ENUM ('ABIERTA', 'CERRADA');
    END IF;
END $$;

-- 2. CREAR TABLA DE CAJAS (Faltaba en tu script original)
CREATE TABLE IF NOT EXISTS cajas (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id),
    cajero_id INTEGER NOT NULL REFERENCES empleados(id),
    caja_status caja_status DEFAULT 'ABIERTA',
    monto_inicial DECIMAL(10,2) DEFAULT 0.00 NOT NULL,
    monto_final DECIMAL(10,2),
    total_ventas DECIMAL(10,2) DEFAULT 0.00,
    total_efectivo DECIMAL(10,2) DEFAULT 0.00,
    total_tarjeta DECIMAL(10,2) DEFAULT 0.00,
    total_yape DECIMAL(10,2) DEFAULT 0.00,
    total_plin DECIMAL(10,2) DEFAULT 0.00,
    diferencia DECIMAL(10,2) DEFAULT 0.00,
    observaciones TEXT,
    fecha_apertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_cierre TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 3. AGREGAR ÍNDICES DE OPTIMIZACIÓN (Para reportes y arqueo de caja)
CREATE INDEX IF NOT EXISTS idx_cajas_empresa ON cajas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cajas_status ON cajas(empresa_id, caja_status);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha_pago ON pagos(empresa_id, fecha_pago);
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(empresa_id, order_status);

-- 4. ASEGURAR QUE LA TABLA PAGOS TENGA FECHA_PAGO (Requerido para arqueo)
-- Si ya existe no hará nada, pero asegura que el sistema pueda filtrar por fecha
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pagos' AND column_name='fecha_pago') THEN
        ALTER TABLE pagos ADD COLUMN fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;