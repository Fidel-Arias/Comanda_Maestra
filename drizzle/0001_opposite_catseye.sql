ALTER TABLE "empresas" ADD COLUMN "apis_net_pe_token" varchar(255);--> statement-breakpoint
ALTER TABLE "items_pedido" ADD COLUMN IF NOT EXISTS "pagado" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "ventas" ADD COLUMN IF NOT EXISTS "sub_cuenta" integer DEFAULT 0;--> statement-breakpoint
CREATE UNIQUE INDEX "clientes_empresa_dni" ON "clientes" USING btree ("empresa_id","dni");--> statement-breakpoint
CREATE UNIQUE INDEX "clientes_empresa_ruc" ON "clientes" USING btree ("empresa_id","ruc");