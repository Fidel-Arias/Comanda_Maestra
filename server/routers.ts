import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { format } from "date-fns";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import * as nubefact from "./lib/nubefact";

/**
 * Mapeo de tipos de comprobante para NubeFact JSON API
 * NubeFact usa: 1 (Factura), 2 (Boleta), 3 (Nota Crédito), 4 (Nota Débito)
 */
const TIPO_NUBEFACT = {
  FACTURA: 1,
  BOLETA: 2,
  NOTA_CREDITO: 3,
  NOTA_DEBITO: 4,
  TICKET: 0, // No enviado a NubeFact real
};

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============================================
  // EMPRESA ROUTER
  // ============================================
  empresa: router({
    list: publicProcedure.query(async () => {
      return db.getEmpresas();
    }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getEmpresaById(input.id);
      }),
  }),

  // ============================================
  // EMPLEADO ROUTER (Auth por PIN)
  // ============================================
  empleado: router({
    loginByPin: publicProcedure
      .input(z.object({
        empresaId: z.number(),
        pin: z.string().length(4)
      }))
      .mutation(async ({ input }) => {
        const empleado = await db.getEmpleadoByPin(input.empresaId, input.pin);
        if (!empleado) {
          return { success: false, error: "PIN inválido" };
        }
        return {
          success: true,
          empleado: {
            id: empleado.id,
            nombre: empleado.nombre,
            apellido: empleado.apellido,
            rol: empleado.userRole,
            empresaId: empleado.empresaId,
          }
        };
      }),

    listByEmpresa: publicProcedure
      .input(z.object({ empresaId: z.number() }))
      .query(async ({ input }) => {
        return db.getEmpleadosByEmpresa(input.empresaId);
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getEmpleadoById(input.id);
      }),
  }),

  // ============================================
  // MESA ROUTER
  // ============================================
  mesa: router({
    listByEmpresa: publicProcedure
      .input(z.object({ empresaId: z.number() }))
      .query(async ({ input }) => {
        return db.getMesasByEmpresa(input.empresaId);
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getMesaById(input.id);
      }),

    updateEstado: publicProcedure
      .input(z.object({
        id: z.number(),
        estado: z.enum(["DISPONIBLE", "OCUPADA", "PIDIENDO_CUENTA", "RESERVADA"]),
        mozoId: z.number().nullable().optional(),
        personas: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.updateMesaEstado(input.id, input.estado, input.mozoId, input.personas);
        return { success: true };
      }),

    create: publicProcedure
      .input(z.object({
        empresaId: z.number(),
        numero: z.number().min(1),
        capacidad: z.number().min(1).max(20),
      }))
      .mutation(async ({ input }) => {
        const mesaId = await db.createMesa({
          empresaId: input.empresaId,
          numero: input.numero,
          capacidad: input.capacidad,
        });
        return { success: true, mesaId };
      }),

    update: publicProcedure
      .input(z.object({
        id: z.number(),
        numero: z.number().min(1).optional(),
        capacidad: z.number().min(1).max(20).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateMesa(id, data);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteMesa(input.id);
        return { success: true };
      }),
  }),

  // ============================================
  // CATEGORIA ROUTER
  // ============================================
  categoria: router({
    listByEmpresa: publicProcedure
      .input(z.object({ empresaId: z.number() }))
      .query(async ({ input }) => {
        return db.getCategoriasByEmpresa(input.empresaId);
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getCategoriaById(input.id);
      }),

    create: publicProcedure
      .input(z.object({
        empresaId: z.number(),
        nombre: z.string().min(1),
        descripcion: z.string().nullable().optional(),
        icono: z.string().nullable().optional(),
        orden: z.number().optional(),
        area: z.enum(["COCINA", "BAR"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const categoriaId = await db.createCategoria({
          empresaId: input.empresaId,
          nombre: input.nombre,
          descripcion: input.descripcion,
          icono: input.icono,
          orden: input.orden,
          area: input.area,
        });
        return { success: true, categoriaId };
      }),

    update: publicProcedure
      .input(z.object({
        id: z.number(),
        nombre: z.string().min(1).optional(),
        descripcion: z.string().nullable().optional(),
        icono: z.string().nullable().optional(),
        orden: z.number().optional(),
        area: z.enum(["COCINA", "BAR"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateCategoria(id, data);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteCategoria(input.id);
        return { success: true };
      }),
  }),

  // ============================================
  // PRODUCTO ROUTER
  // ============================================
  producto: router({
    listByEmpresa: publicProcedure
      .input(z.object({ empresaId: z.number() }))
      .query(async ({ input }) => {
        return db.getProductosByEmpresa(input.empresaId);
      }),

    listByCategoria: publicProcedure
      .input(z.object({ categoriaId: z.number() }))
      .query(async ({ input }) => {
        return db.getProductosByCategoria(input.categoriaId);
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getProductoById(input.id);
      }),

    create: publicProcedure
      .input(z.object({
        empresaId: z.number(),
        categoriaId: z.number(),
        nombre: z.string().min(1),
        descripcion: z.string().nullable().optional(),
        precio: z.string(),
        precioCosto: z.string().nullable().optional(),
        stock: z.number().optional(),
        stockMinimo: z.number().optional(),
        imagenUrl: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const productoId = await db.createProducto({
          empresaId: input.empresaId,
          categoriaId: input.categoriaId,
          nombre: input.nombre,
          descripcion: input.descripcion,
          precio: input.precio,
          precioCosto: input.precioCosto,
          stock: input.stock,
          stockMinimo: input.stockMinimo,
          imagenUrl: input.imagenUrl,
        });
        return { success: true, productoId };
      }),

    update: publicProcedure
      .input(z.object({
        id: z.number(),
        empresaId: z.number().optional(),
        categoriaId: z.number().optional(),
        nombre: z.string().min(1).optional(),
        descripcion: z.string().nullable().optional(),
        precio: z.string().optional(),
        precioCosto: z.string().nullable().optional(),
        stock: z.number().optional(),
        stockMinimo: z.number().optional(),
        imagenUrl: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateProducto(id, data);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteProducto(input.id);
        return { success: true };
      }),
  }),

  // ============================================
  // PEDIDO ROUTER
  // ============================================
  pedido: router({
    listByEmpresa: publicProcedure
      .input(z.object({ empresaId: z.number() }))
      .query(async ({ input }) => {
        return db.getPedidosByEmpresa(input.empresaId);
      }),

    listActivos: publicProcedure
      .input(z.object({ empresaId: z.number() }))
      .query(async ({ input }) => {
        return db.getPedidosActivos(input.empresaId);
      }),

    listComandas: publicProcedure
      .input(z.object({
        empresaId: z.number(),
        area: z.enum(["COCINA", "BAR"])
      }))
      .query(async ({ input }) => {
        return db.getComandasByArea(input.empresaId, input.area);
      }),

    listPedidosListos: publicProcedure
      .input(z.object({ empresaId: z.number() }))
      .query(async ({ input }) => {
        return db.getPedidosListos(input.empresaId);
      }),

    getByMesa: publicProcedure
      .input(z.object({ mesaId: z.number() }))
      .query(async ({ input }) => {
        return db.getPedidoActivo(input.mesaId);
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getPedidoById(input.id);
      }),

    create: publicProcedure
      .input(z.object({
        empresaId: z.number(),
        mesaId: z.number(),
        mozoId: z.number(),
        notas: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Actualizar estado de mesa a OCUPADA
        await db.updateMesaEstado(input.mesaId, "OCUPADA", input.mozoId);

        const pedidoId = await db.createPedido({
          empresaId: input.empresaId,
          mesaId: input.mesaId,
          mozoId: input.mozoId,
          notas: input.notas,
        });

        return { success: true, pedidoId };
      }),

    updateEstado: publicProcedure
      .input(z.object({
        id: z.number(),
        estado: z.enum(["PENDIENTE", "PREPARANDO", "LISTO", "ENTREGADO", "CANCELADO"])
      }))
      .mutation(async ({ input }) => {
        await db.updatePedidoEstado(input.id, input.estado);
        return { success: true };
      }),

    updateTotales: publicProcedure
      .input(z.object({
        id: z.number(),
        subtotal: z.string(),
        impuesto: z.string(),
        total: z.string(),
      }))
      .mutation(async ({ input }) => {
        await db.updatePedidoTotales(input.id, input.subtotal, input.impuesto, input.total);
        return { success: true };
      }),
  }),

  // ============================================
  // ITEM PEDIDO ROUTER
  // ============================================
  itemPedido: router({
    listByPedido: publicProcedure
      .input(z.object({ pedidoId: z.number() }))
      .query(async ({ input }) => {
        return db.getItemsByPedido(input.pedidoId);
      }),

    add: publicProcedure
      .input(z.object({
        pedidoId: z.number(),
        productoId: z.number(),
        cantidad: z.number().min(1),
        precioUnitario: z.string(),
        subtotal: z.string(),
        notas: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const itemId = await db.addItemPedido({
          pedidoId: input.pedidoId,
          productoId: input.productoId,
          cantidad: input.cantidad,
          precioUnitario: input.precioUnitario,
          subtotal: input.subtotal,
          notas: input.notas,
        });

        // Actualizar stock del producto
        await db.updateProductoStock(input.productoId, input.cantidad);

        return { success: true, itemId };
      }),

    updateCantidad: publicProcedure
      .input(z.object({
        id: z.number(),
        cantidad: z.number().min(1),
        subtotal: z.string(),
      }))
      .mutation(async ({ input }) => {
        await db.updateItemCantidad(input.id, input.cantidad, input.subtotal);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteItem(input.id);
        return { success: true };
      }),

    updateStatus: publicProcedure
      .input(z.object({
        id: z.number(),
        estado: z.enum(["PENDIENTE", "PREPARANDO", "LISTO", "ENTREGADO", "CANCELADO"]),
      }))
      .mutation(async ({ input }) => {
        await db.updateItemEstado(input.id, input.estado);
        return { success: true };
      }),
  }),

  // ============================================
  // PAGO ROUTER
  // ============================================
  pago: router({
    listByEmpresa: publicProcedure
      .input(z.object({ empresaId: z.number() }))
      .query(async ({ input }) => {
        return db.getPagosByEmpresa(input.empresaId);
      }),

    listByPedido: publicProcedure
      .input(z.object({ pedidoId: z.number() }))
      .query(async ({ input }) => {
        return db.getPagosByPedido(input.pedidoId);
      }),

    create: publicProcedure
      .input(z.object({
        empresaId: z.number(),
        pedidoId: z.number(),
        cajeroId: z.number(),
        metodoPago: z.enum(["EFECTIVO", "TARJETA", "YAPE", "PLIN", "TRANSFERENCIA"]),
        monto: z.string(),
        montoPagado: z.string(),
        vuelto: z.string(),
        referenciaPago: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const pagoId = await db.createPago({
          empresaId: input.empresaId,
          pedidoId: input.pedidoId,
          cajeroId: input.cajeroId,
          paymentMethod: input.metodoPago,
          monto: input.monto,
          montoPagado: input.montoPagado,
          vuelto: input.vuelto,
          referenciaPago: input.referenciaPago,
          paymentStatus: "PAGADO",
          fechaPago: new Date(),
        });

        // Actualizar estado del pedido a ENTREGADO
        await db.updatePedidoEstado(input.pedidoId, "ENTREGADO");

        // Obtener el pedido para liberar la mesa
        const pedido = await db.getPedidoById(input.pedidoId);
        if (pedido) {
          await db.updateMesaEstado(pedido.mesaId, "DISPONIBLE", null);
        }

        return { success: true, pagoId };
      }),
  }),

  // ============================================
  // ANALYTICS ROUTER
  // ============================================
  analytics: router({
    ventasTotales: publicProcedure
      .input(z.object({ empresaId: z.number() }))
      .query(async ({ input }) => {
        return db.getVentasTotales(input.empresaId);
      }),

    productosMasVendidos: publicProcedure
      .input(z.object({ empresaId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getProductosMasVendidos(input.empresaId, input.limit);
      }),

    rendimientoMozos: publicProcedure
      .input(z.object({ empresaId: z.number() }))
      .query(async ({ input }) => {
        return db.getRendimientoMozos(input.empresaId);
      }),

    ventasPorHora: publicProcedure
      .input(z.object({ empresaId: z.number() }))
      .query(async ({ input }) => {
        return db.getVentasPorHora(input.empresaId);
      }),

    ventasPorCategoria: publicProcedure
      .input(z.object({ empresaId: z.number() }))
      .query(async ({ input }) => {
        return db.getVentasPorCategoria(input.empresaId);
      }),
  }),

  // ============================================
  // RESERVA ROUTER
  // ============================================
  reserva: router({
    listByEmpresa: publicProcedure
      .input(z.object({ empresaId: z.number() }))
      .query(async ({ input }) => {
        return db.getReservasByEmpresa(input.empresaId);
      }),

    listByFecha: publicProcedure
      .input(z.object({ empresaId: z.number(), fecha: z.string() }))
      .query(async ({ input }) => {
        return db.getReservasByFecha(input.empresaId, new Date(input.fecha));
      }),

    listByMesa: publicProcedure
      .input(z.object({ mesaId: z.number(), fecha: z.string() }))
      .query(async ({ input }) => {
        return db.getReservasByMesa(input.mesaId, new Date(input.fecha));
      }),

    create: publicProcedure
      .input(z.object({
        empresaId: z.number(),
        mesaId: z.number(),
        clienteNombre: z.string().min(1),
        clienteTelefono: z.string().nullable().optional(),
        clienteEmail: z.string().nullable().optional(),
        fechaReserva: z.string(),
        horaInicio: z.string(),
        personas: z.number().min(1),
        notas: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const reservaId = await db.createReserva({
          empresaId: input.empresaId,
          mesaId: input.mesaId,
          clienteNombre: input.clienteNombre,
          clienteTelefono: input.clienteTelefono,
          clienteEmail: input.clienteEmail,
          fechaReserva: input.fechaReserva.split('T')[0], // YYYY-MM-DD
          horaInicio: input.horaInicio,
          personas: input.personas,
          notas: input.notas,
        });
        return { success: true, reservaId };
      }),

    update: publicProcedure
      .input(z.object({
        id: z.number(),
        clienteNombre: z.string().min(1).optional(),
        clienteTelefono: z.string().nullable().optional(),
        clienteEmail: z.string().nullable().optional(),
        fechaReserva: z.string().optional(),
        horaInicio: z.string().optional(),
        personas: z.number().min(1).optional(),
        notas: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, fechaReserva, ...data } = input;
        const updateData: any = { ...data };
        if (fechaReserva) updateData.fechaReserva = fechaReserva.split('T')[0];
        await db.updateReserva(id, updateData);
        return { success: true };
      }),

    updateStatus: publicProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["PENDIENTE", "CONFIRMADA", "CANCELADA", "COMPLETADA"]),
      }))
      .mutation(async ({ input }) => {
        await db.updateReservaStatus(input.id, input.status);
        return { success: true };
      }),

    confirmArrival: publicProcedure
      .input(z.object({
        id: z.number(),
        mozoId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.confirmReservaLlegada(input.id, input.mozoId);
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteReserva(input.id);
        return { success: true };
      }),
  }),

  // ============================================
  // CAJA ROUTER (Apertura y Cierre de Caja)
  // ============================================
  caja: router({
    getCajaAbierta: publicProcedure
      .input(z.object({ empresaId: z.number(), cajeroId: z.number() }))
      .query(async ({ input }) => {
        return db.getCajaAbierta(input.empresaId, input.cajeroId);
      }),

    getCajaAbiertaByEmpresa: publicProcedure
      .input(z.object({ empresaId: z.number() }))
      .query(async ({ input }) => {
        return db.getCajaAbiertaByEmpresa(input.empresaId);
      }),

    getUltimoCierre: publicProcedure
      .input(z.object({ empresaId: z.number() }))
      .query(async ({ input }) => {
        return db.getUltimaCajaCerrada(input.empresaId);
      }),

    abrir: publicProcedure
      .input(z.object({
        empresaId: z.number(),
        cajeroId: z.number(),
        montoInicial: z.string(),
      }))
      .mutation(async ({ input }) => {
        // Verificar si ya hay una caja abierta
        const cajaExistente = await db.getCajaAbiertaByEmpresa(input.empresaId);
        if (cajaExistente) {
          return { success: false, error: "Ya existe una caja abierta" };
        }

        const cajaId = await db.abrirCaja({
          empresaId: input.empresaId,
          cajeroId: input.cajeroId,
          montoInicial: input.montoInicial,
        });
        return { success: true, cajaId };
      }),

    cerrar: publicProcedure
      .input(z.object({
        cajaId: z.number(),
        montoFinal: z.string(),
        totalVentas: z.string(),
        totalEfectivo: z.string(),
        totalTarjeta: z.string(),
        totalYape: z.string(),
        totalPlin: z.string(),
        diferencia: z.string(),
        observaciones: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.cerrarCaja(
          input.cajaId,
          input.montoFinal,
          input.totalVentas,
          input.totalEfectivo,
          input.totalTarjeta,
          input.totalYape,
          input.totalPlin,
          input.diferencia,
          input.observaciones
        );
        return { success: true };
      }),

    getVentasDesdeFecha: publicProcedure
      .input(z.object({ empresaId: z.number(), fechaDesde: z.string() }))
      .query(async ({ input }) => {
        return db.getVentasDesdeFecha(input.empresaId, new Date(input.fechaDesde));
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getCajaById(input.id);
      }),

    listByEmpresa: publicProcedure
      .input(z.object({ empresaId: z.number() }))
      .query(async ({ input }) => {
        return db.getCajasByEmpresa(input.empresaId);
      }),
  }),

  // ============================================
  // HISTORIAL DE VENTAS ROUTER
  // ============================================
  historial: router({
    getVentas: publicProcedure
      .input(z.object({
        empresaId: z.number(),
        fechaInicio: z.string().optional(),
        fechaFin: z.string().optional(),
        mozoId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const filtros: { fechaInicio?: Date; fechaFin?: Date; mozoId?: number } = {};

        // Corregir manejo de fechas para incluir todo el día
        if (input.fechaInicio) {
          // Usar T00:00:00 para forzar el parseo en tiempo local y evitar desfases de zona horaria
          const fechaInicio = new Date(input.fechaInicio + "T00:00:00");
          fechaInicio.setHours(0, 0, 0, 0);
          filtros.fechaInicio = fechaInicio;
        }
        if (input.fechaFin) {
          const fechaFin = new Date(input.fechaFin + "T23:59:59");
          fechaFin.setHours(23, 59, 59, 999);
          filtros.fechaFin = fechaFin;
        }
        if (input.mozoId) filtros.mozoId = input.mozoId;
        return db.getHistorialVentas(input.empresaId, filtros);
      }),

    getDetalleVenta: publicProcedure
      .input(z.object({ pedidoId: z.number() }))
      .query(async ({ input }) => {
        return db.getDetalleVenta(input.pedidoId);
      }),
  }),

  // ============================================
  // REPORTES ROUTER
  // ============================================
  reportes: router({
    getReporteVentas: publicProcedure
      .input(z.object({
        empresaId: z.number(),
        fechaInicio: z.string(),
        fechaFin: z.string(),
      }))
      .query(async ({ input }) => {
        return db.getReporteVentas(
          input.empresaId,
          new Date(input.fechaInicio + "T00:00:00"),
          new Date(input.fechaFin + "T23:59:59")
        );
      }),

    generate: publicProcedure
      .input(z.object({
        empresaId: z.number(),
        tipo: z.enum(["ventas", "productos", "mozos", "diario"]),
        fechaInicio: z.string(),
        fechaFin: z.string(),
      }))
      .query(async ({ input }) => {
        const fechaInicio = new Date(input.fechaInicio + "T00:00:00");
        const fechaFin = new Date(input.fechaFin + "T23:59:59");

        switch (input.tipo) {
          case "ventas":
            return db.getReporteVentasDetallado(input.empresaId, fechaInicio, fechaFin);
          case "productos":
            return db.getReporteProductos(input.empresaId, fechaInicio, fechaFin);
          case "mozos":
            return db.getReporteMozos(input.empresaId, fechaInicio, fechaFin);
          case "diario":
            return db.getReporteDiario(input.empresaId, fechaInicio, fechaFin);
          default:
            return { data: [], summary: null };
        }
      }),
  }),

  // ============================================
  // CONFIGURACION EMPRESA ROUTER
  // ============================================
  configuracion: router({
    updateEmpresa: publicProcedure
      .input(z.object({
        id: z.number(),
        nombre: z.string().min(1).optional(),
        ruc: z.string().nullable().optional(),
        razonSocial: z.string().nullable().optional(),
        direccion: z.string().nullable().optional(),
        telefono: z.string().nullable().optional(),
        email: z.string().nullable().optional(),
        logoUrl: z.string().nullable().optional(),
        impuestoPorcentaje: z.string().optional(),
        moneda: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateEmpresa(id, data);
        return { success: true };
      }),
  }),

  // ============================================
  // BILLING ROUTER
  // ============================================
  billing: router({
    listVentas: publicProcedure
      .input(z.object({ empresaId: z.number() }))
      .query(async ({ input }) => {
        return db.getVentasByEmpresa(input.empresaId);
      }),

    listComprobantes: publicProcedure
      .input(z.object({
        empresaId: z.number(),
        fecha: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return db.getComprobantesByEmpresa(input.empresaId, input.fecha);
      }),

    getComprobante: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getComprobanteById(input.id);
      }),

    consultarComprobante: publicProcedure
      .input(z.object({
        tipo: z.number(),
        serie: z.string(),
        numero: z.number(),
      }))
      .mutation(async ({ input }) => {
        return nubefact.consultarComprobante(input.tipo, input.serie, input.numero);
      }),

    createVenta: publicProcedure
      .input(z.object({
        empresaId: z.number(),
        pedidoId: z.number(),
        clienteId: z.number().optional(),
        total: z.string(),
        subtotal: z.string(),
        igv: z.string(),
      }))
      .mutation(async ({ input }) => {
        return db.createVenta(input);
      }),

    generateComprobante: publicProcedure
      .input(z.object({
        empresaId: z.number(),
        ventaId: z.number(),
        tipo: z.enum(["BOLETA", "FACTURA", "TICKET"]),
        serie: z.string(),
        rucCliente: z.string().optional(),
        nombreCliente: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const venta = await db.getVentaById(input.ventaId);
        if (!venta) throw new Error("Venta no encontrada");

        const items = await db.getItemsByPedido(venta.pedidoId);
        const numero = await db.getNextComprobanteNumero(input.empresaId, input.tipo, input.serie);

        // Obtener configuración de impuesto de la empresa
        const empresa = await db.getEmpresaById(input.empresaId);
        if (!empresa) throw new Error("Empresa no encontrada");

        const igvPorcentaje = parseFloat(empresa.impuestoPorcentaje || "10.50");
        const factorIgv = 1 + (igvPorcentaje / 100); // Ej: 1.105 para 10.5%

        // Si es TICKET, solo guardamos en DB interna
        if (input.tipo === "TICKET") {
          const ticketItems = items.map(item => ({
            descripcion: (item as any).productoNombre || `Producto #${item.productoId}`,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            subtotal: item.subtotal,
            igv: (parseFloat(item.subtotal) * (igvPorcentaje / 100)).toFixed(2),
          }));

          return db.createComprobante({
            empresaId: input.empresaId,
            ventaId: input.ventaId,
            pedidoId: venta.pedidoId,
            clienteId: venta.clienteId,
            tipo: input.tipo,
            serie: input.serie,
            numero,
            rucCliente: input.rucCliente,
          }, ticketItems);
        }

        // --- INTEGRACIÓN CON NUBEFACT ---

        // Mapeo de Items para NubeFact
        let totalItemsGravada = 0;
        let totalItemsIgv = 0;
        let totalItemsTotal = 0;

        const nfItems: nubefact.NubeFactItem[] = items.map(item => {
          const itemTotal = parseFloat(item.subtotal);
          const itemSubtotalSinIgv = Number((itemTotal / factorIgv).toFixed(2));
          const itemIgv = Number((itemTotal - itemSubtotalSinIgv).toFixed(2));
          const valorUnitario = Number((itemSubtotalSinIgv / item.cantidad).toFixed(2));
          const precioUnitario = Number((itemTotal / item.cantidad).toFixed(2));

          totalItemsGravada += itemSubtotalSinIgv;
          totalItemsIgv += itemIgv;
          totalItemsTotal += itemTotal;

          return {
            unidad_de_medida: "ZZ",
            codigo: "",
            descripcion: item.notas ? `${(item as any).productoNombre} (${item.notas})` : ((item as any).productoNombre || `Producto #${item.productoId}`),
            cantidad: item.cantidad,
            valor_unitario: valorUnitario,
            precio_unitario: precioUnitario,
            subtotal: itemSubtotalSinIgv,
            tipo_de_igv: 1,
            igv: itemIgv,
            total: itemTotal,
            anticipo_regularizacion: false,
          };
        });

        const nfRequest: nubefact.NubeFactInvoiceRequest = {
          operacion: "generar_comprobante",
          tipo_de_comprobante: TIPO_NUBEFACT[input.tipo as keyof typeof TIPO_NUBEFACT],
          serie: input.serie,
          numero,
          sunat_transaction: 1,
          cliente_tipo_de_documento: input.tipo === "FACTURA" ? "6" : (input.rucCliente?.length === 8 ? "1" : "0"),
          cliente_numero_de_documento: input.rucCliente || "00000000",
          cliente_denominacion: input.nombreCliente || "PÚBLICO EN GENERAL",
          fecha_de_emision: format(new Date(), "dd-MM-yyyy"),
          moneda: 1, // Soles
          porcentaje_de_igv: igvPorcentaje,
          total_gravada: Number(totalItemsGravada.toFixed(2)),
          total_igv: Number(totalItemsIgv.toFixed(2)),
          total: Number(totalItemsTotal.toFixed(2)),
          items: nfItems,
        };

        try {
          const nfResponse = await nubefact.generarComprobante(nfRequest);

          // Guardar Comprobante en DB con links de NubeFact
          return db.createComprobante({
            empresaId: input.empresaId,
            ventaId: input.ventaId,
            pedidoId: venta.pedidoId,
            clienteId: venta.clienteId,
            tipo: input.tipo,
            serie: input.serie,
            numero,
            rucCliente: input.rucCliente,
            sunatStatus: "ACEPTADO",
            xmlPath: nfResponse.enlace_del_xml,
            pdfPath: nfResponse.enlace_del_pdf,
            cdrPath: nfResponse.enlace_del_cdr,
            sunatResponse: nfResponse.sunat_description,
          }, items.map(item => ({
            descripcion: `Item de Comanda #${venta.pedidoId}`,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            subtotal: item.subtotal,
            igv: (parseFloat(item.subtotal) * 0.18).toFixed(2),
          })));
        } catch (err: any) {
          console.error("NubeFact Error:", err);
          throw new Error(`Error NubeFact: ${err.message || "Error desconocido"}`);
        }
      }),

    generateNota: publicProcedure
      .input(z.object({
        empresaId: z.number(),
        comprobanteId: z.number(),
        tipo: z.enum(["NOTA_CREDITO", "NOTA_DEBITO"]),
        motivo: z.number(),
        sustento: z.string(),
      }))
      .mutation(async ({ input }) => {
        const compRelacionado = await db.getComprobanteById(input.comprobanteId);
        if (!compRelacionado || !compRelacionado.items) throw new Error("Comprobante original no encontrado");

        const venta = await db.getVentaById(compRelacionado.ventaId);
        if (!venta) throw new Error("Venta no encontrada");

        // Usar la misma serie que el comprobante original (F001 o B001)
        // NubeFact suele usar la misma serie pero diferente tipo de comprobante
        const serie = compRelacionado.serie;

        const numero = await db.getNextComprobanteNumero(input.empresaId, input.tipo, serie);

        // Obtener configuración de impuesto de la empresa
        const empresa = await db.getEmpresaById(input.empresaId);
        if (!empresa) throw new Error("Empresa no encontrada");

        const igvPorcentaje = parseFloat(empresa.impuestoPorcentaje || "10.50");
        const factorIgv = 1 + (igvPorcentaje / 100); // Ej: 1.105 para 10.5%

        const nfItems: nubefact.NubeFactItem[] = compRelacionado.items.map(item => {
          const total = parseFloat(item.subtotal);
          const precioUnitario = parseFloat(item.precioUnitario);
          const valorUnitario = precioUnitario / factorIgv;
          const subtotalSinIgv = total / factorIgv;
          const igv = total - subtotalSinIgv;

          return {
            unidad_de_medida: "ZZ",
            codigo: "NOT01",
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            valor_unitario: Number(valorUnitario.toFixed(2)),
            precio_unitario: Number(precioUnitario.toFixed(2)),
            subtotal: Number(subtotalSinIgv.toFixed(2)),
            tipo_de_igv: 1,
            igv: Number(igv.toFixed(2)),
            total: Number(total.toFixed(2)),
            anticipo_regularizacion: false,
          };
        });

        const totalNum = parseFloat(venta.total);
        const subtotalNum = parseFloat(venta.subtotal);
        const igvTotalNum = parseFloat(venta.igv);

        const nfRequest: nubefact.NubeFactInvoiceRequest = {
          operacion: "generar_comprobante",
          tipo_de_comprobante: TIPO_NUBEFACT[input.tipo as keyof typeof TIPO_NUBEFACT],
          serie,
          numero,
          sunat_transaction: 1,
          cliente_tipo_de_documento: compRelacionado.rucCliente?.length === 11 ? "6" : (compRelacionado.rucCliente?.length === 8 ? "1" : "0"),
          cliente_numero_de_documento: compRelacionado.rucCliente || "00000000",
          cliente_denominacion: "CLIENTE",
          fecha_de_emision: format(new Date(), "dd-MM-yyyy"),
          moneda: 1,
          porcentaje_de_igv: igvPorcentaje,
          total_gravada: Number(subtotalNum.toFixed(2)),
          total_igv: Number(igvTotalNum.toFixed(2)),
          total: Number(totalNum.toFixed(2)),
          documento_que_se_modifica_tipo: compRelacionado.tipo === "FACTURA" ? 1 : 2,
          documento_que_se_modifica_serie: compRelacionado.serie,
          documento_que_se_modifica_numero: compRelacionado.numero,
          tipo_de_nota_de_credito: input.tipo === "NOTA_CREDITO" ? Number(input.motivo) : undefined,
          tipo_de_nota_de_debito: input.tipo === "NOTA_DEBITO" ? Number(input.motivo) : undefined,
          items: nfItems,
        };

        try {
          const nfResponse = await nubefact.generarComprobante(nfRequest);

          return db.createComprobante({
            empresaId: input.empresaId,
            ventaId: venta.id,
            pedidoId: venta.pedidoId,
            clienteId: venta.clienteId,
            tipo: input.tipo,
            serie,
            numero,
            rucCliente: compRelacionado.rucCliente,
            sunatStatus: "ACEPTADO",
            xmlPath: nfResponse.enlace_del_xml,
            pdfPath: nfResponse.enlace_del_pdf,
            cdrPath: nfResponse.enlace_del_cdr,
            sunatResponse: nfResponse.sunat_description,
          }, compRelacionado.items.map(item => ({
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            subtotal: item.subtotal,
            igv: item.igv,
          })));
        } catch (err: any) {
          console.error("NubeFact Error:", err);
          throw new Error(`Error NubeFact: ${err.message || "Error desconocido"}`);
        }
      }),

    deleteComprobante: publicProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input }) => {
        return db.deleteComprobante(input.id);
      }),

    anularComprobante: publicProcedure
      .input(z.object({
        empresaId: z.number(),
        comprobanteId: z.number(),
        motivo: z.string(),
      }))
      .mutation(async ({ input }) => {
        const comprobante = await db.getComprobanteById(input.comprobanteId);
        if (!comprobante) throw new Error("Comprobante no encontrado");

        // Solo se pueden dar de baja facturas y boletas
        const tipoNubeFact = TIPO_NUBEFACT[comprobante.tipo as keyof typeof TIPO_NUBEFACT];
        if (!tipoNubeFact || (tipoNubeFact !== 1 && tipoNubeFact !== 2)) {
          throw new Error("Solo se pueden anular Facturas y Boletas directamente.");
        }

        const nfRequest: nubefact.NubeFactAnulacionRequest = {
          operacion: "generar_anulacion",
          tipo_de_comprobante: tipoNubeFact,
          serie: comprobante.serie,
          numero: comprobante.numero,
          motivo: input.motivo,
        };

        try {
          const nfResponse = await nubefact.anularComprobante(nfRequest);

          // Actualizar estado en DB
          await db.updateComprobanteStatus(
            comprobante.id,
            "ANULADO",
            nfResponse.sunat_description || "Comunicación de Baja Enviada"
          );

          return { success: true, message: nfResponse.sunat_description };
        } catch (err: any) {
          console.error("NubeFact Anulacion Error:", err);
          throw new Error(`Error al anular: ${err.message || "Error desconocido"}`);
        }
      }),

    consultarEntidad: publicProcedure
      .input(z.object({
        numero: z.string().min(8).max(11),
      }))
      .mutation(async ({ input }) => {
        try {
          return await nubefact.consultarEntidad(input.numero);
        } catch (error: any) {
          throw new Error(error.message);
        }
      }),

    listVentasHistorial: publicProcedure
      .input(z.object({ empresaId: z.number() }))
      .query(async ({ input }) => {
        return db.getVentasHistorial(input.empresaId);
      }),

    anularVenta: publicProcedure
      .input(z.object({
        ventaId: z.number(),
        motivo: z.string(),
      }))
      .mutation(async ({ input }) => {
        const venta = await db.getVentaById(input.ventaId);
        if (!venta) throw new Error("Venta no encontrada");

        // Anular Comprobante
        const comprobante = await db.getComprobanteByVentaId(input.ventaId);
        if (comprobante && comprobante.sunatStatus !== "ANULADO") {
          // @ts-ignore
          const tipoNubeFact = TIPO_NUBEFACT[comprobante.tipo as any];

          if (tipoNubeFact === 1 || tipoNubeFact === 2) {
            try {
              const nfRequest: nubefact.NubeFactAnulacionRequest = {
                operacion: "generar_anulacion",
                tipo_de_comprobante: tipoNubeFact,
                serie: comprobante.serie,
                numero: comprobante.numero,
                motivo: input.motivo,
              };
              const nfResponse = await nubefact.anularComprobante(nfRequest);

              await db.updateComprobanteStatus(
                comprobante.id,
                "ANULADO",
                nfResponse.sunat_description || "Anulado Exitosamente"
              );
            } catch (e: any) {
              console.error("Error anulando en NubeFact:", e);
              throw new Error(`Error NubeFact: ${e.message}`);
            }
          } else {
            await db.updateComprobanteStatus(comprobante.id, "ANULADO", "Anulado Localmente");
          }
        }

        const pedido = await db.getPedidoById(venta.pedidoId);

        await db.anularVenta(input.ventaId);
        await db.restaurarPedido(venta.pedidoId);

        return { success: true, mesaId: pedido?.mesaId };
      }),

    getVentaDetails: publicProcedure
      .input(z.object({ ventaId: z.number() }))
      .query(async ({ input }) => {
        return db.getVentaItems(input.ventaId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
