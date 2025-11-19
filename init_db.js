// init_db.js
const Database = require('better-sqlite3');
const db = new Database('database.db');

function run() {
  // Productos
  db.prepare(`CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE,
    nombre TEXT,
    descripcion TEXT,
    precio REAL,
    stock INTEGER
  )`).run();

  // Clientes
  db.prepare(`CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT,
    ruc TEXT,
    telefono TEXT,
    email TEXT,
    direccion TEXT
  )`).run();

  // Facturas (encabezado)
  db.prepare(`CREATE TABLE IF NOT EXISTS facturas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER,
    numero TEXT UNIQUE,
    fecha TEXT,
    total REAL,
    FOREIGN KEY(cliente_id) REFERENCES clientes(id)
  )`).run();

  // Detalle de factura
  db.prepare(`CREATE TABLE IF NOT EXISTS detalle_factura (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    factura_id INTEGER,
    producto_id INTEGER,
    cantidad INTEGER,
    precio_unitario REAL,
    subtotal REAL,
    FOREIGN KEY(factura_id) REFERENCES facturas(id),
    FOREIGN KEY(producto_id) REFERENCES productos(id)
  )`).run();

  // Datos de ejemplo
  const pCount = db.prepare('SELECT count(*) AS c FROM productos').get().c;
  if (pCount === 0) {
    const insertP = db.prepare('INSERT INTO productos (codigo,nombre,descripcion,precio,stock) VALUES (?,?,?,?,?)');
    insertP.run('P001','Café Molido 250g','Café de origen',5.0,100);
    insertP.run('P002','Azúcar 1kg','Azúcar blanca',2.0,200);
    insertP.run('P003','Galletas','Pack galletas',3.5,150);
  }

  const cCount = db.prepare('SELECT count(*) AS c FROM clientes').get().c;
  if (cCount === 0) {
    const insertC = db.prepare('INSERT INTO clientes (nombre,ruc,telefono,email,direccion) VALUES (?,?,?,?,?)');
    insertC.run('Comercial S.R.L.','80012345','70000001','ventas@comercial.com','Av. Principal 123');
    insertC.run('Cliente Final','','70123456','cliente@correo.com','Calle 45 #12');
  }

  console.log('✅ database.db creada/actualizada con tablas y datos de ejemplo.');
}

run();
