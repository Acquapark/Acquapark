import { FOTO_TAMANHO_MAXIMO } from "@/lib/associados/autocadastro-tipos";

/**
 * Reduz a foto no navegador (lado maior até 800px, JPEG, até 200 KB) antes de
 * enviar: foto de celular passa fácil de 3 MB, e a foto vai também para o
 * leitor facial Hikvision, que só aceita até 200 KB.
 * Usada no autocadastro e no cadastro/edição pelo painel.
 */
export async function comprimirFoto(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const qualidade of [0.85, 0.75, 0.65, 0.55, 0.45]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", qualidade));
    if (blob && blob.size <= FOTO_TAMANHO_MAXIMO) return blob;
  }
  throw new Error("foto grande demais");
}
