# ✅ Verificación de IGV 10.5% - NubeFact

## 📋 Pasos para Verificar

### 1️⃣ Verificar Configuración de Empresa
1. Ir a **Dashboard** → **Configuración de Empresa**
2. Verificar que el **IGV esté en 10.50%**
3. Si no lo está, cambiarlo y guardar

### 2️⃣ Crear Pedido de Prueba
1. Ir a **Vista de Mozo**
2. Seleccionar una **mesa disponible**
3. Ocupar la mesa (ej: 2 personas)
4. Agregar productos al pedido:
   - Ejemplo: 2x Ceviche (S/ 42.00 c/u) = S/ 84.00
   - Ejemplo: 1x Arroz con Pollo (S/ 49.00) = S/ 49.00
5. **Confirmar Pedido**

### 3️⃣ Procesar Pago
1. Ir a **Vista de Cajero**
2. Seleccionar la mesa con el pedido
3. Clic en **"Cobrar"**
4. Verificar los montos:
   ```
   Subtotal (Base): S/ 120.36  (133.00 / 1.105)
   IGV (10.5%):     S/ 12.64   (120.36 * 0.105)
   Total:           S/ 133.00
   ```
5. Seleccionar método de pago (ej: Efectivo)
6. **Confirmar Pago**

### 4️⃣ Generar Boleta en NubeFact
1. En el diálogo de pago, seleccionar **"BOLETA"**
2. Dejar cliente como "PÚBLICO EN GENERAL" o ingresar DNI
3. Clic en **"Confirmar Pago"**
4. El sistema generará la boleta en NubeFact

### 5️⃣ Verificar Resultado
1. **En tu sistema:**
   - Total mostrado: S/ 133.00
   - IGV calculado: S/ 12.64 (10.5%)

2. **En NubeFact:**
   - Ir a tu panel de NubeFact
   - Buscar la última boleta generada
   - Verificar que:
     - **Base Imponible**: S/ 120.36
     - **IGV (10.5%)**: S/ 12.64
     - **Total**: S/ 133.00

### ✅ Resultado Esperado
Los montos deben **coincidir exactamente** entre tu sistema y NubeFact.

---

## 🔍 Cálculos de Referencia

### Ejemplo con S/ 155.76 (tu caso anterior)
```
Total con IGV:     S/ 155.76
Base sin IGV:      S/ 140.96  (155.76 / 1.105)
IGV 10.5%:         S/ 14.80   (140.96 * 0.105)
Verificación:      S/ 155.76  (140.96 + 14.80) ✓
```

### Ejemplo con S/ 133.00
```
Total con IGV:     S/ 133.00
Base sin IGV:      S/ 120.36  (133.00 / 1.105)
IGV 10.5%:         S/ 12.64   (120.36 * 0.105)
Verificación:      S/ 133.00  (120.36 + 12.64) ✓
```

---

## 🐛 Si los Montos NO Coinciden

1. **Verificar en Configuración de Empresa:**
   - El IGV debe estar en **10.50%**

2. **Verificar en NubeFact:**
   - Panel → Configuración → IGV debe estar en **10.5%**

3. **Reiniciar el servidor:**
   ```bash
   # Detener
   Ctrl + C en la terminal del servidor
   
   # Iniciar
   pnpm dev
   ```

4. **Limpiar caché del navegador:**
   - Ctrl + Shift + R (recarga forzada)

---

## 📊 Comparación Antes vs Ahora

### ❌ ANTES (con bug)
- Sistema: S/ 155.76 (IGV 10.5%)
- NubeFact: S/ 139.85 (calculaba con IGV 18%)
- **NO COINCIDÍAN** ❌

### ✅ AHORA (corregido)
- Sistema: S/ 155.76 (IGV 10.5%)
- NubeFact: S/ 155.76 (IGV 10.5%)
- **COINCIDEN PERFECTAMENTE** ✅

---

## 🎯 Notas Importantes

1. **El IGV es configurable** por el dueño desde "Configuración de Empresa"
2. **Si SUNAT cambia el IGV**, solo actualiza el porcentaje en la configuración
3. **Todos los cálculos** (Tickets, Boletas, Facturas, Notas de Crédito) usan el IGV dinámico
4. **NubeFact debe estar configurado** con el mismo IGV (10.5%)
