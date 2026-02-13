import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { usePOS } from "@/features/auth/contexts/POSContext";
import { BottomNavigation } from "@/components/layout/BottomNavigation";
import { Button } from "@/components/ui/forms/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/display/card";
import { Input } from "@/components/ui/forms/input";
import { Badge } from "@/components/ui/display/badge";
import {
    FileText, Search, Filter, Download, ExternalLink,
    CheckCircle2, Clock, AlertCircle, ShoppingBag,
    ArrowLeft, FileJson, FileCode, RefreshCw, Trash2, X, AlertTriangle
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/overlays/dialog";
import { Textarea } from "@/components/ui/forms/textarea";
import { Label } from "@/components/ui/forms/label";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function InvoicesPage() {
    const [, navigate] = useLocation();
    const { empleado, empresa } = usePOS();
    const [searchTerm, setSearchTerm] = useState("");
    const [fecha, setFecha] = useState<string>("");
    const [anularComprobante, setAnularComprobante] = useState<any>(null);
    const [motivoAnulacion, setMotivoAnulacion] = useState("");
    const [showAnularDialog, setShowAnularDialog] = useState(false);

    const { data: comprobantes, isLoading, refetch } = trpc.billing.listComprobantes.useQuery(
        {
            empresaId: empresa?.id || 0,
            fecha: fecha || undefined
        },
        { enabled: !!empresa?.id }
    );

    const consultarMutation = trpc.billing.consultarComprobante.useMutation();
    const notaCreditoMutation = trpc.billing.generateNota.useMutation();
    const anularMutation = trpc.billing.anularComprobante.useMutation();
    const deleteMutation = trpc.billing.deleteComprobante.useMutation();

    const handleConsultar = async (c: any) => {
        try {
            const tipoNum = c.tipo === "FACTURA" ? 1 :
                c.tipo === "BOLETA" ? 3 :
                    c.tipo === "NOTA_CREDITO" ? 4 : 5;

            const res = await consultarMutation.mutateAsync({
                tipo: tipoNum,
                serie: c.serie,
                numero: c.numero
            });

            toast.info(`Estado SUNAT: ${res.sunat_description}`);
        } catch (error) {
            toast.error("Error al consultar comprobante");
        }
    };

    const handleOpenAnular = (c: any) => {
        setAnularComprobante(c);
        setMotivoAnulacion("ERROR EN LA EMISION");
        setShowAnularDialog(true);
    };

    const confirmAnular = async () => {
        if (!anularComprobante) return;
        if (!motivoAnulacion.trim()) {
            toast.error("El motivo es obligatorio");
            return;
        }

        try {
            await anularMutation.mutateAsync({
                empresaId: empresa?.id || 0,
                comprobanteId: anularComprobante.id,
                motivo: motivoAnulacion
            });
            toast.success("Comunicación de Baja enviada correctamente");
            setShowAnularDialog(false);
            refetch();
        } catch (error: any) {
            toast.error(error.message || "Error al anular comprobante");
        }
    };


    const handleEliminarLocal = async (c: any) => {
        if (!confirm("¿Deseas eliminar este registro SOLO del sistema local? Úsalo solo si ya lo borraste en NubeFact.")) return;

        try {
            await deleteMutation.mutateAsync({ id: c.id });
            toast.success("Registro eliminado localmente");
            refetch();
        } catch (error) {
            toast.error("Error al eliminar registro");
        }
    };

    const filteredComprobantes = comprobantes?.filter(c =>
        c.serie.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.numero.toString().includes(searchTerm) ||
        c.rucCliente?.includes(searchTerm)
    );

    const getStatusBadge = (status: string | null) => {
        switch (status) {
            case "ACEPTADO":
                return <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/50">Aceptado</Badge>;
            case "PENDIENTE":
                return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/50">Pendiente</Badge>;
            case "RECHAZADO":
                return <Badge className="bg-rose-500/20 text-rose-500 border-rose-500/50">Rechazado</Badge>;
            case "ANULADO":
                return <Badge className="bg-slate-500/20 text-slate-500 border-slate-500/50">Anulado</Badge>;
            default:
                return <Badge variant="outline">Desconocido</Badge>;
        }
    };

    const getStatusIcon = (status: string | null) => {
        switch (status) {
            case "ACEPTADO":
                return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
            case "PENDIENTE":
                return <Clock className="h-5 w-5 text-amber-500" />;
            default:
                return <AlertCircle className="h-5 w-5 text-rose-500" />;
        }
    };

    return (
        <div className="min-h-screen bg-background pb-24">
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
                <div className="container max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold">Comprobantes Electrónicos</h1>
                            <p className="text-xs text-muted-foreground">{empresa?.nombre}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="hidden sm:flex">
                            <Filter className="h-4 w-4 mr-2" />
                            Filtros
                        </Button>
                    </div>
                </div>
            </header>

            <main className="container max-w-5xl mx-auto px-4 py-6">
                {/* Estadísticas Rápidas */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <Card className="bg-card/50 border-border">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-primary/10">
                                <FileText className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Total Mes</p>
                                <p className="text-xl font-bold">{comprobantes?.length || 0}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card/50 border-border">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-emerald-500/10">
                                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Aceptados</p>
                                <p className="text-xl font-bold">
                                    {comprobantes?.filter(c => c.sunatStatus === "ACEPTADO").length || 0}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card/50 border-border">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-amber-500/10">
                                <Clock className="h-6 w-6 text-amber-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Pendientes</p>
                                <p className="text-xl font-bold">
                                    {comprobantes?.filter(c => c.sunatStatus === "PENDIENTE").length || 0}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card/50 border-border">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-rose-500/10">
                                <AlertCircle className="h-6 w-6 text-rose-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Rechazados</p>
                                <p className="text-xl font-bold">
                                    {comprobantes?.filter(c => c.sunatStatus === "RECHAZADO").length || 0}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Buscador */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por serie, número o RUC..."
                            className="pl-10 bg-card/50"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Input
                        type="date"
                        className="w-full sm:w-[180px] bg-card/50"
                        value={fecha}
                        onChange={(e) => setFecha(e.target.value)}
                    />
                </div>

                {/* Lista de Comprobantes */}
                <div className="space-y-4">
                    {isLoading ? (
                        Array(5).fill(0).map((_, i) => (
                            <Card key={i} className="animate-pulse bg-card/50 border-border">
                                <div className="h-20" />
                            </Card>
                        ))
                    ) : filteredComprobantes?.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="inline-flex p-4 rounded-full bg-muted mb-4">
                                <FileText className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-medium">No se encontraron comprobantes</h3>
                            <p className="text-sm text-muted-foreground">Intenta con otros términos de búsqueda</p>
                        </div>
                    ) : (
                        filteredComprobantes?.map((c) => (
                            <Card key={c.id} className="bg-card/50 hover:bg-card/80 transition-all border-border overflow-hidden">
                                <CardContent className="p-0">
                                    <div className="flex flex-col sm:flex-row sm:items-center">
                                        {/* Indicador lateral */}
                                        <div className={cn(
                                            "w-full sm:w-2 h-2 sm:h-auto self-stretch",
                                            c.sunatStatus === "ACEPTADO" ? "bg-emerald-500" :
                                                c.sunatStatus === "PENDIENTE" ? "bg-amber-500" : "bg-rose-500"
                                        )} />

                                        <div className="p-4 flex-1 grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-background border border-border">
                                                    <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm">{c.tipo} {c.serie}-{c.numero}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {format(new Date(c.fechaEmision || c.createdAt), "dd MMM yyyy, HH:mm", { locale: es })}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="sm:text-center">
                                                <p className="text-xs text-muted-foreground mb-1">Cliente</p>
                                                <p className="text-sm font-medium">{c.rucCliente || "Público General"}</p>
                                            </div>

                                            <div className="flex items-center sm:justify-center gap-2">
                                                {getStatusIcon(c.sunatStatus)}
                                                {getStatusBadge(c.sunatStatus)}
                                            </div>

                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-full"
                                                    onClick={() => handleConsultar(c)}
                                                    disabled={consultarMutation.isPending}
                                                >
                                                    <RefreshCw className={cn("h-4 w-4 text-amber-500", consultarMutation.isPending && "animate-spin")} />
                                                </Button>
                                                {c.xmlPath && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => window.open(c.xmlPath as string, '_blank')}>
                                                        <FileCode className="h-4 w-4 text-primary" />
                                                    </Button>
                                                )}
                                                {c.cdrPath && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => window.open(c.cdrPath as string, '_blank')}>
                                                        <FileJson className="h-4 w-4 text-emerald-500" />
                                                    </Button>
                                                )}
                                                {c.pdfPath && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => window.open(c.pdfPath as string, '_blank')}>
                                                        <Download className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                )}
                                                {c.tipo !== "TICKET" && !c.tipo.includes("NOTA") && c.sunatStatus === "ACEPTADO" && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-full"
                                                        onClick={() => handleOpenAnular(c)}
                                                        disabled={anularMutation.isPending}
                                                        title="Dar de Baja (Anular)"
                                                    >
                                                        <Trash2 className="h-4 w-4 text-rose-500" />
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-full"
                                                    onClick={() => handleEliminarLocal(c)}
                                                    disabled={deleteMutation.isPending}
                                                    title="Eliminar solo del sistema local"
                                                >
                                                    <X className="h-4 w-4 text-muted-foreground" />
                                                </Button>

                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </main>

            <BottomNavigation />

            <Dialog open={showAnularDialog} onOpenChange={setShowAnularDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-rose-600">
                            <AlertTriangle className="h-5 w-5" />
                            Anular Comprobante
                        </DialogTitle>
                        <DialogDescription>
                            Está a punto de dar de <strong>BAJA</strong> el comprobante
                            <span className="font-bold text-foreground"> {anularComprobante?.serie}-{anularComprobante?.numero}</span> ante la SUNAT.
                            <br /><br />
                            Esta acción es irreversible y anula legalmente el documento.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <Label htmlFor="motivo">Motivo de la anulación:</Label>
                        <Textarea
                            id="motivo"
                            className="mt-2"
                            value={motivoAnulacion}
                            onChange={(e) => setMotivoAnulacion(e.target.value)}
                            placeholder="Ej: Error en el precio, Error en el RUC, Devolución total..."
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAnularDialog(false)}>
                            Cancelar
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmAnular}
                            disabled={anularMutation.isPending}
                        >
                            {anularMutation.isPending ? "Anulando..." : "Confirmar Anulación"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
