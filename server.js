// server.js
`);
}


function requireApiKey(req, res, next) {
const key = req.get('x-api-key');
if (!API_KEY) return res.status(500).send('NO_API_KEY');
if (!key || key !== API_KEY) return res.status(401).send('UNAUTHORIZED');
next();
}


// Health
app.get('/health', (req, res) => res.send('OK'));


// Registra compra
app.post('/purchase', requireApiKey, async (req, res) => {
try {
const { avatar, product, vendor } = req.body;
if (!avatar || !product || !vendor) return res.status(400).send('MISSING');
await pool.query('INSERT INTO purchases(avatar, product, vendor) VALUES($1,$2,$3)', [avatar, product, vendor]);
return res.send('OK');
} catch (e) {
console.error(e);
return res.status(500).send('ERR');
}
});


// Retorna lista compacta: prod|vendor;prod2|vendor2 ... (texto plano para LSL)
app.get('/purchases/:avatar', requireApiKey, async (req, res) => {
try {
const avatar = req.params.avatar;
const per = Math.min(parseInt(req.query.per || '50', 10), 200);
const page = Math.max(parseInt(req.query.page || '1', 10), 1);
const offset = (page - 1) * per;
const result = await pool.query(
'SELECT product, vendor FROM purchases WHERE avatar = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
[avatar, per, offset]
);
const body = result.rows.map(r => `${r.product}|${r.vendor}`).join(';');
res.type('text/plain').send(body);
} catch (e) {
console.error(e);
res.status(500).send('ERR');
}
});


// Verifica se já existe a compra para receiver
app.post('/check_duplicate', requireApiKey, async (req, res) => {
try {
const { receiver, product } = req.body;
if (!receiver || !product) return res.status(400).send('MISSING');
const r = await pool.query('SELECT 1 FROM purchases WHERE avatar=$1 AND product=$2 LIMIT 1', [receiver, product]);
res.send(r.rowCount > 0 ? 'DUPLICATE' : 'OK');
} catch (e) {
console.error(e);
res.status(500).send('ERR');
}
});


const PORT = process.env.PORT || 3000;
ensureTable().then(() => {
app.listen(PORT, () => console.log('Server up on port', PORT));
}).catch(err => {
console.error('Error ensuring DB table:', err);
process.exit(1);
});
