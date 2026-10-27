# Clientes, Inventario, Zonas y Notificaciones en Tiempo Real — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar búsqueda de clientes por DNI/RUC con caché en BD, inventario de insumos (compras, kardex físico, escaneo de código de barras), gestión de zonas/mesas/sillas con validación, descuento de insumos en tiempo real al pedir platos, y sonidos de notificación en cocina/bar/mozo.

**Architecture:** Se mantiene el stack actual (Express + tRPC + Drizzle/PostgreSQL + React/wouter). Se agrega un canal SSE (`/api/events`) para tiempo real, reemplazando el polling de 3–5 s solo donde hace falta (producción, mozo, disponibilidad de insumos). La lógica de inventario vive en `server/lib/inventario.ts` (puro + una función transaccional); `server/db.ts` y `server/routers.ts` siguen el patrón existente (funciones `db.*`, routers `publicProcedure` con zod).

**Tech Stack:** TypeScript, Express 4, tRPC 11, Drizzle 0.44 + `postgres` (PostgreSQL), zod 4, React 19, wouter, TanStack Query, shadcn/ui, vitest 2 (entorno node, db mockeada con `vi.mock("./db")` como en `server/pos.test.ts`).

**Spec:** No hay documento de diseño; el requerimiento es el mensaje del usuario del 2026-10-27 (resumido en "Global Constraints" y "Decisiones tomadas").

## Hallazgos del análisis (lo que ya existe)

- La tabla `clientes` **ya existe** (`drizzle/schema.ts`) con `dni`, `ruc`, `tipoCliente`; también `getClienteByDocumento` / `createCliente` en `server/db.ts:1528-1545`. Falta: índices únicos, el flujo "buscar en BD → si no, API → guardar", y que el Cajero lo use.
- Consulta DNI/RUC ya existe: `consultarEntidad` en `server/lib/nubefact.ts:166` (apis.net.pe v2 con `APIS_NET_PE_TOKEN` opcional, fallback v1 pública). Se **reutiliza**, no se crea otra integración. La v1 pública puede dejar de funcionar sin aviso: el plan deja el proveedor detrás de esa única función.
- `pedido.create` marca la mesa OCUPADA; los items se envían a cocina al pulsar "Enviar a Cocina" (`TomaPedidoPage.handleEnviarPedido`, línea 269) vía `itemPedido.add`, que hoy solo hace `updateProductoStock` (resta `productos.stock`, un entero por plato, sin recetas).
- Tiempo real inexistente: `ProductionPage` hace `refetchInterval: 3000`, `MozoPage` 5000, `CajeroPage` 5000. `server/_core/index.ts` crea `http.Server` sin websockets.
- `mesas` solo tiene `numero` y `capacidad`; no hay zonas ni terrazas. `GestionMesasPage` valida duplicados y capacidad > 0 en cliente.
- Todos los routers son `publicProcedure` y `empresaId` viene del cliente (login por PIN, sin sesión de servidor). **Fuera de alcance** corregirlo, pero los endpoints nuevos reciben `empresaId` igual que los existentes para ser consistentes.
- Migraciones: solo `drizzle/0000_lumpy_landau.sql`; `pnpm db:push` = `drizzle-kit generate && drizzle-kit migrate` (requiere `DATABASE_URL`).
- Tests: solo `server/**/*.test.ts` (node). No hay tests de cliente; la lógica nueva se aísla en funciones puras de `server/lib/` para poder probarla.

## Decisiones tomadas (corregir antes de ejecutar si no coinciden)

1. **Recetas:** "descontar ingredientes al elegir el plato" exige saber qué insumos usa cada plato → tabla `recetas` (producto → insumo + cantidad). Platos sin receta no descuentan insumos.
2. **Momento del descuento:** al enviar el pedido (`itemPedido.add`), no al tocar el plato en la pantalla (ahí los items son solo estado local de React y se pueden quitar). Mientras el mozo arma el pedido, la pantalla muestra la disponibilidad de insumos en vivo (SSE).
3. **Stock insuficiente (actualizada por el usuario):** el servidor **bloquea** `itemPedido.add` si algún insumo de la receta no alcanza para la cantidad pedida (stock 0 incluido), con `TRPCError PRECONDITION_FAILED` y el nombre del insumo agotado. El bloqueo es atómico (`UPDATE … WHERE stock >= cantidad`). En el mismo momento se emite el evento `insumo_agotado` a **Caja y Dueño**, que son los únicos roles (`CAJERO`, `DUENO`, más `ADMIN`) autorizados a actualizar stock; el servidor verifica el rol del `empleadoId` en cada mutation de stock (`FORBIDDEN` si es `MOZO`). La UI del mozo deshabilita el plato cuando `porcionesDisponibles === 0`. Platos sin receta no se bloquean.
10. **API key de apis.net.pe (nueva):** se guarda por empresa en `empresas.apis_net_pe_token`, se edita en `ConfiguracionEmpresaPage` (solo `DUENO`/`ADMIN`, campo tipo password) y tiene prioridad sobre la variable de entorno `APIS_NET_PE_TOKEN`. El token **nunca** se devuelve al cliente: las respuestas de `empresa.*`/`empleado.loginByPin` exponen solo `tieneApiKey: boolean` (el objeto `empresa` termina en `localStorage` vía `POSContext`).
4. **Reversa:** borrar un item o cancelar el pedido repone los insumos con un movimiento `ENTRADA` motivo `ANULACION`.
5. **Escáner:** las pistolas de supermercado USB/Bluetooth funcionan como teclado (escriben el código y envían Enter). Un `<input>` enfocado que busca al presionar Enter basta; no se usa cámara ni librería.
6. **Tiempo real:** SSE sobre Express (sin dependencias nuevas). Si luego se necesita bidireccional, se cambia solo `server/lib/events.ts`.
7. **Sonido:** generado con Web Audio API (sin archivos). Los navegadores exigen un gesto del usuario: las pantallas de cocina/bar/mozo muestran un botón "Activar sonido".
8. **Proveedor de compras:** texto libre en la compra (sin tabla `proveedores`), YAGNI.
9. **Costeo:** costo promedio ponderado del insumo, actualizado al registrar una compra.

## Global Constraints

- Idioma de UI y mensajes: español; identificadores de dominio en español (`insumos`, `compras`, `kardex`), como el código actual.
- Moneda `PEN`; montos como `decimal(10,2)`, cantidades de insumo como `decimal(12,3)`; en TS los decimales de Drizzle son `string`.
- Multi-tenancy: toda tabla nueva lleva `empresa_id` → `empresas.id` y toda query filtra por él.
- Imports del cliente con alias `@/…`; rutas nuevas se registran en `client/src/App.tsx`; componentes UI de `@/components/ui/<grupo>/…`.
- No se agregan dependencias nuevas.
- DNI = 8 dígitos, RUC = 11 dígitos (RUC de empresa empieza en `20`).
- Cada tarea: cambios de esquema → `pnpm db:push`; verificación con `pnpm check` y `pnpm test`.

## Review Focus

- **Doble clic en "Enviar a Cocina"** → no debe descontar insumos dos veces (descuento ligado al `itemId` creado; un segundo `add` crea otro item legítimo, pero reintentos fallidos no deben dejar medio descuento: transacción).
- **Stock 0 o insuficiente** → el mozo no puede agregar el plato (servidor lo rechaza aunque el cliente esté desactualizado), no se crea el item, y Caja y Dueño reciben la alerta; un MOZO que llame a las mutations de stock recibe `FORBIDDEN`.
- **Caja/Dueño sin conexión cuando se agota** → la alerta no se pierde: al abrir la app ven los insumos agotados (`insumo.listAgotados`).
- **API key en el navegador** → `localStorage` (vía `POSContext`) y respuestas tRPC nunca contienen el token.
- **Insumo compartido por dos platos pedidos a la vez** → los descuentos concurrentes deben sumarse (UPDATE atómico `stock = stock - n`, no leer-modificar-escribir).
- **DNI/RUC inválido o con espacios** (`"1234567"`, `"20 123456789"`, letras) → rechazo con mensaje claro, sin llamar a la API externa.
- **API externa caída o lenta** → el cajero puede seguir escribiendo el nombre a mano; la búsqueda no bloquea el cobro (timeout 5 s).
- **Cliente ya guardado** → segunda búsqueda no hace ninguna llamada HTTP (probado con `fetch` mockeado).
- **Eliminar zona/mesa con pedidos u ocupada**, o bajar el máximo de sillas por debajo de lo ya configurado → rechazo con mensaje.
- **Código de barras repetido** en la misma empresa, o escaneo de código inexistente → el segundo se rechaza; el inexistente ofrece crear el insumo con ese código.
- **Sonido con pestaña sin gesto previo** → no lanza excepción; muestra aviso para activarlo. No suena en la carga inicial para pedidos ya existentes, solo para nuevos.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `drizzle/schema.ts` (modificar) | Tablas nuevas: `zonas`, `insumos`, `movimientosInventario`, `recetas`, `compras`, `compraItems`; `mesas.zonaId`, `mesas.sillas`; índices únicos de `clientes` |
| `server/lib/events.ts` (nuevo) | Bus SSE por empresa: `publish`, `subscribe`, ruta Express |
| `server/lib/inventario.ts` (nuevo) | Lógica pura (`calcularSaldo`, `costoPromedio`, `consumoPorPlato`) y `aplicarMovimiento` transaccional |
| `server/lib/documento.ts` (nuevo) | `normalizarDocumento(raw)` (valida DNI/RUC) |
| `server/db.ts` (modificar) | Funciones `db.*` de zonas, insumos, kardex, compras, recetas, clientes |
| `server/routers.ts` (modificar) | Routers `cliente`, `zona`, `insumo`, `compra`, `receta`; hooks de descuento en `itemPedido` y `pedido` |
| `client/src/hooks/useRealtime.ts` (nuevo) | `useRealtime(empresaId, handlers)` sobre `EventSource` |
| `client/src/hooks/useNotificationSound.ts` (nuevo) | `{ enabled, enable, play(kind) }` con Web Audio |
| `client/src/features/inventory/pages/InsumosPage.tsx` (nuevo) | Lista, alta, ingreso por código/escáner |
| `client/src/features/inventory/pages/KardexPage.tsx` (nuevo) | Kardex físico por insumo y rango de fechas |
| `client/src/features/inventory/pages/ComprasPage.tsx` (nuevo) | Registro de compras y gastos |
| `client/src/features/management/pages/GestionMesasPage.tsx` (modificar) | Zonas, sillas, validación |
| `client/src/features/management/pages/GestionProductosPage.tsx` (modificar) | Editor de receta por plato |
| `client/src/features/production/pages/ProductionPage.tsx`, `pos/pages/MozoPage.tsx`, `pos/pages/TomaPedidoPage.tsx`, `cashier/pages/CajeroPage.tsx` (modificar) | Sonidos, SSE, buscador de cliente |

---

### Task 1: Canal de tiempo real (SSE)

**Files:**
- Create: `server/lib/events.ts`, `client/src/hooks/useRealtime.ts`
- Modify: `server/_core/index.ts` (registrar ruta antes del middleware tRPC)
- Test: `server/events.test.ts`

**Interfaces:**
- Produces:
  - `type RealtimeEvent = { type: "comanda_nueva"; area: "COCINA" | "BAR"; pedidoId: number } | { type: "item_listo"; mozoId: number; itemId: number; mesaNumero: number } | { type: "insumo_stock"; insumoId: number; stock: string; bajo: boolean }`
  - `publish(empresaId: number, event: RealtimeEvent): void`
  - `subscribe(empresaId: number, send: (e: RealtimeEvent) => void): () => void` (devuelve unsubscribe)
  - `registerEventsRoute(app: Express): void` → `GET /api/events?empresaId=N` (`text/event-stream`, heartbeat cada 25 s)
  - Cliente: `useRealtime(empresaId: number | undefined, onEvent: (e: RealtimeEvent) => void): void` (reconecta solo; `EventSource` lo hace nativamente)

- [ ] **Step 1: Test** `events.test.ts`: `publish` entrega solo a suscriptores de la misma `empresaId`; tras llamar al unsubscribe ya no entrega; dos suscriptores reciben el mismo evento.
- [ ] **Step 2: Run** `pnpm vitest run server/events.test.ts` → FAIL (módulo no existe).
- [ ] **Step 3: Implementar `server/lib/events.ts`** con `Map<number, Set<fn>>`; la ruta escribe `data: ${JSON.stringify(e)}\n\n`, limpia en `req.on("close")`.
- [ ] **Step 4: Registrar** `registerEventsRoute(app)` en `server/_core/index.ts` justo después de `registerOAuthRoutes(app)`.
- [ ] **Step 5: Implementar `useRealtime`** (un `EventSource` por montaje, `onEvent` guardado en ref para no reconectar en cada render; cierra en cleanup).
- [ ] **Step 6: Run** `pnpm vitest run server/events.test.ts` → PASS; `pnpm check` → sin errores.
- [ ] **Step 7: Commit** `feat: add SSE realtime channel`.

---

### Task 2: Sonidos de notificación (hook) y activación

**Files:**
- Create: `client/src/hooks/useNotificationSound.ts`
- Test: ninguno (API del navegador; se verifica manualmente en Task 3 y 11)

**Interfaces:**
- Produces: `useNotificationSound(): { enabled: boolean; enable: () => void; play: (kind: "nuevo" | "listo") => void }`. `"nuevo"` = dos pitidos agudos; `"listo"` = campanilla ascendente de tres notas. `play` es no-op si `enabled` es false o si `AudioContext` lanza. `enable` crea/reanuda el `AudioContext` (llamar desde un click) y guarda `localStorage["sonido_activo"]="1"` solo como preferencia: el contexto igual exige un gesto cada carga.

- [ ] **Step 1: Implementar** con osciladores (`OscillatorNode` + `GainNode` con rampa de decaimiento), envolviendo todo en try/catch.
- [ ] **Step 2: Commit** `feat: add notification sound hook`.

---

### Task 3: Sonido de "nuevo pedido" en Cocina/Bar y "pedido listo" en Mozo

**Files:**
- Modify: `server/routers.ts` (`itemPedido.add`, `itemPedido.updateStatus`), `client/src/features/production/pages/ProductionPage.tsx`, `client/src/features/pos/pages/MozoPage.tsx`
- Test: `server/pos.test.ts` (ampliar mock con `publish` de `./lib/events`)

**Interfaces:**
- Consumes: `publish` (Task 1), `useRealtime` (Task 1), `useNotificationSound` (Task 2).
- Produces: `itemPedido.add` publica `comanda_nueva` con el `area` de la categoría del producto (usar `db.getProductoById` + `db.getCategoriaById`); `itemPedido.updateStatus` con `estado: "LISTO"` publica `item_listo` con `mozoId` del pedido y `mesaNumero`. Requiere `db.getItemContext(itemId: number): Promise<{ empresaId: number; mozoId: number; mesaNumero: number } | undefined>` en `server/db.ts`.

- [ ] **Step 1: Test** en `server/pos.test.ts`: `itemPedido.updateStatus({ id: 5, estado: "LISTO" })` llama `publish(1, { type: "item_listo", mozoId: 1, itemId: 5, mesaNumero: 3 })`; con `estado: "PREPARANDO"` no publica.
- [ ] **Step 2: Run** `pnpm vitest run server/pos.test.ts` → FAIL.
- [ ] **Step 3: Implementar** `db.getItemContext` (join `itemsPedido → pedidos → mesas`) y las publicaciones en los dos procedures.
- [ ] **Step 4: ProductionPage:** `useRealtime` escucha `comanda_nueva` con `area === area` → `play("nuevo")` + `utils.pedido.listComandas.invalidate()`; bajar `refetchInterval` a `15000` como respaldo. Botón "Activar sonido" visible mientras `!enabled`.
- [ ] **Step 5: MozoPage:** escuchar `item_listo` con `mozoId === empleado.id` → `play("listo")` + `toast.info("Mesa N: pedido listo")` + `refetchListos()`; `refetchInterval` a `15000`. Mismo botón de activación. No sonar al cargar (solo eventos SSE).
- [ ] **Step 6: Run** `pnpm vitest run` → PASS; `pnpm check`.
- [ ] **Step 7: Verificación manual:** abrir `/cocina` y `/mozo` en dos pestañas, activar sonido, enviar un pedido desde `/pedido/:mesaId` → suena en cocina (o bar según categoría); marcar "¡Listo!" → suena en el mozo dueño del pedido y no en otro mozo.
- [ ] **Step 8: Commit** `feat: sound notifications for new and ready orders`.

---

### Task 4: Clientes — búsqueda con caché en BD

**Files:**
- Create: `server/lib/documento.ts`
- Modify: `drizzle/schema.ts` (índices únicos parciales), `server/db.ts`, `server/routers.ts`, `client/src/features/cashier/pages/CajeroPage.tsx`
- Test: `server/documento.test.ts`, `server/cliente.test.ts`

**Interfaces:**
- Produces:
  - `normalizarDocumento(raw: string): { tipo: "DNI" | "RUC"; numero: string }` — quita espacios; 8 dígitos → DNI; 11 dígitos que empiezan con `10`/`15`/`17`/`20` → RUC; si no, lanza `Error("Documento inválido: …")`.
  - `db.getClienteByDocumento(empresaId, numero)` (ya existe), `db.createCliente(data)` (ya existe).
  - Router `cliente.buscarPorDocumento` (mutation): input `{ empresaId: number; numero: string }` → `{ cliente: Cliente; origen: "BD" | "API" }`. Flujo: normaliza → busca en BD → si existe devuelve `origen:"BD"` sin llamar a la API → si no, `nubefact.consultarEntidad` (con `AbortSignal.timeout(5000)` agregado a los `fetch` de `server/lib/nubefact.ts:166-250`) → `createCliente({ nombre: razon_social, dni|ruc, direccion, tipoCliente: "PERSONA" | "EMPRESA" })` → `origen:"API"`.
  - Router `cliente.listByEmpresa` (query) `{ empresaId }`.
  - Esquema: `empresas.apisNetPeToken varchar(255) null` (`apis_net_pe_token`). `consultarEntidad(numero: string, token?: string)` usa `token ?? process.env.APIS_NET_PE_TOKEN` (hoy lee la constante de módulo en `nubefact.ts:163`; pasar a parámetro). `buscarPorDocumento` obtiene el token con `db.getEmpresaById(empresaId)`. `billing.consultarEntidad` (existente) también recibe `empresaId` y usa el token de la empresa.
  - `configuracion.updateEmpresa` acepta `apisNetPeToken?: string | null` (cadena vacía → `null`); `shared`/`server` helper `toPublicEmpresa(e: Empresa): Omit<Empresa, "apisNetPeToken"> & { tieneApiKey: boolean }` aplicado en `empresa.getById`, `empresa.*` y en la respuesta de `empleado.loginByPin` que incluye la empresa.

- [ ] **Step 1: Tests de `normalizarDocumento`:** `"12345678"`→DNI; `" 20 123456789 "`→RUC `"20123456789"`; `"1234567"`, `"abc12345"`, `"30123456789"` lanzan error.
- [ ] **Step 2: Tests del router** (db y `nubefact` mockeados): BD con cliente → resultado `origen:"BD"` y `consultarEntidad` **no** llamado; BD vacía → `origen:"API"`, `createCliente` llamado una vez con `ruc` y `tipoCliente:"EMPRESA"`; API rechaza → el error se propaga con el mensaje de `consultarEntidad` y no se crea cliente.
- [ ] **Step 3: Run** `pnpm vitest run server/documento.test.ts server/cliente.test.ts` → FAIL.
- [ ] **Step 4: Implementar** `documento.ts`, el router y el timeout.
- [ ] **Step 5: Esquema:** en `clientes` agregar `uniqueIndex("clientes_empresa_dni").on(empresaId, dni)` y análogo para `ruc` (Postgres permite múltiples NULL). Ejecutar `pnpm db:push` y revisar el SQL generado en `drizzle/`.
- [ ] **Step 6: CajeroPage:** reemplazar `trpc.billing.consultarEntidad` por `trpc.cliente.buscarPorDocumento`; al responder rellenar `nombreCliente`/`direccionCliente`; mostrar `Badge` "Guardado"/"Nuevo". Si falla, el toast indica que puede escribir los datos a mano (los campos nunca se bloquean).
- [ ] **Step 6b: Tests y UI de API key:** test: `toPublicEmpresa` nunca incluye `apisNetPeToken` y devuelve `tieneApiKey` correcto; `buscarPorDocumento` pasa a `consultarEntidad` el token de la empresa (y el de `.env` si la empresa no tiene); `updateEmpresa` con `""` guarda `null`. UI: en `ConfiguracionEmpresaPage`, sección "Consulta DNI/RUC (apis.net.pe)" con `Input type="password"` (placeholder "Pegue aquí su API key"), indicador "Configurada / No configurada" según `tieneApiKey`, enlace a https://apis.net.pe para obtener una gratis, y botón "Quitar". Solo visible para `empleado.rol` `DUENO` o `ADMIN`; el campo vacío al guardar no borra la clave existente (solo "Quitar" la borra).
- [ ] **Step 7: Al cobrar** (`createVenta`/`generateComprobante` en `CajeroPage`), pasar el `clienteId` devuelto cuando exista, para que `ventas.clienteId` y `comprobantes.clienteId` se llenen (hoy quedan en `null`). Verificar en `server/routers.ts:869-1010` cómo se resuelve el cliente actualmente y reutilizar `getClienteByDocumento` en vez de duplicar.
- [ ] **Step 8: Run** `pnpm vitest run` → PASS; `pnpm check`. Prueba manual con un DNI real: primera consulta `API`, segunda `BD`.
- [ ] **Step 9: Commit** `feat: cache-first customer lookup by DNI/RUC`.

> **Nota sobre "API gratuita":** la v1 pública sin token de apis.net.pe es la ruta gratuita ya usada; para producción conviene registrar un token gratuito en apis.net.pe y definir `APIS_NET_PE_TOKEN` (ya soportado). Confirmar vigencia del plan gratuito del proveedor al ejecutar; el caché en BD reduce el consumo a una consulta por cliente.

---

### Task 5: Zonas, mesas y sillas (esquema + servidor + validación en frontend)

**Files:**
- Modify: `drizzle/schema.ts`, `server/db.ts`, `server/routers.ts`, `client/src/features/management/pages/GestionMesasPage.tsx`
- Create: `shared/zonas.ts` (validación compartida cliente/servidor)
- Test: `server/zona.test.ts`

**Interfaces:**
- Esquema: enum `tipoZonaEnum("tipo_zona", ["SALON","TERRAZA","BARRA"])`; tabla `zonas { id, empresaId, nombre varchar(100), tipo, maxMesas integer, maxSillas integer, activa boolean }`; `mesas` gana `zonaId integer → zonas.id (nullable)` y `sillas integer default 4` (se mantiene `capacidad` por compatibilidad; al guardar, `capacidad = sillas`).
- `shared/zonas.ts`: `validarMesaEnZona(zona: { maxMesas: number; maxSillas: number }, mesasActuales: { id: number; sillas: number }[], nueva: { id?: number; sillas: number }): string | null` → mensaje de error o `null`. Reglas: `sillas >= 1`; nº de mesas tras el alta ≤ `maxMesas`; suma de sillas tras el alta/edición ≤ `maxSillas`.
- Routers: `zona.listByEmpresa`, `zona.create`, `zona.update` (rechaza bajar `maxMesas`/`maxSillas` por debajo de lo ya usado), `zona.delete` (rechaza si tiene mesas). `mesa.create`/`mesa.update` aceptan `zonaId` y `sillas` y **revalidan en servidor** con `validarMesaEnZona`.

- [ ] **Step 1: Tests** de `validarMesaEnZona`: zona `{maxMesas:2,maxSillas:8}` con 2 mesas → alta rechazada; 1 mesa de 6 sillas + nueva de 4 → rechazada (10>8); edición de la misma mesa de 6→8 sillas sola en la zona → aceptada; `sillas: 0` → rechazada. Tests de `zona.delete` con mesas → error; `mesa.create` fuera de límite → error aunque el cliente no valide.
- [ ] **Step 2: Run** `pnpm vitest run server/zona.test.ts` → FAIL.
- [ ] **Step 3: Implementar** esquema, `shared/zonas.ts`, funciones `db.*` y routers. `pnpm db:push`.
- [ ] **Step 4: GestionMesasPage:** sección "Zonas" (alta/edición con límites) y selector de zona + sillas en el diálogo de mesa; usar `validarMesaEnZona` antes de enviar (toast con el mensaje), deshabilitar "Guardar" si hay error, mostrar contador "Mesas 3/10 · Sillas 12/40" por zona. Mantener las validaciones actuales (número duplicado, no eliminar mesa ocupada).
- [ ] **Step 5: Run** `pnpm vitest run` → PASS; `pnpm check`; verificación manual: crear zona Terraza (2 mesas, 8 sillas) y comprobar rechazo al exceder.
- [ ] **Step 6: Commit** `feat: zones with table and chair limits`.

---

### Task 6: Esquema de inventario y lógica de movimientos

**Files:**
- Modify: `drizzle/schema.ts`
- Create: `server/lib/inventario.ts`
- Test: `server/inventario.test.ts`

**Interfaces:**
- Esquema (todo con `empresaId`):
  - `insumos { id, empresaId, nombre, codigo varchar(40) (interno, único por empresa), codigoBarras varchar(64) null (único por empresa), unidad enum("UND","KG","G","L","ML"), stock decimal(12,3) default 0, stockMinimo decimal(12,3) default 0, costoPromedio decimal(10,4) default 0, activo }`
  - `movimientosInventario { id, empresaId, insumoId, tipo enum("ENTRADA","SALIDA","AJUSTE"), motivo enum("COMPRA","CONSUMO_PEDIDO","ANULACION","MERMA","AJUSTE_MANUAL","INICIAL"), cantidad decimal(12,3) (siempre positiva), saldoDespues decimal(12,3), costoUnitario decimal(10,4) null, referenciaTipo varchar(20) null, referenciaId integer null, empleadoId null, createdAt }` con índice `(insumoId, createdAt)`.
  - `recetas { id, empresaId, productoId, insumoId, cantidad decimal(12,3) }` único `(productoId, insumoId)`.
- `calcularSaldo(saldo: number, tipo: "ENTRADA"|"SALIDA"|"AJUSTE", cantidad: number): number` (AJUSTE fija el saldo a `cantidad`).
- `costoPromedio(stockActual: number, costoActual: number, entrada: { cantidad: number; costoUnitario: number }): number` (promedio ponderado; si `stockActual <= 0` devuelve el costo de la entrada).
- `consumoPorPlato(receta: { insumoId: number; cantidad: number }[], cantidadPlatos: number): { insumoId: number; cantidad: number }[]`.
- `aplicarMovimiento(tx, m: { empresaId: number; insumoId: number; tipo; motivo; cantidad: number; costoUnitario?: number; referenciaTipo?: string; referenciaId?: number; empleadoId?: number }): Promise<{ saldoDespues: string; bajo: boolean }>` — dentro de una transacción: `UPDATE insumos SET stock = stock ± cantidad … RETURNING stock` (atómico), inserta el movimiento con `saldoDespues`, recalcula `costoPromedio` en ENTRADA/COMPRA, devuelve `bajo = saldo <= stockMinimo`.

- [ ] **Step 1: Tests** de las tres funciones puras (valores con decimales: entrada 10 kg a 5.00 sobre 10 kg a 3.00 → costo 4.00; AJUSTE a 7 con saldo 3 → 7; salida mayor al saldo → negativo, sin lanzar; receta × 3 platos).
- [ ] **Step 2: Run** `pnpm vitest run server/inventario.test.ts` → FAIL.
- [ ] **Step 3: Implementar** funciones puras y `aplicarMovimiento`; agregar tablas al esquema; `pnpm db:push`.
- [ ] **Step 4: Run** tests → PASS; `pnpm check`.
- [ ] **Step 5: Commit** `feat: inventory schema and movement logic`.

---

### Task 7: Insumos — CRUD, ingreso por código/escáner y kardex físico

**Files:**
- Modify: `server/db.ts`, `server/routers.ts`, `client/src/App.tsx`, `client/src/features/dashboard/pages/DashboardPage.tsx` (enlace de menú; ver cómo se listan las demás gestiones)
- Create: `client/src/features/inventory/pages/InsumosPage.tsx`, `client/src/features/inventory/pages/KardexPage.tsx`
- Test: `server/insumo.test.ts`

**Interfaces:**
- Consumes: `aplicarMovimiento` (Task 6), `publish` (Task 1).
- Produces (router `insumo`):
  - `listByEmpresa({ empresaId })`, `create({ empresaId, nombre, codigo, codigoBarras?, unidad, stockMinimo })` (rechaza `codigo`/`codigoBarras` duplicados en la empresa), `update`, `delete` (baja lógica `activo=false`).
  - `buscarPorCodigo({ empresaId, codigo }): Insumo | null` — busca por `codigoBarras` **o** `codigo`.
  - `registrarIngreso({ empresaId, insumoId, cantidad, costoUnitario?, empleadoId })` — `ENTRADA`/`AJUSTE_MANUAL`; `registrarMerma({ …, cantidad, motivo: "MERMA" })`; `ajustar({ …, nuevoSaldo })`. Publican `insumo_stock`. Las tres (y `create`/`update`/`delete`, y `compra.create`) llaman a `exigirRolInventario(empleadoId: number): Promise<Empleado>` (en `server/lib/inventario.ts`), que lanza `TRPCError FORBIDDEN` si el rol no es `CAJERO`, `DUENO` o `ADMIN`. `listByEmpresa`, `buscarPorCodigo` y `kardex` son lecturas abiertas.
  - `listAgotados({ empresaId }): { id: number; nombre: string; stock: string }[]` — insumos activos con `stock <= 0`.
  - `kardex({ empresaId, insumoId, desde: Date, hasta: Date }): { saldoInicial: string; filas: { fecha: Date; tipo; motivo; entrada: string; salida: string; saldo: string; costoUnitario: string | null; referencia: string | null }[] }` — `saldoInicial` = `saldoDespues` del último movimiento anterior a `desde` (0 si no hay).

- [ ] **Step 1: Tests:** `registrarIngreso`/`ajustar`/`create` con un empleado `MOZO` → `FORBIDDEN`, con `CAJERO` y `DUENO` → OK; `listAgotados` devuelve solo `stock <= 0`; `create` con `codigoBarras` repetido → error; `buscarPorCodigo` encuentra por barras y por código interno y devuelve `null` si no existe; `kardex` con 3 movimientos (entrada 10, salida 4, entrada 2) devuelve saldos 10, 6, 8 y `saldoInicial` correcto al filtrar desde el segundo.
- [ ] **Step 2: Run** `pnpm vitest run server/insumo.test.ts` → FAIL.
- [ ] **Step 3: Implementar** funciones `db.*` y router.
- [ ] **Step 4: InsumosPage** (`/inventario`): tabla con stock, mínimo (resaltar bajos), acciones editar/ingreso/kardex. Diálogo "Ingresar producto": un `Input` con `autoFocus` que al `Enter` llama `insumo.buscarPorCodigo`; si existe, enfoca el campo cantidad (y Enter de nuevo confirma); si no existe, abre el alta de insumo con el código prellenado en `codigoBarras`. Funciona igual tecleando el código interno a mano.
- [ ] **Step 5: KardexPage** (`/inventario/kardex/:insumoId`): selector de rango (default mes actual), tabla `Fecha | Tipo/Motivo | Entrada | Salida | Saldo | Costo`, fila "Saldo inicial" arriba, botón Imprimir (`window.print()`, como `ProductionPage`).
- [ ] **Step 6: Registrar rutas** en `App.tsx` y enlace en el menú de gestión. `InsumosPage`/`ComprasPage` redirigen a `/mozo` si `empleado.rol === "MOZO"`; el mozo no ve el enlace.
- [ ] **Step 7: Run** `pnpm vitest run` → PASS; `pnpm check`; verificación manual con escáner (o escribiendo el código + Enter).
- [ ] **Step 8: Commit** `feat: supplies, barcode intake and physical kardex`.

---

### Task 8: Compras y gastos

**Files:**
- Modify: `drizzle/schema.ts`, `server/db.ts`, `server/routers.ts`, `client/src/App.tsx`
- Create: `client/src/features/inventory/pages/ComprasPage.tsx`
- Test: `server/compra.test.ts`

**Interfaces:**
- Esquema: `compras { id, empresaId, fecha date, proveedor varchar(255) null, comprobante varchar(50) null, total decimal(10,2), notas, empleadoId, createdAt }`; `compraItems { id, compraId, insumoId, cantidad decimal(12,3), costoUnitario decimal(10,4), subtotal decimal(10,2) }`.
- Router `compra`: `create({ empresaId, empleadoId, fecha, proveedor?, comprobante?, notas?, items: { insumoId: number; cantidad: number; costoUnitario: number }[] })` — en **una transacción** inserta compra + items y llama `aplicarMovimiento` (ENTRADA/COMPRA, `referenciaTipo:"COMPRA"`) por item; `total` = suma de `cantidad*costoUnitario` redondeada a 2 decimales en servidor (no se confía en el cliente). `listByEmpresa({ empresaId, desde, hasta })`, `getById`. `gastos({ empresaId, desde, hasta }): { total: string; porDia: { fecha: string; total: string }[]; porInsumo: { insumoId: number; nombre: string; total: string }[] }`.

- [ ] **Step 1: Tests:** `create` con 2 items llama `aplicarMovimiento` 2 veces y guarda `total` calculado (no el enviado); `items: []` → error; `cantidad <= 0` → error; `gastos` agrega correctamente por día e insumo.
- [ ] **Step 2: Run** `pnpm vitest run server/compra.test.ts` → FAIL.
- [ ] **Step 3: Implementar** esquema, `db.*`, router; `pnpm db:push`.
- [ ] **Step 4: ComprasPage** (`/inventario/compras`): formulario (fecha, proveedor, comprobante) + líneas de items usando el mismo input de código/escáner de Task 7 (extraer a componente `InsumoCodeInput` en `client/src/features/inventory/components/InsumoCodeInput.tsx` y usarlo en ambas páginas); pestaña "Gastos" con rango de fechas, total, gráfico/tabla por día y por insumo.
- [ ] **Step 5: Run** `pnpm vitest run` → PASS; `pnpm check`.
- [ ] **Step 6: Commit** `feat: purchases and expense report`.

---

### Task 9: Recetas por plato

**Files:**
- Modify: `server/db.ts`, `server/routers.ts`, `client/src/features/management/pages/GestionProductosPage.tsx`
- Test: `server/receta.test.ts`

**Interfaces:**
- Router `receta`: `getByProducto({ productoId }): { insumoId: number; nombre: string; unidad: string; cantidad: string }[]`; `save({ empresaId, productoId, items: { insumoId: number; cantidad: number }[] })` — reemplaza la receta completa en una transacción; rechaza `cantidad <= 0` e insumos repetidos.
- `db.getRecetasByProductos(productoIds: number[]): Promise<{ productoId: number; insumoId: number; cantidad: string }[]>` (lo usa Task 10).

- [ ] **Step 1: Tests:** `save` con insumo repetido → error; guardar `items: []` borra la receta; `getByProducto` devuelve nombre y unidad.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implementar. Step 4: Run** → PASS.
- [ ] **Step 5: UI:** en el diálogo de producto, sección "Receta (insumos por porción)" con selector de insumo + cantidad + quitar; se guarda con `receta.save` tras guardar el producto.
- [ ] **Step 6: Commit** `feat: dish recipes`.

---

### Task 10: Descuento de insumos en tiempo real al pedir platos

**Files:**
- Modify: `server/routers.ts` (`itemPedido.add`, `itemPedido.delete`, `pedido.updateEstado`), `server/db.ts`, `client/src/features/pos/pages/TomaPedidoPage.tsx`
- Test: `server/consumo.test.ts`

**Interfaces:**
- Consumes: `consumoPorPlato`, `aplicarMovimiento` (Task 6), `db.getRecetasByProductos` (Task 9), `publish` (Task 1).
- Produces: `descontarInsumosItem(tx, { empresaId, itemId, productoId, cantidad, empleadoId }): Promise<void>` y `reponerInsumosItem(tx, { empresaId, itemId, productoId, cantidad }): Promise<void>` en `server/lib/inventario.ts`. El primero genera un movimiento `SALIDA/CONSUMO_PEDIDO` por insumo de la receta (`referenciaTipo:"ITEM_PEDIDO"`, `referenciaId:itemId`); el segundo `ENTRADA/ANULACION` con la misma referencia. Platos sin receta: no hace nada. Cada movimiento publica `insumo_stock` (al terminar la transacción, no dentro).
- `descontarInsumosItem` verifica y descuenta de forma atómica por insumo (`UPDATE insumos SET stock = stock - n WHERE id = X AND stock >= n RETURNING stock`); si alguna fila no se actualiza lanza `StockInsuficienteError { insumoId: number; nombre: string }`. `itemPedido.add` lo captura, hace rollback de toda la transacción (ningún insumo queda descontado a medias), publica `insumo_agotado` (Task 11 define el evento) y responde `TRPCError PRECONDITION_FAILED` con mensaje `"Sin stock de <nombre>"`.
- `itemPedido.add` hace insert del item + descuento en **una sola transacción**; si falla el descuento, el item no se crea. `itemPedido.delete` y `pedido.updateEstado(estado:"CANCELADO")` reponen. `itemPedido.updateCantidad` repone la cantidad anterior y descuenta la nueva (o la diferencia).
- Cliente: `insumo.disponibilidadPorPlato({ empresaId }): { productoId: number; porcionesDisponibles: number | null }[]` (`null` = sin receta); `TomaPedidoPage` la consulta, la invalida con `useRealtime` en `insumo_stock`, y muestra en cada plato un `Badge` "Quedan N" / "Agotado"; el plato con `porcionesDisponibles === 0` queda **deshabilitado** y el botón "+" no pasa de `porcionesDisponibles` (si es no nulo). Si el servidor responde `PRECONDITION_FAILED`, toast de error con el mensaje y se refresca la disponibilidad. El servidor es la autoridad; la UI solo evita el intento.

- [ ] **Step 1: Tests:** stock del insumo 0 → `itemPedido.add` lanza `PRECONDITION_FAILED`, no inserta el item, no deja movimientos, y publica `insumo_agotado`; stock 5 con pedido que requiere 6 → rechazado, con 5 exacto → aceptado; plato con receta `[{insumo 1, 0.2}, {insumo 2, 1}]` × 3 → salidas 0.6 y 3; plato sin receta → ningún movimiento; fallo en el segundo insumo → el item no se inserta (transacción mockeada que lanza); `delete` repone con la misma cantidad; `disponibilidadPorPlato` = `min(floor(stock_i / cantidad_i))`.
- [ ] **Step 2: Run** `pnpm vitest run server/consumo.test.ts` → FAIL.
- [ ] **Step 3: Implementar** helpers, modificar los procedures (conservar el `updateProductoStock` existente), añadir `disponibilidadPorPlato`.
- [ ] **Step 4: UI** en `TomaPedidoPage` como arriba.
- [ ] **Step 5: Run** `pnpm vitest run` → PASS; `pnpm check`.
- [ ] **Step 6: Verificación manual de punta a punta:** crear insumo con stock 10, plato con receta 2/porción, enviar 3 porciones → stock 4 y kardex con salida 6; abrir `/inventario` en otra pestaña → el stock cambia sin recargar; eliminar el item → stock vuelve a 10.
- [ ] **Step 7: Commit** `feat: real-time ingredient deduction on order`.

---

### Task 11: Alerta de stock agotado a Caja y Dueño

**Files:**
- Modify: `server/lib/events.ts` (tipo `insumo_agotado`), `client/src/hooks/useNotificationSound.ts` (kind `"alerta"`), `client/src/features/cashier/pages/CajeroPage.tsx`, `client/src/features/dashboard/pages/DashboardPage.tsx`, `client/src/features/inventory/pages/InsumosPage.tsx`, `todo.md`
- Test: `server/consumo.test.ts` (ampliar)

**Interfaces:**
- Consumes: `publish`, `useRealtime`, `useNotificationSound`, `insumo.listAgotados`, `insumo.registrarIngreso`.
- Produces: `RealtimeEvent` gana `{ type: "insumo_agotado"; insumoId: number; nombre: string; mesaNumero?: number }`; `play` acepta `"alerta"` (tono grave repetido tres veces, distinto de `"nuevo"` y `"listo"`). `insumo_agotado` se publica también desde `aplicarMovimiento` cuando una SALIDA deja `saldo <= 0`, y desde el bloqueo de `itemPedido.add`.

- [ ] **Step 1: Test:** una salida que deja el stock en 0 publica `insumo_agotado` con el nombre del insumo; una salida que deja stock > 0 no la publica; `insumo_stock` sigue publicándose en ambos casos.
- [ ] **Step 2: Run** `pnpm vitest run server/consumo.test.ts` → FAIL.
- [ ] **Step 3: Implementar** el evento y el kind de sonido.
- [ ] **Step 4: Cliente:** `CajeroPage` y `DashboardPage` (dueño) escuchan `insumo_agotado` solo si `empleado.rol` es `CAJERO`, `DUENO` o `ADMIN` → `play("alerta")` y `toast.error` persistente (`duration: Infinity`) "Insumo agotado: <nombre>" con acción "Reponer" que navega a `/inventario`. Botón "Activar sonido" como en Task 3. Al montar, consultar `insumo.listAgotados` y mostrar un banner fijo con los insumos agotados (cubre el caso sin conexión previa).
- [ ] **Step 5: InsumosPage:** fila de insumo agotado resaltada en rojo; al registrar un ingreso que lo repone, el banner y los toasts de ese insumo desaparecen (invalidar `listAgotados` con `insumo_stock`).
- [ ] **Step 6: Dashboard:** tarjeta "Insumos agotados / bajo mínimo" con conteo y enlace a `/inventario`.
- [ ] **Step 7: Verificación final:** `pnpm check`, `pnpm test`, `pnpm build` sin errores; recorrer el flujo completo: compra → receta → pedido hasta agotar un insumo → el mozo no puede pedir más y Caja/Dueño reciben sonido y alerta → Caja repone stock → el mozo vuelve a poder pedir → cocina con sonido → listo con sonido en mozo → cobro con cliente por DNI usando la API key guardada → kardex.
- [ ] **Step 8:** Actualizar `todo.md` y documentar `APIS_NET_PE_TOKEN` (opcional, respaldo de la clave por empresa). Commit `feat: out-of-stock alerts and docs`.

---

## Self-Review

- **Cobertura:** clientes + API gratuita (T4); inventario/ingredientes (T6–7); compras y gastos (T8); kardex físico (T7); ingreso por código o escáner (T7, T8); tabla de mesas/sillas/terrazas + validación frontend (T5); descuento en tiempo real al pedir (T9–10); sonidos cocina/bar/mozo (T1–3). Sin huecos.
- **Consistencia de nombres:** `aplicarMovimiento`, `consumoPorPlato`, `publish`/`useRealtime`, `InsumoCodeInput`, `db.getRecetasByProductos` se definen en tareas anteriores a su uso.
- **Orden de dependencias:** T1→T3; T6→T7→T8; T6+T9→T10. T4 y T5 son independientes y pueden ir en paralelo con T6.
- **Proporción:** código solo donde fija una interfaz; los cuerpos los decide quien implementa.
- **Riesgos abiertos para el usuario:** (1) proveedor gratuito DNI/RUC y su límite; (2) la ausencia de autenticación de servidor sigue igual: el control de rol para stock se basa en `empleadoId` enviado por el cliente (un cliente malicioso puede suplantarlo); el plan lo hace verificable en servidor pero no lo resuelve de raíz.
