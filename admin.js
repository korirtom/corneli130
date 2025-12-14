// Admin Interface Logic
class AdminInterface {
    constructor() {
        this.currentAdmin = null;
        this.templates = [];
        this.payments = [];
        this.failedPayments = [];
        this.users = [];
        this.stats = {};
        this.initialize();
    }

    async initialize() {
        await this.checkAuth();
        this.setupEventListeners();
        await this.loadDashboardData();
        this.setupCharts();
    }

    async checkAuth() {
        const token = localStorage.getItem('admin_token');
        const username = localStorage.getItem('admin_username');

        if (!token || !username) {
            this.showLoginPage();
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/auth.php?action=validate`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success) {
                this.currentAdmin = { username, token };
                this.showAdminInterface();
            } else {
                this.showLoginPage();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            this.showLoginPage();
        }
    }

    showLoginPage() {
        const loginPage = document.getElementById('admin-login-page');
        const adminMain = document.getElementById('admin-main');

        if (loginPage) loginPage.style.display = 'flex';
        if (adminMain) adminMain.style.display = 'none';
    }

    showAdminInterface() {
        const loginPage = document.getElementById('admin-login-page');
        const adminMain = document.getElementById('admin-main');

        if (loginPage) loginPage.style.display = 'none';
        if (adminMain) adminMain.style.display = 'block';

        // Update admin greeting
        const username = localStorage.getItem('admin_username');
        const greeting = document.getElementById('admin-greeting');
        if (greeting) {
            greeting.textContent = `Welcome back, ${username}`;
        }

        // Update username display
        const usernameDisplay = document.getElementById('admin-username-display');
        if (usernameDisplay) {
            usernameDisplay.textContent = username;
        }
    }

    setupEventListeners() {
        // Admin login form
        const loginForm = document.getElementById('admin-login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Admin logout
        const logoutBtn = document.getElementById('admin-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // Navigation links
        document.querySelectorAll('.admin-nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                this.showSection(section);
                
                // Update active link
                document.querySelectorAll('.admin-nav-link').forEach(l => {
                    l.classList.remove('active');
                });
                link.classList.add('active');
            });
        });

        // Quick actions
        const quickActions = {
            'add-template-quick': 'templates',
            'view-payments-quick': 'payments',
            'platform-settings-quick': 'platform-settings',
            'refresh-data-btn': 'dashboard'
        };

        Object.entries(quickActions).forEach(([id, section]) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', () => {
                    if (section === 'dashboard') {
                        this.loadDashboardData();
                    } else {
                        this.showSection(section);
                    }
                });
            }
        });

        // Add template form
        const addTemplateBtn = document.getElementById('add-template-btn');
        if (addTemplateBtn) {
            addTemplateBtn.addEventListener('click', () => {
                this.showTemplateForm();
            });
        }

        // File upload preview
        this.setupFileUploads();
    }

    showSection(sectionId) {
        // Hide all sections
        document.querySelectorAll('.admin-section').forEach(section => {
            section.classList.remove('active');
        });

        // Show selected section
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
            
            // Load section data if needed
            switch (sectionId) {
                case 'templates':
                    this.loadTemplates();
                    break;
                case 'payments':
                    this.loadPayments();
                    break;
                case 'failed-payments':
                    this.loadFailedPayments();
                    break;
                case 'users':
                    this.loadUsers();
                    break;
                case 'platform-settings':
                    this.loadPlatformSettings();
                    break;
                case 'mpesa-settings':
                    this.loadMpesaSettings();
                    break;
            }
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const form = e.target;
        const username = form.querySelector('#admin-username').value;
        const password = form.querySelector('#admin-password').value;

        try {
            const response = await fetch(`${API_BASE_URL}/auth.php?action=login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.success) {
                // Store admin token
                localStorage.setItem('admin_token', data.token);
                localStorage.setItem('admin_username', data.username);
                
                // Update last login time
                const lastLogin = document.getElementById('last-login-time');
                if (lastLogin) {
                    lastLogin.textContent = 'Just now';
                }

                this.showAdminInterface();
                marketplace.showNotification('Login successful', 'success');
            } else {
                marketplace.showNotification(data.message || 'Invalid credentials', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            marketplace.showNotification('Network error. Please try again.', 'error');
        }
    }

    handleLogout() {
        marketplace.showConfirmation(
            'Confirm Logout',
            'Are you sure you want to log out of the admin panel?'
        ).then((confirmed) => {
            if (confirmed) {
                localStorage.removeItem('admin_token');
                localStorage.removeItem('admin_username');
                this.showLoginPage();
                marketplace.showNotification('Logged out successfully', 'success');
            }
        });
    }

    async loadDashboardData() {
        try {
            // Load stats
            const [statsRes, templatesRes, paymentsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/stats.php`),
                fetch(`${API_BASE_URL}/templates.php`),
                fetch(`${API_BASE_URL}/payments.php?action=recent`)
            ]);

            const statsData = await statsRes.json();
            const templatesData = await templatesRes.json();
            const paymentsData = await paymentsRes.json();

            if (statsData.success) {
                this.stats = statsData.data;
                this.updateDashboardStats();
            }

            if (templatesData.success) {
                this.templates = templatesData.data;
            }

            if (paymentsData.success) {
                this.payments = paymentsData.data;
                this.updateRecentTransactions();
            }

            // Update last updated time
            const updatedEl = document.getElementById('dashboard-updated');
            if (updatedEl) {
                updatedEl.textContent = new Date().toLocaleTimeString();
            }

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            marketplace.showNotification('Failed to load dashboard data', 'error');
        }
    }

    updateDashboardStats() {
        const stats = this.stats;
        
        // Update stats cards
        const elements = {
            'total-templates': stats.total_templates || 0,
            'total-sales': stats.total_sales || 0,
            'successful-payments': stats.successful_payments || 0,
            'failed-payments': stats.failed_payments || 0
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                if (id === 'total-sales') {
                    element.textContent = marketplace.formatCurrency(value);
                } else {
                    element.textContent = value;
                }
            }
        });
    }

    updateRecentTransactions() {
        const container = document.getElementById('recent-transactions');
        if (!container) return;

        const recentPayments = this.payments.slice(0, 5);
        
        container.innerHTML = recentPayments.map(payment => `
            <tr>
                <td><code>${payment.transaction_id}</code></td>
                <td>
                    <strong>${payment.customer_name || 'Guest'}</strong><br>
                    <small>${payment.customer_email || 'N/A'}</small>
                </td>
                <td>KSh ${parseFloat(payment.amount).toFixed(2)}</td>
                <td>
                    <span class="status-badge ${payment.status}">
                        ${payment.status}
                    </span>
                </td>
                <td>${marketplace.formatDate(payment.payment_date)}</td>
            </tr>
        `).join('');
    }

    setupCharts() {
        const ctx = document.getElementById('sales-chart');
        if (!ctx) return;

        // Sample data - replace with actual data from API
        const data = {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Sales (KSh)',
                data: [12000, 19000, 15000, 25000, 22000, 30000, 28000],
                borderColor: '#4361ee',
                backgroundColor: 'rgba(67, 97, 238, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        };

        const chart = new Chart(ctx, {
            type: 'line',
            data: data,
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            drawBorder: false
                        },
                        ticks: {
                            callback: function(value) {
                                return 'KSh ' + value;
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    async loadTemplates() {
        try {
            const response = await fetch(`${API_BASE_URL}/templates.php`);
            const data = await response.json();
            
            if (data.success) {
                this.templates = data.data;
                this.renderTemplatesTable();
            }
        } catch (error) {
            console.error('Error loading templates:', error);
            marketplace.showNotification('Failed to load templates', 'error');
        }
    }

    renderTemplatesTable() {
        const tbody = document.getElementById('templates-table-body');
        if (!tbody) return;

        tbody.innerHTML = this.templates.map(template => `
            <tr>
                <td>${template.id}</td>
                <td>
                    <strong>${marketplace.sanitizeInput(template.name)}</strong>
                    ${!template.is_active ? '<span class="inactive-badge">Inactive</span>' : ''}
                </td>
                <td>${marketplace.sanitizeInput(template.description.substring(0, 80))}...</td>
                <td>KSh ${parseFloat(template.price).toFixed(2)}</td>
                <td>${template.downloads_count || 0}</td>
                <td>
                    <span class="status-badge ${template.is_active ? 'active' : 'inactive'}">
                        ${template.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <div class="table-actions">
                        <button class="btn-icon edit-template-btn" data-id="${template.id}" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon delete-template-btn" data-id="${template.id}" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Add event listeners
        this.attachTemplateTableEventListeners();
    }

    attachTemplateTableEventListeners() {
        // Edit buttons
        document.querySelectorAll('.edit-template-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const templateId = e.target.closest('button').dataset.id;
                this.editTemplate(templateId);
            });
        });

        // Delete buttons
        document.querySelectorAll('.delete-template-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const templateId = e.target.closest('button').dataset.id;
                this.deleteTemplate(templateId);
            });
        });
    }

    showTemplateForm() {
        const formCard = document.getElementById('template-form-card');
        if (formCard) {
            formCard.style.display = 'block';
            formCard.scrollIntoView({ behavior: 'smooth' });
        }
    }

    async deleteTemplate(templateId) {
        const confirmed = await marketplace.showConfirmation(
            'Delete Template',
            'Are you sure you want to delete this template? This action cannot be undone and will remove the template from the marketplace.'
        );

        if (!confirmed) return;

        try {
            const response = await fetch(`${API_BASE_URL}/templates.php`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.currentAdmin?.token}`
                },
                body: JSON.stringify({ id: templateId })
            });

            const data = await response.json();

            if (data.success) {
                marketplace.showNotification('Template deleted successfully', 'success');
                this.loadTemplates();
                this.loadDashboardData();
            } else {
                marketplace.showNotification(data.message || 'Failed to delete template', 'error');
            }
        } catch (error) {
            console.error('Delete error:', error);
            marketplace.showNotification('Network error. Please try again.', 'error');
        }
    }

    setupFileUploads() {
        // Template background image upload
        const backgroundInput = document.getElementById('template-background');
        if (backgroundInput) {
            backgroundInput.addEventListener('change', (e) => {
                const fileName = e.target.files[0]?.name || 'No file chosen';
                const fileNameEl = document.getElementById('background-filename');
                if (fileNameEl) fileNameEl.textContent = fileName;
            });
        }

        // Template files upload
        const templateFilesInput = document.getElementById('template-files');
        if (templateFilesInput) {
            templateFilesInput.addEventListener('change', (e) => {
                const fileName = e.target.files[0]?.name || 'No file chosen';
                const fileNameEl = document.getElementById('template-filename');
                if (fileNameEl) fileNameEl.textContent = fileName;
            });
        }

        // Platform logo upload
        const logoInput = document.getElementById('platform-logo');
        if (logoInput) {
            logoInput.addEventListener('change', (e) => {
                const fileName = e.target.files[0]?.name || 'Current logo';
                const fileNameEl = document.getElementById('logo-filename');
                if (fileNameEl) fileNameEl.textContent = fileName;
            });
        }
    }

    // Add more methods for payments, users, settings management...
}

// Initialize admin interface
document.addEventListener('DOMContentLoaded', () => {
    const adminInterface = new AdminInterface();
});