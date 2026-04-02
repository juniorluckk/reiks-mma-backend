require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// Conexão com o PostgreSQL que você criou
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

pool.connect()
    .then(() => console.log('✅ Conectado ao PostgreSQL com sucesso!'))
    .catch(err => console.error('❌ Erro ao conectar no banco:', err.stack));

// Rota de teste
app.get('/', (req, res) => {
    res.send('API da reiks MMA está online! 🥊');
});

// Webhook para a Evolution API (WhatsApp)
app.post('/webhook/evolution', async (req, res) => {
    const data = req.body;
    console.log('Mensagem recebida do Zap:', JSON.stringify(data, null, 2));
    
    // Aqui nas próximas etapas vamos colocar a lógica da IA e a Pausa de Atendimento
    
    res.status(200).send('Webhook Recebido');
});

// O Easypanel injeta a porta automaticamente, ou usamos a 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
