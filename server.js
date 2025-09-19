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
    // Recebe o nome da loja, o nome do produto e o ID do vendor
    const { user, storeName, product, vendorKey } = req.body;

    if (!user || !storeName || !product || !vendorKey) {
      return res.status(400).send('Missing required fields: user, storeName, product, or vendorKey');
    }

    const key = `purchases:${user}`;
    const value = { storeName, product, vendorKey, timestamp: Date.now() };

    try {
      // Adiciona o valor à lista (ou cria a lista se ela não existir)
      await redisClient.lPush(key, JSON.stringify(value));
      res.status(200).send('Purchase registered successfully');
    } catch (error) {
      console.error('Error processing purchase:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  // Rota para buscar compras de um usuário em uma loja específica
  app.get('/purchases', async (req, res) => {
    const { user, storeName } = req.query;

    if (!user || !storeName) {
      return res.status(400).send('Missing required parameters: user or storeName');
    }

    try {
      const key = `purchases:${user}`;
      const allPurchases = await redisClient.lRange(key, 0, -1);

      if (allPurchases.length === 0) {
        return res.status(200).send('');
      }

      // Filtra as compras para a loja específica
      const filteredPurchases = allPurchases.filter(purchase => {
        const parsed = JSON.parse(purchase);
        return parsed.storeName === storeName;
      });

      // Formata a resposta para o LSL: produto|chave|produto|chave...
      const formattedResponse = filteredPurchases.map(purchase => {
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
