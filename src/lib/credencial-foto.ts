/**
 * Foto (ou iniciais, quando não há foto) no círculo da credencial — usada na
 * credencial do Portal e na aba Credencial do painel, tanto na tela quanto no
 * PNG gerado pelo botão "Baixar credencial".
 */

export function iniciaisDoNome(nome: string) {
  return nome
    ? nome
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "??";
}

/**
 * Carrega a foto para desenhar no canvas. `crossOrigin` é obrigatório: sem
 * ele a imagem do Supabase Storage "suja" o canvas e o PNG não pode ser gerado.
 */
export function carregarFoto(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Desenha o círculo do avatar: a foto recortada (cobrindo o círculo) ou as iniciais. */
export function desenharAvatar(
  ctx: CanvasRenderingContext2D,
  params: { foto: HTMLImageElement | null; iniciais: string; cx: number; cy: number; raio: number },
) {
  const { foto, iniciais, cx, cy, raio } = params;

  ctx.beginPath();
  ctx.arc(cx, cy, raio, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fill();

  if (foto) {
    // "object-fit: cover": corta o lado que sobra para a foto não achatar.
    const lado = Math.min(foto.naturalWidth, foto.naturalHeight);
    const sx = (foto.naturalWidth - lado) / 2;
    const sy = (foto.naturalHeight - lado) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, raio, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(foto, sx, sy, lado, lado, cx - raio, cy - raio, raio * 2, raio * 2);
    ctx.restore();
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 44px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(iniciais, cx, cy + 15);
  }

  ctx.beginPath();
  ctx.arc(cx, cy, raio, 0, Math.PI * 2);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.stroke();
}
