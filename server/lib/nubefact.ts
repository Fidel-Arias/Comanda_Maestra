
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
        // Si el error es "Documento no existe", devolvemos un estado limpio
        if (result.errors && result.errors.includes("Documento no existe")) {
            return {
                sunat_description: "NO ENCONTRADO EN SUNAT (Posiblemente solo local)",
                enlace_del_pdf: "",
                enlace_del_xml: "",
                enlace_del_cdr: "",
                cadena_para_codigo_qr: "",
                sunat_ticket_numero: "",
                aceptada_por_sunat: false,
                sunat_soap_error: "",
                codigo_hash: ""
            } as unknown as NubeFactResponse;
        }
        throw new Error(result.errors || "Error calling NubeFact API");
    }

    return result as NubeFactResponse;
}

export interface NubeFactEntidad {
    tipo_de_documento: string;
    numero_de_documento: string;
    razon_social: string;
    estado?: string;
    condicion?: string;
    direccion?: string;
    ubigeo?: string;
    distrito?: string;
    provincia?: string;
    departamento?: string;
}

// Token opcional para APIs.net.pe V2 (Mayor estabilidad)
const APIS_NET_PE_TOKEN = process.env.APIS_NET_PE_TOKEN;

export async function consultarEntidad(numero: string): Promise<NubeFactEntidad> {
    const esRuc = numero.length === 11;

    // MÉTODO 1: API V2 (Si existe token configurado - RECOMENDADO para producción)
    if (APIS_NET_PE_TOKEN) {
        try {
            const tipoEntidad = esRuc ? "sunat/ruc" : "reniec/dni";
            const url = `https://api.apis.net.pe/v2/${tipoEntidad}?numero=${numero}`;

            console.log(`Consultando API V2 (Token): ${url}`);
            const response = await fetch(url, {
                headers: {
                    "Authorization": `Bearer ${APIS_NET_PE_TOKEN}`,
                    "Referer": "https://apis.net.pe/api-ruc",
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data && (data.razonSocial || data.nombres || data.nombre)) {
                    // Mapeo V2
                    const razonSocial = data.razonSocial || (data.nombres ? `${data.nombres} ${data.apellidoPaterno} ${data.apellidoMaterno}` : data.nombre);

                    if (esRuc) {
                        return {
                            tipo_de_documento: "6", // RUC
                            numero_de_documento: data.numeroDocumento || numero,
                            razon_social: razonSocial,
                            estado: data.estado,
                            condicion: data.condicion,
                            direccion: data.direccion,
                            ubigeo: data.ubigeo,
                            distrito: data.distrito,
                            provincia: data.provincia,
                            departamento: data.departamento
                        };
                    } else {
                        return {
                            tipo_de_documento: "1", // DNI
                            numero_de_documento: data.numeroDocumento || numero,
                            razon_social: razonSocial,
                        };
                    }
                }
            }
        } catch (e) {
            console.warn("Fallo API V2, intentando fallback V1...", e);
        }
    }

    // MÉTODO 2: API V1 (Pública/Gratuita - Fallback)
    try {
        const tipo = esRuc ? "ruc" : "dni";
        // V1 usa /ruc o /dni directo
        const url = `https://api.apis.net.pe/v1/${tipo}?numero=${numero}`;

        console.log(`Consultando API V1 (Pública): ${url}`);
        const response = await fetch(url);

        if (response.ok) {
            const data = await response.json();
            // Validar que tengamos datos reales
            if (data && (data.nombre || data.razonSocial)) {
                if (esRuc) {
                    return {
                        tipo_de_documento: "6", // RUC
                        numero_de_documento: data.numeroDocumento || numero,
                        razon_social: data.nombre, // En v1 ruc devuelve 'nombre' a veces
                        estado: data.estado,
                        condicion: data.condicion,
                        direccion: data.direccion,
                        ubigeo: data.ubigeo,
                        distrito: data.distrito,
                        provincia: data.provincia,
                        departamento: data.departamento
                    };
                } else {
                    return {
                        tipo_de_documento: "1", // DNI
                        numero_de_documento: data.numeroDocumento || numero,
                        razon_social: data.nombre,
                    };
                }
            }
        }

    } catch (e) {
        console.warn("Fallo API V1 pública...", e);
    }

    // Si llegamos aquí y falló todo
    throw new Error("No se encontraron datos. Verifique el número o ingrese los datos manualmente.");
}

export interface NubeFactAnulacionRequest {
    operacion: "generar_anulacion";
    tipo_de_comprobante: number;
    serie: string;
    numero: number;
    motivo: string;
    codigo_unico?: string;
}

export async function anularComprobante(data: NubeFactAnulacionRequest): Promise<NubeFactResponse> {
    if (!NUBEFACT_ENDPOINT || !NUBEFACT_TOKEN) {
        throw new Error("NubeFact credentials not configured");
    }

    console.log("NubeFact Anulación Request Payload:", JSON.stringify(data, null, 2));

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
        throw new Error(result.errors || "Error calling NubeFact API for Anulacion");
    }

    return result as NubeFactResponse;
}
