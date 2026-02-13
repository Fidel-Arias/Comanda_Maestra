import { eq, and, or, desc, asc, sql, gte, lte, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  InsertUser, users,
  empresas, InsertEmpresa,
  empleados, InsertEmpleado,
  mesas, InsertMesa,
  categorias, InsertCategoria,
  productos, InsertProducto,
  pedidos, InsertPedido,
  itemsPedido, InsertItemPedido,
  clientes, InsertCliente,
  pagos, InsertPago,
  reservas, InsertReserva,
  cajas, InsertCaja,
  ventas, InsertVenta, Venta,
  comprobantes, InsertComprobante, Comprobante,
  comprobanteItems, InsertComprobanteItem, ComprobanteItem
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // Configuración para TiDB Cloud con SSL
      const dbUrl = process.env.DATABASE_URL;

      // Determinar si necesita SSL basado en la URL
      const needsSSL = dbUrl.includes('tidb') ||
        dbUrl.includes('tidbcloud') ||
        dbUrl.includes('ssl=true') ||
        dbUrl.includes('sslmode=require');

      _client = postgres(dbUrl, {
        ssl: needsSSL ? { rejectUnauthorized: false } : false,
        max: 3,
        idle_timeout: 60,
        connect_timeout: 120,
        prepare: false, // Desactivar prepared statements para TiDB
      });
      _db = drizzle(_client);
      console.log("[Database] Connection pool initialized, SSL:", needsSSL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============================================
// USER FUNCTIONS (OAuth)
// ============================================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };

    if (user.name !== undefined) {
      values.name = user.name ?? null;
    }
    if (user.email !== undefined) {
      values.email = user.email ?? null;
    }
    if (user.loginMethod !== undefined) {
      values.loginMethod = user.loginMethod ?? null;
    }

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    // PostgreSQL upsert using ON CONFLICT
    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: {
        name: values.name,
        email: values.email,
        loginMethod: values.loginMethod,
        lastSignedIn: new Date(),
        role: values.role,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================
// EMPRESA FUNCTIONS
// ============================================

export async function getEmpresas() {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(empresas);
  } catch (error) {
    console.error("[Database] Error fetching empresas:", error);
    return [];
  }
}

export async function getEmpresaById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(empresas).where(eq(empresas.id, id)).limit(1);
  return result[0];
}

export async function createEmpresa(data: InsertEmpresa) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(empresas).values(data).returning({ id: empresas.id });
  return result[0].id;
}

// ============================================
// EMPLEADO FUNCTIONS (POS Users with PIN)
// ============================================

export async function getEmpleadosByEmpresa(empresaId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(empleados).where(
    and(eq(empleados.empresaId, empresaId), eq(empleados.activo, true))
  );
}

export async function getEmpleadoByPin(empresaId: number, pin: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(empleados).where(
    and(
      eq(empleados.empresaId, empresaId),
      eq(empleados.pin, pin),
      eq(empleados.activo, true)
    )
  ).limit(1);
  return result[0];
}

export async function getEmpleadoById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(empleados).where(eq(empleados.id, id)).limit(1);
  return result[0];
}

export async function createEmpleado(data: InsertEmpleado) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(empleados).values(data).returning({ id: empleados.id });
  return result[0].id;
}

// ============================================
// MESA FUNCTIONS
// ============================================

export async function refreshMesasReservaStatus(empresaId: number) {
  const db = await getDb();
  if (!db) return;

  try {
    const now = new Date();
    // Forzamos formato YYYY-MM-DD local
    const today = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');

    const currentTime = now.toTimeString().split(' ')[0];
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const oneHourLaterTime = oneHourLater.toTimeString().split(' ')[0];

    // Buscar reservas próximas
    const proximas = await db.select().from(reservas).where(
      and(
        eq(reservas.empresaId, empresaId),
        eq(reservas.fechaReserva, today),
        sql`${reservas.reservaStatus} IN ('PENDIENTE', 'CONFIRMADA')`,
        sql`${reservas.horaInicio} <= ${oneHourLaterTime}`,
        sql`${reservas.horaInicio} >= ${currentTime}`
      )
    );

    if (proximas.length > 0) {
      const mesaIds = Array.from(new Set(proximas.map(r => r.mesaId)));
      await db.update(mesas)
        .set({ tableStatus: 'RESERVADA' })
        .where(
          and(
            eq(mesas.empresaId, empresaId),
            inArray(mesas.id, mesaIds),
            eq(mesas.tableStatus, 'DISPONIBLE')
          )
        );
    }
  } catch (error) {
    console.warn("[Database] Error refreshing mesa status:", error);
  }
}

export async function getMesasByEmpresa(empresaId: number) {
  const db = await getDb();
  if (!db) return [];

  // Refrescar estados basados en reservas próximas
  await refreshMesasReservaStatus(empresaId);

  const now = new Date();
  const today = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');

  const allMesas = await db.select().from(mesas)
    .where(eq(mesas.empresaId, empresaId))
    .orderBy(asc(mesas.numero));

  const allReservasHoy = await db.select().from(reservas).where(
    and(
      eq(reservas.empresaId, empresaId),
      eq(reservas.fechaReserva, today),
      inArray(reservas.reservaStatus, ['PENDIENTE', 'CONFIRMADA'])
    )
  ).orderBy(asc(reservas.horaInicio));

  // Combinar datos: cada mesa tendrá su reserva más próxima si está reservada
  return allMesas.map(mesa => {
    const reservaMesa = allReservasHoy.find(r => r.mesaId === mesa.id);
    return {
      ...mesa,
      reservaInfo: reservaMesa ? {
        nombre: reservaMesa.clienteNombre,
        personas: reservaMesa.personas,
        hora: reservaMesa.horaInicio,
        id: reservaMesa.id
      } : null
    };
  });
}

export async function confirmReservaLlegada(reservaId: number, mozoId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 1. Obtener info de la reserva
  const res = await db.select().from(reservas).where(eq(reservas.id, reservaId)).limit(1);
  const reserva = res[0];
  if (!reserva) throw new Error("Reserva no encontrada");

  // 2. Marcar reserva como COMPLETADA (ya llegó)
  await db.update(reservas)
    .set({ reservaStatus: 'COMPLETADA', updatedAt: new Date() })
    .where(eq(reservas.id, reservaId));

  // 3. Crear el Pedido inicial
  let assignedMozoId = mozoId;
  if (!assignedMozoId) {
    const mozos = await db.select().from(empleados).where(
      and(eq(empleados.empresaId, reserva.empresaId), eq(empleados.userRole, 'MOZO'))
    ).limit(1);
    assignedMozoId = mozos[0]?.id || 1;
  }

  const pedidoId = await createPedido({
    empresaId: reserva.empresaId,
    mesaId: reserva.mesaId,
    mozoId: assignedMozoId,
  });

  // 4. Actualizar estado de la mesa a OCUPADA
  await db.update(mesas)
    .set({
      tableStatus: 'OCUPADA',
      mozoAsignadoId: assignedMozoId,
      personas: reserva.personas,
      fechaOcupacion: new Date()
    })
    .where(eq(mesas.id, reserva.mesaId));

  return { success: true, pedidoId };
}

export async function getMesaById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(mesas).where(eq(mesas.id, id)).limit(1);
  return result[0] || null;
}

export async function updateMesaEstado(
  id: number,
  tableStatus: "DISPONIBLE" | "OCUPADA" | "PIDIENDO_CUENTA" | "RESERVADA",
  mozoId?: number | null,
  personas?: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: Record<string, unknown> = { tableStatus };
  if (mozoId !== undefined) updateData.mozoAsignadoId = mozoId;
  if (personas !== undefined) updateData.personas = personas;
  if (tableStatus === "OCUPADA") updateData.fechaOcupacion = new Date();
  if (tableStatus === "DISPONIBLE") {
    updateData.mozoAsignadoId = null;
    updateData.personas = 0;
    updateData.fechaOcupacion = null;
  }

  await db.update(mesas).set(updateData).where(eq(mesas.id, id));
}

export async function createMesa(data: InsertMesa) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(mesas).values(data).returning({ id: mesas.id });
  return result[0].id;
}

export async function updateMesa(id: number, data: Partial<InsertMesa>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(mesas).set(data).where(eq(mesas.id, id));
}

export async function deleteMesa(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(mesas).where(eq(mesas.id, id));
}

// ============================================
// CATEGORIA FUNCTIONS
// ============================================

export async function getCategoriasByEmpresa(empresaId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(categorias).where(
    and(eq(categorias.empresaId, empresaId), eq(categorias.activa, true))
  );
}

export async function createCategoria(data: InsertCategoria) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(categorias).values(data).returning({ id: categorias.id });
  return result[0].id;
}

export async function updateCategoria(id: number, data: Partial<InsertCategoria>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(categorias).set(data).where(eq(categorias.id, id));
}

export async function deleteCategoria(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Soft delete - marcar como inactiva
  await db.update(categorias).set({ activa: false }).where(eq(categorias.id, id));
}

export async function getCategoriaById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(categorias).where(eq(categorias.id, id)).limit(1);
  return result[0];
}

// ============================================
// PRODUCTO FUNCTIONS
// ============================================

export async function getProductosByEmpresa(empresaId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(productos).where(
    and(eq(productos.empresaId, empresaId), eq(productos.activo, true))
  );
}

export async function getProductosByCategoria(categoriaId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(productos).where(
    and(eq(productos.categoriaId, categoriaId), eq(productos.activo, true))
  );
}

export async function getProductoById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(productos).where(eq(productos.id, id)).limit(1);
  return result[0];
}

export async function updateProductoStock(id: number, cantidad: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(productos).set({
    stock: sql`${productos.stock} - ${cantidad}`
  }).where(eq(productos.id, id));
}

export async function createProducto(data: InsertProducto) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(productos).values(data).returning({ id: productos.id });
  return result[0].id;
}

export async function updateProducto(id: number, data: Partial<InsertProducto>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(productos).set({ ...data, updatedAt: new Date() }).where(eq(productos.id, id));
}

export async function deleteProducto(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Soft delete - marcar como inactivo
  await db.update(productos).set({ activo: false, updatedAt: new Date() }).where(eq(productos.id, id));
}

// ============================================
// PEDIDO FUNCTIONS
// ============================================

export async function getPedidosByEmpresa(empresaId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pedidos).where(eq(pedidos.empresaId, empresaId)).orderBy(desc(pedidos.createdAt));
}

export async function getPedidosByMesa(mesaId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pedidos).where(
    and(eq(pedidos.mesaId, mesaId), eq(pedidos.orderStatus, "PENDIENTE"))
  );
}

export async function getPedidoActivo(mesaId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(pedidos).where(
    and(
      eq(pedidos.mesaId, mesaId),
      sql`${pedidos.orderStatus} IN ('PENDIENTE', 'PREPARANDO', 'LISTO')`
    )
  ).limit(1);
  return result[0];
}

export async function getPedidoById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(pedidos).where(eq(pedidos.id, id)).limit(1);
  return result[0];
}

export async function createPedido(data: InsertPedido) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(pedidos).values(data).returning({ id: pedidos.id });
  return result[0].id;
}

export async function updatePedidoTotales(id: number, subtotal: string, impuesto: string, total: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(pedidos).set({ subtotal, impuesto, total }).where(eq(pedidos.id, id));
}

export async function updatePedidoEstado(id: number, orderStatus: "PENDIENTE" | "PREPARANDO" | "LISTO" | "ENTREGADO" | "CANCELADO") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(pedidos).set({ orderStatus }).where(eq(pedidos.id, id));
}

// ============================================
// ITEMS PEDIDO FUNCTIONS
// ============================================

export async function getItemsByPedido(pedidoId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: itemsPedido.id,
    pedidoId: itemsPedido.pedidoId,
    productoId: itemsPedido.productoId,
    cantidad: itemsPedido.cantidad,
    precioUnitario: itemsPedido.precioUnitario,
    subtotal: itemsPedido.subtotal,
    notas: itemsPedido.notas,
    productoNombre: productos.nombre,
  })
    .from(itemsPedido)
    .innerJoin(productos, eq(itemsPedido.productoId, productos.id))
    .where(eq(itemsPedido.pedidoId, pedidoId));
}

export async function getComandasByArea(empresaId: number, area: "COCINA" | "BAR") {
  const db = await getDb();
  if (!db) return [];

  // 1. Obtener pedidos activos (Pendientes o En Preparación)
  const activePedidos = await db.select({
    id: pedidos.id,
    mesaId: pedidos.mesaId,
    mozoId: pedidos.mozoId,
    orderStatus: pedidos.orderStatus,
    createdAt: pedidos.createdAt,
    notas: pedidos.notas,
    mesaNumero: mesas.numero,
    mozoNombre: empleados.nombre,
  })
    .from(pedidos)
    .innerJoin(mesas, eq(pedidos.mesaId, mesas.id))
    .innerJoin(empleados, eq(pedidos.mozoId, empleados.id))
    .where(
      and(
        eq(pedidos.empresaId, empresaId),
        or(
          eq(pedidos.orderStatus, "PENDIENTE"),
          eq(pedidos.orderStatus, "PREPARANDO")
        )
      )
    )
    .orderBy(asc(pedidos.createdAt));

  // 2. Para cada pedido, obtener sus items filtrados por área
  const comandas = [];

  for (const p of activePedidos) {
    const items = await db.select({
      id: itemsPedido.id,
      cantidad: itemsPedido.cantidad,
      notas: itemsPedido.notas,
      estado: itemsPedido.estado,
      productoNombre: productos.nombre,
      categoriaArea: categorias.area
    })
      .from(itemsPedido)
      .innerJoin(productos, eq(itemsPedido.productoId, productos.id))
      .innerJoin(categorias, eq(productos.categoriaId, categorias.id))
      .where(
        and(
          eq(itemsPedido.pedidoId, p.id),
          eq(categorias.area, area),
          or(
            eq(itemsPedido.estado, "PENDIENTE"),
            eq(itemsPedido.estado, "PREPARANDO")
          )
        )
      );

    if (items.length > 0) {
      comandas.push({
        ...p,
        items
      });
    }
  }

  return comandas;
}

export async function getPedidosListos(empresaId: number) {
  const db = await getDb();
  if (!db) return [];

  // Items listos para recoger (READY)
  const itemsListos = await db.select({
    id: itemsPedido.id,
    pedidoId: itemsPedido.pedidoId,
    productoNombre: productos.nombre,
    cantidad: itemsPedido.cantidad,
    mesaNumero: mesas.numero,
    mozoId: pedidos.mozoId,
    area: categorias.area,
    updatedAt: itemsPedido.createdAt // Idealmente deberíamos tener updatedAt en itemsPedido
  })
    .from(itemsPedido)
    .innerJoin(pedidos, eq(itemsPedido.pedidoId, pedidos.id))
    .innerJoin(productos, eq(itemsPedido.productoId, productos.id))
    .innerJoin(categorias, eq(productos.categoriaId, categorias.id))
    .innerJoin(mesas, eq(pedidos.mesaId, mesas.id))
    .where(
      and(
        eq(pedidos.empresaId, empresaId),
        eq(itemsPedido.estado, "LISTO")
      )
    );

  return itemsListos;
}


export async function addItemPedido(data: InsertItemPedido) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(itemsPedido).values(data).returning({ id: itemsPedido.id });
  return result[0].id;
}

export async function updateItemCantidad(id: number, cantidad: number, subtotal: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(itemsPedido).set({ cantidad, subtotal }).where(eq(itemsPedido.id, id));
}

export async function deleteItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(itemsPedido).where(eq(itemsPedido.id, id));
}

// ============================================
// ITEM UPDATE FUNCTION
// ============================================

export async function updateItemEstado(id: number, estado: "PENDIENTE" | "PREPARANDO" | "LISTO" | "ENTREGADO" | "CANCELADO") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(itemsPedido).set({ estado }).where(eq(itemsPedido.id, id));
}

// ============================================
// PAGO FUNCTIONS
// ============================================

export async function getPagosByEmpresa(empresaId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pagos).where(eq(pagos.empresaId, empresaId)).orderBy(desc(pagos.createdAt));
}

export async function getPagosByPedido(pedidoId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pagos).where(eq(pagos.pedidoId, pedidoId));
}

export async function createPago(data: InsertPago) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(pagos).values(data).returning({ id: pagos.id });
  return result[0].id;
}

// ============================================
// ANALYTICS FUNCTIONS
// ============================================

export async function getVentasTotales(empresaId: number) {
  const db = await getDb();
  if (!db) return { total: "0", count: 0 };

  const result = await db.select({
    total: sql<string>`COALESCE(SUM(${pagos.monto}), 0)`,
    count: sql<number>`COUNT(*)`,
  }).from(pagos).where(
    and(
      eq(pagos.empresaId, empresaId),
      eq(pagos.paymentStatus, "PAGADO")
    )
  );

  return result[0] || { total: "0", count: 0 };
}

export async function getProductosMasVendidos(empresaId: number, limit: number = 10) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.select({
    productoId: itemsPedido.productoId,
    nombre: productos.nombre,
    cantidadVendida: sql<number>`SUM(${itemsPedido.cantidad})`,
    totalVendido: sql<string>`SUM(${itemsPedido.subtotal})`,
  })
    .from(itemsPedido)
    .innerJoin(productos, eq(itemsPedido.productoId, productos.id))
    .innerJoin(pedidos, eq(itemsPedido.pedidoId, pedidos.id))
    .where(
      and(
        eq(pedidos.empresaId, empresaId),
        eq(pedidos.orderStatus, "ENTREGADO")
      )
    )
    .groupBy(itemsPedido.productoId, productos.nombre)
    .orderBy(desc(sql`SUM(${itemsPedido.cantidad})`))
    .limit(limit);

  return result;
}

export async function getRendimientoMozos(empresaId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.select({
    mozoId: pedidos.mozoId,
    nombre: empleados.nombre,
    apellido: empleados.apellido,
    totalPedidos: sql<number>`COUNT(DISTINCT ${pedidos.id})`,
    mesasAtendidas: sql<number>`COUNT(DISTINCT ${pedidos.mesaId})`,
    totalVentas: sql<string>`COALESCE(SUM(${pedidos.total}), 0)`,
    ticketPromedio: sql<string>`COALESCE(AVG(${pedidos.total}), 0)`,
  })
    .from(pedidos)
    .innerJoin(empleados, eq(pedidos.mozoId, empleados.id))
    .where(
      and(
        eq(pedidos.empresaId, empresaId),
        eq(pedidos.orderStatus, "ENTREGADO")
      )
    )
    .groupBy(pedidos.mozoId, empleados.nombre, empleados.apellido);

  return result;
}

export async function getPedidosActivos(empresaId: number) {
  const db = await getDb();
  if (!db) return [];

  const activePedidos = await db.select().from(pedidos).where(
    and(
      eq(pedidos.empresaId, empresaId),
      sql`${pedidos.orderStatus} IN ('PENDIENTE', 'PREPARANDO', 'LISTO')`
    )
  ).orderBy(desc(pedidos.createdAt));

  // Para cada pedido, obtener los items con sus estados
  const pedidosConItems = await Promise.all(
    activePedidos.map(async (pedido) => {
      const items = await db.select({
        id: itemsPedido.id,
        estado: itemsPedido.estado,
        cantidad: itemsPedido.cantidad,
        productoNombre: productos.nombre
      })
        .from(itemsPedido)
        .innerJoin(productos, eq(itemsPedido.productoId, productos.id))
        .where(eq(itemsPedido.pedidoId, pedido.id));

      // Determinar el estado real del pedido basado en los items
      let estadoReal = pedido.orderStatus;

      if (items.length > 0) {
        const todosEntregados = items.every(item => item.estado === "ENTREGADO");
        const algunoPreparando = items.some(item => item.estado === "PREPARANDO");
        const todosListos = items.every(item => item.estado === "LISTO" || item.estado === "ENTREGADO");

        if (todosEntregados) {
          estadoReal = "ENTREGADO"; // Consumiendo
        } else if (algunoPreparando) {
          estadoReal = "PREPARANDO";
        } else if (todosListos) {
          estadoReal = "LISTO";
        }
      }

      return {
        ...pedido,
        orderStatus: estadoReal,
        items
      };
    })
  );

  return pedidosConItems;
}

export async function getVentasPorHora(empresaId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.select({
    hora: sql<number>`EXTRACT(HOUR FROM ${pagos.fechaPago})`,
    total: sql<string>`SUM(${pagos.monto})`,
    cantidad: sql<number>`COUNT(*)`,
  })
    .from(pagos)
    .where(
      and(
        eq(pagos.empresaId, empresaId),
        eq(pagos.paymentStatus, "PAGADO"),
        sql`DATE(${pagos.fechaPago}) = CURRENT_DATE`
      )
    )
    .groupBy(sql`EXTRACT(HOUR FROM ${pagos.fechaPago})`)
    .orderBy(sql`EXTRACT(HOUR FROM ${pagos.fechaPago})`);

  return result;
}

export async function getVentasPorCategoria(empresaId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.select({
    categoriaId: categorias.id,
    nombre: categorias.nombre,
    total: sql<string>`SUM(${itemsPedido.subtotal})`,
    cantidad: sql<number>`SUM(${itemsPedido.cantidad})`,
  })
    .from(itemsPedido)
    .innerJoin(productos, eq(itemsPedido.productoId, productos.id))
    .innerJoin(categorias, eq(productos.categoriaId, categorias.id))
    .innerJoin(pedidos, eq(itemsPedido.pedidoId, pedidos.id))
    .where(
      and(
        eq(pedidos.empresaId, empresaId),
        eq(pedidos.orderStatus, "ENTREGADO")
      )
    )
    .groupBy(categorias.id, categorias.nombre)
    .orderBy(desc(sql`SUM(${itemsPedido.subtotal})`));

  return result;
}


// ============================================
// RESERVA FUNCTIONS
// ============================================

export async function getReservasByEmpresa(empresaId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reservas).where(eq(reservas.empresaId, empresaId)).orderBy(desc(reservas.fechaReserva));
}

export async function getReservasByFecha(empresaId: number, fecha: Date) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reservas).where(
    and(
      eq(reservas.empresaId, empresaId),
      eq(reservas.fechaReserva, fecha.toISOString().split('T')[0])
    )
  ).orderBy(reservas.horaInicio);
}

export async function getReservasByMesa(mesaId: number, fecha: Date) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reservas).where(
    and(
      eq(reservas.mesaId, mesaId),
      eq(reservas.fechaReserva, fecha.toISOString().split('T')[0]),
      sql`${reservas.reservaStatus} IN ('PENDIENTE', 'CONFIRMADA')`
    )
  ).orderBy(reservas.horaInicio);
}

export async function createReserva(data: InsertReserva) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(reservas).values(data).returning({ id: reservas.id });
  return result[0].id;
}

export async function updateReserva(id: number, data: Partial<InsertReserva>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(reservas).set({ ...data, updatedAt: new Date() }).where(eq(reservas.id, id));
}

export async function updateReservaStatus(id: number, status: "PENDIENTE" | "CONFIRMADA" | "CANCELADA" | "COMPLETADA") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(reservas).set({ reservaStatus: status, updatedAt: new Date() }).where(eq(reservas.id, id));
}

export async function deleteReserva(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(reservas).where(eq(reservas.id, id));
}

// ============================================
// HISTORIAL DE VENTAS FUNCTIONS
// ============================================

export async function getHistorialVentas(empresaId: number, filtros?: { fechaInicio?: Date; fechaFin?: Date; mozoId?: number }) {
  const db = await getDb();
  if (!db) return [];

  let conditions = [
    eq(pedidos.empresaId, empresaId),
    eq(pedidos.orderStatus, "ENTREGADO")
  ];

  if (filtros?.fechaInicio) {
    conditions.push(sql`${pedidos.createdAt} >= ${filtros.fechaInicio.toISOString()}::timestamp`);
  }
  if (filtros?.fechaFin) {
    conditions.push(sql`${pedidos.createdAt} <= ${filtros.fechaFin.toISOString()}::timestamp`);
  }
  if (filtros?.mozoId) {
    conditions.push(eq(pedidos.mozoId, filtros.mozoId));
  }

  return db.select({
    pedidoId: pedidos.id,
    mesaId: pedidos.mesaId,
    mesaNumero: mesas.numero,
    mozoId: pedidos.mozoId,
    mozoNombre: empleados.nombre,
    subtotal: pedidos.subtotal,
    impuesto: pedidos.impuesto,
    total: pedidos.total,
    fecha: pedidos.createdAt,
  })
    .from(pedidos)
    .leftJoin(mesas, eq(pedidos.mesaId, mesas.id))
    .leftJoin(empleados, eq(pedidos.mozoId, empleados.id))
    .where(and(...conditions))
    .orderBy(desc(pedidos.createdAt));
}

export async function getDetalleVenta(pedidoId: number) {
  const db = await getDb();
  if (!db) return { pedido: null, items: [], pago: null };

  const pedidoResult = await db.select().from(pedidos).where(eq(pedidos.id, pedidoId)).limit(1);
  const pedido = pedidoResult[0] || null;

  const items = await db.select({
    id: itemsPedido.id,
    productoId: itemsPedido.productoId,
    productoNombre: productos.nombre,
    cantidad: itemsPedido.cantidad,
    precioUnitario: itemsPedido.precioUnitario,
    subtotal: itemsPedido.subtotal,
    notas: itemsPedido.notas,
  })
    .from(itemsPedido)
    .leftJoin(productos, eq(itemsPedido.productoId, productos.id))
    .where(eq(itemsPedido.pedidoId, pedidoId));

  const pagoResult = await db.select().from(pagos).where(eq(pagos.pedidoId, pedidoId)).limit(1);
  const pago = pagoResult[0] || null;

  return { pedido, items, pago };
}

// ============================================
// EMPRESA UPDATE FUNCTION
// ============================================

export async function updateEmpresa(id: number, data: Partial<InsertEmpresa>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(empresas).set({ ...data, updatedAt: new Date() }).where(eq(empresas.id, id));
}

// ============================================
// REPORTES FUNCTIONS
// ============================================

export async function getReporteVentas(empresaId: number, fechaInicio: Date, fechaFin: Date) {
  const db = await getDb();
  if (!db) return { resumen: null, porDia: [], porCategoria: [], porMozo: [] };

  // Resumen general
  const resumenResult = await db.select({
    totalVentas: sql<string>`COALESCE(SUM(${pagos.monto}), 0)`,
    cantidadVentas: sql<number>`COUNT(*)`,
    ticketPromedio: sql<string>`COALESCE(AVG(${pagos.monto}), 0)`,
  })
    .from(pagos)
    .where(
      and(
        eq(pagos.empresaId, empresaId),
        eq(pagos.paymentStatus, "PAGADO"),
        sql`${pagos.fechaPago} >= ${fechaInicio.toISOString()}::timestamp`,
        sql`${pagos.fechaPago} <= ${fechaFin.toISOString()}::timestamp`
      )
    );

  // Ventas por día
  const porDia = await db.select({
    fecha: sql<string>`DATE(${pagos.fechaPago})`,
    total: sql<string>`SUM(${pagos.monto})`,
    cantidad: sql<number>`COUNT(*)`,
  })
    .from(pagos)
    .where(
      and(
        eq(pagos.empresaId, empresaId),
        eq(pagos.paymentStatus, "PAGADO"),
        sql`${pagos.fechaPago} >= ${fechaInicio.toISOString()}::timestamp`,
        sql`${pagos.fechaPago} <= ${fechaFin.toISOString()}::timestamp`
      )
    )
    .groupBy(sql`DATE(${pagos.fechaPago})`)
    .orderBy(sql`DATE(${pagos.fechaPago})`);

  // Ventas por categoría
  const porCategoria = await db.select({
    categoriaId: categorias.id,
    categoriaNombre: categorias.nombre,
    total: sql<string>`SUM(${itemsPedido.subtotal})`,
    cantidad: sql<number>`SUM(${itemsPedido.cantidad})`,
  })
    .from(itemsPedido)
    .innerJoin(productos, eq(itemsPedido.productoId, productos.id))
    .innerJoin(categorias, eq(productos.categoriaId, categorias.id))
    .innerJoin(pedidos, eq(itemsPedido.pedidoId, pedidos.id))
    .where(
      and(
        eq(pedidos.empresaId, empresaId),
        eq(pedidos.orderStatus, "ENTREGADO"),
        sql`${pedidos.createdAt} >= ${fechaInicio.toISOString()}::timestamp`,
        sql`${pedidos.createdAt} <= ${fechaFin.toISOString()}::timestamp`
      )
    )
    .groupBy(categorias.id, categorias.nombre)
    .orderBy(desc(sql`SUM(${itemsPedido.subtotal})`));

  // Ventas por mozo
  const porMozo = await db.select({
    mozoId: empleados.id,
    mozoNombre: empleados.nombre,
    totalVentas: sql<string>`COALESCE(SUM(${pedidos.total}), 0)`,
    cantidadPedidos: sql<number>`COUNT(*)`,
    ticketPromedio: sql<string>`COALESCE(AVG(${pedidos.total}), 0)`,
  })
    .from(pedidos)
    .innerJoin(empleados, eq(pedidos.mozoId, empleados.id))
    .where(
      and(
        eq(pedidos.empresaId, empresaId),
        eq(pedidos.orderStatus, "ENTREGADO"),
        sql`${pedidos.createdAt} >= ${fechaInicio.toISOString()}::timestamp`,
        sql`${pedidos.createdAt} <= ${fechaFin.toISOString()}::timestamp`
      )
    )
    .groupBy(empleados.id, empleados.nombre)
    .orderBy(desc(sql`SUM(${pedidos.total})`));

  return {
    resumen: resumenResult[0] || null,
    porDia,
    porCategoria,
    porMozo,
  };
}


// ============================================
// FUNCIONES DE REPORTES EXPORTABLES
// ============================================

export async function getReporteVentasDetallado(empresaId: number, fechaInicio: Date, fechaFin: Date) {
  const db = await getDb();
  if (!db) return { data: [], summary: null };

  const ventas = await db.select({
    fecha: pedidos.createdAt,
    mesa: mesas.numero,
    mozo: empleados.nombre,
    subtotal: pedidos.subtotal,
    igv: pedidos.impuesto,
    total: pedidos.total,
    metodo_pago: pagos.paymentMethod,
  })
    .from(pedidos)
    .leftJoin(mesas, eq(pedidos.mesaId, mesas.id))
    .leftJoin(empleados, eq(pedidos.mozoId, empleados.id))
    .leftJoin(pagos, eq(pagos.pedidoId, pedidos.id))
    .where(
      and(
        eq(pedidos.empresaId, empresaId),
        eq(pedidos.orderStatus, "ENTREGADO"),
        sql`${pedidos.createdAt} >= ${fechaInicio.toISOString()}::timestamp`,
        sql`${pedidos.createdAt} <= ${fechaFin.toISOString()}::timestamp`
      )
    )
    .orderBy(desc(pedidos.createdAt));

  const totalVentas = ventas.reduce((sum, v) => sum + parseFloat(v.total || "0"), 0);
  const ticketPromedio = ventas.length > 0 ? totalVentas / ventas.length : 0;

  return {
    data: ventas.map(v => ({
      fecha: v.fecha ? new Date(v.fecha).toLocaleDateString("es-PE") : "",
      mesa: v.mesa?.toString() || "N/A",
      mozo: v.mozo || "N/A",
      subtotal: parseFloat(v.subtotal || "0").toFixed(2),
      igv: parseFloat(v.igv || "0").toFixed(2),
      total: parseFloat(v.total || "0").toFixed(2),
      metodo_pago: v.metodo_pago || "N/A",
    })),
    summary: {
      total: totalVentas,
      totalPedidos: ventas.length,
      ticketPromedio: ticketPromedio,
    },
  };
}

export async function getReporteProductos(empresaId: number, fechaInicio: Date, fechaFin: Date) {
  const db = await getDb();
  if (!db) return { data: [], summary: null };

  const productosVendidos = await db.select({
    producto: productos.nombre,
    categoria: categorias.nombre,
    cantidad_vendida: sql<number>`SUM(${itemsPedido.cantidad})`,
    ingresos_total: sql<string>`SUM(${itemsPedido.subtotal})`,
  })
    .from(itemsPedido)
    .innerJoin(productos, eq(itemsPedido.productoId, productos.id))
    .leftJoin(categorias, eq(productos.categoriaId, categorias.id))
    .innerJoin(pedidos, eq(itemsPedido.pedidoId, pedidos.id))
    .where(
      and(
        eq(pedidos.empresaId, empresaId),
        eq(pedidos.orderStatus, "ENTREGADO"),
        sql`${pedidos.createdAt} >= ${fechaInicio.toISOString()}::timestamp`,
        sql`${pedidos.createdAt} <= ${fechaFin.toISOString()}::timestamp`
      )
    )
    .groupBy(productos.id, productos.nombre, categorias.nombre)
    .orderBy(desc(sql`SUM(${itemsPedido.cantidad})`));

  const totalIngresos = productosVendidos.reduce((sum, p) => sum + parseFloat(p.ingresos_total || "0"), 0);
  const totalUnidades = productosVendidos.reduce((sum, p) => sum + (p.cantidad_vendida || 0), 0);

  return {
    data: productosVendidos.map(p => ({
      producto: p.producto,
      categoria: p.categoria || "Sin categoría",
      cantidad_vendida: p.cantidad_vendida?.toString() || "0",
      ingresos_total: parseFloat(p.ingresos_total || "0").toFixed(2),
    })),
    summary: {
      total: totalIngresos,
      totalUnidades: totalUnidades,
    },
  };
}

export async function getReporteMozos(empresaId: number, fechaInicio: Date, fechaFin: Date) {
  const db = await getDb();
  if (!db) return { data: [], summary: null };

  const mozosStats = await db.select({
    mozo: empleados.nombre,
    pedidos_atendidos: sql<number>`COUNT(*)`,
    total_ventas: sql<string>`COALESCE(SUM(${pedidos.total}), 0)`,
    ticket_promedio: sql<string>`COALESCE(AVG(${pedidos.total}), 0)`,
  })
    .from(pedidos)
    .innerJoin(empleados, eq(pedidos.mozoId, empleados.id))
    .where(
      and(
        eq(pedidos.empresaId, empresaId),
        eq(pedidos.orderStatus, "ENTREGADO"),
        sql`${pedidos.createdAt} >= ${fechaInicio.toISOString()}::timestamp`,
        sql`${pedidos.createdAt} <= ${fechaFin.toISOString()}::timestamp`
      )
    )
    .groupBy(empleados.id, empleados.nombre)
    .orderBy(desc(sql`SUM(${pedidos.total})`));

  const totalVentas = mozosStats.reduce((sum, m) => sum + parseFloat(m.total_ventas || "0"), 0);
  const totalPedidos = mozosStats.reduce((sum, m) => sum + (m.pedidos_atendidos || 0), 0);

  return {
    data: mozosStats.map(m => ({
      mozo: m.mozo,
      pedidos_atendidos: m.pedidos_atendidos?.toString() || "0",
      total_ventas: parseFloat(m.total_ventas || "0").toFixed(2),
      ticket_promedio: parseFloat(m.ticket_promedio || "0").toFixed(2),
    })),
    summary: {
      total: totalVentas,
      totalPedidos: totalPedidos,
    },
  };
}

export async function getReporteDiario(empresaId: number, fechaInicio: Date, fechaFin: Date) {
  const db = await getDb();
  if (!db) return { data: [], summary: null };

  const ventasDiarias = await db.select({
    fecha: sql<string>`DATE(${pedidos.createdAt})`,
    total_pedidos: sql<number>`COUNT(*)`,
    total_ventas: sql<string>`COALESCE(SUM(${pedidos.total}), 0)`,
    ticket_promedio: sql<string>`COALESCE(AVG(${pedidos.total}), 0)`,
  })
    .from(pedidos)
    .where(
      and(
        eq(pedidos.empresaId, empresaId),
        eq(pedidos.orderStatus, "ENTREGADO"),
        sql`${pedidos.createdAt} >= ${fechaInicio.toISOString()}::timestamp`,
        sql`${pedidos.createdAt} <= ${fechaFin.toISOString()}::timestamp`
      )
    )
    .groupBy(sql`DATE(${pedidos.createdAt})`)
    .orderBy(desc(sql`DATE(${pedidos.createdAt})`));

  const totalVentas = ventasDiarias.reduce((sum, d) => sum + parseFloat(d.total_ventas || "0"), 0);
  const totalPedidos = ventasDiarias.reduce((sum, d) => sum + (d.total_pedidos || 0), 0);
  const ticketPromedio = totalPedidos > 0 ? totalVentas / totalPedidos : 0;

  return {
    data: ventasDiarias.map(d => ({
      fecha: d.fecha || "",
      total_pedidos: d.total_pedidos?.toString() || "0",
      total_ventas: parseFloat(d.total_ventas || "0").toFixed(2),
      ticket_promedio: parseFloat(d.ticket_promedio || "0").toFixed(2),
    })),
    summary: {
      total: totalVentas,
      totalPedidos: totalPedidos,
      ticketPromedio: ticketPromedio,
    },
  };
}


// ============================================
// CAJA FUNCTIONS (Apertura y Cierre de Caja)
// ============================================

export async function getCajaAbierta(empresaId: number, cajeroId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(cajas).where(
    and(
      eq(cajas.empresaId, empresaId),
      eq(cajas.cajeroId, cajeroId),
      eq(cajas.cajaStatus, "ABIERTA")
    )
  ).limit(1);
  return result[0] || null;
}

export async function getCajaAbiertaByEmpresa(empresaId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(cajas).where(
    and(
      eq(cajas.empresaId, empresaId),
      eq(cajas.cajaStatus, "ABIERTA")
    )
  ).limit(1);
  return result[0] || null;
}

export async function abrirCaja(data: InsertCaja) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(cajas).values({
    ...data,
    cajaStatus: "ABIERTA",
    fechaApertura: new Date(),
  }).returning({ id: cajas.id });
  return result[0].id;
}

export async function cerrarCaja(
  cajaId: number,
  montoFinal: string,
  totalVentas: string,
  totalEfectivo: string,
  totalTarjeta: string,
  totalYape: string,
  totalPlin: string,
  diferencia: string,
  observaciones?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(cajas).set({
    cajaStatus: "CERRADA",
    montoFinal,
    totalVentas,
    totalEfectivo,
    totalTarjeta,
    totalYape,
    totalPlin,
    diferencia,
    observaciones,
    fechaCierre: new Date(),
    updatedAt: new Date(),
  }).where(eq(cajas.id, cajaId));
}

export async function getCajaById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(cajas).where(eq(cajas.id, id)).limit(1);
  return result[0];
}

export async function getCajasByEmpresa(empresaId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cajas).where(eq(cajas.empresaId, empresaId)).orderBy(desc(cajas.fechaApertura));
}

export async function getUltimaCajaCerrada(empresaId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(cajas).where(
    and(
      eq(cajas.empresaId, empresaId),
      eq(cajas.cajaStatus, "CERRADA")
    )
  ).orderBy(desc(cajas.fechaCierre)).limit(1);
  return result[0] || null;
}

export async function getVentasDesdeFecha(empresaId: number, fechaDesde: Date) {
  const db = await getDb();
  if (!db) return { total: "0", efectivo: "0", tarjeta: "0", yape: "0", plin: "0", count: 0 };

  const result = await db.select({
    total: sql<string>`COALESCE(SUM(${pagos.monto}), '0')`,
    efectivo: sql<string>`COALESCE(SUM(CASE WHEN ${pagos.paymentMethod} = 'EFECTIVO' THEN ${pagos.monto} ELSE '0' END), '0')`,
    tarjeta: sql<string>`COALESCE(SUM(CASE WHEN ${pagos.paymentMethod} = 'TARJETA' THEN ${pagos.monto} ELSE '0' END), '0')`,
    yape: sql<string>`COALESCE(SUM(CASE WHEN ${pagos.paymentMethod} = 'YAPE' THEN ${pagos.monto} ELSE '0' END), '0')`,
    plin: sql<string>`COALESCE(SUM(CASE WHEN ${pagos.paymentMethod} = 'PLIN' THEN ${pagos.monto} ELSE '0' END), '0')`,
    count: sql<number>`COUNT(*)::int`,
  }).from(pagos).where(
    and(
      eq(pagos.empresaId, empresaId),
      eq(pagos.paymentStatus, "PAGADO"),
      sql`${pagos.fechaPago} >= ${fechaDesde.toISOString()}::timestamp`
    )
  );

  return result[0] || { total: "0", efectivo: "0", tarjeta: "0", yape: "0", plin: "0", count: 0 };
}

// ============================================
// BILLING FUNCTIONS
// ============================================

export async function createVenta(venta: InsertVenta): Promise<Venta> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(ventas).values(venta).returning();
  return result[0];
}

export async function getVentasByEmpresa(empresaId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ventas).where(eq(ventas.empresaId, empresaId)).orderBy(desc(ventas.createdAt));
}

export async function getVentaById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(ventas).where(eq(ventas.id, id)).limit(1);
  return result[0];
}

export async function createComprobante(comprobante: InsertComprobante, items: Omit<InsertComprobanteItem, 'comprobanteId'>[]): Promise<Comprobante> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.transaction(async (tx) => {
    const [c] = await tx.insert(comprobantes).values(comprobante).returning();

    if (items.length > 0) {
      const itemsWithComprobanteId = items.map(item => ({
        ...item,
        comprobanteId: c.id
      })) as InsertComprobanteItem[];
      await tx.insert(comprobanteItems).values(itemsWithComprobanteId);
    }

    return c;
  });
}

export async function getComprobantesByEmpresa(empresaId: number, fecha?: string) {
  const db = await getDb();
  if (!db) return [];

  let conditions = eq(comprobantes.empresaId, empresaId);

  if (fecha) {
    const startDate = new Date(`${fecha}T00:00:00`);
    const endDate = new Date(`${fecha}T23:59:59.999`);
    conditions = and(conditions, gte(comprobantes.createdAt, startDate), lte(comprobantes.createdAt, endDate))!;
  }

  return db.select().from(comprobantes).where(conditions).orderBy(desc(comprobantes.createdAt));
}

export async function getComprobanteById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(comprobantes).where(eq(comprobantes.id, id));
  if (result.length === 0) return null;

  const items = await db.select().from(comprobanteItems).where(eq(comprobanteItems.comprobanteId, id));

  return {
    ...result[0],
    items
  };
}

export async function getNextComprobanteNumero(empresaId: number, tipo: "BOLETA" | "FACTURA" | "TICKET" | "NOTA_CREDITO" | "NOTA_DEBITO", serie: string): Promise<number> {
  const db = await getDb();
  if (!db) return 1;
  const result = await db.select({
    maxNumero: sql<number>`COALESCE(MAX(${comprobantes.numero}), 0)`
  })
    .from(comprobantes)
    .where(
      and(
        eq(comprobantes.empresaId, empresaId),
        eq(comprobantes.tipo, tipo),
        eq(comprobantes.serie, serie)
      )
    );

  return (result[0]?.maxNumero || 0) + 1;
}

export async function updateComprobanteStatus(id: number, status: "PENDIENTE" | "ENVIADO" | "ACEPTADO" | "RECHAZADO" | "ANULADO", response?: string, paths?: { xml?: string, cdr?: string, pdf?: string }) {
  const db = await getDb();
  if (!db) return;

  await db.update(comprobantes)
    .set({
      sunatStatus: status,
      sunatResponse: response,
      xmlPath: paths?.xml,
      cdrPath: paths?.cdr,
      pdfPath: paths?.pdf,
    })
    .where(eq(comprobantes.id, id));
}

export async function deleteComprobante(id: number) {
  const db = await getDb();
  if (!db) return;

  await db.transaction(async (tx) => {
    await tx.delete(comprobanteItems).where(eq(comprobanteItems.comprobanteId, id));
    await tx.delete(comprobantes).where(eq(comprobantes.id, id));
  });
}

// ============================================
// CLIENTE FUNCTIONS
// ============================================

export async function getClienteByDocumento(empresaId: number, rucOrDni: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(clientes).where(
    and(
      eq(clientes.empresaId, empresaId),
      or(eq(clientes.ruc, rucOrDni), eq(clientes.dni, rucOrDni))
    )
  ).limit(1);
  return result[0];
}

export async function createCliente(data: InsertCliente) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(clientes).values(data).returning();
  return result[0];
}



// ============================================
// HISTORIAL Y RESTAURACION DE VENTAS
// ============================================

export async function getVentasHistorial(empresaId: number) {
  const db = await getDb();
  if (!db) return [];

  // Usamos leftJoin para traer info relacionada pero asegurando tipos
  // Nota: Drizzle devolverá objetos anidados { ventas: ..., comprobantes: ..., pedidos: ... }
  return db.select()
    .from(ventas)
    .leftJoin(comprobantes, eq(ventas.id, comprobantes.ventaId))
    .leftJoin(pedidos, eq(ventas.pedidoId, pedidos.id))
    .leftJoin(clientes, eq(ventas.clienteId, clientes.id))
    .where(eq(ventas.empresaId, empresaId))
    .orderBy(desc(ventas.createdAt))
    .limit(50);
}

export async function anularVenta(ventaId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB no disponible");

  await db.update(ventas)
    .set({ estado: 'ANULADA' })
    .where(eq(ventas.id, ventaId));
}

export async function restaurarPedido(pedidoId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB no disponible");

  // Restaurar a estado 'LISTO' para que aparezca en "Por Cobrar" (sin traer historial antiguo)
  // y pueda ser modificado/pagado nuevamente.
  await db.update(pedidos)
    .set({ orderStatus: 'LISTO' })
    .where(eq(pedidos.id, pedidoId));
}

export async function getComprobanteByVentaId(ventaId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(comprobantes).where(eq(comprobantes.ventaId, ventaId)).limit(1);
  return result[0];
}

export async function getVentaItems(ventaId: number) {
  const db = await getDb();
  if (!db) return [];

  // Siempre priorizamos items del pedido original para tener el nombre real del producto
  // y evitar descripciones genericas de SUNAT (como "Item de Comanda")
  const [venta] = await db.select().from(ventas).where(eq(ventas.id, ventaId)).limit(1);

  if (venta) {
    return db.select({
      descripcion: productos.nombre,
      cantidad: itemsPedido.cantidad,
      precioUnitario: itemsPedido.precioUnitario,
      subtotal: itemsPedido.subtotal,
      id: itemsPedido.id
    })
      .from(itemsPedido)
      .innerJoin(productos, eq(itemsPedido.productoId, productos.id))
      .where(eq(itemsPedido.pedidoId, venta.pedidoId));
  }

  return [];
}
