const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// MySQL Connection Pool setup
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'System0107_',
    database: 'floral_haven',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Serve the index.html file directly from the root URL.
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Login route to authenticate users
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM login WHERE username = ? AND password = ?', [username, password]);
        if (rows.length > 0) {
            res.json({ success: true, message: 'Login successful' });
        } else {
            res.json({ success: false, message: 'Invalid username or password' });
        }
    } catch (error) {
        console.error('Database query error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Products route to fetch all flowers for the dropdown list
app.get('/api/products', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM flower_details');
        console.log('Products retrieved from database:', rows);
        res.json({ success: true, products: rows });
    } catch (error) {
        console.error('Database query error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Save order route to handle the transaction and save customer and order details
app.post('/api/save-order', async (req, res) => {
    const { customer, order } = req.body;
    let connection;
    try {
        // Start a transaction
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Check if customer exists or create a new one
        let [customerRows] = await connection.query('SELECT Cust_ID FROM customer WHERE Ph_No = ?', [customer.phone]);
        let custId;

        if (customerRows.length > 0) {
            custId = customerRows[0].Cust_ID;
        } else {
            const [result] = await connection.query('INSERT INTO customer (Cust_Name, Ph_No, E_mail, Address) VALUES (?, ?, ?, ?)', [
                customer.name,
                customer.phone,
                customer.email,
                customer.address
            ]);
            custId = result.insertId;
        }

        // 2. Insert into orders table
        const [orderResult] = await connection.query('INSERT INTO orders (flower_id, quantity, delivery_date) VALUES (?, ?, ?)', [
            order.flowerId,
            order.quantity,
            order.deliveryDate
        ]);
        const orderId = orderResult.insertId;

        // 3. Insert into delivery table
        await connection.query('INSERT INTO delivery (Cust_ID, order_id, delivery_date) VALUES (?, ?, ?)', [
            custId,
            orderId,
            order.deliveryDate
        ]);

        await connection.commit();
        connection.release();

        res.json({ success: true, message: 'Order has been placed successfully.' });
    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        console.error('Transaction error:', error);
        res.status(500).json({ success: false, message: 'Failed to place order.' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log('You can now open the application in your browser.');
});
