CREATE TABLE `categorias` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`nombre` varchar(255) NOT NULL,
	`descripcion` text,
	`orden` int DEFAULT 0,
	`activa` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categorias_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clientes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`nombre` varchar(255) NOT NULL,
	`apellido` varchar(255),
	`email` varchar(255),
	`telefono` varchar(20),
	`dni` varchar(8),
	`ruc` varchar(11),
	`direccion` text,
	`tipoCliente` varchar(50) DEFAULT 'CONSUMIDOR_FINAL',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `clientes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `comprobantes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`pedidoId` int NOT NULL,
	`clienteId` int,
	`tipo` enum('BOLETA','FACTURA','TICKET') NOT NULL,
	`numeroSerie` varchar(50),
	`numeroComprobante` varchar(50),
	`rucCliente` varchar(11),
	`montoTotal` decimal(10,2) NOT NULL,
	`fechaEmision` timestamp DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `comprobantes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `empleados` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`nombre` varchar(255) NOT NULL,
	`apellido` varchar(255),
	`pin` varchar(4) NOT NULL,
	`userRole` enum('MOZO','CAJERO','DUENO','ADMIN') NOT NULL DEFAULT 'MOZO',
	`activo` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `empleados_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `empresas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nombre` varchar(255) NOT NULL,
	`ruc` varchar(11),
	`razonSocial` varchar(255),
	`direccion` text,
	`telefono` varchar(20),
	`email` varchar(255),
	`logoUrl` text,
	`activa` boolean DEFAULT true,
	`impuestoPorcentaje` decimal(5,2) DEFAULT '18.00',
	`moneda` varchar(3) DEFAULT 'PEN',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `empresas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `itemsPedido` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pedidoId` int NOT NULL,
	`productoId` int NOT NULL,
	`cantidad` int NOT NULL DEFAULT 1,
	`precioUnitario` decimal(10,2) NOT NULL,
	`subtotal` decimal(10,2) NOT NULL,
	`notas` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `itemsPedido_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mesas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`numero` int NOT NULL,
	`capacidad` int NOT NULL DEFAULT 4,
	`tableStatus` enum('DISPONIBLE','OCUPADA','PIDIENDO_CUENTA','RESERVADA') DEFAULT 'DISPONIBLE',
	`mozoAsignadoId` int,
	`personas` int DEFAULT 0,
	`fechaOcupacion` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mesas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pagos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`pedidoId` int NOT NULL,
	`clienteId` int,
	`cajeroId` int NOT NULL,
	`paymentMethod` enum('EFECTIVO','TARJETA','YAPE','PLIN','TRANSFERENCIA') NOT NULL,
	`paymentStatus` enum('PENDIENTE','PAGADO','PARCIAL','CANCELADO') DEFAULT 'PENDIENTE',
	`monto` decimal(10,2) NOT NULL,
	`montoPagado` decimal(10,2) DEFAULT '0',
	`vuelto` decimal(10,2) DEFAULT '0',
	`referenciaPago` varchar(255),
	`fechaPago` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pagos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pedidos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`mesaId` int NOT NULL,
	`mozoId` int NOT NULL,
	`orderStatus` enum('PENDIENTE','PREPARANDO','LISTO','ENTREGADO','CANCELADO') DEFAULT 'PENDIENTE',
	`subtotal` decimal(10,2) DEFAULT '0',
	`impuesto` decimal(10,2) DEFAULT '0',
	`total` decimal(10,2) DEFAULT '0',
	`notas` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pedidos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `productos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`categoriaId` int NOT NULL,
	`nombre` varchar(255) NOT NULL,
	`descripcion` text,
	`precio` decimal(10,2) NOT NULL,
	`precioCosto` decimal(10,2),
	`stock` int DEFAULT 0,
	`stockMinimo` int DEFAULT 5,
	`imagenUrl` text,
	`activo` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `productos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`empresaId` int,
	`nombre` varchar(255) NOT NULL,
	`apellido` varchar(255),
	`email` varchar(320),
	`pinHash` varchar(255),
	`userRole` enum('MOZO','CAJERO','DUENO','ADMIN') NOT NULL DEFAULT 'MOZO',
	`activo` boolean DEFAULT true,
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`ultimoLogin` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
ALTER TABLE `categorias` ADD CONSTRAINT `categorias_empresaId_empresas_id_fk` FOREIGN KEY (`empresaId`) REFERENCES `empresas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clientes` ADD CONSTRAINT `clientes_empresaId_empresas_id_fk` FOREIGN KEY (`empresaId`) REFERENCES `empresas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comprobantes` ADD CONSTRAINT `comprobantes_empresaId_empresas_id_fk` FOREIGN KEY (`empresaId`) REFERENCES `empresas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comprobantes` ADD CONSTRAINT `comprobantes_pedidoId_pedidos_id_fk` FOREIGN KEY (`pedidoId`) REFERENCES `pedidos`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comprobantes` ADD CONSTRAINT `comprobantes_clienteId_clientes_id_fk` FOREIGN KEY (`clienteId`) REFERENCES `clientes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `empleados` ADD CONSTRAINT `empleados_empresaId_empresas_id_fk` FOREIGN KEY (`empresaId`) REFERENCES `empresas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `itemsPedido` ADD CONSTRAINT `itemsPedido_pedidoId_pedidos_id_fk` FOREIGN KEY (`pedidoId`) REFERENCES `pedidos`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `itemsPedido` ADD CONSTRAINT `itemsPedido_productoId_productos_id_fk` FOREIGN KEY (`productoId`) REFERENCES `productos`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mesas` ADD CONSTRAINT `mesas_empresaId_empresas_id_fk` FOREIGN KEY (`empresaId`) REFERENCES `empresas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mesas` ADD CONSTRAINT `mesas_mozoAsignadoId_empleados_id_fk` FOREIGN KEY (`mozoAsignadoId`) REFERENCES `empleados`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pagos` ADD CONSTRAINT `pagos_empresaId_empresas_id_fk` FOREIGN KEY (`empresaId`) REFERENCES `empresas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pagos` ADD CONSTRAINT `pagos_pedidoId_pedidos_id_fk` FOREIGN KEY (`pedidoId`) REFERENCES `pedidos`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pagos` ADD CONSTRAINT `pagos_clienteId_clientes_id_fk` FOREIGN KEY (`clienteId`) REFERENCES `clientes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pagos` ADD CONSTRAINT `pagos_cajeroId_empleados_id_fk` FOREIGN KEY (`cajeroId`) REFERENCES `empleados`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pedidos` ADD CONSTRAINT `pedidos_empresaId_empresas_id_fk` FOREIGN KEY (`empresaId`) REFERENCES `empresas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pedidos` ADD CONSTRAINT `pedidos_mesaId_mesas_id_fk` FOREIGN KEY (`mesaId`) REFERENCES `mesas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pedidos` ADD CONSTRAINT `pedidos_mozoId_empleados_id_fk` FOREIGN KEY (`mozoId`) REFERENCES `empleados`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `productos` ADD CONSTRAINT `productos_empresaId_empresas_id_fk` FOREIGN KEY (`empresaId`) REFERENCES `empresas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `productos` ADD CONSTRAINT `productos_categoriaId_categorias_id_fk` FOREIGN KEY (`categoriaId`) REFERENCES `categorias`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_empresaId_empresas_id_fk` FOREIGN KEY (`empresaId`) REFERENCES `empresas`(`id`) ON DELETE no action ON UPDATE no action;