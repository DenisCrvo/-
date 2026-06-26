-- schema.sql
-- Este script cria ambas as tabelas necessárias para o funcionamento do sistema unificado.

CREATE TABLE IF NOT EXISTS despesas_gerais (
    id TEXT PRIMARY KEY,
    ano INTEGER NOT NULL,
    mes INTEGER NOT NULL,
    categoria TEXT NOT NULL,
    valor REAL NOT NULL,
    tipo TEXT CHECK(tipo IN ('FIXO', 'VARIAVEL')) NOT NULL,
    UNIQUE(ano, mes, categoria)
);

CREATE TABLE IF NOT EXISTS folha_pagamento (
    id TEXT PRIMARY KEY,
    ano INTEGER NOT NULL,
    mes INTEGER NOT NULL,
    salario_base REAL NOT NULL,
    dias_uteis_vt INTEGER DEFAULT 0,
    valor_passagem REAL DEFAULT 0,
    adiantamento_salario REAL DEFAULT 0,
    adiantamento_13 REAL DEFAULT 0,
    ferias_dias INTEGER DEFAULT 0,
    vende_ferias BOOLEAN DEFAULT 0,
    UNIQUE(ano, mes)
);