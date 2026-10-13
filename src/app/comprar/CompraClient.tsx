"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Minus, Plus, QrCode, Tag, Waves, X } from "lucide-react";
import { cn, formatCPF, formatCurrency, formatDate, formatPhone, isCPFValido } from "@/lib/utils";
import type { TipoOnline } from "@/lib/venda-online/servidor";
import { conferirCupom, consultarData, criarPedido } from "./actions";

const MAX_INGRESSOS = 50;

const inputClass =
  "h-12 w-full rounded-[6px] border border-gray-300 bg-white px-4 text-base text-gray-800 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100";

function Secao({ numero, titulo, children }: { numero: number; titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[10px] border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-xs text-white">{numero}</span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  );
}

export function CompraClient({ tipos, primeiraData, ultimaData }: { tipos: TipoOnline[]; primeiraData: string; ultimaData: string }) {
  const router = useRouter();
  const [data, setData] = useState(primeiraData);
  const [situacaoData, setSituacaoData] = useState<{ carregando: boolean; erro: string | null; restantes: number | null }>({
    carregando: true,
    erro: null,
    restantes: null,
  });
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [cupomInput, setCupomInput] = useState("");
  const [cupom, setCupom] = useState<{ codigo: string; descontos: Record<string, number> } | null>(null);
  const [cupomErro, setCupomErro] = useState("");
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [forma, setForma] = useState<"Pix" | "Cartão de crédito">("Pix");
  const [aceite, setAceite] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const honeypotRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelado = false;
    consultarData(data).then((r) => {
      if (cancelado) return;
      setSituacaoData(r.disponivel ? { carregando: false, erro: null, restantes: r.restantes } : { carregando: false, erro: r.motivo, restantes: null });
    });
    return () => {
      cancelado = true;
    };
  }, [data]);

  const total = tipos.reduce((s, t) => s + (quantidades[t.id] ?? 0) * (t.valor - (cupom?.descontos[t.id] ?? 0)), 0);
  const totalSemDesconto = tipos.reduce((s, t) => s + (quantidades[t.id] ?? 0) * t.valor, 0);
  const quantidade = Object.values(quantidades).reduce((s, q) => s + q, 0);
  const limite = Math.min(MAX_INGRESSOS, situacaoData.restantes ?? MAX_INGRESSOS);

  function alterar(tipoId: string, delta: number) {
    setQuantidades((atual) => {
      const nova = Math.max(0, (atual[tipoId] ?? 0) + delta);
      if (delta > 0 && quantidade >= limite) return atual;
      return { ...atual, [tipoId]: nova };
    });
  }

  async function aplicarCupom() {
    setCupomErro("");
    const result = await conferirCupom(
      cupomInput,
      tipos.map((t) => ({ id: t.id, valor: t.valor })),
    );
    if ("error" in result) {
      setCupomErro(result.error);
      setCupom(null);
      return;
    }
    setCupom({ codigo: cupomInput.trim().toUpperCase(), descontos: result.descontos });
  }

  function validar(): string | null {
    if (situacaoData.erro) return situacaoData.erro;
    if (quantidade === 0) return "Escolha ao menos um ingresso.";
    if (quantidade > limite) return `Escolha no máximo ${limite} ingresso(s) para esta data.`;
    if (nome.trim().split(/\s+/).length < 2) return "Informe seu nome completo.";
    if (!isCPFValido(cpf)) return "CPF inválido.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "E-mail inválido.";
    if (telefone.replace(/\D/g, "").length < 10) return "Informe um telefone com DDD.";
    if (!aceite) return "É preciso concordar com as regras da compra.";
    return null;
  }

  async function finalizar() {
    const erro = validar();
    if (erro) {
      setError(erro);
      return;
    }
    setError("");
    setEnviando(true);
    try {
      const result = await criarPedido({
        data,
        itens: Object.entries(quantidades)
          .filter(([, q]) => q > 0)
          .map(([tipoId, q]) => ({ tipoId, quantidade: q })),
        cupom: cupom?.codigo ?? "",
        nome,
        cpf,
        email,
        telefone,
        forma,
        aceite,
        website: honeypotRef.current?.value ?? "",
      });
      if ("error" in result) {
        setError(result.error);
        setEnviando(false);
        return;
      }
      router.push(`/comprar/pedido/${result.token}`);
    } catch {
      setError("Não foi possível concluir a compra. Verifique sua conexão e tente de novo.");
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-md space-y-4">
        <div className="mb-2 flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-primary-600 text-white shadow-sm">
            <Waves size={24} strokeWidth={2.25} />
          </div>
          <h1 className="mt-3 text-lg font-semibold text-gray-900">Comprar ingressos</h1>
          <p className="text-sm text-gray-500">Acqua Park</p>
        </div>

        <Secao numero={1} titulo="Data da visita">
          <input
            type="date"
            className={inputClass}
            value={data}
            min={primeiraData}
            max={ultimaData}
            onChange={(e) => {
              setData(e.target.value);
              setSituacaoData({ carregando: true, erro: null, restantes: null });
            }}
          />
          <p className={cn("mt-2 text-sm", situacaoData.erro ? "text-danger-600" : "text-gray-500")}>
            {situacaoData.carregando
              ? "Conferindo a data..."
              : situacaoData.erro
                ? situacaoData.erro
                : `${formatDate(data)}${situacaoData.restantes !== null && situacaoData.restantes <= 50 ? ` · restam ${situacaoData.restantes} ingresso(s)` : ""}`}
          </p>
        </Secao>

        <Secao numero={2} titulo="Ingressos">
          <div className="space-y-3">
            {tipos.map((t) => {
              const desconto = cupom?.descontos[t.id] ?? 0;
              return (
                <div key={t.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">{t.nome}</p>
                    {t.descricao && <p className="text-xs text-gray-500">{t.descricao}</p>}
                    <p className="text-sm text-gray-900">
                      {desconto > 0 && <span className="mr-1.5 text-xs text-gray-400 line-through">{formatCurrency(t.valor)}</span>}
                      <strong>{formatCurrency(t.valor - desconto)}</strong>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => alterar(t.id, -1)}
                      disabled={!quantidades[t.id]}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 text-gray-700 disabled:opacity-40"
                      aria-label={`Menos ${t.nome}`}
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-6 text-center text-base font-semibold">{quantidades[t.id] ?? 0}</span>
                    <button
                      type="button"
                      onClick={() => alterar(t.id, 1)}
                      disabled={quantidade >= limite || !!situacaoData.erro}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-primary-600 text-primary-700 disabled:opacity-40"
                      aria-label={`Mais ${t.nome}`}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 border-t border-gray-100 pt-4">
            {cupom ? (
              <div className="flex items-center justify-between rounded-[6px] border border-success-600/30 bg-success-50 px-3 py-2 text-sm text-success-700">
                <span className="flex items-center gap-1.5 font-medium">
                  <Tag size={14} />
                  Cupom {cupom.codigo} aplicado
                </span>
                <button type="button" onClick={() => setCupom(null)} aria-label="Remover cupom">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  className={cn(inputClass, "uppercase")}
                  value={cupomInput}
                  onChange={(e) => {
                    setCupomInput(e.target.value.toUpperCase());
                    setCupomErro("");
                  }}
                  placeholder="Cupom de desconto"
                />
                <button
                  type="button"
                  onClick={aplicarCupom}
                  disabled={!cupomInput.trim()}
                  className="h-12 shrink-0 rounded-[6px] border border-gray-300 px-4 text-sm font-medium text-gray-700 disabled:opacity-40"
                >
                  Aplicar
                </button>
              </div>
            )}
            {cupomErro && <p className="mt-1.5 text-sm text-danger-600">{cupomErro}</p>}
          </div>
        </Secao>

        <Secao numero={3} titulo="Seus dados">
          <div className="space-y-3">
            <Campo label="Nome completo">
              <input className={inputClass} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
            </Campo>
            <Campo label="CPF">
              <input
                className={inputClass}
                value={cpf}
                onChange={(e) => setCpf(formatCPF(e.target.value))}
                inputMode="numeric"
                placeholder="000.000.000-00"
                maxLength={14}
              />
            </Campo>
            <Campo label="E-mail (os ingressos vão para ele)">
              <input
                type="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                inputMode="email"
                autoComplete="email"
              />
            </Campo>
            <Campo label="Telefone">
              <input
                className={inputClass}
                value={telefone}
                onChange={(e) => setTelefone(formatPhone(e.target.value))}
                inputMode="tel"
                autoComplete="tel"
                placeholder="(00) 00000-0000"
                maxLength={15}
              />
            </Campo>
          </div>
        </Secao>

        <Secao numero={4} titulo="Pagamento">
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { valor: "Pix", rotulo: "Pix", Icone: QrCode },
                { valor: "Cartão de crédito", rotulo: "Cartão de crédito", Icone: CreditCard },
              ] as const
            ).map(({ valor, rotulo, Icone }) => (
              <button
                key={valor}
                type="button"
                onClick={() => setForma(valor)}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 rounded-[8px] border text-sm font-medium",
                  forma === valor ? "border-primary-500 bg-primary-50 text-primary-700 ring-2 ring-primary-100" : "border-gray-200 text-gray-700",
                )}
              >
                <Icone size={20} />
                {rotulo}
              </button>
            ))}
          </div>
          {forma === "Pix" && <p className="mt-2 text-xs text-gray-500">O QR Code do Pix vale por 30 minutos.</p>}

          <div className="mt-4 rounded-[6px] bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
            <p className="mb-1 font-semibold text-gray-700">Regras da compra</p>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>O ingresso vale somente na data escolhida (exceto ingressos sem expiração).</li>
              <li>Cada ingresso tem um QR Code, que deve ser apresentado na entrada do parque.</li>
              <li>
                <strong>Ingressos sem cancelamento, troca de data ou reembolso.</strong>
              </li>
              <li>Os ingressos são liberados assim que o pagamento é confirmado.</li>
            </ul>
          </div>
          <label className="mt-3 flex cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-0.5 h-5 w-5" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
            <span className="text-sm text-gray-700">Li e concordo com as regras da compra.</span>
          </label>
        </Secao>

        <input ref={honeypotRef} name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />

        <div className="rounded-[10px] border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-gray-600">
              Total{quantidade > 0 && <span className="text-gray-400"> · {quantidade} ingresso(s)</span>}
            </span>
            <span className="flex items-baseline gap-2">
              {totalSemDesconto > total && <span className="text-sm text-gray-400 line-through">{formatCurrency(totalSemDesconto)}</span>}
              <span className="text-2xl font-bold text-gray-900">{formatCurrency(total)}</span>
            </span>
          </div>
          {error && <p className="mt-3 rounded-[6px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}
          <button
            type="button"
            onClick={finalizar}
            disabled={enviando}
            className="mt-4 h-12 w-full rounded-[6px] bg-primary-600 text-base font-semibold text-white hover:bg-primary-700 disabled:bg-gray-300"
          >
            {enviando ? "Gerando pagamento..." : "Ir para o pagamento"}
          </button>
        </div>
      </div>
    </div>
  );
}
