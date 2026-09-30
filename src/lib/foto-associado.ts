import { FOTO_TAMANHO_MAXIMO } from "@/lib/associados/autocadastro-tipos";

/**
 * Reduz a foto no navegador (lado maior até 1024px, JPEG) antes de enviar:
 * foto de celular passa fácil de 3 MB e o envio para o servidor tem limite de 1 MB.
 * Usada no autocadastro e no cadastro/edição pelo painel.
 */
export async function comprimirFoto(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const qualidade of [0.85, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", qualidade));
    if (blob && blob.size <= FOTO_TAMANHO_MAXIMO) return blob;
  }
  throw new Error("foto grande demais");
}
