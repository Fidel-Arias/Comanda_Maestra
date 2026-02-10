
export interface NubeFactItem {
    unidad_de_medida: string;
    codigo: string;
    descripcion: string;
    cantidad: number;
    valor_unitario: number;
    precio_unitario: number;
    subtotal: number;
    tipo_de_igv: number;
    igv: number;
    total: number;
    anticipo_regularizacion: boolean;
    anticipo_documento_serie?: string;
    anticipo_documento_numero?: string;
}

export interface NubeFactInvoiceRequest {
    operacion: "generar_comprobante";
    tipo_de_comprobante: number;
    serie: string;
    numero: number;
    sunat_transaction: number;
    cliente_tipo_de_documento: string;
    cliente_numero_de_documento: string;
    cliente_denominacion: string;
    cliente_direccion?: string;
    cliente_email?: string;
    fecha_de_emision: string;
    moneda: number;
    tipo_de_cambio?: number;
    porcentaje_de_igv: number;
    total_gravada: number;
    total_inafecta?: number;
    total_exonerada?: number;
    total_gratuita?: number;
    total_exportacion?: number;
    total_previsualizacion?: number;
    total_otros_cargos?: number;
    total_otros_tributos?: number;
    total_igv: number;
    total_isc?: number;
    total_otrival?: number;
    total_detraccion?: number;
    total_percepcion?: number;
    total: number;
    documento_que_se_modifica_tipo?: number;
    documento_que_se_modifica_serie?: string;
    documento_que_se_modifica_numero?: number;
    tipo_de_nota_de_credito?: number;
    tipo_de_nota_de_debito?: number;
    enviar_a_profe?: boolean;
    guia_tipo?: number;
    guia_serie_numero?: string;
    items: NubeFactItem[];
}

export interface NubeFactResponse {
    tipo_de_comprobante: number;
    serie: string;
    numero: number;
    enlace: string;
    aceptada_por_sunat: boolean;
    sunat_description: string;
    sunat_note?: string;
    sunat_responsecode?: string;
    sunat_soap_error?: string;
    pdf_zip_base64?: string;
    xml_zip_base64?: string;
    cdr_zip_base64?: string;
    cadena_para_codigo_qr: string;
    codigo_hash: string;
    enlace_del_pdf: string;
    enlace_del_xml: string;
    enlace_del_cdr: string;
}

const NUBEFACT_ENDPOINT = process.env.NUBEFACT_ENDPOINT;
const NUBEFACT_TOKEN = process.env.NUBEFACT_TOKEN;

export async function generarComprobante(data: NubeFactInvoiceRequest): Promise<NubeFactResponse> {
    if (!NUBEFACT_ENDPOINT || !NUBEFACT_TOKEN) {
        throw new Error("NubeFact credentials not configured");
    }

    console.log("NubeFact Request Payload:", JSON.stringify(data, null, 2));

    const response = await fetch(NUBEFACT_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Token token=\"${NUBEFACT_TOKEN}\"`,
        },
        body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.errors || "Error calling NubeFact API");
    }

    return result as NubeFactResponse;
}

export async function consultarComprobante(tipo: number, serie: string, numero: number): Promise<NubeFactResponse> {
    if (!NUBEFACT_ENDPOINT || !NUBEFACT_TOKEN) {
        throw new Error("NubeFact credentials not configured");
    }

    const data = {
        operacion: "consultar_comprobante",
        tipo_de_comprobante: tipo,
        serie,
        numero,
    };

    const response = await fetch(NUBEFACT_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Token token=\"${NUBEFACT_TOKEN}\"`,
        },
        body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.errors || "Error calling NubeFact API");
    }

    return result as NubeFactResponse;
}
