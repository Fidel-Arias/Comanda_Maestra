# Comanda Maestra - TODO

## Base de Datos
- [x] Esquema completo: empresas, usuarios, mesas, productos, categorías, pedidos, items_pedido, pagos, clientes, comprobantes
- [x] Enums: user_role, order_status, payment_method, payment_status, table_status
- [x] Índices y relaciones
- [x] Datos de ejemplo (empresa demo, productos, mesas)

## Autenticación
- [x] Sistema de autenticación por PIN de 4 dígitos
- [x] Selección de rol (Mozo, Cajero, Dueño)
- [x] Validación de credenciales
- [x] Sesión por empresa (multi-tenancy)

## Pantalla de Login
- [x] Diseño oscuro profesional
- [x] Selección visual de rol con iconos
- [x] Input de PIN con teclado numérico
- [x] Información de empresa
- [x] Datos de demostración visibles

## Vista Mozo
- [x] Grid de mesas responsivo
- [x] Estados visuales (verde=libre, amarillo=ocupada, rojo=pidiendo cuenta)
- [x] Información: mozo asignado, personas, consumo, tiempo
- [x] Header con logo y usuario actual
- [x] Botón flotante para acciones rápidas

## Toma de Pedidos
- [x] Menú categorizado con filtros
- [x] Indicadores de stock (disponible, poco stock, agotado)
- [x] Panel de pedido actual con cantidades
- [x] Notas por item
- [x] Cálculo automático: subtotal, IGV (18%), total
- [x] Botón enviar a cocina

## Vista Cajero
- [x] Lista de cuentas activas con búsqueda
- [x] Panel de detalle de consumo
- [x] Métodos de pago: Efectivo, Yape, Plin, Tarjeta
- [x] Cálculo de vuelto
- [x] Botón cobrar y cerrar mesa

## Vista Dueño (Dashboard)
- [x] KPIs: Ventas Totales, Ticket Promedio, Mesas Atendidas, Productos Vendidos
- [x] Gráfico de líneas: Ventas por hora/día
- [x] Gráfico de dona: Top categorías
- [x] Mapa de calor de ocupación
- [x] Tabla de rendimiento por mozo
- [x] Tabla de platos más vendidos

## Navegación
- [x] Tabs inferiores: Mozo, Cajero, Dueño
- [x] Cambio fluido entre vistas
- [x] Indicador de vista activa

## Estilo Visual
- [x] Paleta oscura: Slate 900/800/700
- [x] Acentos azul/cyan (#007BFF)
- [x] Tipografía moderna y legible
- [x] Componentes consistentes

## Tests
- [x] Tests de autenticación por PIN
- [x] Tests de listado de empresas
- [x] Tests de listado de empleados
- [x] Tests de listado de mesas
- [x] Tests de listado de categorías
- [x] Tests de listado de productos
- [x] Tests de analytics

## Documentación
- [x] Script SQL completo descargable
- [x] Manual de usuario del sistema
- [x] Paquete de descarga completo

## Migración a PostgreSQL
- [x] Instalar dependencias de PostgreSQL (pg, drizzle-orm/pg)
- [x] Actualizar esquema de Drizzle para PostgreSQL
- [x] Actualizar conexión de base de datos
- [x] Generar script SQL para PostgreSQL
- [x] Actualizar documentación
- [x] Generar nuevo paquete descargable

## Nuevas Funcionalidades - Administración
- [x] Sistema de temas claro/oscuro switchable
- [x] Toggle de tema en header/navegación
- [x] Pantalla de gestión de platos (agregar, editar, eliminar)
- [x] Pantalla de gestión de mesas (agregar, editar cantidad)
- [x] Integrar gestión en sección Dueño
- [x] APIs para CRUD de productos y mesas

## Mejoras de UI
- [x] Botón de cambio de tema en pantalla de Login

## Funcionalidades Empresariales Avanzadas
- [x] Gestión de categorías con iconos personalizados
- [x] Sistema de reservas de mesas (fecha/hora/cliente)
- [x] Historial de ventas filtrable por fecha y mozo
- [x] Reportes exportables a PDF/Excel
- [x] Configuración de empresa (nombre, RUC, logo, IGV)
- [x] Actualizar script SQL (agregada tabla reservas)

## Correcciones Versión 3
- [x] Validación de rol obligatorio antes de ingresar PIN
- [x] Mensaje "Primero seleccione un rol" si no hay rol seleccionado
- [x] Funcionalidad de apertura de caja
- [x] Funcionalidad de cierre de caja (no se puede reabrir)
- [x] Flujo típico de caja de restaurante
- [x] Tabla de cajas en base de datos (script SQL actualizado)

## Correcciones Versión 4
- [ ] Validación de rol obligatorio antes de ingresar PIN
- [ ] Mensaje "Primero seleccione un rol" si no hay rol seleccionado
- [ ] Funcionalidad de apertura de caja
- [ ] Funcionalidad de cierre de caja (no se puede reabrir)
- [ ] Tabla de cajas en base de datos
- [ ] Corregir historial de ventas (no muestra ventas del día)
- [ ] Corregir reportes PDF (no descarga)
- [ ] Corregir reportes Excel (no descarga)

## Clientes, inventario, mesas y notificaciones (plan 2026-10-27)
- [x] Clientes por DNI/RUC con caché en BD y consulta a apis.net.pe (clave por empresa)
- [x] Zonas, mesas y sillas con límites por zona
- [x] Inventario de insumos, kardex, compras (los gastos son un reporte agregado de compras; ingreso por código o escáner)
- [x] Recetas por plato, descuento de stock al pedir y bloqueo al mozo si no hay stock
- [x] Notificaciones sonoras (cocina/bar, mozo) y alerta de insumo agotado a Caja y Dueño

### Variable de entorno
- `APIS_NET_PE_TOKEN` (opcional): token de respaldo para la consulta DNI/RUC. La clave por empresa se edita en Configuración y tiene prioridad.

### Migraciones pendientes de aplicar
- `drizzle/0001_opposite_catseye.sql`: agrega `empresas.apis_net_pe_token` e índices únicos `clientes_empresa_dni` y `clientes_empresa_ruc`. ATENCIÓN: también contiene drift ajeno al plan (`items_pedido.pagado`, `ventas.sub_cuenta`); verificar antes de aplicar en una BD que ya tenga esas columnas, y revisar duplicados de DNI/RUC antes de crear los índices únicos.
- `drizzle/0002_broken_sebastian_shaw.sql`: tabla `zonas`, `mesas.zona_id` y `mesas.sillas`. Incluye al final un `UPDATE "mesas" SET "sillas" = "capacidad"` añadido a mano para migrar los datos existentes.
- `drizzle/0003_normal_red_hulk.sql`: tablas `insumos`, `movimientos_inventario` y `recetas` (y sus enums).
- `drizzle/0004_right_starfox.sql`: tablas `compras` y `compra_items`.
- `drizzle/0005_huge_caretaker.sql`: índice `movimientos_referencia` en `movimientos_inventario`.

### Limitaciones conocidas de seguridad
- `exigirRolInventario` confía en el `empleadoId` que envía el cliente y todos los procedimientos son `publicProcedure`. Además `empleado.listByEmpresa` devuelve las filas completas de empleados, incluido el `pin`. Por eso la regla "el mozo NO puede actualizar stock / recetas" se cumple en la UI y con clientes honestos; un mozo con devtools podría hacerse pasar por el dueño. Corregirlo requiere sesiones de empleado en el servidor (fuera de alcance).
- `/api/events?empresaId=N` (SSE) no está autenticado: transmite niveles de stock, nombres de insumos, números de mesa e ids de pedido a quien adivine el `empresaId` (los mismos datos ya son accesibles por los procedimientos tRPC públicos).
- `updateEmpresa` y otras mutaciones no validan el rol en el servidor.

### Antes de aplicar las migraciones
- [ ] Hacer un `pg_dump` nuevo.
- [ ] Revisar `SELECT * FROM drizzle.__drizzle_migrations;`. Si está vacía pero las tablas existen (como en `backup_comanda_maestra.sql` de feb 2026), `pnpm db:push` intentaría rerunear 0000 y fallaría. Hacer baseline: insertar una fila con `created_at` = el `when` de 0000 en `drizzle/meta/_journal.json` (1771261653132) y `hash` = sha256 hex de `drizzle/0000_lumpy_landau.sql`; o aplicar 0001–0005 a mano con psql dentro de una transacción y registrarlas.
- [ ] 0001 ahora usa `ADD COLUMN IF NOT EXISTS` para las columnas con drift (`items_pedido.pagado`, `ventas.sub_cuenta`).
- [ ] Buscar documentos duplicados antes de crear los índices únicos: `SELECT empresa_id, dni, count(*) FROM clientes WHERE dni IS NOT NULL GROUP BY 1,2 HAVING count(*)>1;` (igual con `ruc`) y convertir los valores `''` en NULL.
- [ ] `SELECT id, capacidad FROM mesas WHERE capacidad > 20;` (la nueva columna `sillas` copia `capacidad`; la UI y el servidor limitan la edición a 20).
- [ ] Reiniciar el servidor después de migrar (SSE y rutas nuevas necesitan las tablas nuevas).

### Decisiones de producto pendientes
- Anular pedido / cancelar restituye insumos también de ítems ya ENTREGADOS (inflaría el kardex).
- Desactivar un insumo vuelve imposibles de pedir los platos cuya receta lo usa (mensaje "Sin stock de X").
- "Gastos" es solo un reporte agregado de compras (no hay registro de gastos no ligados a insumos).
- La cocina suena una vez al enviar un pedido de varios ítems y otra ~5 s después (throttle).

### Verificación manual pendiente
- [ ] Cajero: DNI nuevo muestra "Nuevo"; el mismo DNI después muestra "Guardado"; RUC; sin API key o con clave errónea da error y la entrada manual sigue funcionando.
- [ ] Configuración: guardar API key, recargar (el campo no se rellena); en Network solo aparece `tieneApiKey`.
- [ ] Zonas: los límites de mesas/sillas bloquean en UI y servidor; bajar límites por debajo del uso se rechaza; las mesas existentes muestran sillas = capacidad anterior.
- [ ] Inventario: escáner/código, merma, ajuste, compra (costo promedio), kardex por rango (su SQL nunca se ejecutó contra Postgres).
- [ ] Receta + pedido descuenta stock al instante; con stock 0 el mozo ve "Agotado" y queda bloqueado; Caja y Dashboard reciben toast+sonido+banner; reponer cierra el toast.
- [ ] Sonidos de cocina/bar; solo el mozo dueño oye "listo".
- [ ] Anular pedido / borrar o reducir ítems devuelven stock (ANULACION en kardex).
- [ ] Envío parcial: un plato agotado no bloquea a los demás; el total del pedido en Caja incluye todo lo guardado.
- [ ] Mozo redirigido al intentar entrar a /inventario*.
