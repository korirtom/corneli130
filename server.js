const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Database connection
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'template_marketplace',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// File upload configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadPath = 'uploads/';
        
        if (file.fieldname === 'logo') {
            uploadPath += 'logos/';
        } else if (file.fieldname === 'background') {
            uploadPath += 'backgrounds/';
        } else if (file.fieldname === 'template') {
            uploadPath += 'templates/';
        }
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: function (req, file, cb) {
        const allowedTypes = {
            'logo': ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
            'background': ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
            'template': ['application/zip', 'application/x-zip-compressed']
        };
        
        const fieldname = file.fieldname;
        if (allowedTypes[fieldname] && allowedTypes[fieldname].includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Invalid file type for ${fieldname}. Allowed types: ${allowedTypes[fieldname].join(', ')}`));
        }
    }
});

// Authentication middleware
const authenticateAdmin = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        
        // In a real application, you would verify JWT token
        // For simplicity, we'll check if the token exists in the database
        const [rows] = await pool.execute(
            'SELECT * FROM admins WHERE id = ?',
            [token] // Using token as admin ID for demo
        );
        
        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid token' });
        }
        
        req.admin = rows[0];
        next();
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ success: false, message: 'Authentication error' });
    }
};

// API Routes

// Get all templates
app.get('/api/templates', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM templates WHERE is_active = 1 ORDER BY created_at DESC'
        );
        
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch templates' });
    }
});

// Add new template
app.post('/api/templates', authenticateAdmin, upload.fields([
    { name: 'background', maxCount: 1 },
    { name: 'template', maxCount: 1 }
]), async (req, res) => {
    try {
        const { name, description, price, preview_html } = req.body;
        
        if (!name || !description || !price) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields' 
            });
        }
        
        const background_url = req.files?.background?.[0]?.path || null;
        const zip_file_url = req.files?.template?.[0]?.path || null;
        
        if (!zip_file_url) {
            return res.status(400).json({ 
                success: false, 
                message: 'Template file is required' 
            });
        }
        
        const [result] = await pool.execute(
            `INSERT INTO templates 
            (name, description, price, background_url, zip_file_url, preview_html) 
            VALUES (?, ?, ?, ?, ?, ?)`,
            [name, description, parseFloat(price), background_url, zip_file_url, preview_html]
        );
        
        res.json({ 
            success: true, 
            message: 'Template added successfully',
            template_id: result.insertId 
        });
    } catch (error) {
        console.error('Error adding template:', error);
        res.status(500).json({ success: false, message: 'Failed to add template' });
    }
});

// Delete template
app.delete('/api/templates/:id', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const [result] = await pool.execute(
            'UPDATE templates SET is_active = 0 WHERE id = ?',
            [id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Template not found' 
            });
        }
        
        res.json({ success: true, message: 'Template deleted successfully' });
    } catch (error) {
        console.error('Error deleting template:', error);
        res.status(500).json({ success: false, message: 'Failed to delete template' });
    }
});

// Get platform settings
app.get('/api/settings', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM platform_settings LIMIT 1');
        
        if (rows.length === 0) {
            // Return default settings
            return res.json({ 
                success: true, 
                data: {
                    platform_name: 'PromptTemplates',
                    contact_phone: '+254 700 000 000',
                    contact_email: 'support@prompttemplates.com'
                }
            });
        }
        
        res.json({ success: true, data: rows[0] });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch settings' });
    }
});

// Update platform settings
app.post('/api/settings', authenticateAdmin, upload.single('logo'), async (req, res) => {
    try {
        const { 
            platform_name, 
            contact_phone, 
            contact_email,
            tiktok_url,
            facebook_url,
            whatsapp_number,
            instagram_url
        } = req.body;
        
        let logo_url = null;
        if (req.file) {
            logo_url = req.file.path;
        }
        
        // Check if settings exist
        const [existing] = await pool.execute('SELECT id FROM platform_settings LIMIT 1');
        
        if (existing.length > 0) {
            // Update existing settings
            await pool.execute(
                `UPDATE platform_settings SET 
                platform_name = ?, 
                logo_url = COALESCE(?, logo_url),
                contact_phone = ?,
                contact_email = ?,
                tiktok_url = ?,
                facebook_url = ?,
                whatsapp_number = ?,
                instagram_url = ?,
                updated_at = NOW()`,
                [
                    platform_name, 
                    logo_url, 
                    contact_phone, 
                    contact_email,
                    tiktok_url,
                    facebook_url,
                    whatsapp_number,
                    instagram_url
                ]
            );
        } else {
            // Insert new settings
            await pool.execute(
                `INSERT INTO platform_settings 
                (platform_name, logo_url, contact_phone, contact_email, 
                 tiktok_url, facebook_url, whatsapp_number, instagram_url) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    platform_name, 
                    logo_url, 
                    contact_phone, 
                    contact_email,
                    tiktok_url,
                    facebook_url,
                    whatsapp_number,
                    instagram_url
                ]
            );
        }
        
        res.json({ success: true, message: 'Settings updated successfully' });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ success: false, message: 'Failed to update settings' });
    }
});

// Admin authentication
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username and password are required' 
            });
        }
        
        // For demo, using simple authentication
        // In production, use proper password hashing (bcrypt)
        const [rows] = await pool.execute(
            'SELECT * FROM admins WHERE username = ? AND password_hash = ?',
            [username, password] // In real app, compare hashed passwords
        );
        
        if (rows.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }
        
        const admin = rows[0];
        
        // Update last login
        await pool.execute(
            'UPDATE admins SET last_login = NOW() WHERE id = ?',
            [admin.id]
        );
        
        // Generate token (simplified)
        const token = admin.id.toString();
        
        res.json({ 
            success: true, 
            message: 'Login successful',
            token: token,
            username: admin.username,
            email: admin.email
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
});

// Get dashboard statistics
app.get('/api/stats', authenticateAdmin, async (req, res) => {
    try {
        const [
            [templates],
            [sales],
            [successfulPayments],
            [failedPayments]
        ] = await Promise.all([
            pool.execute('SELECT COUNT(*) as count FROM templates WHERE is_active = 1'),
            pool.execute('SELECT COALESCE(SUM(amount), 0) as total FROM purchases WHERE status = "completed"'),
            pool.execute('SELECT COUNT(*) as count FROM purchases WHERE status = "completed"'),
            pool.execute('SELECT COUNT(*) as count FROM failed_payments')
        ]);
        
        res.json({
            success: true,
            data: {
                total_templates: templates[0].count,
                total_sales: sales[0].total,
                successful_payments: successfulPayments[0].count,
                failed_payments: failedPayments[0].count
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
    }
});

// Get recent payments
app.get('/api/payments/recent', authenticateAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT p.*, u.email as customer_email, u.full_name as customer_name
            FROM purchases p
            LEFT JOIN users u ON p.user_id = u.id
            ORDER BY p.payment_date DESC
            LIMIT 10
        `);
        
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch payments' });
    }
});

// M-Pesa payment simulation
app.post('/api/payments/mpesa', async (req, res) => {
    try {
        const { phone, amount, template_ids, customer_name, customer_email } = req.body;
        
        if (!phone || !amount || !template_ids || !Array.isArray(template_ids)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields' 
            });
        }
        
        // Format phone number
        let formattedPhone = phone;
        if (phone.length === 9) {
            formattedPhone = '254' + phone;
        } else if (phone.startsWith('0')) {
            formattedPhone = '254' + phone.substring(1);
        }
        
        // Generate transaction ID
        const transactionId = 'TXN_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9).toUpperCase();
        
        // Simulate M-Pesa payment (80% success rate for demo)
        const isSuccess = Math.random() > 0.2;
        
        if (isSuccess) {
            const receiptNumber = 'MPE' + Date.now().toString().substr(-6) + Math.floor(Math.random() * 1000);
            
            // Create or find user
            let userId = null;
            const [existingUser] = await pool.execute(
                'SELECT id FROM users WHERE email = ?',
                [customer_email]
            );
            
            if (existingUser.length > 0) {
                userId = existingUser[0].id;
            } else {
                const [userResult] = await pool.execute(
                    'INSERT INTO users (email, phone, full_name) VALUES (?, ?, ?)',
                    [customer_email, formattedPhone, customer_name]
                );
                userId = userResult.insertId;
            }
            
            // Record purchase
            const [purchaseResult] = await pool.execute(
                `INSERT INTO purchases 
                (transaction_id, user_id, amount, phone_number, mpesa_receipt, status, download_url) 
                VALUES (?, ?, ?, ?, ?, 'completed', ?)`,
                [
                    transactionId,
                    userId,
                    parseFloat(amount),
                    formattedPhone,
                    receiptNumber,
                    `/download/${transactionId}`
                ]
            );
            
            const purchaseId = purchaseResult.insertId;
            
            // Record template purchases
            for (const templateId of template_ids) {
                await pool.execute(
                    'INSERT INTO purchase_templates (purchase_id, template_id) VALUES (?, ?)',
                    [purchaseId, templateId]
                );
                
                // Increment downloads count
                await pool.execute(
                    'UPDATE templates SET downloads_count = downloads_count + 1 WHERE id = ?',
                    [templateId]
                );
            }
            
            res.json({
                success: true,
                message: 'Payment successful',
                transaction_id: transactionId,
                receipt: receiptNumber,
                download_url: `/download/${transactionId}`
            });
        } else {
            // Record failed payment
            await pool.execute(
                'INSERT INTO failed_payments (transaction_id, phone_number, amount, error_message) VALUES (?, ?, ?, ?)',
                [transactionId, formattedPhone, amount, 'Payment cancelled by user']
            );
            
            res.status(400).json({
                success: false,
                message: 'Payment failed. Please try again.',
                transaction_id: transactionId
            });
        }
    } catch (error) {
        console.error('M-Pesa payment error:', error);
        res.status(500).json({ success: false, message: 'Payment processing failed' });
    }
});

// File download endpoint
app.get('/download/:transactionId', async (req, res) => {
    try {
        const { transactionId } = req.params;
        
        const [rows] = await pool.execute(`
            SELECT t.* 
            FROM templates t
            INNER JOIN purchase_templates pt ON t.id = pt.template_id
            INNER JOIN purchases p ON pt.purchase_id = p.id
            WHERE p.transaction_id = ? AND p.status = 'completed'
        `, [transactionId]);
        
        if (rows.length === 0) {
            return res.status(404).send('Download not found or expired');
        }
        
        // For demo, return first template's file
        // In production, you might want to create a zip of all purchased templates
        const template = rows[0];
        
        if (!template.zip_file_url || !fs.existsSync(template.zip_file_url)) {
            return res.status(404).send('Template file not found');
        }
        
        res.download(template.zip_file_url, `${template.name}.zip`);
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).send('Download failed');
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ 
            success: false, 
            message: `Upload error: ${err.message}` 
        });
    }
    
    res.status(500).json({ 
        success: false, 
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
});