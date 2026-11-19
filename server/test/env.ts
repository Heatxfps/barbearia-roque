// Variáveis de ambiente dos testes (importado ANTES do resto, para o config.ts já ler)
process.env.BANCO = ':memory:'
process.env.JOBS = '0'
process.env.JWT_SEGREDO = 'teste'
process.env.ADMIN_SENHA = 'senha-teste'
process.env.WHATSAPP_MODO = 'demo'
