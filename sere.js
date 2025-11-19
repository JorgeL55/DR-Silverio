// server.js
const express = require('express');
const bodyParser = require('body-parser');
const Database = require('better-sqlite3');
const cors = require('cors');

const db = new Database('database.db');
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Servir frontend
app.use('/', express.static('public'));

/* ---------- API Productos ---------- */
app.get('/api/productos', (req, res) => {
  const rows = db.prepare('SELECT * FROM productos ORDER BY id DESC').all();
  res.json(rows);
});
app.post('/api/productos', (req, res) => {
  const { codigo, nombre, descripcion, precio, stock } = req.body;
  const info = db.prepare('INSERT INTO productos (codigo,nombre,descripcion,precio,stock) VALUES (?,?,?,?,?)')
    .run(codigo, nombre, descripcion, parseFloat(precio), parseInt(stock));
  res.json({ success: true, id: info.lastInsertRowid });
});
app.put('/api/productos/:id', (req, res) => {
  const { codigo, nombre, descripcion, precio, stock } = req.body;
  db.prepare('UPDATE productos SET codigo=?,nombre=?,descripcion=?,precio=?,stock=? WHERE id=?')
    .run(codigo, nombre, descripcion, parseFloat(precio), parseInt(stock), req.params.id);
  res.json({ success: true });
});
app.delete('/api/productos/:id', (req, res) => {
  db.prepare('DELETE FROM productos WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

/* ---------- API Clientes ---------- */
app.get('/api/clientes', (req,res) => {
  const rows = db.prepare('SELECT * FROM clientes ORDER BY id DESC').all();
  res.json(rows);
});
app.post('/api/clientes', (req,res) => {
  const { nombre, ruc, telefono, email, direccion } = req.body;
  const info = db.prepare('INSERT INTO clientes (nombre,ruc,telefono,email,direccion) VALUES (?,?,?,?,?)')
    .run(nombre,ruc,telefono,email,direccion);
  res.json({ success: true, id: info.lastInsertRowid });
});
app.put('/api/clientes/:id', (req,res) => {
  const { nombre, ruc, telefono, email, direccion } = req.body;
  db.prepare('UPDATE clientes SET nombre=?,ruc=?,telefono=?,email=?,direccion=? WHERE id=?')
    .run(nombre,ruc,telefono,email,direccion, req.params.id);
  res.json({ success: true });
});
app.delete('/api/clientes/:id', (req,res) => {
  db.prepare('DELETE FROM clientes WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

/* ---------- API Facturas / Ventas ---------- */
// Generar número de factura simple (fecha + id)
function generarNumeroFactura() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth()+1).padStart(2,'0');
  const d = String(now.getDate()).padStart(2,'0');
  const rand = Math.floor(Math.random()*9000)+1000;
  return `F${y}${m}${d}-${rand}`;
}

// Crear factura (encabezado + detalle) y disminuir stock
app.post('/api/facturas', (req,res) => {
  const { cliente_id, items } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'No hay items' });

  const numero = generarNumeroFactura();
  const fecha = new Date().toISOString();
  let total = 0;
  const insertFactura = db.prepare('INSERT INTO facturas (cliente_id,numero,fecha,total) VALUES (?,?,?,?)');
  const insertDetalle = db.prepare('INSERT INTO detalle_factura (factura_id,producto_id,cantidad,precio_unitario,subtotal) VALUES (?,?,?,?,?)');
  const getProducto = db.prepare('SELECT * FROM productos WHERE id=?');
  const updateStock = db.prepare('UPDATE productos SET stock = stock - ? WHERE id = ?');

  const trx = db.transaction(() => {
    // calcular total
    items.forEach(it => {
      total += parseFloat(it.precio_unitario) * parseInt(it.cantidad);
    });
    const info = insertFactura.run(cliente_id || null, numero, fecha, total);
    const facturaId = info.lastInsertRowid;
    items.forEach(it => {
      const prod = getProducto.get(it.producto_id);
      if (!prod) throw new Error('Producto no encontrado: ' + it.producto_id);
      if (prod.stock < it.cantidad) throw new Error(`Stock insuficiente para ${prod.nombre}`);
      const subtotal = parseFloat(it.precio_unitario) * parseInt(it.cantidad);
      insertDetalle.run(facturaId, it.producto_id, it.cantidad, it.precio_unitario, subtotal);
      updateStock.run(it.cantidad, it.producto_id);
    });
    return facturaId;
  });

  try {
    const facturaId = trx();
    res.json({ success: true, facturaId, numero, total });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Obtener factura con detalle
app.get('/api/facturas/:id', (req,res) => {
  const f = db.prepare('SELECT f.*, c.nombre as cliente FROM facturas f LEFT JOIN clientes c ON f.cliente_id=c.id WHERE f.id=?').get(req.params.id);
  if (!f) return res.status(404).json({ error: 'Factura no encontrada' });
  const detalles = db.prepare('SELECT d.*, p.nombre as producto FROM detalle_factura d LEFT JOIN productos p ON d.producto_id=p.id WHERE d.factura_id=?').all(req.params.id);
  res.json({ factura: f, detalles });
});

// Listar facturas (con cliente)
app.get('/api/facturas', (req,res) => {
  const rows = db.prepare('SELECT f.*, c.nombre as cliente FROM facturas f LEFT JOIN clientes c ON f.cliente_id=c.id ORDER BY f.fecha DESC').all();
  res.json(rows);
});

/* ---------- API Reportes (ventas por fecha, top productos) ---------- */
app.get('/api/reportes/ventas-por-fecha', (req,res) => {
  // params: desde, hasta (YYYY-MM-DD)
  const desde = req.query.desde || '1970-01-01';
  const hasta = req.query.hasta || '9999-12-31';
  const rows = db.prepare(`
    SELECT date(fecha) as fecha, SUM(total) as total
    FROM facturas
    WHERE date(fecha) BETWEEN ? AND ?
    GROUP BY date(fecha)
    ORDER BY date(fecha) DESC
  `).all(desde, hasta);
  res.json(rows);
});

app.get('/api/reportes/top-productos', (req,res) => {
  const rows = db.prepare(`
    SELECT p.id, p.nombre, SUM(d.cantidad) as total_vendidos
    FROM detalle_factura d
    JOIN productos p ON d.producto_id = p.id
    GROUP BY p.id, p.nombre
    ORDER BY total_vendidos DESC
    LIMIT 10
  `).all();
  res.json(rows);
});

/* ---------- Iniciar servidor ---------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
