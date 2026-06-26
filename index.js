// index.js
// Worker consolidado com as rotas de Dashboard, Despesas e Cálculo de Folha (eSocial)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
      // ---------------------------------------------------------
      // ROTA 1: DASHBOARD CONSOLIDADO (GET /api/dashboard)
      // ---------------------------------------------------------
      if (url.pathname === "/api/dashboard" && request.method === "GET") {
        const ano = url.searchParams.get("ano") || new Date().getFullYear().toString();
        
        const { results: despesas } = await env.DB.prepare(
          "SELECT mes, categoria, valor, tipo FROM despesas_gerais WHERE ano = ?"
        ).bind(ano).all();

        const { results: folhaDados } = await env.DB.prepare(
          "SELECT * FROM folha_pagamento WHERE ano = ?"
        ).bind(ano).all();

        const meses = Array.from({ length: 12 }, (_, i) => i + 1);
        const respostaConsolidada = meses.map(mes => {
          const despesasMes = despesas.filter(d => d.mes === mes);
          const dadosPaulaMes = folhaDados.find(p => p.mes === mes);

          let custoPaula = 0;
          if (dadosPaulaMes) {
             // Simulação simplificada de custo total para o gráfico
             const custoVT = dadosPaulaMes.dias_uteis_vt * dadosPaulaMes.valor_passagem;
             const baseEncargos = dadosPaulaMes.salario_base; // Simplificação para o dashboard
             const inssEmpregado = baseEncargos * 0.075;
             const encargosPatronais = baseEncargos * (0.08 + 0.008 + 0.08 + 0.032);
             custoPaula = baseEncargos + custoVT + encargosPatronais;
          } else {
             custoPaula = 13500.00; // Projeção padrão
          }

          const totalDespesas = despesasMes.reduce((acc, curr) => acc + curr.valor, 0);
          
          return {
            mes,
            custoPaula,
            despesas: despesasMes,
            totalGeral: totalDespesas + custoPaula
          };
        });

        return new Response(JSON.stringify(respostaConsolidada), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // ---------------------------------------------------------
      // ROTA 2: SALVAR DESPESA GERAL (POST /api/despesa)
      // ---------------------------------------------------------
      if (url.pathname === "/api/despesa" && request.method === "POST") {
        const body = await request.json();
        const id = crypto.randomUUID();

        await env.DB.prepare(
          "INSERT INTO despesas_gerais (id, ano, mes, categoria, valor, tipo) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(ano, mes, categoria) DO UPDATE SET valor = excluded.valor, tipo = excluded.tipo"
        ).bind(id, body.ano, body.mes, body.categoria, body.valor, body.tipo).run();

        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // ---------------------------------------------------------
      // ROTA 3: CÁLCULO E SALVAMENTO DE FOLHA (POST /api/folha)
      // ---------------------------------------------------------
      if (url.pathname === "/api/folha" && request.method === "POST") {
        const payload = await request.json();
        
        const ano = parseInt(payload.ano) || new Date().getFullYear();
        const mes = parseInt(payload.mes) || 1;
        const salario_base = parseFloat(payload.salario_base) || 0;
        const dias_uteis_vt = parseInt(payload.dias_uteis_vt) || 0;
        const valor_passagem = parseFloat(payload.valor_passagem) || 0;
        const adiantamento_salario = parseFloat(payload.adiantamento_salario) || 0;
        const adiantamento_13 = parseFloat(payload.adiantamento_13) || 0;
        const ferias_dias = parseInt(payload.ferias_dias) || 0;
        const vende_ferias = payload.vende_ferias ? 1 : 0;

        // 1. Salvar no Banco de Dados
        const id = crypto.randomUUID();
        await env.DB.prepare(
          `INSERT INTO folha_pagamento (id, ano, mes, salario_base, dias_uteis_vt, valor_passagem, adiantamento_salario, adiantamento_13, ferias_dias, vende_ferias) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
           ON CONFLICT(ano, mes) DO UPDATE SET 
           salario_base=excluded.salario_base, dias_uteis_vt=excluded.dias_uteis_vt, valor_passagem=excluded.valor_passagem, 
           adiantamento_salario=excluded.adiantamento_salario, adiantamento_13=excluded.adiantamento_13, ferias_dias=excluded.ferias_dias, vende_ferias=excluded.vende_ferias`
        ).bind(id, ano, mes, salario_base, dias_uteis_vt, valor_passagem, adiantamento_salario, adiantamento_13, ferias_dias, vende_ferias).run();

        // 2. Motor de Cálculo
        const custo_passagens_total = dias_uteis_vt * valor_passagem;
        const limite_desconto_vt = salario_base * 0.06;
        const desconto_vt = Math.min(limite_desconto_vt, custo_passagens_total);

        let vencimentos = salario_base;
        let descontos = desconto_vt + adiantamento_salario;
        let abono_pecuniario = 0;
        let terco_abono = 0;

        if (ferias_dias > 0) {
            const valor_ferias = (salario_base / 30) * ferias_dias;
            const terco_ferias = valor_ferias / 3;
            vencimentos = (salario_base / 30) * (30 - ferias_dias); 
            vencimentos += valor_ferias + terco_ferias;
        }

        if (vende_ferias === 1) {
            abono_pecuniario = (salario_base / 30) * 10;
            terco_abono = abono_pecuniario / 3;
            vencimentos += abono_pecuniario + terco_abono;
        }

        vencimentos += adiantamento_13;

        const inss_empregado = vencimentos * 0.075; 
        descontos += inss_empregado;

        const liquido_pagar_paula = vencimentos - descontos;
        const base_encargos = vencimentos - abono_pecuniario - terco_abono;
        
        const inss_patronal = base_encargos * 0.08;
        const gilrat = base_encargos * 0.008;
        const fgts = base_encargos * 0.08;
        const fgts_comp = base_encargos * 0.032;

        const guia_esocial_total = inss_empregado + inss_patronal + gilrat + fgts + fgts_comp;
        const custo_total_mensal = liquido_pagar_paula + guia_esocial_total + custo_passagens_total;

        const resumoFolha = {
            pagamento_direto_paula: liquido_pagar_paula,
            guia_esocial: guia_esocial_total,
            custo_passagens_compradas: custo_passagens_total,
            custo_total_empregador: custo_total_mensal
        };

        return new Response(JSON.stringify(resumoFolha), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response("Endpoint não encontrado", { status: 404, headers: corsHeaders });
      
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};