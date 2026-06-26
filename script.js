// script.js
// Script unificado que gerencia as chamadas HTTP e a interface de usuário

const API_URL = "https://gestao-residencial-api.deniscrvo.workers.dev";
let meuGrafico;

document.addEventListener("DOMContentLoaded", () => {
    const mesAtual = new Date().getMonth() + 1; // 1-12
    const proximoMes = mesAtual === 12 ? 1 : mesAtual + 1;
    document.getElementById("filtro-mes").value = proximoMes;

    carregarDadosDashboard();

    document.getElementById("filtro-ano").addEventListener("change", carregarDadosDashboard);
    document.getElementById("filtro-mes").addEventListener("change", carregarDadosDashboard);
    document.getElementById("form-despesa").addEventListener("submit", salvarDespesa);
    document.getElementById("form-folha").addEventListener("submit", calcularFolha);
});

// --- FUNÇÕES DO DASHBOARD GERAL ---

async function carregarDadosDashboard() {
    const ano = document.getElementById("filtro-ano").value;
    try {
        const response = await fetch(`${API_URL}/api/dashboard?ano=${ano}`);
        const dados = await response.json();
        
        atualizarKPIs(dados);
        renderizarGrafico(dados);
    } catch (error) {
        console.error("Erro ao carregar dados do dashboard:", error);
    }
}

const CATEGORIAS_CARTAO = ["NUBANK", "BRADESCO", "ITAU", "SANTANDER", "INTER", "C6", "CARTAO"];

function atualizarKPIs(dados) {
    const mesAtual = new Date().getMonth() + 1;
    const proximoMes = mesAtual === 12 ? 1 : mesAtual + 1;
    const nomesMes = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

    const dadosMes = dados.find(d => d.mes === proximoMes) || {};
    const despesas = dadosMes.despesas || [];

    const totalCartoes = despesas
        .filter(d => CATEGORIAS_CARTAO.some(c => d.categoria.toUpperCase().includes(c)))
        .reduce((acc, d) => acc + d.valor, 0);

    const label = `Próx. mês: ${nomesMes[proximoMes - 1]}`;

    document.getElementById("kpi-cartoes").innerText = formatarMoeda(totalCartoes);
    document.getElementById("kpi-paula").innerText   = formatarMoeda(dadosMes.custoPaula || 0);
    document.getElementById("kpi-total").innerText   = formatarMoeda(dadosMes.totalGeral || 0);

    document.querySelectorAll(".kpi-mes-ref").forEach(el => el.textContent = label);
}

function renderizarGrafico(dados) {
    const ctx = document.getElementById("graficoProjecao").getContext("2d");
    const labels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const valores = dados.map(d => d.totalGeral);

    if (meuGrafico) meuGrafico.destroy();

    const projecaoMensal = Array(12).fill(13500);

    meuGrafico = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Custo Total Acumulado (R$)',
                    data: valores,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: '#10b981'
                },
                {
                    type: 'line',
                    label: 'Projeção Mensal (R$)',
                    data: projecaoMensal,
                    borderColor: '#f59e0b',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [6, 4],
                    pointRadius: 0,
                    tension: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true, labels: { color: '#94a3b8', boxWidth: 20 } } },
            scales: {
                y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}

// --- FUNÇÕES DE LANÇAMENTO ---

async function salvarDespesa(e) {
    e.preventDefault();
    const ano = document.getElementById("filtro-ano").value;
    const mes = parseInt(document.getElementById("form-mes-despesa").value);
    const categoria = document.getElementById("form-categoria").value.toUpperCase();
    const valor = parseFloat(document.getElementById("form-valor").value);
    const tipo = document.getElementById("form-tipo").value;

    const payload = { ano, mes, categoria, valor, tipo };

    try {
        const response = await fetch(`${API_URL}/api/despesa`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            document.getElementById("form-despesa").reset();
            carregarDadosDashboard(); // Atualiza o gráfico imediatamente
        }
    } catch (error) {
        console.error("Erro ao salvar despesa:", error);
    }
}

async function calcularFolha(e) {
    e.preventDefault();
    const ano = document.getElementById("filtro-ano").value;
    const mes = document.getElementById("mes_ref").value;
    
    const payload = {
        ano: ano,
        mes: mes,
        salario_base: document.getElementById("salario_base").value,
        dias_uteis_vt: document.getElementById("dias_uteis_vt").value,
        valor_passagem: document.getElementById("valor_passagem").value,
        adiantamento_salario: document.getElementById("adiantamento_salario").value || 0,
        adiantamento_13: document.getElementById("adiantamento_13").value || 0,
        ferias_dias: document.getElementById("ferias_dias").value,
        vende_ferias: document.getElementById("vende_ferias").checked
    };

    try {
        const response = await fetch(`${API_URL}/api/folha`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const resultado = await response.json();
            
            // Atualiza os cards de resultados na tela
            document.getElementById("res_paula").innerText = formatarMoeda(resultado.pagamento_direto_paula);
            document.getElementById("res_esocial").innerText = formatarMoeda(resultado.guia_esocial);
            document.getElementById("res_vt").innerText = formatarMoeda(resultado.custo_passagens_compradas);
            document.getElementById("res_total").innerText = formatarMoeda(resultado.custo_total_empregador);
            
            // Recarrega o gráfico para refletir a nova folha salva no banco
            carregarDadosDashboard();
        }
    } catch (error) {
        console.error("Erro ao calcular/salvar folha:", error);
    }
}

// --- UTILITÁRIOS ---

function formatarMoeda(valor) {
    return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}