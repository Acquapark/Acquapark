"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, Check, CheckCircle2, Plus, Trash2, Waves } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, formatCEP, formatCPF, formatCurrency, formatDate, formatPhone, formatRG, isCPFValido } from "@/lib/utils";
import type { CampoFormularioContrato } from "@/lib/contracts/variables";
import {
  AutocadastroDados,
  AutocadastroDependente,
  PlanoAutocadastro,
  SENHA_TAMANHO_MINIMO,
} from "@/lib/associados/autocadastro-tipos";
import { comprimirFoto } from "@/lib/foto-associado";
import { enviarAutocadastro } from "./actions";

type Sucesso = Extract<Awaited<ReturnType<typeof enviarAutocadastro>>, { ok: true }>;
type Etapa = "dados" | "foto" | "plano" | "dependentes" | "senha" | "revisao";

const ETAPA_TITULO: Record<Etapa, string> = {
  dados: "Seus dados",
  foto: "Sua foto",
  plano: "Escolha o plano",
  dependentes: "Dependentes",
  senha: "Crie sua senha",
  revisao: "Revise e confirme",
};

const inputClass =
  "h-12 w-full rounded-[6px] border border-gray-300 bg-white px-4 text-base text-gray-800 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100";

const emptyDados: AutocadastroDados = {
  nome: "",
  cpf: "",
  rg: "",
  nascimento: "",
  sexo: "",
  telefone: "",
  whatsapp: "",
  email: "",
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  planoId: "",
  dependentes: [],
  senha: "",
  aceiteTermos: false,
};

const emptyDependente: AutocadastroDependente = { nome: "", cpf: "", parentesco: "", nascimento: "" };

function Campo({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-gray-600">
        {label}
        {required && <span className="ml-0.5 text-danger-600">*</span>}
      </span>
      {children}
    </label>
  );
}

export function AutocadastroClient({
  planos,
  camposContrato,
}: {
  planos: PlanoAutocadastro[];
  /** Campos que o modelo de contrato padrão usa — obrigatórios para o contrato ser gerado. */
  camposContrato: CampoFormularioContrato[];
}) {
  const router = useRouter();
  const [dados, setDados] = useState<AutocadastroDados>(emptyDados);
  const [foto, setFoto] = useState<{ blob: Blob; preview: string } | null>(null);
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [depDraft, setDepDraft] = useState<AutocadastroDependente>(emptyDependente);
  const [etapaIndex, setEtapaIndex] = useState(0);
  const [error, setError] = useState("");
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [processandoFoto, setProcessandoFoto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState<Sucesso | null>(null);
  const [entrando, setEntrando] = useState(false);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  const plano = planos.find((p) => p.id === dados.planoId) ?? null;
  const permiteDependentes = (plano?.dependentesPermitidos ?? 0) > 0;

  // A etapa de dependentes só existe quando o plano escolhido permite.
  const etapas = useMemo<Etapa[]>(
    () => ["dados", "foto", "plano", ...(permiteDependentes ? (["dependentes"] as Etapa[]) : []), "senha", "revisao"],
    [permiteDependentes],
  );
  const etapa = etapas[Math.min(etapaIndex, etapas.length - 1)];

  function update(patch: Partial<AutocadastroDados>) {
    setDados((prev) => ({ ...prev, ...patch }));
  }

  function escolherPlano(p: PlanoAutocadastro) {
    // Trocar para um plano com menos vagas corta os dependentes que sobrariam.
    update({ planoId: p.id, dependentes: dados.dependentes.slice(0, p.dependentesPermitidos) });
  }

  async function handleCepBlur() {
    const digits = dados.cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        update({
          endereco: data.logradouro ?? "",
          bairro: data.bairro ?? "",
          cidade: data.localidade ?? "",
          estado: data.uf ?? "",
        });
      }
    } catch {
      // silencioso — a pessoa pode preencher manualmente
    } finally {
      setBuscandoCep(false);
    }
  }

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setError("");
    setProcessandoFoto(true);
    try {
      const blob = await comprimirFoto(arquivo);
      if (foto) URL.revokeObjectURL(foto.preview);
      setFoto({ blob, preview: URL.createObjectURL(blob) });
    } catch {
      setError("Não foi possível usar essa imagem. Tente tirar outra foto.");
    } finally {
      setProcessandoFoto(false);
    }
  }

  function adicionarDependente() {
    if (!depDraft.nome.trim() || !depDraft.parentesco) {
      setError("Preencha nome e parentesco do dependente.");
      return;
    }
    if (depDraft.cpf && !isCPFValido(depDraft.cpf)) {
      setError("CPF do dependente inválido.");
      return;
    }
    setError("");
    update({ dependentes: [...dados.dependentes, { ...depDraft, nome: depDraft.nome.trim() }] });
    setDepDraft(emptyDependente);
  }

  /** Mesmas regras do servidor, só para avisar antes de avançar. */
  function validarEtapa(): string | null {
    if (etapa === "dados") {
      if (dados.nome.trim().split(/\s+/).length < 2) return "Informe seu nome completo.";
      if (!isCPFValido(dados.cpf)) return "CPF inválido.";
      if (!dados.nascimento) return "Informe sua data de nascimento.";
      if (dados.telefone.replace(/\D/g, "").length < 10) return "Informe um telefone com DDD.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email.trim())) return "E-mail inválido.";
      if (dados.cep.replace(/\D/g, "").length !== 8) return "CEP inválido.";
      if (!dados.endereco.trim() || !dados.numero.trim() || !dados.bairro.trim() || !dados.cidade.trim() || !dados.estado.trim()) {
        return "Preencha o endereço completo.";
      }
      if (camposContrato.includes("rg") && !dados.rg.trim()) return "Informe seu RG.";
    }
    if (etapa === "foto" && !foto) return "Tire ou envie uma foto do seu rosto.";
    if (etapa === "plano" && !plano) return "Escolha um plano.";
    if (etapa === "senha") {
      if (dados.senha.length < SENHA_TAMANHO_MINIMO) return `A senha precisa ter pelo menos ${SENHA_TAMANHO_MINIMO} caracteres.`;
      if (dados.senha !== confirmarSenha) return "As senhas não conferem.";
    }
    return null;
  }

  function avancar() {
    const erro = validarEtapa();
    if (erro) {
      setError(erro);
      return;
    }
    setError("");
    setEtapaIndex((i) => Math.min(i + 1, etapas.length - 1));
    window.scrollTo({ top: 0 });
  }

  function voltar() {
    setError("");
    setEtapaIndex((i) => Math.max(i - 1, 0));
    window.scrollTo({ top: 0 });
  }

  async function concluir() {
    if (!dados.aceiteTermos) {
      setError("É preciso aceitar os termos para concluir o cadastro.");
      return;
    }
    if (!foto) return;
    setError("");
    setEnviando(true);
    try {
      const formData = new FormData();
      formData.set("dados", JSON.stringify(dados));
      formData.set("foto", foto.blob, "foto.jpg");
      formData.set("website", honeypotRef.current?.value ?? "");
      const result = await enviarAutocadastro(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSucesso(result);
      window.scrollTo({ top: 0 });
    } catch {
      setError("Não foi possível enviar o cadastro. Verifique sua conexão e tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  async function pagarAgora() {
    if (!sucesso) return;
    setEntrando(true);
    setError("");
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email: sucesso.email, password: dados.senha });
    if (authError) {
      setEntrando(false);
      setError("Não foi possível entrar automaticamente. Use o Portal do Associado com seu e-mail e senha.");
      return;
    }
    router.push("/portal/mensalidades");
    router.refresh();
  }

  if (sucesso) {
    return (
      <Tela>
        <div className="rounded-[10px] border border-gray-200 bg-white p-5 text-center shadow-sm">
          <CheckCircle2 size={40} className="mx-auto text-success-600" />
          <h2 className="mt-3 text-lg font-semibold text-gray-900">Cadastro recebido!</h2>
          <p className="mt-1 text-sm text-gray-500">Seu número de associado é</p>
          <p className="text-2xl font-bold text-gray-900">{sucesso.numero}</p>
        </div>

        <div className="mt-4 space-y-3 rounded-[10px] border border-gray-200 bg-white p-5 text-sm text-gray-600 shadow-sm">
          <p>
            <strong className="text-gray-800">1. Assine o contrato:</strong> enviamos o contrato para <strong>{sucesso.email}</strong>.
            Confira também a caixa de spam.
          </p>
          <p>
            <strong className="text-gray-800">2. Pague a 1ª mensalidade:</strong>{" "}
            {sucesso.primeiraParcela
              ? `${formatCurrency(sucesso.primeiraParcela.valor)}, com vencimento em ${formatDate(sucesso.primeiraParcela.vencimento)}.`
              : "a cobrança aparece no Portal do Associado."}{" "}
            Seu acesso ao parque é liberado assim que o pagamento for confirmado.
          </p>
        </div>

        {error && <Erro mensagem={error} />}

        {sucesso.acessoCriado ? (
          <div className="mt-4 space-y-3">
            <button
              type="button"
              onClick={pagarAgora}
              disabled={entrando}
              className="h-12 w-full rounded-[6px] bg-primary-600 text-base font-semibold text-white transition-colors hover:bg-primary-700 disabled:bg-gray-300"
            >
              {entrando ? "Entrando..." : "Pagar agora"}
            </button>
            <Link
              href="/portal/login"
              className="flex h-12 w-full items-center justify-center rounded-[6px] border border-gray-300 bg-white text-base font-medium text-gray-700"
            >
              Pagar depois
            </Link>
            <p className="text-center text-xs text-gray-500">
              Para pagar depois, entre no Portal do Associado com seu e-mail e a senha que você criou.
            </p>
          </div>
        ) : (
          <p className="mt-4 rounded-[6px] border border-warning-600/30 bg-warning-50 px-3 py-2.5 text-sm text-warning-700">
            Não conseguimos criar seu acesso ao Portal do Associado. Procure a secretaria do parque para liberar o acesso e
            pagar a 1ª mensalidade.
          </p>
        )}
      </Tela>
    );
  }

  return (
    <Tela>
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            Etapa {etapaIndex + 1} de {etapas.length}
          </span>
          <span className="font-medium text-gray-700">{ETAPA_TITULO[etapa]}</span>
        </div>
        <div className="mt-2 flex gap-1">
          {etapas.map((e, i) => (
            <div key={e} className={cn("h-1 flex-1 rounded-full", i <= etapaIndex ? "bg-primary-600" : "bg-gray-200")} />
          ))}
        </div>
      </div>

      <div className="rounded-[10px] border border-gray-200 bg-white p-5 shadow-sm">
        {etapa === "dados" && (
          <div className="space-y-4">
            <Campo label="Nome completo" required>
              <input className={inputClass} value={dados.nome} onChange={(e) => update({ nome: e.target.value })} autoComplete="name" />
            </Campo>
            <Campo label="CPF" required>
              <input
                className={inputClass}
                value={dados.cpf}
                onChange={(e) => update({ cpf: formatCPF(e.target.value) })}
                placeholder="000.000.000-00"
                inputMode="numeric"
                maxLength={14}
              />
            </Campo>
            <Campo label="RG" required={camposContrato.includes("rg")}>
              <input
                className={inputClass}
                value={dados.rg}
                onChange={(e) => update({ rg: formatRG(e.target.value) })}
                placeholder="00.000.000-0"
                maxLength={12}
              />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Nascimento" required>
                <input type="date" className={inputClass} value={dados.nascimento} onChange={(e) => update({ nascimento: e.target.value })} />
              </Campo>
              <Campo label="Sexo">
                <select className={inputClass} value={dados.sexo} onChange={(e) => update({ sexo: e.target.value })}>
                  <option value="">Selecione</option>
                  <option value="Feminino">Feminino</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Outro">Outro</option>
                </select>
              </Campo>
            </div>
            <Campo label="Telefone" required>
              <input
                className={inputClass}
                value={dados.telefone}
                onChange={(e) => update({ telefone: formatPhone(e.target.value) })}
                placeholder="(00) 00000-0000"
                inputMode="tel"
                autoComplete="tel"
                maxLength={15}
              />
            </Campo>
            <Campo label="WhatsApp">
              <input
                className={inputClass}
                value={dados.whatsapp}
                onChange={(e) => update({ whatsapp: formatPhone(e.target.value) })}
                placeholder="(00) 00000-0000"
                inputMode="tel"
                maxLength={15}
              />
            </Campo>
            <Campo label="E-mail" required>
              <input
                type="email"
                className={inputClass}
                value={dados.email}
                onChange={(e) => update({ email: e.target.value })}
                placeholder="seu@email.com"
                inputMode="email"
                autoComplete="email"
              />
              <span className="mt-1 block text-[11px] text-gray-400">O contrato para assinatura será enviado para este e-mail.</span>
            </Campo>

            <div className="border-t border-gray-100 pt-4">
              <Campo label="CEP" required>
                <input
                  className={inputClass}
                  value={dados.cep}
                  onChange={(e) => update({ cep: formatCEP(e.target.value) })}
                  onBlur={handleCepBlur}
                  placeholder="00000-000"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={9}
                />
                {buscandoCep && <span className="mt-1 block text-[11px] text-gray-400">Buscando endereço...</span>}
              </Campo>
            </div>
            <Campo label="Endereço" required>
              <input className={inputClass} value={dados.endereco} onChange={(e) => update({ endereco: e.target.value })} />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Número" required>
                <input className={inputClass} value={dados.numero} onChange={(e) => update({ numero: e.target.value })} />
              </Campo>
              <Campo label="Complemento">
                <input className={inputClass} value={dados.complemento} onChange={(e) => update({ complemento: e.target.value })} />
              </Campo>
            </div>
            <Campo label="Bairro" required>
              <input className={inputClass} value={dados.bairro} onChange={(e) => update({ bairro: e.target.value })} />
            </Campo>
            <div className="grid grid-cols-[1fr_5rem] gap-3">
              <Campo label="Cidade" required>
                <input className={inputClass} value={dados.cidade} onChange={(e) => update({ cidade: e.target.value })} />
              </Campo>
              <Campo label="UF" required>
                <input
                  className={inputClass}
                  value={dados.estado}
                  onChange={(e) => update({ estado: e.target.value.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 2) })}
                  maxLength={2}
                />
              </Campo>
            </div>
          </div>
        )}

        {etapa === "foto" && (
          <div className="text-center">
            <p className="text-sm text-gray-600">
              A foto identifica você na entrada do parque. Tire uma foto do rosto, de frente, sem óculos escuros ou boné e em um
              lugar bem iluminado.
            </p>
            <div className="mx-auto mt-5 flex h-48 w-48 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-gray-300 bg-gray-50">
              {foto ? (
                // eslint-disable-next-line @next/next/no-img-element -- pré-visualização local (blob:)
                <img src={foto.preview} alt="Sua foto" className="h-full w-full object-cover" />
              ) : (
                <Camera size={40} className="text-gray-300" />
              )}
            </div>
            <input ref={fotoInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleFoto} />
            <button
              type="button"
              onClick={() => fotoInputRef.current?.click()}
              disabled={processandoFoto}
              className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-[6px] border border-primary-600 px-5 text-base font-semibold text-primary-700 disabled:opacity-50"
            >
              <Camera size={18} />
              {processandoFoto ? "Processando..." : foto ? "Tirar outra foto" : "Tirar foto"}
            </button>
          </div>
        )}

        {etapa === "plano" && (
          <div className="space-y-3">
            {planos.map((p) => {
              const selecionado = p.id === dados.planoId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => escolherPlano(p)}
                  className={cn(
                    "w-full rounded-[8px] border p-4 text-left transition-colors",
                    selecionado ? "border-primary-500 bg-primary-50 ring-2 ring-primary-100" : "border-gray-200 bg-white",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-gray-900">{p.nome}</p>
                      <p className="mt-0.5 text-sm text-gray-600">
                        <strong className="text-gray-900">{formatCurrency(p.valor)}</strong>/mês · {p.quantidadeMensalidades} mensalidades
                      </p>
                    </div>
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                        selecionado ? "border-primary-600 bg-primary-600 text-white" : "border-gray-300",
                      )}
                    >
                      {selecionado && <Check size={13} strokeWidth={3} />}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    {p.dependentesPermitidos > 0 ? `Até ${p.dependentesPermitidos} dependente(s)` : "Sem dependentes"} ·{" "}
                    {p.vencimentoNaContratacao ? "vence todo mês no dia da contratação" : `vence todo dia ${p.diaVencimento}`}
                  </p>
                  {p.beneficios.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-gray-600">
                      {p.beneficios.map((b) => (
                        <li key={b} className="flex items-center gap-1.5">
                          <Check size={12} className="text-success-600" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {etapa === "dependentes" && plano && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              O plano {plano.nome} permite até {plano.dependentesPermitidos} dependente(s). Esta etapa é opcional.
            </p>

            {dados.dependentes.length > 0 && (
              <ul className="divide-y divide-gray-100 rounded-[6px] border border-gray-200">
                {dados.dependentes.map((d, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{d.nome}</p>
                      <p className="text-xs text-gray-500">{d.parentesco}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => update({ dependentes: dados.dependentes.filter((_, j) => j !== i) })}
                      className="p-2 text-gray-400 hover:text-danger-600"
                      aria-label={`Remover ${d.nome}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {dados.dependentes.length < plano.dependentesPermitidos ? (
              <div className="space-y-3 rounded-[6px] border border-dashed border-gray-300 p-3">
                <Campo label="Nome do dependente" required>
                  <input className={inputClass} value={depDraft.nome} onChange={(e) => setDepDraft({ ...depDraft, nome: e.target.value })} />
                </Campo>
                <Campo label="Parentesco" required>
                  <select
                    className={inputClass}
                    value={depDraft.parentesco}
                    onChange={(e) => setDepDraft({ ...depDraft, parentesco: e.target.value })}
                  >
                    <option value="">Selecione</option>
                    <option value="Cônjuge">Cônjuge</option>
                    <option value="Filho">Filho(a)</option>
                    <option value="Pai">Pai</option>
                    <option value="Mãe">Mãe</option>
                    <option value="Outro">Outro</option>
                  </select>
                </Campo>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="CPF">
                    <input
                      className={inputClass}
                      value={depDraft.cpf}
                      onChange={(e) => setDepDraft({ ...depDraft, cpf: formatCPF(e.target.value) })}
                      inputMode="numeric"
                      maxLength={14}
                    />
                  </Campo>
                  <Campo label="Nascimento">
                    <input
                      type="date"
                      className={inputClass}
                      value={depDraft.nascimento}
                      onChange={(e) => setDepDraft({ ...depDraft, nascimento: e.target.value })}
                    />
                  </Campo>
                </div>
                <button
                  type="button"
                  onClick={adicionarDependente}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[6px] border border-primary-600 text-sm font-semibold text-primary-700"
                >
                  <Plus size={16} />
                  Adicionar dependente
                </button>
              </div>
            ) : (
              <p className="text-xs text-gray-500">Você atingiu o limite de dependentes do plano.</p>
            )}
          </div>
        )}

        {etapa === "senha" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Com o e-mail <strong>{dados.email}</strong> e esta senha você entra no Portal do Associado para pagar mensalidades e
              ver sua credencial.
            </p>
            <Campo label="Senha" required>
              <input
                type="password"
                className={inputClass}
                value={dados.senha}
                onChange={(e) => update({ senha: e.target.value })}
                autoComplete="new-password"
              />
              <span className="mt-1 block text-[11px] text-gray-400">Mínimo de {SENHA_TAMANHO_MINIMO} caracteres.</span>
            </Campo>
            <Campo label="Confirme a senha" required>
              <input
                type="password"
                className={inputClass}
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                autoComplete="new-password"
              />
            </Campo>
          </div>
        )}

        {etapa === "revisao" && plano && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-3">
              {foto && (
                // eslint-disable-next-line @next/next/no-img-element -- pré-visualização local (blob:)
                <img src={foto.preview} alt="Sua foto" className="h-14 w-14 rounded-full object-cover" />
              )}
              <div>
                <p className="font-semibold text-gray-900">{dados.nome}</p>
                <p className="text-xs text-gray-500">CPF {dados.cpf}</p>
              </div>
            </div>
            <dl className="space-y-1.5 rounded-[6px] bg-gray-50 p-3 text-gray-600">
              <div className="flex justify-between gap-3">
                <dt>E-mail</dt>
                <dd className="text-right text-gray-800">{dados.email}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Telefone</dt>
                <dd className="text-right text-gray-800">{dados.telefone}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Endereço</dt>
                <dd className="text-right text-gray-800">
                  {dados.endereco}, {dados.numero} — {dados.cidade}/{dados.estado}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Plano</dt>
                <dd className="text-right text-gray-800">
                  {plano.nome} · {formatCurrency(plano.valor)}/mês
                </dd>
              </div>
              {dados.dependentes.length > 0 && (
                <div className="flex justify-between gap-3">
                  <dt>Dependentes</dt>
                  <dd className="text-right text-gray-800">{dados.dependentes.map((d) => d.nome).join(", ")}</dd>
                </div>
              )}
            </dl>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={dados.aceiteTermos}
                onChange={(e) => update({ aceiteTermos: e.target.checked })}
              />
              <span className="text-xs text-gray-600">
                Confirmo que os dados são verdadeiros, aceito as condições do plano escolhido e autorizo o Aqua Park a usar meus
                dados e minha foto para cadastro, cobrança e controle de acesso ao parque, conforme a Lei Geral de Proteção de
                Dados (LGPD).
              </span>
            </label>
          </div>
        )}

        {/* Campo-isca para robôs: invisível e fora da navegação por teclado. */}
        <input
          ref={honeypotRef}
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute -left-[9999px] h-0 w-0 opacity-0"
        />
      </div>

      {error && <Erro mensagem={error} />}

      <div className="mt-4 flex gap-3">
        {etapaIndex > 0 && (
          <button
            type="button"
            onClick={voltar}
            disabled={enviando}
            className="flex h-12 items-center justify-center gap-1.5 rounded-[6px] border border-gray-300 bg-white px-4 text-base font-medium text-gray-700"
          >
            <ArrowLeft size={18} />
            Voltar
          </button>
        )}
        {etapa === "revisao" ? (
          <button
            type="button"
            onClick={concluir}
            disabled={enviando}
            className="h-12 flex-1 rounded-[6px] bg-primary-600 text-base font-semibold text-white transition-colors hover:bg-primary-700 disabled:bg-gray-300"
          >
            {enviando ? "Enviando..." : "Concluir cadastro"}
          </button>
        ) : (
          <button
            type="button"
            onClick={avancar}
            disabled={processandoFoto}
            className="h-12 flex-1 rounded-[6px] bg-primary-600 text-base font-semibold text-white transition-colors hover:bg-primary-700 disabled:bg-gray-300"
          >
            Continuar
          </button>
        )}
      </div>

      {etapaIndex === 0 && (
        <p className="mt-5 text-center text-sm text-gray-500">
          Já é associado?{" "}
          <Link href="/portal/login" className="font-medium text-primary-600">
            Entre no Portal
          </Link>
        </p>
      )}
    </Tela>
  );
}

function Tela({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-primary-600 text-white shadow-sm">
            <Waves size={24} strokeWidth={2.25} />
          </div>
          <h1 className="mt-3 text-lg font-semibold text-gray-900">Seja associado</h1>
          <p className="text-sm text-gray-500">Aqua Park</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function Erro({ mensagem }: { mensagem: string }) {
  return (
    <div className="mt-4 rounded-[6px] border border-danger-600/30 bg-danger-50 px-3 py-2.5 text-sm text-danger-700">{mensagem}</div>
  );
}
