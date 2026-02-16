CREATE TYPE "public"."caja_status" AS ENUM('ABIERTA', 'CERRADA');--> statement-breakpoint
CREATE TYPE "public"."comanda_area" AS ENUM('COCINA', 'BAR');--> statement-breakpoint
CREATE TYPE "public"."comprobante_type" AS ENUM('BOLETA', 'FACTURA', 'TICKET', 'NOTA_CREDITO', 'NOTA_DEBITO');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('PENDIENTE', 'PREPARANDO', 'LISTO', 'ENTREGADO', 'CANCELADO');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('EFECTIVO', 'TARJETA', 'YAPE', 'PLIN', 'TRANSFERENCIA');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDIENTE', 'PAGADO', 'PARCIAL', 'CANCELADO');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'COMPLETADA');--> statement-breakpoint
CREATE TYPE "public"."sunat_status" AS ENUM('PENDIENTE', 'ENVIADO', 'ACEPTADO', 'RECHAZADO', 'ANULADO');--> statement-breakpoint
CREATE TYPE "public"."system_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."table_status" AS ENUM('DISPONIBLE', 'OCUPADA', 'PIDIENDO_CUENTA', 'RESERVADA');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('MOZO', 'CAJERO', 'DUENO', 'ADMIN');--> statement-breakpoint
CREATE TABLE "cajas" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"cajero_id" integer NOT NULL,
	"caja_status" "caja_status" DEFAULT 'ABIERTA',
	"monto_inicial" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"monto_final" numeric(10, 2),
	"total_ventas" numeric(10, 2) DEFAULT '0.00',
	"total_efectivo" numeric(10, 2) DEFAULT '0.00',
	"total_tarjeta" numeric(10, 2) DEFAULT '0.00',
	"total_yape" numeric(10, 2) DEFAULT '0.00',
	"total_plin" numeric(10, 2) DEFAULT '0.00',
	"diferencia" numeric(10, 2) DEFAULT '0.00',
	"observaciones" text,
	"fecha_apertura" timestamp DEFAULT now() NOT NULL,
	"fecha_cierre" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categorias" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"nombre" varchar(255) NOT NULL,
	"descripcion" text,
	"icono" varchar(50),
	"orden" integer DEFAULT 0,
	"area" "comanda_area" DEFAULT 'COCINA' NOT NULL,
	"activa" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"nombre" varchar(255) NOT NULL,
	"apellido" varchar(255),
	"email" varchar(255),
	"telefono" varchar(20),
	"dni" varchar(8),
	"ruc" varchar(11),
	"direccion" text,
	"tipo_cliente" varchar(50) DEFAULT 'CONSUMIDOR_FINAL',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comprobante_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"comprobante_id" integer NOT NULL,
	"descripcion" text NOT NULL,
	"cantidad" integer NOT NULL,
	"precio_unitario" numeric(10, 2) NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"igv" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comprobantes" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"venta_id" integer NOT NULL,
	"pedido_id" integer NOT NULL,
	"cliente_id" integer,
	"tipo" "comprobante_type" NOT NULL,
	"serie" varchar(10) NOT NULL,
	"numero" integer NOT NULL,
	"ruc_cliente" varchar(11),
	"sunat_status" "sunat_status" DEFAULT 'PENDIENTE',
	"xml_path" text,
	"cdr_path" text,
	"pdf_path" text,
	"digest_value" text,
	"sunat_response" text,
	"fecha_emision" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empleados" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"nombre" varchar(255) NOT NULL,
	"apellido" varchar(255),
	"pin" varchar(4) NOT NULL,
	"user_role" "user_role" DEFAULT 'MOZO' NOT NULL,
	"activo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empresas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(255) NOT NULL,
	"ruc" varchar(11),
	"razon_social" varchar(255),
	"direccion" text,
	"telefono" varchar(20),
	"email" varchar(255),
	"logo_url" text,
	"activa" boolean DEFAULT true,
	"impuesto_porcentaje" numeric(5, 2) DEFAULT '10.50',
	"moneda" varchar(3) DEFAULT 'PEN',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items_pedido" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedido_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"cantidad" integer DEFAULT 1 NOT NULL,
	"precio_unitario" numeric(10, 2) NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"notas" text,
	"estado" "order_status" DEFAULT 'PENDIENTE' NOT NULL,
	"sub_cuenta" integer DEFAULT 0,
	"sub_cuenta_nombre" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mesas" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"numero" integer NOT NULL,
	"capacidad" integer DEFAULT 4 NOT NULL,
	"table_status" "table_status" DEFAULT 'DISPONIBLE',
	"mozo_asignado_id" integer,
	"personas" integer DEFAULT 0,
	"fecha_ocupacion" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pagos" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"pedido_id" integer NOT NULL,
	"cliente_id" integer,
	"cajero_id" integer NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"payment_status" "payment_status" DEFAULT 'PENDIENTE',
	"monto" numeric(10, 2) NOT NULL,
	"monto_pagado" numeric(10, 2) DEFAULT '0.00',
	"vuelto" numeric(10, 2) DEFAULT '0.00',
	"referencia_pago" varchar(255),
	"fecha_pago" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pedidos" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"mesa_id" integer NOT NULL,
	"mozo_id" integer NOT NULL,
	"order_status" "order_status" DEFAULT 'PENDIENTE',
	"subtotal" numeric(10, 2) DEFAULT '0.00',
	"impuesto" numeric(10, 2) DEFAULT '0.00',
	"total" numeric(10, 2) DEFAULT '0.00',
	"notas" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "productos" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"categoria_id" integer NOT NULL,
	"nombre" varchar(255) NOT NULL,
	"descripcion" text,
	"precio" numeric(10, 2) NOT NULL,
	"precio_costo" numeric(10, 2),
	"stock" integer DEFAULT 100,
	"stock_minimo" integer DEFAULT 5,
	"imagen_url" text,
	"activo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservas" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"mesa_id" integer NOT NULL,
	"cliente_nombre" varchar(255) NOT NULL,
	"cliente_telefono" varchar(50),
	"cliente_email" varchar(255),
	"fecha_reserva" date NOT NULL,
	"hora_reserva" time NOT NULL,
	"num_personas" integer DEFAULT 2 NOT NULL,
	"reservation_status" "reservation_status" DEFAULT 'PENDIENTE',
	"notas" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"open_id" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"login_method" varchar(64),
	"role" "system_role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_signed_in" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_open_id_unique" UNIQUE("open_id")
);
--> statement-breakpoint
CREATE TABLE "ventas" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"pedido_id" integer NOT NULL,
	"cliente_id" integer,
	"total" numeric(10, 2) NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"igv" numeric(10, 2) NOT NULL,
	"estado" varchar(50) DEFAULT 'COMPLETA',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cajas" ADD CONSTRAINT "cajas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cajas" ADD CONSTRAINT "cajas_cajero_id_empleados_id_fk" FOREIGN KEY ("cajero_id") REFERENCES "public"."empleados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comprobante_items" ADD CONSTRAINT "comprobante_items_comprobante_id_comprobantes_id_fk" FOREIGN KEY ("comprobante_id") REFERENCES "public"."comprobantes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_venta_id_ventas_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items_pedido" ADD CONSTRAINT "items_pedido_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items_pedido" ADD CONSTRAINT "items_pedido_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mesas" ADD CONSTRAINT "mesas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mesas" ADD CONSTRAINT "mesas_mozo_asignado_id_empleados_id_fk" FOREIGN KEY ("mozo_asignado_id") REFERENCES "public"."empleados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_cajero_id_empleados_id_fk" FOREIGN KEY ("cajero_id") REFERENCES "public"."empleados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_mesa_id_mesas_id_fk" FOREIGN KEY ("mesa_id") REFERENCES "public"."mesas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_mozo_id_empleados_id_fk" FOREIGN KEY ("mozo_id") REFERENCES "public"."empleados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_mesa_id_mesas_id_fk" FOREIGN KEY ("mesa_id") REFERENCES "public"."mesas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;