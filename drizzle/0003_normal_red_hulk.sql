CREATE TYPE "public"."movimiento_motivo" AS ENUM('COMPRA', 'CONSUMO_PEDIDO', 'ANULACION', 'MERMA', 'AJUSTE_MANUAL', 'INICIAL');--> statement-breakpoint
CREATE TYPE "public"."movimiento_tipo" AS ENUM('ENTRADA', 'SALIDA', 'AJUSTE');--> statement-breakpoint
CREATE TYPE "public"."unidad_insumo" AS ENUM('UND', 'KG', 'G', 'L', 'ML');--> statement-breakpoint
CREATE TABLE "insumos" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"nombre" varchar(255) NOT NULL,
	"codigo" varchar(40) NOT NULL,
	"codigo_barras" varchar(64),
	"unidad" "unidad_insumo" NOT NULL,
	"stock" numeric(12, 3) DEFAULT '0' NOT NULL,
	"stock_minimo" numeric(12, 3) DEFAULT '0' NOT NULL,
	"costo_promedio" numeric(10, 4) DEFAULT '0' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movimientos_inventario" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"insumo_id" integer NOT NULL,
	"tipo" "movimiento_tipo" NOT NULL,
	"motivo" "movimiento_motivo" NOT NULL,
	"cantidad" numeric(12, 3) NOT NULL,
	"saldo_despues" numeric(12, 3) NOT NULL,
	"costo_unitario" numeric(10, 4),
	"referencia_tipo" varchar(20),
	"referencia_id" integer,
	"empleado_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recetas" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"insumo_id" integer NOT NULL,
	"cantidad" numeric(12, 3) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "insumos" ADD CONSTRAINT "insumos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_empleado_id_empleados_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recetas" ADD CONSTRAINT "recetas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recetas" ADD CONSTRAINT "recetas_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recetas" ADD CONSTRAINT "recetas_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "insumos_empresa_codigo" ON "insumos" USING btree ("empresa_id","codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "insumos_empresa_codigo_barras" ON "insumos" USING btree ("empresa_id","codigo_barras");--> statement-breakpoint
CREATE INDEX "movimientos_insumo_created" ON "movimientos_inventario" USING btree ("insumo_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "recetas_producto_insumo" ON "recetas" USING btree ("producto_id","insumo_id");