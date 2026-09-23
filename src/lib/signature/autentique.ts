import "server-only";

const AUTENTIQUE_ENDPOINT = "https://api.autentique.com.br/v2/graphql";

const CREATE_DOCUMENT_MUTATION = `
  mutation CreateDocumentMutation($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!, $sandbox: Boolean) {
    createDocument(document: $document, signers: $signers, file: $file, sandbox: $sandbox) {
      id
      name
      signatures {
        public_id
        email
        link { short_link }
      }
    }
  }
`;

interface AutentiqueErrorPayload {
  message: string;
}

interface CreateDocumentResponse {
  createDocument: {
    id: string;
    name: string;
    signatures: { public_id: string; email: string | null; link: { short_link: string } | null }[];
  };
}

interface GetDocumentResponse {
  document: {
    id: string;
    files: { signed: string | null };
    signatures: {
      public_id: string;
      signed: { created_at: string } | null;
      rejected: { created_at: string } | null;
    }[];
  } | null;
}

function getToken(): string {
  const token = process.env.AUTENTIQUE_API_TOKEN;
  if (!token) throw new Error("AUTENTIQUE_API_TOKEN não configurado.");
  return token;
}

function isSandbox(): boolean {
  return process.env.AUTENTIQUE_SANDBOX === "true";
}

async function request<T>(query: string, variables: Record<string, unknown>, file?: { html: string; filename: string }): Promise<T> {
  const form = new FormData();
  form.append("operations", JSON.stringify({ query, variables }));
  form.append("map", file ? JSON.stringify({ file: ["variables.file"] }) : "{}");
  if (file) {
    form.append("file", new Blob([file.html], { type: "text/html" }), file.filename);
  }

  const res = await fetch(AUTENTIQUE_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
    body: form,
  });

  const json = (await res.json()) as { data?: T; errors?: AutentiqueErrorPayload[] };
  if (json.errors?.length) {
    throw new Error(`Autentique: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  if (!json.data) throw new Error("Autentique: resposta vazia.");
  return json.data;
}

/**
 * Envia o HTML já resolvido do contrato (variáveis substituídas) como
 * documento para assinatura — a Autentique aceita HTML diretamente, sem
 * precisar converter para PDF antes (ver "criando um documento" na doc deles).
 */
export async function criarDocumentoParaAssinatura(params: {
  nomeDocumento: string;
  conteudoHtml: string;
  signerNome: string;
  signerEmail: string;
  mensagem?: string;
}): Promise<{ documentoId: string }> {
  const htmlCompleto = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${params.conteudoHtml}</body></html>`;

  const data = await request<CreateDocumentResponse>(
    CREATE_DOCUMENT_MUTATION,
    {
      document: { name: params.nomeDocumento, message: params.mensagem ?? "Segue o contrato de associação para assinatura." },
      signers: [{ email: params.signerEmail, name: params.signerNome, action: "SIGN" }],
      file: null,
      sandbox: isSandbox(),
    },
    { html: htmlCompleto, filename: `${params.nomeDocumento}.html` },
  );

  return { documentoId: data.createDocument.id };
}

/** Consulta o documento na Autentique — usado pelo webhook para buscar o link do PDF assinado. */
export async function buscarDocumento(documentoId: string): Promise<GetDocumentResponse["document"]> {
  const idEscapado = documentoId.replace(/"/g, "");
  const query = `
    query {
      document(id: "${idEscapado}") {
        id
        files { signed }
        signatures {
          public_id
          signed { created_at }
          rejected { created_at }
        }
      }
    }
  `;
  const data = await request<GetDocumentResponse>(query, {});
  return data.document;
}
