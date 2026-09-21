export type PaperWidth = "80" | "58";

const WIDTH_KEY = "aquapark:ingresso:papel";
const AUTO_KEY = "aquapark:ingresso:imprimir-automatico";

export function getPaperWidth(): PaperWidth {
  try {
    return localStorage.getItem(WIDTH_KEY) === "58" ? "58" : "80";
  } catch {
    return "80";
  }
}

export function setPaperWidth(width: PaperWidth) {
  try {
    localStorage.setItem(WIDTH_KEY, width);
  } catch {
    // sem armazenamento local — a preferência só vale nesta sessão
  }
}

/** Padrão: ligado, porque o fluxo da bilheteria é vender e já imprimir. */
export function getAutoPrint(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setAutoPrint(value: boolean) {
  try {
    localStorage.setItem(AUTO_KEY, value ? "1" : "0");
  } catch {
    // idem
  }
}

/**
 * Imprime o cupom do ingresso na impressora do sistema (a térmica, quando ela
 * é a impressora padrão). A rota de impressão roda dentro de um iframe oculto:
 * quem chama continua na mesma tela e o iframe se remove quando a impressão termina.
 */
export function imprimirIngresso(ingressoId: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:340px;height:800px;border:0;";
  iframe.src = `/imprimir/ingresso/${ingressoId}?w=${getPaperWidth()}&auto=1`;

  const remover = () => {
    window.removeEventListener("message", onMessage);
    iframe.remove();
  };
  const onMessage = (event: MessageEvent) => {
    if (event.origin === window.location.origin && event.data === "ingresso-impresso") remover();
  };

  window.addEventListener("message", onMessage);
  document.body.appendChild(iframe);
  setTimeout(remover, 120_000);
}
