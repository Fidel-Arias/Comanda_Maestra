import { integer, pgEnum, pgTable, text, timestamp, varchar, decimal, boolean, serial, date, time } from "drizzle-orm/pg-core";

// ============================================
// ENUMS para PostgreSQL
// ============================================

export const userRoleEnum = pgEnum("user_role", ["MOZO", "CAJERO", "DUENO", "ADMIN"]);
export const tableStatusEnum = pgEnum("table_status", ["DISPONIBLE", "OCUPADA", "PIDIENDO_CUENTA", "RESERVADA"]);
export const orderStatusEnum = pgEnum("order_status", ["PENDIENTE", "PREPARANDO", "LISTO", "ENTREGADO", "CANCELADO"]);
export const paymentMethodEnum = pgEnum("payment_method", ["EFECTIVO", "TARJETA", "YAPE", "PLIN", "TRANSFERENCIA"]);
export const paymentStatusEnum = pgEnum("payment_status", ["PENDIENTE", "PAGADO", "PARCIAL", "CANCELADO"]);
export const comprobanteTypeEnum = pgEnum("comprobante_type", ["BOLETA", "FACTURA", "TICKET", "NOTA_CREDITO", "NOTA_DEBITO"]);
export const sunatStatusEnum = pgEnum("sunat_status", ["PENDIENTE", "ENVIADO", "ACEPTADO", "RECHAZADO", "ANULADO"]);
export const systemRoleEnum = pgEnum("system_role", ["user", "admin"]);
// Nuevo Enum para Áreas de Producción
export const comandaAreaEnum = pgEnum("comanda_area", ["COCINA", "BAR"]);

// ============================================
// TABLA: EMPRESAS (Multi-tenancy)
// ============================================

export const empresas = pgTable("empresas", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  ruc: varchar("ruc", { length: 11 }),
  razonSocial: varchar("razon_social", { length: 255 }),
  direccion: text("direccion"),
  telefono: varchar("telefono", { length: 20 }),
  email: varchar("email", { length: 255 }),
  logoUrl: text("logo_url"),
  activa: boolean("activa").default(true),
  impuestoPorcentaje: decimal("impuesto_porcentaje", { precision: 5, scale: 2 }).default("10.50"),
  moneda: varchar("moneda", { length: 3 }).default("PEN"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Empresa = typeof empresas.$inferSelect;
export type InsertEmpresa = typeof empresas.$inferInsert;

// ============================================
// TABLA: EMPLEADOS (Usuarios POS con PIN)
// ============================================

export const empleados = pgTable("empleados", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").references(() => empresas.id).notNull(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  apellido: varchar("apellido", { length: 255 }),
  pin: varchar("pin", { length: 4 }).notNull(),
  userRole: userRoleEnum("user_role").default("MOZO").notNull(),
  activo: boolean("activo").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Empleado = typeof empleados.$inferSelect;
export type InsertEmpleado = typeof empleados.$inferInsert;

// ============================================
// TABLA: MESAS
// ============================================

export const mesas = pgTable("mesas", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").references(() => empresas.id).notNull(),
  numero: integer("numero").notNull(),
  capacidad: integer("capacidad").default(4).notNull(),
  tableStatus: tableStatusEnum("table_status").default("DISPONIBLE"),
  mozoAsignadoId: integer("mozo_asignado_id").references(() => empleados.id),
  personas: integer("personas").default(0),
  fechaOcupacion: timestamp("fecha_ocupacion"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Mesa = typeof mesas.$inferSelect;
export type InsertMesa = typeof mesas.$inferInsert;

// ============================================
// TABLA: CATEGORIAS
// ============================================

export const categorias = pgTable("categorias", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").references(() => empresas.id).notNull(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  descripcion: text("descripcion"),
  icono: varchar("icono", { length: 50 }),
  orden: integer("orden").default(0),
  area: comandaAreaEnum("area").default("COCINA").notNull(),
  activa: boolean("activa").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Categoria = typeof categorias.$inferSelect;
export type InsertCategoria = typeof categorias.$inferInsert;

// ============================================
// TABLA: PRODUCTOS
// ============================================

export const productos = pgTable("productos", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").references(() => empresas.id).notNull(),
  categoriaId: integer("categoria_id").references(() => categorias.id).notNull(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  descripcion: text("descripcion"),
  precio: decimal("precio", { precision: 10, scale: 2 }).notNull(),
  precioCosto: decimal("precio_costo", { precision: 10, scale: 2 }),
  stock: integer("stock").default(100),
  stockMinimo: integer("stock_minimo").default(5),
  imagenUrl: text("imagen_url"),
  activo: boolean("activo").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Producto = typeof productos.$inferSelect;
export type InsertProducto = typeof productos.$inferInsert;

// ============================================
// TABLA: PEDIDOS
// ============================================

export const pedidos = pgTable("pedidos", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").references(() => empresas.id).notNull(),
  mesaId: integer("mesa_id").references(() => mesas.id).notNull(),
  mozoId: integer("mozo_id").references(() => empleados.id).notNull(),
  orderStatus: orderStatusEnum("order_status").default("PENDIENTE"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).default("0.00"),
  impuesto: decimal("impuesto", { precision: 10, scale: 2 }).default("0.00"),
  total: decimal("total", { precision: 10, scale: 2 }).default("0.00"),
  notas: text("notas"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Pedido = typeof pedidos.$inferSelect;
export type InsertPedido = typeof pedidos.$inferInsert;

// ============================================
// TABLA: ITEMS_PEDIDO
// ============================================

export const itemsPedido = pgTable("items_pedido", {
  id: serial("id").primaryKey(),
  pedidoId: integer("pedido_id").references(() => pedidos.id).notNull(),
  productoId: integer("producto_id").references(() => productos.id).notNull(),
  cantidad: integer("cantidad").default(1).notNull(),
  precioUnitario: decimal("precio_unitario", { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  notas: text("notas"),
  estado: orderStatusEnum("estado").default("PENDIENTE").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ItemPedido = typeof itemsPedido.$inferSelect;
export type InsertItemPedido = typeof itemsPedido.$inferInsert;

// ============================================
// TABLA: CLIENTES
// ============================================

export const clientes = pgTable("clientes", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").references(() => empresas.id).notNull(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  apellido: varchar("apellido", { length: 255 }),
  email: varchar("email", { length: 255 }),
  telefono: varchar("telefono", { length: 20 }),
  dni: varchar("dni", { length: 8 }),
  ruc: varchar("ruc", { length: 11 }),
  direccion: text("direccion"),
  tipoCliente: varchar("tipo_cliente", { length: 50 }).default("CONSUMIDOR_FINAL"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Cliente = typeof clientes.$inferSelect;
export type InsertCliente = typeof clientes.$inferInsert;

// ============================================
// TABLA: PAGOS
// ============================================

export const pagos = pgTable("pagos", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").references(() => empresas.id).notNull(),
  pedidoId: integer("pedido_id").references(() => pedidos.id).notNull(),
  clienteId: integer("cliente_id").references(() => clientes.id),
  cajeroId: integer("cajero_id").references(() => empleados.id).notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  paymentStatus: paymentStatusEnum("payment_status").default("PENDIENTE"),
  monto: decimal("monto", { precision: 10, scale: 2 }).notNull(),
  montoPagado: decimal("monto_pagado", { precision: 10, scale: 2 }).default("0.00"),
  vuelto: decimal("vuelto", { precision: 10, scale: 2 }).default("0.00"),
  referenciaPago: varchar("referencia_pago", { length: 255 }),
  fechaPago: timestamp("fecha_pago"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Pago = typeof pagos.$inferSelect;
export type InsertPago = typeof pagos.$inferInsert;

// ============================================
// TABLA: VENTAS (Dominio fiscal)
// ============================================

export const ventas = pgTable("ventas", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").references(() => empresas.id).notNull(),
  pedidoId: integer("pedido_id").references(() => pedidos.id).notNull(),
  clienteId: integer("cliente_id").references(() => clientes.id),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  igv: decimal("igv", { precision: 10, scale: 2 }).notNull(),
  estado: varchar("estado", { length: 50 }).default("COMPLETA"), // COMPLETA, ANULADA
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Venta = typeof ventas.$inferSelect;
export type InsertVenta = typeof ventas.$inferInsert;

// ============================================
// TABLA: COMPROBANTES (SUNAT)
// ============================================

export const comprobantes = pgTable("comprobantes", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").references(() => empresas.id).notNull(),
  ventaId: integer("venta_id").references(() => ventas.id).notNull(),
  pedidoId: integer("pedido_id").references(() => pedidos.id).notNull(),
  clienteId: integer("cliente_id").references(() => clientes.id),
  tipo: comprobanteTypeEnum("tipo").notNull(),
  serie: varchar("serie", { length: 10 }).notNull(), // Ej: B001, F001
  numero: integer("numero").notNull(),
  rucCliente: varchar("ruc_cliente", { length: 11 }),
  sunatStatus: sunatStatusEnum("sunat_status").default("PENDIENTE"),
  xmlPath: text("xml_path"),
  cdrPath: text("cdr_path"),
  pdfPath: text("pdf_path"),
  digestValue: text("digest_value"),
  sunatResponse: text("sunat_response"),
  fechaEmision: timestamp("fecha_emision").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Comprobante = typeof comprobantes.$inferSelect;
export type InsertComprobante = typeof comprobantes.$inferInsert;

// ============================================
// TABLA: COMPROBANTE_ITEMS
// ============================================

export const comprobanteItems = pgTable("comprobante_items", {
  id: serial("id").primaryKey(),
  comprobanteId: integer("comprobante_id").references(() => comprobantes.id).notNull(),
  descripcion: text("descripcion").notNull(),
  cantidad: integer("cantidad").notNull(),
  precioUnitario: decimal("precio_unitario", { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  igv: decimal("igv", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ComprobanteItem = typeof comprobanteItems.$inferSelect;
export type InsertComprobanteItem = typeof comprobanteItems.$inferInsert;

// ============================================
// TABLA: RESERVAS
// ============================================

export const reservaStatusEnum = pgEnum("reservation_status", ["PENDIENTE", "CONFIRMADA", "CANCELADA", "COMPLETADA"]);
export const cajaStatusEnum = pgEnum("caja_status", ["ABIERTA", "CERRADA"]);

export const reservas = pgTable("reservas", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").references(() => empresas.id).notNull(),
  mesaId: integer("mesa_id").references(() => mesas.id).notNull(),
  clienteNombre: varchar("cliente_nombre", { length: 255 }).notNull(),
  clienteTelefono: varchar("cliente_telefono", { length: 50 }),
  clienteEmail: varchar("cliente_email", { length: 255 }),
  fechaReserva: date("fecha_reserva").notNull(),
  horaInicio: time("hora_reserva").notNull(),
  personas: integer("num_personas").default(2).notNull(),
  reservaStatus: reservaStatusEnum("reservation_status").default("PENDIENTE"),
  notas: text("notas"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Reserva = typeof reservas.$inferSelect;
export type InsertReserva = typeof reservas.$inferInsert;

// ============================================
// TABLA: CAJAS (Apertura y Cierre de Caja)
// ============================================

export const cajas = pgTable("cajas", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").references(() => empresas.id).notNull(),
  cajeroId: integer("cajero_id").references(() => empleados.id).notNull(),
  cajaStatus: cajaStatusEnum("caja_status").default("ABIERTA"),
  montoInicial: decimal("monto_inicial", { precision: 10, scale: 2 }).default("0.00").notNull(),
  montoFinal: decimal("monto_final", { precision: 10, scale: 2 }),
  totalVentas: decimal("total_ventas", { precision: 10, scale: 2 }).default("0.00"),
  totalEfectivo: decimal("total_efectivo", { precision: 10, scale: 2 }).default("0.00"),
  totalTarjeta: decimal("total_tarjeta", { precision: 10, scale: 2 }).default("0.00"),
  totalYape: decimal("total_yape", { precision: 10, scale: 2 }).default("0.00"),
  totalPlin: decimal("total_plin", { precision: 10, scale: 2 }).default("0.00"),
  diferencia: decimal("diferencia", { precision: 10, scale: 2 }).default("0.00"),
  observaciones: text("observaciones"),
  fechaApertura: timestamp("fecha_apertura").defaultNow().notNull(),
  fechaCierre: timestamp("fecha_cierre"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Caja = typeof cajas.$inferSelect;
export type InsertCaja = typeof cajas.$inferInsert;

// ============================================
// TABLA: USERS (OAuth - Sistema)
// ============================================

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("open_id", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("login_method", { length: 64 }),
  role: systemRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
