import { useState, useMemo } from "react";
import { usePOS } from "@/features/auth/contexts/POSContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/forms/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/display/card";
import { Input } from "@/components/ui/forms/input";
import { Label } from "@/components/ui/forms/label";
import { Badge } from "@/components/ui/display/badge";
import { BottomNavigation } from "@/components/layout/BottomNavigation";
import { useLocation } from "wouter";
import { 
  ArrowLeft, FileSpreadsheet, FileText, Download, 
  Calendar, TrendingUp, DollarSign, Package, Users, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

type ReportType = "ventas" | "productos" | "mozos" | "diario";
type FilterPreset = "hoy" | "semana" | "mes" | "custom";

export default function Reportes() {
  const { empleado, empresa } = usePOS();
  const [, setLocation] = useLocation();
  const [filterPreset, setFilterPreset] = useState<FilterPreset>("mes");
  const [fechaInicio, setFechaInicio] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [fechaFin, setFechaFin] = useState(format(new Date(), "yyyy-MM-dd"));
  const [reportType, setReportType] = useState<ReportType>("ventas");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Calcular fechas según preset
  const fechasCalculadas = useMemo(() => {
    const hoy = new Date();
    switch (filterPreset) {
      case "hoy":
        return { inicio: format(hoy, "yyyy-MM-dd"), fin: format(hoy, "yyyy-MM-dd") };
      case "semana":
        return { inicio: format(subDays(hoy, 7), "yyyy-MM-dd"), fin: format(hoy, "yyyy-MM-dd") };
      case "mes":
        return { inicio: format(startOfMonth(hoy), "yyyy-MM-dd"), fin: format(hoy, "yyyy-MM-dd") };
      default:
        return { inicio: fechaInicio, fin: fechaFin };
    }
  }, [filterPreset, fechaInicio, fechaFin]);

  const { data: reportData, refetch, isLoading } = trpc.reportes.generate.useQuery(
    { 
      empresaId: empleado?.empresaId || 0,
      tipo: reportType,
      fechaInicio: fechasCalculadas.inicio,
      fechaFin: fechasCalculadas.fin,
    },
    { enabled: false }
  );

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return `S/ ${num.toFixed(2)}`;
  };

  const handlePresetChange = (preset: FilterPreset) => {
    setFilterPreset(preset);
    const hoy = new Date();
    switch (preset) {
      case "hoy":
        setFechaInicio(format(hoy, "yyyy-MM-dd"));
        setFechaFin(format(hoy, "yyyy-MM-dd"));
        break;
      case "semana":
        setFechaInicio(format(subDays(hoy, 7), "yyyy-MM-dd"));
        setFechaFin(format(hoy, "yyyy-MM-dd"));
        break;
      case "mes":
        setFechaInicio(format(startOfMonth(hoy), "yyyy-MM-dd"));
        setFechaFin(format(hoy, "yyyy-MM-dd"));
        break;
    }
  };

  // Función para generar y descargar CSV/Excel
  const generateAndDownloadCSV = (data: any[], headers: string[], filename: string) => {
    try {
      // Crear contenido CSV con BOM para Excel
      const headerRow = headers.join(",");
      const dataRows = data.map(row => {
        return headers.map(h => {
          const key = h.toLowerCase().replace(/ /g, "_");
          let value = row[key] ?? "";
          // Formatear valores numéricos
          if (typeof value === "number") {
            value = value.toString();
          }
          // Escapar comillas y valores con comas
          if (typeof value === "string" && (value.includes(",") || value.includes('"') || value.includes("\n"))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(",");
      });
      
      const csvContent = [headerRow, ...dataRows].join("\n");
      
      // Crear Blob con BOM para que Excel reconozca UTF-8
      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
      
      // Crear link y descargar
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${filename}_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error("Error generando CSV:", error);
      return false;
    }
  };

  // Función para generar y descargar PDF
  const generateAndDownloadPDF = (title: string, data: any[], headers: string[]) => {
    try {
      const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Arial, sans-serif; 
      padding: 30px; 
      background: white;
      color: #333;
    }
    .header { 
      border-bottom: 3px solid #007BFF; 
      padding-bottom: 20px; 
      margin-bottom: 25px;
    }
    .header h1 { 
      color: #007BFF; 
      font-size: 24px; 
      margin-bottom: 5px;
    }
    .header .subtitle { 
      color: #666; 
      font-size: 14px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin-bottom: 25px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 8px;
    }
    .info-item label {
      font-size: 11px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .info-item p {
      font-size: 14px;
      font-weight: 600;
      color: #333;
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-top: 15px;
      font-size: 12px;
    }
    th { 
      background: #007BFF; 
      color: white; 
      padding: 12px 10px; 
      text-align: left;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
    }
    td { 
      padding: 10px; 
      border-bottom: 1px solid #e9ecef;
    }
    tr:nth-child(even) { 
      background: #f8f9fa; 
    }
    tr:hover {
      background: #e3f2fd;
    }
    .summary {
      margin-top: 25px;
      padding: 20px;
      background: linear-gradient(135deg, #007BFF 0%, #0056b3 100%);
      border-radius: 8px;
      color: white;
    }
    .summary h3 {
      font-size: 14px;
      margin-bottom: 10px;
      opacity: 0.9;
    }
    .summary .total {
      font-size: 28px;
      font-weight: bold;
    }
    .footer { 
      margin-top: 40px; 
      padding-top: 20px;
      border-top: 1px solid #e9ecef;
      text-align: center; 
      color: #999; 
      font-size: 11px;
    }
    @media print {
      body { padding: 15px; }
      .header { page-break-after: avoid; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <p class="subtitle">Reporte generado por Comanda Maestra</p>
  </div>
  
  <div class="info-grid">
    <div class="info-item">
      <label>Empresa</label>
      <p>${empresa?.nombre || "N/A"}</p>
    </div>
    <div class="info-item">
      <label>RUC</label>
      <p>${empresa?.ruc || "N/A"}</p>
    </div>
    <div class="info-item">
      <label>Período</label>
      <p>${format(new Date(fechasCalculadas.inicio), "dd/MM/yyyy")} - ${format(new Date(fechasCalculadas.fin), "dd/MM/yyyy")}</p>
    </div>
    <div class="info-item">
      <label>Fecha de generación</label>
      <p>${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        ${headers.map(h => `<th>${h.replace(/_/g, " ")}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${data.map(row => `
        <tr>
          ${headers.map(h => {
            const key = h.toLowerCase().replace(/ /g, "_");
            let value = row[key] ?? "-";
            // Formatear montos
            if (key.includes("total") || key.includes("subtotal") || key.includes("ingresos") || key.includes("promedio")) {
              if (typeof value === "number" || !isNaN(parseFloat(value))) {
                value = `S/ ${parseFloat(value).toFixed(2)}`;
              }
            }
            return `<td>${value}</td>`;
          }).join("")}
        </tr>
      `).join("")}
    </tbody>
  </table>

  <div class="summary">
    <h3>TOTAL DEL PERÍODO</h3>
    <p class="total">${formatCurrency(data.reduce((sum, row) => {
      const totalKey = headers.find(h => h.toLowerCase().includes("total"))?.toLowerCase().replace(/ /g, "_");
      return sum + (parseFloat(row[totalKey || "total"] || "0") || 0);
    }, 0))}</p>
  </div>

  <div class="footer">
    <p>Comanda Maestra - Sistema POS Profesional</p>
    <p>Este documento fue generado automáticamente y no requiere firma.</p>
  </div>
</body>
</html>`;

      // Crear Blob y abrir en nueva ventana para imprimir
      const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      
      // Abrir ventana de impresión
      const printWindow = window.open(url, "_blank", "width=800,height=600");
      
      if (printWindow) {
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 500);
        };
        return true;
      } else {
        // Si no se puede abrir ventana, descargar como HTML
        const link = document.createElement("a");
        link.href = url;
        link.download = `${title.replace(/ /g, "_")}_${format(new Date(), "yyyyMMdd")}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.info("Archivo HTML descargado. Ábrelo y usa Ctrl+P para imprimir como PDF.");
        return true;
      }
    } catch (error) {
      console.error("Error generando PDF:", error);
      return false;
    }
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const result = await refetch();
      if (result.data && result.data.data && result.data.data.length > 0) {
        toast.success(`Reporte generado: ${result.data.data.length} registros encontrados`);
      } else {
        toast.info("No hay datos para el período seleccionado");
      }
    } catch (error) {
      toast.error("Error al generar reporte");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportCSV = async () => {
    if (!reportData?.data || reportData.data.length === 0) {
      toast.error("Primero genera el reporte antes de exportar");
      return;
    }

    setIsExporting(true);
    try {
      const headers = getHeaders(reportType);
      const success = generateAndDownloadCSV(reportData.data, headers, `reporte_${reportType}`);
      
      if (success) {
        toast.success("Archivo CSV descargado correctamente");
      } else {
        toast.error("Error al generar el archivo CSV");
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!reportData?.data || reportData.data.length === 0) {
      toast.error("Primero genera el reporte antes de exportar");
      return;
    }

    setIsExporting(true);
    try {
      const headers = getHeaders(reportType);
      const title = getReportTitle(reportType);
      const success = generateAndDownloadPDF(title, reportData.data, headers);
      
      if (success) {
        toast.success("PDF listo para imprimir");
      } else {
        toast.error("Error al generar el PDF");
      }
    } finally {
      setIsExporting(false);
    }
  };

  const getHeaders = (type: ReportType): string[] => {
    switch (type) {
      case "ventas":
        return ["Fecha", "Mesa", "Mozo", "Subtotal", "IGV", "Total", "Metodo_Pago"];
      case "productos":
        return ["Producto", "Categoria", "Cantidad_Vendida", "Ingresos_Total"];
      case "mozos":
        return ["Mozo", "Pedidos_Atendidos", "Total_Ventas", "Ticket_Promedio"];
      case "diario":
        return ["Fecha", "Total_Pedidos", "Total_Ventas", "Ticket_Promedio"];
      default:
        return [];
    }
  };

  const getReportTitle = (type: ReportType): string => {
    switch (type) {
      case "ventas":
        return "Reporte de Ventas";
      case "productos":
        return "Reporte de Productos Vendidos";
      case "mozos":
        return "Reporte de Rendimiento por Mozo";
      case "diario":
        return "Reporte de Ventas Diarias";
      default:
        return "Reporte";
    }
  };

  const reportTypes = [
    { 
      value: "ventas", 
      label: "Ventas Detalladas", 
      icon: DollarSign,
      description: "Listado completo de ventas con detalles de pago"
    },
    { 
      value: "productos", 
      label: "Productos Vendidos", 
      icon: Package,
      description: "Ranking de productos más vendidos"
    },
    { 
      value: "mozos", 
      label: "Rendimiento por Mozo", 
      icon: Users,
      description: "Estadísticas de ventas por empleado"
    },
    { 
      value: "diario", 
      label: "Ventas Diarias", 
      icon: TrendingUp,
      description: "Resumen de ventas por día"
    },
  ];

  if (!empleado || !["DUENO", "ADMIN"].includes(empleado.rol)) {
    setLocation("/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setLocation("/dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Reportes</h1>
            <p className="text-sm text-muted-foreground">Exporta datos para análisis contable</p>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Filtros rápidos de fecha */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { id: "hoy" as FilterPreset, label: "Hoy" },
            { id: "semana" as FilterPreset, label: "Última semana" },
            { id: "mes" as FilterPreset, label: "Este mes" },
            { id: "custom" as FilterPreset, label: "Personalizado" },
          ].map((preset) => (
            <Button
              key={preset.id}
              variant={filterPreset === preset.id ? "default" : "outline"}
              size="sm"
              onClick={() => handlePresetChange(preset.id)}
              className="whitespace-nowrap"
            >
              {preset.label}
            </Button>
          ))}
        </div>

        {/* Selector de tipo de reporte */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tipo de Reporte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {reportTypes.map((type) => {
              const Icon = type.icon;
              const isSelected = reportType === type.value;
              return (
                <button
                  key={type.value}
                  onClick={() => setReportType(type.value as ReportType)}
                  className={cn(
                    "w-full p-3 rounded-lg border transition-all text-left",
                    isSelected 
                      ? "border-primary bg-primary/10" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg",
                      isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className={cn(
                        "font-medium",
                        isSelected ? "text-primary" : "text-foreground"
                      )}>
                        {type.label}
                      </p>
                      <p className="text-xs text-muted-foreground">{type.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Filtros de fecha personalizados */}
        {filterPreset === "custom" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Período Personalizado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fechaInicio">Fecha Inicio</Label>
                  <Input
                    id="fechaInicio"
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fechaFin">Fecha Fin</Label>
                  <Input
                    id="fechaFin"
                    type="date"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Botón generar */}
        <Button 
          className="w-full h-12 text-lg" 
          onClick={handleGenerateReport}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Generando...
            </>
          ) : (
            <>
              <TrendingUp className="h-5 w-5 mr-2" />
              Generar Reporte
            </>
          )}
        </Button>

        {/* Resultados y exportación */}
        {reportData && (
          <Card className="border-primary/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{getReportTitle(reportType)}</CardTitle>
                  <CardDescription>
                    {reportData.data?.length || 0} registros encontrados
                  </CardDescription>
                </div>
                {reportData.summary && (
                  <Badge variant="default" className="text-lg px-4 py-2 bg-primary">
                    {formatCurrency(reportData.summary.total || 0)}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Resumen */}
              {reportData.summary && (
                <div className="grid grid-cols-2 gap-3">
                  {"totalPedidos" in reportData.summary && reportData.summary.totalPedidos && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">Total Pedidos</p>
                      <p className="text-lg font-bold">{(reportData.summary as any).totalPedidos}</p>
                    </div>
                  )}
                  {"ticketPromedio" in reportData.summary && reportData.summary.ticketPromedio && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">Ticket Promedio</p>
                      <p className="text-lg font-bold">{formatCurrency((reportData.summary as any).ticketPromedio)}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Botones de exportación */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button
                  variant="outline"
                  className="gap-2 h-12"
                  onClick={handleExportCSV}
                  disabled={!reportData.data || reportData.data.length === 0 || isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4" />
                  )}
                  Descargar Excel
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 h-12"
                  onClick={handleExportPDF}
                  disabled={!reportData.data || reportData.data.length === 0 || isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  Imprimir PDF
                </Button>
              </div>

              {/* Preview de datos */}
              {reportData.data && reportData.data.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground mb-2">Vista previa (primeros 5 registros):</p>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted">
                          {getHeaders(reportType).slice(0, 4).map((h) => (
                            <th key={h} className="text-left py-2 px-3 font-medium">
                              {h.replace(/_/g, " ")}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.data.slice(0, 5).map((row: any, idx: number) => (
                          <tr key={idx} className="border-t border-border/50">
                            {getHeaders(reportType).slice(0, 4).map((h) => {
                              const key = h.toLowerCase().replace(/ /g, "_");
                              return (
                                <td key={h} className="py-2 px-3 text-muted-foreground">
                                  {row[key] ?? "-"}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Info */}
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Download className="h-5 w-5 text-primary mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Formatos de exportación</p>
                <p><strong>Excel (CSV):</strong> Se descarga automáticamente. Compatible con Excel, Google Sheets y software contable.</p>
                <p className="mt-1"><strong>PDF:</strong> Se abre una ventana de impresión. Selecciona "Guardar como PDF" en las opciones de impresora.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      <BottomNavigation />
    </div>
  );
}
