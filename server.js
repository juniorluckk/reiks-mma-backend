require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const axios = require('axios');
const OpenAI = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Prompt de Sistema (Regras do Bot)
const SYSTEM_PROMPT = `Você é o assistente virtual da reiks MMA. 
Seu objetivo é agendar aulas experimentais. Seja educado, direto e sem enrolação.
Faça uma pergunta por vez. 
Colete: 1) Nome, 2) Data de nascimento, 3) Dia e horário da aula. 
Se o cliente desviar o assunto, traga-o de volta para o agendamento. Respostas curtas!`;

// Função para enviar mensagem via Evolution API
async function sendMessage(phone, text) {
    try {
        const url = `${process.env.EVOLUTION_API_URL}/message/sendText/reiks`; // "reiks" será o nome da nossa instância
        await axios.post(url, {
            number: phone,
            text: text
        }, {
            headers: { 'apikey': process.env.EVOLUTION_API_KEY }
        });
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error?.response?.data || error.message);
    }
}

app.post('/webhook/evolution', async (req, res) => {
    // A Evolution API sempre manda a requisição pra cá. Vamos responder rápido com 200 OK
    res.status(200).send('Webhook Recebido');

    try {
        const data = req.body;
        // Filtra para processar apenas mensagens recebidas de texto (ignora status, mensagens do próprio bot, etc)
        if (!data.data || !data.data.message || data.data.key.fromMe) return;

        const phone = data.data.key.remoteJid.replace('@s.whatsapp.net', '');
        const textMessage = data.data.message.conversation || data.data.message.extendedTextMessage?.text;
        
        if (!textMessage) return;

        // 1. Busca ou cria o Lead no banco de dados
        let leadResult = await pool.query('SELECT * FROM leads WHERE phone = $1', [phone]);
        let lead;

        if (leadResult.rows.length === 0) {
            const insertLead = await pool.query(
                "INSERT INTO leads (phone, bot_status) VALUES ($1, 'active') RETURNING *",
                [phone]
            );
            lead = insertLead.rows[0];
        } else {
            lead = leadResult.rows[0];
        }

        // 2. Salva a mensagem do Lead no histórico
        await pool.query(
            "INSERT INTO messages (lead_id, sender_type, content) VALUES ($1, 'lead', $2)",
            [lead.id, textMessage]
        );

        // 3. Verifica se o bot está pausado para esse lead (Atendente Humano assumiu)
        if (lead.bot_status === 'paused') {
            console.log(`Bot pausado para o número ${phone}. Ignorando requisição à IA.`);
            return; 
        }

        // 4. Se o bot está ativo, busca o histórico de mensagens para dar contexto à IA
        const historyResult = await pool.query(
            "SELECT sender_type, content FROM messages WHERE lead_id = $1 ORDER BY created_at ASC LIMIT 15",
            [lead.id]
        );

        const openAiMessages = [ { role: 'system', content: SYSTEM_PROMPT } ];
        
        // Mapeia o histórico do banco para o formato que a OpenAI entende
        historyResult.rows.forEach(msg => {
            const role = (msg.sender_type === 'bot') ? 'assistant' : 'user';
            openAiMessages.push({ role: role, content: msg.content });
        });

        // 5. Chama a Inteligência Artificial
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo", // Podemos mudar para gpt-4o depois para ficar mais inteligente
            messages: openAiMessages,
            temperature: 0.7,
        });

        const botResponse = completion.choices[0].message.content;

        // 6. Salva a resposta do Bot no banco e envia pro WhatsApp
        await pool.query(
            "INSERT INTO messages (lead_id, sender_type, content) VALUES ($1, 'bot', $2)",
            [lead.id, botResponse]
        );

        await sendMessage(phone, botResponse);

    } catch (error) {
        console.error('Erro no processamento do Webhook:', error);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
