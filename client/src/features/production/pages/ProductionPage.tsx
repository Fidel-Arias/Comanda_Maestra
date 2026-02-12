import { useState, useEffect } from "react";
import { usePOS } from "@/features/auth/contexts/POSContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/display/card";
import { Badge } from "@/components/ui/display/badge";
import { Button } from "@/components/ui/forms/button";
import { Clock, ChefHat, Wine, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ProductionPageProps {
    area: "COCINA" | "BAR";
}

export default function ProductionPage({ area }: ProductionPageProps) {
    const { empresa } = usePOS();

    const { data: comandas, refetch } = trpc.pedido.listComandas.useQuery(
        { empresaId: empresa?.id || 0, area },
        {
            enabled: !!empresa?.id,
            refetchInterval: 10000 // Poll every 10 seconds
        }
    );

    return (
        <div className="min-h-screen bg-background p-6">
            <header className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {area === "COCINA" ? (
                        <ChefHat className="h-8 w-8 text-primary" />
                    ) : (
                        <Wine className="h-8 w-8 text-primary" />
                    )}
                    <h1 className="text-3xl font-bold tracking-tight">
                        {area === "COCINA" ? "Pantalla de Cocina" : "Pantalla de Bar"}
                    </h1>
                </div>
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.print()}
                        className="print:hidden"
                    >
                        Imprimir
                    </Button>
                    <Badge variant="outline" className="text-lg px-4 py-1 print:hidden">
                        {comandas?.length || 0} Pendientes
                    </Badge>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 print:block print:space-y-6">
                {comandas?.map((pedido) => (
                    <Card key={pedido.id} className="border-l-4 border-l-primary shadow-md overflow-hidden">
                        <CardHeader className="pb-3 bg-muted/40 border-b">
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-2xl font-bold">Mesa {pedido.mesaNumero}</CardTitle>
                                <Badge variant={pedido.orderStatus === "PENDIENTE" ? "destructive" : "default"}>
                                    {pedido.orderStatus}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                                <Clock className="h-4 w-4" />
                                <span>{format(new Date(pedido.createdAt), "HH:mm", { locale: es })}</span>
                                <span>•</span>
                                <span className="font-medium">{pedido.mozoNombre}</span>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4 max-h-[400px] overflow-y-auto">
                            {pedido.notas && (
                                <div className="mb-4 bg-yellow-500/10 border border-yellow-500/20 p-2.5 rounded text-sm text-yellow-600 dark:text-yellow-400">
                                    <strong>Nota Global:</strong> {pedido.notas}
                                </div>
                            )}
                            <ul className="space-y-4">
                                {pedido.items.map((item: any) => (
                                    <li key={item.id} className="flex justify-between items-start border-b border-border/40 last:border-0 pb-3 last:pb-0">
                                        <div className="flex gap-3">
                                            <span className="font-bold text-xl min-w-[1.5rem] bg-primary/10 text-primary w-8 h-8 flex items-center justify-center rounded-full text-center">
                                                {item.cantidad}
                                            </span>
                                            <div>
                                                <p className="font-bold text-lg leading-tight">{item.productoNombre}</p>
                                                {item.notas && (
                                                    <p className="text-sm text-muted-foreground italic mt-1 bg-muted px-2 py-0.5 rounded inline-block">
                                                        "{item.notas}"
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                ))}

                {(!comandas || comandas.length === 0) && (
                    <div className="col-span-full py-32 text-center text-muted-foreground flex flex-col items-center">
                        <div className="h-24 w-24 bg-muted/50 rounded-full flex items-center justify-center mb-6">
                            <CheckCircle2 className="h-12 w-12 text-muted-foreground/50" />
                        </div>
                        <h3 className="text-2xl font-semibold mb-2">¡Todo al día!</h3>
                        <p className="text-lg opacity-80">No hay pedidos pendientes en este momento.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
