// server.js - Redelivery Master Backend
// Link Lab - Serkan Winchester
// Node.js 24+, Postgres no Render

const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;  // deve vir do .env
const DATABASE_URL = process.env.DATABASE_URL;

if (!API_KEY || !DATABASE_URL) {
    console.error("❌ Variáveis de ambiente API_KEY ou DATABASE_URL não definidas!");
    process.exit(1);
}

// Conexão com Postgres
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Middleware
app.use(bodyParser.json());

// Middleware de verificação de API_KEY
function verifyApiKey(req, res, next) {
    const key = req.headers['x-api-key'];
    if (!key || key !== API_KEY) {
        return res.status(401).json({ error: "Invalid API key" });
    }
    next();
}

// Health check
app.get('/health', (req, res) => {
    res.json({ status: "ok" });
});

// Recebe compra de vendor
app.post('/purchase', verifyApiKey, async (req, res) => {
    try {
        const { buyerUUID, product, vendorKey } = req.body;
        if (!buyerUUID || !product || !vendorKey) {
            return res.status(400).json({ error: "Missing parameters" });
        }

        await pool.query(
            'INSERT INTO purchases(buyer_uuid, product, vendor_key) VALUES($1, $2, $3)',
            [buyerUUID, product, vendorKey]
        );

        console.log(`✅ Compra registrada: ${buyerUUID} -> ${product} (vendor: ${vendorKey})`);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Checa duplicado e processa
app.post('/check-duplicate', verifyApiKey, async (req, res) => {
    try {
        const { giver, receiver, product, amount, vendorKey } = req.body;
        if (!giver || !receiver || !product || !amount || !vendorKey) {
            return res.status(400).json({ error: "Missing parameters" });
        }

        const result = await pool.query(
            'SELECT * FROM purchases WHERE buyer_uuid=$1 AND product=$2',
            [receiver, product]
        );

        if (result.rows.length > 0) {
            console.log(`⚠ Compra duplicada: ${giver} -> ${receiver} (${product})`);
            return res.json({ duplicate: true });
        }

        // Se não duplicado, adiciona
        await pool.query(
            'INSERT INTO purchases(buyer_uuid, product, vendor_key) VALUES($1, $2, $3)',
            [receiver, product, vendorKey]
        );

        console.log(`✅ Compra permitida: ${giver} -> ${receiver} (${product})`);
        res.json({ duplicate: false });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Retorna lista de compras de um avatar
app.get('/purchases/:avatarUUID', verifyApiKey, async (req, res) => {
    try {
        const avatarUUID = req.params.avatarUUID;
        const result = await pool.query(
            'SELECT product, vendor_key FROM purchases WHERE buyer_uuid=$1',
            [avatarUUID]
        );

        // Transforma em lista simples: [product1, vendorKey1, product2, vendorKey2, ...]
        const body = result.rows.map(r => r.product + "|" + r.vendor_key).join(';');

        res.json(body);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Inicia servidor
app.listen(PORT, () => {
    console.log(`🚀 Redelivery Master backend rodando na porta ${PORT}`);
});
