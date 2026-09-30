"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { hojeBR } from "@/lib/datas-br";
import { formatCEP, formatCPF, formatPhone, isCPFValido } from "@/lib/utils";
import {
  BUCKET_FOTOS,
  camposExigidosPeloContrato,
  criarAcessoAutomatico,
  criarContratoEMensalidades,
  enviarFoto,
  gerarEEnviarContratoAutomatico,
  validarFoto,
} from "@/lib/associados/cadastro";
import { getPlanosAutocadastro } from "@/lib/associados/autocadastro";
import { AutocadastroDados, SENHA_TAMANHO_MINIMO } from "@/lib/associados/autocadastro-tipos";

const LIMITE_TENTATIVAS_POR_HORA = 5;
const IDADE_MINIMA_TITULAR = 18;
const MENSAGEM_DADOS_EM_USO =
  "Não foi possível concluir o cadastro com esses dados. Se você já é associado, entre pelo Portal do Associado ou procure a secretaria do parque.";

export type AutocadastroResultado =
  | { error: string }
  | {
      ok: true;
      numero: string;
      email: string;
      acessoCriado: boolean;
      primeiraParcela: { valor: number; vencimento: string } | null;
    };

function idadeEm(nascimento: string, hoje: string): number {
  const [a, m, d] = nascimento.split("-").map(Number);
  const [ha, hm, hd] = hoje.split("-").map(Number);
  return ha - a - (hm < m || (hm === m && hd < d) ? 1 : 0);
}

function dataValida(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

/** Validação completa no servidor — a página pública não é confiável. */
function validar(dados: AutocadastroDados, hoje: string): string | null {
  if (dados.nome.trim().split(/\s+/).length < 2) return "Informe seu nome completo.";
  if (!isCPFValido(dados.cpf)) return "CPF inválido.";
  if (!dataValida(dados.nascimento) || dados.nascimento >= hoje) return "Data de nascimento inválida.";
  if (idadeEm(dados.nascimento, hoje) < IDADE_MINIMA_TITULAR) {
    return "O titular precisa ter 18 anos ou mais. Menores entram como dependentes de um responsável.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email.trim())) return "E-mail inválido.";
  if (dados.telefone.replace(/\D/g, "").length < 10) return "Informe um telefone com DDD.";
  if (dados.cep.replace(/\D/g, "").length !== 8) return "CEP inválido.";
  if (!dados.endereco.trim() || !dados.numero.trim() || !dados.bairro.trim() || !dados.cidade.trim()) {
    return "Preencha o endereço completo.";
  }
  if (!/^[A-Za-z]{2}$/.test(dados.estado.trim())) return "Informe a UF do estado (ex: SP).";
  if (dados.senha.length < SENHA_TAMANHO_MINIMO) return `A senha precisa ter pelo menos ${SENHA_TAMANHO_MINIMO} caracteres.`;
  if (!dados.aceiteTermos) return "É preciso aceitar os termos para concluir o cadastro.";

  for (const d of dados.dependentes) {
    if (!d.nome.trim() || !d.parentesco.trim()) return "Preencha nome e parentesco de todos os dependentes.";
    if (d.cpf && !isCPFValido(d.cpf)) return `CPF inválido no dependente ${d.nome}.`;
    if (d.nascimento && (!dataValida(d.nascimento) || d.nascimento > hoje)) {
      return `Data de nascimento inválida no dependente ${d.nome}.`;
    }
  }
  return null;
}

async function ipDaRequisicao(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconhecido";
}

/**
 * Autocadastro público: cria o associado como "Pendente" (vira "Ativo" quando
 * a 1ª parcela é paga, pela mesma regra do cadastro feito pela equipe), com
 * contrato, mensalidades, credencial, acesso ao Portal e contrato enviado para
 * assinatura. Roda com a service role porque não há sessão — por isso tudo é
 * revalidado aqui e o associado nunca escolhe valor, desconto ou datas.
 */
export async function enviarAutocadastro(formData: FormData): Promise<AutocadastroResultado> {
  // Campo invisível para humanos: se veio preenchido, foi um robô.
  if (formData.get("website")) return { error: "Não foi possível concluir o cadastro." };

  let dados: AutocadastroDados;
  try {
    dados = JSON.parse(String(formData.get("dados") ?? ""));
  } catch {
    return { error: "Dados inválidos. Recarregue a página e tente novamente." };
  }
  if (!Array.isArray(dados?.dependentes)) dados.dependentes = [];

  const hoje = hojeBR();
  const erroValidacao = validar(dados, hoje);
  if (erroValidacao) return { error: erroValidacao };

  const foto = validarFoto(formData.get("foto"));
  if ("error" in foto) return foto;

  const admin = createAdminClient();

  // Limite de tentativas por IP — protege a página pública contra cadastros em massa.
  const ip = await ipDaRequisicao();
  const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: tentativas } = await admin
    .from("autocadastro_tentativas")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("criado_em", umaHoraAtras);
  if ((tentativas ?? 0) >= LIMITE_TENTATIVAS_POR_HORA) {
    return { error: "Muitas tentativas de cadastro. Aguarde um pouco e tente novamente." };
  }
  await admin.from("autocadastro_tentativas").insert({ ip });

  // Dados que o modelo de contrato padrão usa: sem eles o contrato não sai.
  const faltandoParaContrato = (await camposExigidosPeloContrato(admin)).filter(
    (v) => !String(dados[v.campo] ?? "").trim(),
  );
  if (faltandoParaContrato.length > 0) {
    return { error: `Preencha: ${faltandoParaContrato.map((v) => v.label).join(", ")}.` };
  }

  const planos = await getPlanosAutocadastro(admin);
  const plano = planos.find((p) => p.id === dados.planoId);
  if (!plano) return { error: "O plano escolhido não está mais disponível. Escolha outro plano." };
  if (dados.dependentes.length > plano.dependentesPermitidos) {
    return {
      error:
        plano.dependentesPermitidos === 0
          ? "O plano escolhido não permite dependentes."
          : `O plano escolhido permite até ${plano.dependentesPermitidos} dependente(s).`,
    };
  }

  const cpf = formatCPF(dados.cpf);
  const email = dados.email.trim().toLowerCase();

  // Dados já em uso: mensagem genérica, que não confirma se o CPF ou o e-mail existem.
  const [{ count: cpfEmUso }, { count: emailEmUsoAssociado }, { count: emailEmUsoAcesso }] = await Promise.all([
    admin.from("associados").select("id", { count: "exact", head: true }).in("cpf", [cpf, cpf.replace(/\D/g, "")]),
    admin.from("associados").select("id", { count: "exact", head: true }).ilike("email", email),
    admin.from("associado_acessos").select("id", { count: "exact", head: true }).ilike("email", email),
  ]);
  if (cpfEmUso || emailEmUsoAssociado || emailEmUsoAcesso) return { error: MENSAGEM_DADOS_EM_USO };

  // Foto primeiro: o associado só é criado se ela foi guardada (é obrigatória).
  const fotoEnviada = await enviarFoto(admin, foto);
  if ("error" in fotoEnviada) return fotoEnviada;
  const caminhoFoto = fotoEnviada.caminho;

  async function desfazer(associadoId?: string) {
    if (associadoId) await admin.from("associados").delete().eq("id", associadoId);
    await admin.storage.from(BUCKET_FOTOS).remove([caminhoFoto]);
  }

  const { data: associado, error: associadoError } = await admin
    .from("associados")
    .insert({
      nome: dados.nome.trim(),
      cpf,
      rg: dados.rg?.trim() || null,
      nascimento: dados.nascimento,
      sexo: dados.sexo || null,
      telefone: formatPhone(dados.telefone),
      whatsapp: dados.whatsapp ? formatPhone(dados.whatsapp) : null,
      email,
      cep: formatCEP(dados.cep),
      endereco: dados.endereco.trim(),
      numero_endereco: dados.numero.trim(),
      complemento: dados.complemento.trim() || null,
      bairro: dados.bairro.trim(),
      cidade: dados.cidade.trim(),
      estado: dados.estado.trim().toUpperCase(),
      plano_id: plano.id,
      foto_url: caminhoFoto,
      origem: "autocadastro",
      status: "Pendente",
    })
    .select("id, numero")
    .single();
  if (associadoError || !associado) {
    await desfazer();
    // Corrida com outro cadastro do mesmo CPF (unique) cai aqui.
    if (associadoError?.code === "23505") return { error: MENSAGEM_DADOS_EM_USO };
    console.error("Autocadastro: falha ao criar associado:", associadoError?.message);
    return { error: "Não foi possível concluir o cadastro. Tente novamente." };
  }
  const associadoId = associado.id as string;

  if (dados.dependentes.length > 0) {
    const { error: dependentesError } = await admin.from("dependentes").insert(
      dados.dependentes.map((d) => ({
        associado_id: associadoId,
        nome: d.nome.trim(),
        cpf: d.cpf ? formatCPF(d.cpf) : null,
        parentesco: d.parentesco.trim(),
        nascimento: d.nascimento || null,
      })),
    );
    if (dependentesError) {
      await desfazer(associadoId);
      console.error("Autocadastro: falha ao criar dependentes:", dependentesError.message);
      return { error: "Não foi possível salvar os dependentes. Tente novamente." };
    }
  }

  const contrato = await criarContratoEMensalidades(admin, { associadoId, planoId: plano.id, dataInicio: hoje });
  if (contrato.error) {
    await desfazer(associadoId);
    console.error("Autocadastro: falha ao criar contrato:", contrato.error);
    return { error: "Não foi possível concluir o cadastro. Tente novamente ou procure a secretaria." };
  }

  await admin.from("credenciais").insert({ associado_id: associadoId });

  const acessoCriado = await criarAcessoAutomatico(associadoId, email, dados.senha);

  const avisoContrato = await gerarEEnviarContratoAutomatico(admin, {
    associadoId,
    associadoNome: dados.nome.trim(),
    associadoEmail: email,
    dataContrato: hoje,
    geradoPor: null,
  });
  if (avisoContrato) console.error(`Autocadastro ${associado.numero}: ${avisoContrato}`);

  const { data: primeira } = await admin
    .from("mensalidades")
    .select("valor, vencimento")
    .eq("associado_id", associadoId)
    .order("numero_parcela")
    .limit(1)
    .maybeSingle();

  revalidatePath("/associados");
  return {
    ok: true,
    numero: associado.numero as string,
    email,
    acessoCriado,
    primeiraParcela: primeira ? { valor: Number(primeira.valor), vencimento: primeira.vencimento as string } : null,
  };
}
