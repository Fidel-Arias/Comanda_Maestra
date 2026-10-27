CREATE TYPE "public"."tipo_zona" AS ENUM('SALON', 'TERRAZA', 'BARRA');--> statement-breakpoint
CREATE TABLE "zonas" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"tipo" "tipo_zona" DEFAULT 'SALON' NOT NULL,
	"max_mesas" integer NOT NULL,
	"max_sillas" integer NOT NULL,
	"activa" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mesas" ADD COLUMN "zona_id" integer;--> statement-breakpoint
ALTER TABLE "mesas" ADD COLUMN "sillas" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "zonas" ADD CONSTRAINT "zonas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mesas" ADD CONSTRAINT "mesas_zona_id_zonas_id_fk" FOREIGN KEY ("zona_id") REFERENCES "public"."zonas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
UPDATE "mesas" SET "sillas" = "capacidad";
