
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/forms/button";
import { Input } from "@/components/ui/forms/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/overlays/dialog";
import { ArrowLeft, ArrowRight, Save, Lock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Item {
    id?: number;
    nombre: string;
    cantidad: number;
    precioUnitario: number;
    subCuenta?: number;
    pagado?: boolean;
}

interface DividirCuentaDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    items: Item[];
    onSave: (updates: { itemId: number; subCuenta: number; subCuentaNombre: string }[]) => Promise<void>;
}

export function DividirCuentaDialog({ open, onOpenChange, items, onSave }: DividirCuentaDialogProps) {
    const [numCuentas, setNumCuentas] = useState(2);
    const [nombresCuentas, setNombresCuentas] = useState<string[]>([]);
    const [asignaciones, setAsignaciones] = useState<Record<number, number>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [draggingId, setDraggingId] = useState<number | null>(null);

    useEffect(() => {
        if (open) {
            // Inicializar asignaciones basadas en items actuales
            const newAsignaciones: Record<number, number> = {};
            let maxSubCuenta = 0;

            items.forEach(item => {
                if (item.id) {
                    const sc = item.subCuenta || 0;
                    newAsignaciones[item.id] = sc;
                    if (sc > maxSubCuenta) maxSubCuenta = sc;
                }
            });
            setAsignaciones(newAsignaciones);

            const count = Math.max(2, maxSubCuenta + 1);
            setNumCuentas(count);

            const names = Array.from({ length: count }, (_, i) => i === 0 ? "Cuenta Principal" : `Cuenta ${i + 1}`);
            setNombresCuentas(names);
        }
    }, [open, items]);

    const handleUpdateNumCuentas = (delta: number) => {
        const newCount = numCuentas + delta;
        if (newCount < 2 || newCount > 6) return;

        setNumCuentas(newCount);
        setNombresCuentas(prev => {
            const newNames = [...prev];
            if (newCount > prev.length) {
                for (let i = prev.length; i < newCount; i++) newNames[i] = `Cuenta ${i + 1}`;
            }
            return newNames.slice(0, newCount);
        });

        // Items en cuentas eliminadas vuelven a 0
        if (delta < 0) {
            setAsignaciones(prev => {
                const next = { ...prev };
                Object.keys(next).forEach(k => {
                    const key = Number(k);
                    if (next[key] >= newCount) next[key] = 0;
                });
                return next;
            });
        }
    };

    const moveItem = (itemId: number, direction: 'left' | 'right') => {
        const current = asignaciones[itemId] ?? 0;
        let next = current;
        if (direction === 'left' && current > 0) next--;
        else if (direction === 'right' && current < numCuentas - 1) next++;

        if (next !== current) {
            setAsignaciones(prev => ({ ...prev, [itemId]: next }));
        }
    };

    const handleDragStart = (e: React.DragEvent, id: number) => {
        setDraggingId(id);
        e.dataTransfer.effectAllowed = "move";
        // Transparencia visual al arrastrar
        e.dataTransfer.setData("text/plain", id.toString());
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e: React.DragEvent, targetColIndex: number) => {
        e.preventDefault();
        if (draggingId !== null) {
            setAsignaciones(prev => ({ ...prev, [draggingId]: targetColIndex }));
            setDraggingId(null);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updates = items
                .filter(i => i.id !== undefined)
                .map(item => ({
                    itemId: item.id!,
                    subCuenta: asignaciones[item.id!] || 0,
                    subCuentaNombre: nombresCuentas[asignaciones[item.id!] || 0] || `Cuenta ${asignaciones[item.id!] || 0}`
                }));

            await onSave(updates);
            toast.success("Cuentas guardadas");
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar");
        } finally {
            setIsSaving(false);
        }
    };

    if (!open) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] h-[90vh] flex flex-col p-0 gap-0 bg-background/95 backdrop-blur-xl border-border/50">
                <DialogHeader className="p-6 border-b shrink-0">
                    <DialogTitle>Dividir Cuenta</DialogTitle>
                    <DialogDescription>Arrastra los items entre las diferentes cuentas</DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="p-4 border-b flex items-center justify-between bg-muted/20 shrink-0">
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-medium">Cantidad de Cuentas:</span>
                            <div className="flex items-center gap-2 bg-background rounded-md border p-1">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleUpdateNumCuentas(-1)} disabled={numCuentas <= 2}>
                                    <ArrowLeft className="h-3 w-3" />
                                </Button>
                                <span className="w-6 text-center text-sm font-bold">{numCuentas}</span>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleUpdateNumCuentas(1)} disabled={numCuentas >= 6}>
                                    <ArrowRight className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-x-auto p-4 space-x-4 flex">
                        {Array.from({ length: numCuentas }).map((_, colIndex) => {
                            const colItems = items.filter(item => {
                                const assigned = asignaciones[item.id!] ?? (item.subCuenta || 0);
                                return item.id && assigned === colIndex;
                            });

                            const total = colItems.reduce((sum, i) => sum + (i.precioUnitario * i.cantidad), 0);
                            const isOver = false; // Podríamos añadir estado isOver para highlight

                            return (
                                <div
                                    key={colIndex}
                                    className="min-w-[320px] flex-1 flex flex-col border rounded-lg bg-card shadow-sm h-full max-h-full transition-colors"
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, colIndex)}
                                >
                                    <div className="p-3 border-b bg-muted/40 text-center sticky top-0 z-10">
                                        <Input
                                            value={nombresCuentas[colIndex] || ''}
                                            onChange={(e) => {
                                                const newNames = [...nombresCuentas];
                                                newNames[colIndex] = e.target.value;
                                                setNombresCuentas(newNames);
                                            }}
                                            className="h-8 text-center font-bold bg-transparent border-transparent hover:border-input focus:border-input text-lg"
                                        />
                                        <div className="text-sm font-mono text-muted-foreground mt-1 font-bold text-primary">
                                            Total: S/ {total.toFixed(2)}
                                        </div>
                                    </div>

                                    <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-muted/10">
                                        {colItems.length === 0 && (
                                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg m-2 opacity-50">
                                                <p className="text-sm font-medium">Arrastra items aquí</p>
                                            </div>
                                        )}
                                        {colItems.map(item => (
                                            <div
                                                key={item.id}
                                                draggable={!item.pagado}
                                                onDragStart={(e) => !item.pagado && handleDragStart(e, item.id!)}
                                                className={cn(
                                                    "p-3 border rounded-lg bg-background shadow-sm hover:shadow-md transition-all select-none relative group",
                                                    !item.pagado && "cursor-grab active:cursor-grabbing",
                                                    draggingId === item.id ? "opacity-50 border-primary border-dashed" : "",
                                                    item.pagado && "opacity-75 bg-muted/30 border-emerald-200"
                                                )}
                                            >
                                                {item.pagado && (
                                                    <div className="absolute top-2 right-2" title="Item pagado">
                                                        <Lock className="h-3 w-3 text-emerald-500" />
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-start mb-2 pr-4">
                                                    <span className="text-sm font-medium leading-tight line-clamp-2">{item.nombre}</span>
                                                    <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">x{item.cantidad}</span>
                                                </div>
                                                <div className="flex justify-between items-end">
                                                    <div className="text-xs text-muted-foreground font-mono">
                                                        S/ {(item.precioUnitario * item.cantidad).toFixed(2)}
                                                    </div>
                                                    {/* Flechas de fallback para movil/accesibilidad */}
                                                    <div className="flex gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            variant="secondary" size="icon" className="h-6 w-6"
                                                            onClick={() => moveItem(item.id!, 'left')}
                                                            disabled={colIndex === 0 || !!item.pagado}
                                                        >
                                                            <ArrowLeft className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                            variant="secondary" size="icon" className="h-6 w-6"
                                                            onClick={() => moveItem(item.id!, 'right')}
                                                            disabled={colIndex === numCuentas - 1 || !!item.pagado}
                                                        >
                                                            <ArrowRight className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <DialogFooter className="p-4 border-t bg-muted/10 shrink-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)} size="lg">Cancelar</Button>
                    <Button onClick={handleSave} disabled={isSaving} className="gap-2" size="lg">
                        {isSaving ? "Guardando..." : <><Save className="h-4 w-4" /> Guardar División</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
