import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/forms/input";
import type { RouterOutputs } from "@/lib/trpc";

export type InsumoEncontrado = NonNullable<RouterOutputs["insumo"]["buscarPorCodigo"]>;

interface Props {
  empresaId: number;
  onFound: (insumo: InsumoEncontrado) => void;
  onNotFound: (codigo: string) => void;
  autoFocus?: boolean;
}

/** Input para escaner de codigo de barras (o codigo interno tecleado): busca al pulsar Enter. */
export function InsumoCodeInput({ empresaId, onFound, onNotFound, autoFocus }: Props) {
  const utils = trpc.useUtils();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const buscar = async () => {
    const codigo = value.trim();
    if (!codigo || busy) return;
    setBusy(true);
    try {
      const insumo = await utils.insumo.buscarPorCodigo.fetch({ empresaId, codigo });
      setValue("");
      if (insumo) onFound(insumo);
      else onNotFound(codigo);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Input
      autoFocus={autoFocus}
      value={value}
      disabled={busy}
      placeholder="Escanea o escribe el código y pulsa Enter"
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void buscar();
        }
      }}
    />
  );
}
