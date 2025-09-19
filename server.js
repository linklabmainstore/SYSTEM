// server.js
const express = require('express');
const bodyParser = require('body-parser');
const { createClient } = require('redis');

const app = express();
app.use(bodyParser.json());

// Conecta ao Redis usando a variável de ambiente do Render
const redisClient = createClient({
  url: process.env.REDIS_URL
});

redisClient.on('error', err => console.log('Redis Client Error', err));

// Espera o cliente do Redis estar pronto antes de iniciar o servidor
redisClient.connect().then(() => {
  console.log('Connected to Redis');

  // Rota para registrar uma nova compra
  app.post('/purchase', async (req, res) => {
    // Retornamos uma mensagem de texto simples para verificar se o LSL a recebe.
    res.status(200).send('compra salva no sistema de redelivery');
  });

  // Rota para buscar todas as compras de um usuário (sem filtro por loja)
  app.get('/purchases', async (req, res) => {
    const { user } = req.query;

    if (!user) {
      return res.status(400).send('Missing required parameter: user');
    }

    try {
      const key = `purchases:${user}`;
      const allPurchases = await redisClient.lRange(key, 0, -1);
      console.log(`Found ${allPurchases.length} purchases for user: ${user}`);

      if (allPurchases.length === 0) {
        return res.status(200).send('');
      }

      const formattedResponse = allPurchases.map(purchase => {
        const parsed = JSON.parse(purchase);
        return `${parsed.product}|${parsed.vendorKey}`;
      }).join('|');
      
      res.status(200).send(formattedResponse);

    } catch (error) {
      console.error('Error fetching purchases:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  const PORT = process.env.PORT || 10000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

}).catch(err => console.error('Failed to connect to Redis', err));
