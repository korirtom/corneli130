// User Interface Logic
class UserInterface {
    constructor() {
        this.templates = [];
        this.selectedTemplates = [];
        this.cart = [];
        this.isLoading = false;
        this.initialize();
    }

    async initialize() {
        this.setupEventListeners();
        await this.loadTemplates();
        this.hideLoadingScreen();
    }

    setupEventListeners() {
        // Admin login button
        const adminLoginBtn = document.querySelector('.admin-access-btn');
        if (adminLoginBtn) {
            adminLoginBtn.addEventListener('click', () => this.showAdminLogin());
        }

        // Browse templates button
        const browseBtn = document.querySelector('.browse-templates-btn');
        if (browseBtn) {
            browseBtn.addEventListener('click', () => {
                document.querySelector('#templates').scrollIntoView({ 
                    behavior: 'smooth' 
                });
            });
        }

        // Template search
        const searchInput = document.getElementById('template-search');
        if (searchInput) {
            searchInput.addEventListener('input', marketplace.debounce(() => {
                this.filterTemplates(searchInput.value);
            }, 300));
        }

        // Sort templates
        const sortSelect = document.getElementById('sort-templates');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                this.sortTemplates(sortSelect.value);
            });
        }

        // Preview selected templates
        const previewBtn = document.querySelector('.preview-selected-btn');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => this.previewSelectedTemplates());
        }

        // Purchase selected templates
        const purchaseBtn = document.querySelector('.purchase-selected-btn');
        if (purchaseBtn) {
            purchaseBtn.addEventListener('click', () => this.showMpesaPaymentModal());
        }

        // Admin login form
        const adminLoginForm = document.getElementById('admin-login-form');
        if (adminLoginForm) {
            adminLoginForm.addEventListener('submit', (e) => this.handleAdminLogin(e));
        }
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            setTimeout(() => {
                loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 300);
            }, 500);
        }
    }

    async loadTemplates() {
        this.isLoading = true;
        try {
            const response = await fetch(`${API_BASE_URL}/templates.php`);
            const data = await response.json();
            
            if (data.success) {
                this.templates = data.data;
                this.renderTemplates();
            } else {
                marketplace.showNotification('Failed to load templates', 'error');
            }
        } catch (error) {
            console.error('Error loading templates:', error);
            marketplace.showNotification('Network error. Please try again.', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    renderTemplates() {
        const container = document.getElementById('templates-container');
        const noTemplates = document.getElementById('no-templates');
        
        if (!container) return;

        if (this.templates.length === 0) {
            container.innerHTML = '';
            if (noTemplates) noTemplates.style.display = 'block';
            return;
        }

        if (noTemplates) noTemplates.style.display = 'none';

        container.innerHTML = this.templates.map(template => `
            <div class="template-card" data-id="${template.id}">
                <div class="template-image" style="background: ${template.background_url || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}">
                    <div class="template-overlay">
                        <button class="btn btn-primary preview-template-btn" data-id="${template.id}">
                            <i class="fas fa-eye"></i> Preview
                        </button>
                    </div>
                </div>
                <div class="template-content">
                    <div class="template-header">
                        <h3 class="template-title">${marketplace.sanitizeInput(template.name)}</h3>
                        <div class="template-price">KSh ${parseFloat(template.price).toFixed(2)}</div>
                    </div>
                    <p class="template-desc">${marketplace.sanitizeInput(template.description)}</p>
                    <div class="template-footer">
                        <div class="checkbox-container">
                            <input type="checkbox" id="template-${template.id}" 
                                   ${this.isTemplateSelected(template.id) ? 'checked' : ''}>
                            <label for="template-${template.id}">Select for purchase</label>
                        </div>
                        <button class="btn btn-outline buy-template-btn" data-id="${template.id}">
                            <i class="fas fa-shopping-cart"></i> Buy Now
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        // Add event listeners to newly created elements
        this.attachTemplateEventListeners();
    }

    attachTemplateEventListeners() {
        // Checkbox selection
        document.querySelectorAll('.template-card input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const templateId = parseInt(e.target.id.replace('template-', ''));
                this.toggleTemplateSelection(templateId, e.target.checked);
            });
        });

        // Preview buttons
        document.querySelectorAll('.preview-template-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const templateId = parseInt(e.target.closest('button').dataset.id);
                this.previewTemplate(templateId);
            });
        });

        // Buy now buttons
        document.querySelectorAll('.buy-template-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const templateId = parseInt(e.target.closest('button').dataset.id);
                this.buyTemplate(templateId);
            });
        });
    }

    isTemplateSelected(templateId) {
        return this.selectedTemplates.some(t => t.id === templateId);
    }

    toggleTemplateSelection(templateId, isSelected) {
        const template = this.templates.find(t => t.id === templateId);
        
        if (!template) return;

        if (isSelected) {
            if (!this.isTemplateSelected(templateId)) {
                this.selectedTemplates.push(template);
            }
        } else {
            this.selectedTemplates = this.selectedTemplates.filter(t => t.id !== templateId);
        }

        this.updateSelectionPanel();
    }

    updateSelectionPanel() {
        const panel = document.getElementById('selection-panel');
        const countElement = document.getElementById('selected-templates-count');
        const priceElement = document.getElementById('total-price');

        if (!panel || !countElement || !priceElement) return;

        const count = this.selectedTemplates.length;
        const totalPrice = this.selectedTemplates.reduce((sum, template) => 
            sum + parseFloat(template.price), 0
        );

        countElement.textContent = count;
        priceElement.textContent = totalPrice.toFixed(2);

        if (count > 0) {
            panel.style.display = 'flex';
        } else {
            panel.style.display = 'none';
        }
    }

    async previewTemplate(templateId) {
        const template = this.templates.find(t => t.id === templateId);
        if (!template) return;

        const modal = document.getElementById('preview-modal');
        const previewFrame = document.getElementById('preview-frame');

        if (modal && previewFrame) {
            // Create preview HTML with back button
            const previewHTML = template.preview_html || `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${template.name} - Preview</title>
                    <style>
                        body {
                            font-family: 'Poppins', sans-serif;
                            margin: 0;
                            padding: 40px;
                            background: ${template.background_url || '#4361ee'};
                            color: white;
                            text-align: center;
                        }
                        .back-btn {
                            position: fixed;
                            top: 20px;
                            left: 20px;
                            background: white;
                            color: #333;
                            padding: 10px 20px;
                            border-radius: 5px;
                            text-decoration: none;
                            font-weight: bold;
                            border: none;
                            cursor: pointer;
                            font-family: inherit;
                        }
                        h1 {
                            font-size: 48px;
                            margin: 60px 0 20px;
                        }
                        p {
                            font-size: 18px;
                            max-width: 600px;
                            margin: 0 auto 20px;
                            line-height: 1.6;
                        }
                        .features {
                            display: grid;
                            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                            gap: 20px;
                            margin: 40px auto;
                            max-width: 800px;
                        }
                        .feature {
                            background: rgba(255, 255, 255, 0.1);
                            padding: 20px;
                            border-radius: 10px;
                        }
                    </style>
                </head>
                <body>
                    <button class="back-btn" onclick="window.close()">← Back to Templates</button>
                    <h1>${template.name}</h1>
                    <p>${template.description}</p>
                    
                    <div class="features">
                        <div class="feature">
                            <h3>Responsive Design</h3>
                            <p>Works perfectly on all devices</p>
                        </div>
                        <div class="feature">
                            <h3>Modern UI/UX</h3>
                            <p>Clean and professional design</p>
                        </div>
                        <div class="feature">
                            <h3>Easy Customization</h3>
                            <p>Well-documented and modular code</p>
                        </div>
                        <div class="feature">
                            <h3>Fast Loading</h3>
                            <p>Optimized for performance</p>
                        </div>
                    </div>
                    
                    <p style="margin-top: 40px;">
                        <strong>Price: KSh ${template.price}</strong>
                    </p>
                    <p>Purchase to download complete files</p>
                </body>
                </html>
            `;

            // Write to iframe
            previewFrame.srcdoc = previewHTML;
            modal.style.display = 'flex';

            // Add event listener to add to cart button in preview
            const addToCartBtn = document.querySelector('.add-to-cart-preview');
            if (addToCartBtn) {
                const newBtn = addToCartBtn.cloneNode(true);
                addToCartBtn.parentNode.replaceChild(newBtn, addToCartBtn);
                newBtn.addEventListener('click', () => {
                    this.toggleTemplateSelection(templateId, true);
                    modal.style.display = 'none';
                    marketplace.showNotification('Template added to cart', 'success');
                });
            }
        }
    }

    previewSelectedTemplates() {
        if (this.selectedTemplates.length === 0) {
            marketplace.showNotification('Please select at least one template to preview', 'warning');
            return;
        }

        // Preview the first selected template
        this.previewTemplate(this.selectedTemplates[0].id);
    }

    buyTemplate(templateId) {
        // Select the template if not already selected
        if (!this.isTemplateSelected(templateId)) {
            this.toggleTemplateSelection(templateId, true);
        }
        
        // Show payment modal
        this.showMpesaPaymentModal();
    }

    showMpesaPaymentModal() {
        if (this.selectedTemplates.length === 0) {
            marketplace.showNotification('Please select at least one template to purchase', 'warning');
            return;
        }

        const modal = document.getElementById('mpesa-modal');
        const orderDetails = document.getElementById('order-details');
        const totalAmount = document.getElementById('mpesa-total');

        if (!modal || !orderDetails || !totalAmount) return;

        // Calculate total
        const total = this.selectedTemplates.reduce((sum, template) => 
            sum + parseFloat(template.price), 0
        );

        // Update order details
        orderDetails.innerHTML = this.selectedTemplates.map(template => `
            <div class="order-item">
                <span>${marketplace.sanitizeInput(template.name)}</span>
                <span>KSh ${parseFloat(template.price).toFixed(2)}</span>
            </div>
        `).join('');

        totalAmount.textContent = total.toFixed(2);
        modal.style.display = 'flex';

        // Reset payment status
        const paymentStatus = document.getElementById('payment-status');
        if (paymentStatus) paymentStatus.style.display = 'none';

        // Reset form
        const form = document.getElementById('mpesa-payment-form');
        if (form) form.reset();

        // Add form submit handler
        if (form) {
            const newForm = form.cloneNode(true);
            form.parentNode.replaceChild(newForm, form);
            newForm.addEventListener('submit', (e) => this.handleMpesaPayment(e));
        }
    }

    async handleMpesaPayment(e) {
        e.preventDefault();
        
        const form = e.target;
        const name = form.querySelector('#customer-name').value;
        const email = form.querySelector('#customer-email').value;
        const phone = form.querySelector('#customer-phone').value;

        // Validation
        if (!name || !email || !phone) {
            marketplace.showNotification('Please fill in all required fields', 'warning');
            return;
        }

        if (!marketplace.validateEmail(email)) {
            marketplace.showNotification('Please enter a valid email address', 'warning');
            return;
        }

        if (!/^\d{9}$/.test(phone)) {
            marketplace.showNotification('Please enter a valid 9-digit phone number', 'warning');
            return;
        }

        // Calculate total amount
        const total = this.selectedTemplates.reduce((sum, template) => 
            sum + parseFloat(template.price), 0
        );

        // Show payment status
        const paymentStatus = document.getElementById('payment-status');
        if (paymentStatus) {
            paymentStatus.style.display = 'block';
            form.style.display = 'none';
        }

        // Start countdown
        this.startPaymentCountdown();

        try {
            // Call M-Pesa API
            const response = await fetch(`${API_BASE_URL}/payments.php?action=initiate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    phone: phone,
                    amount: total,
                    template_ids: this.selectedTemplates.map(t => t.id),
                    customer_name: name,
                    customer_email: email
                })
            });

            const data = await response.json();

            if (data.success) {
                // Payment initiated successfully
                marketplace.showNotification('Payment initiated. Check your phone for prompt.', 'success');
                
                // Wait for payment confirmation
                await this.checkPaymentStatus(data.transaction_id);
            } else {
                marketplace.showNotification(data.message || 'Payment failed', 'error');
                this.resetPaymentForm();
            }
        } catch (error) {
            console.error('Payment error:', error);
            marketplace.showNotification('Network error. Please try again.', 'error');
            this.resetPaymentForm();
        }
    }

    startPaymentCountdown() {
        let countdown = 60;
        const countdownElement = document.getElementById('payment-countdown');
        
        if (!countdownElement) return;

        const interval = setInterval(() => {
            countdown--;
            countdownElement.textContent = countdown;
            
            if (countdown <= 0) {
                clearInterval(interval);
                marketplace.showNotification('Payment timeout. Please try again.', 'warning');
                this.resetPaymentForm();
            }
        }, 1000);
    }

    async checkPaymentStatus(transactionId) {
        try {
            const response = await fetch(`${API_BASE_URL}/payments.php?action=check&transaction_id=${transactionId}`);
            const data = await response.json();

            if (data.success && data.payment.status === 'completed') {
                // Payment successful
                this.showSuccessModal(data.payment);
            } else {
                // Payment failed or still pending
                setTimeout(() => this.checkPaymentStatus(transactionId), 3000);
            }
        } catch (error) {
            console.error('Error checking payment status:', error);
        }
    }

    showSuccessModal(payment) {
        const modal = document.getElementById('success-modal');
        const transactionId = document.getElementById('success-transaction-id');
        const amount = document.getElementById('success-amount');
        const receipt = document.getElementById('success-receipt');
        const downloadLink = document.getElementById('download-link');

        if (!modal || !transactionId || !amount || !receipt || !downloadLink) return;

        // Close M-Pesa modal
        const mpesaModal = document.getElementById('mpesa-modal');
        if (mpesaModal) mpesaModal.style.display = 'none';

        // Update success modal
        transactionId.textContent = payment.transaction_id;
        amount.textContent = parseFloat(payment.amount).toFixed(2);
        receipt.textContent = payment.mpesa_receipt || 'Pending';
        
        if (payment.download_url) {
            downloadLink.href = payment.download_url;
        }

        modal.style.display = 'flex';

        // Add event listeners
        const closeBtn = document.querySelector('.close-success-btn');
        const viewPurchasesBtn = document.querySelector('.view-purchases-btn');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
                this.clearSelection();
            });
        }

        if (viewPurchasesBtn) {
            viewPurchasesBtn.addEventListener('click', () => {
                modal.style.display = 'none';
                this.clearSelection();
                // Navigate to purchases section
                const purchasesSection = document.querySelector('#purchases');
                if (purchasesSection) {
                    purchasesSection.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }
    }

    resetPaymentForm() {
        const paymentStatus = document.getElementById('payment-status');
        const form = document.getElementById('mpesa-payment-form');
        
        if (paymentStatus) paymentStatus.style.display = 'none';
        if (form) form.style.display = 'block';
    }

    clearSelection() {
        this.selectedTemplates = [];
        this.updateSelectionPanel();
        
        // Uncheck all checkboxes
        document.querySelectorAll('.template-card input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
        });
    }

    filterTemplates(searchTerm) {
        const filtered = this.templates.filter(template =>
            template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            template.description.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        this.renderFilteredTemplates(filtered);
    }

    renderFilteredTemplates(filteredTemplates) {
        const container = document.getElementById('templates-container');
        const noTemplates = document.getElementById('no-templates');
        
        if (!container) return;

        if (filteredTemplates.length === 0) {
            container.innerHTML = '';
            if (noTemplates) noTemplates.style.display = 'block';
            return;
        }

        if (noTemplates) noTemplates.style.display = 'none';

        container.innerHTML = filteredTemplates.map(template => `
            <div class="template-card" data-id="${template.id}">
                <div class="template-image" style="background: ${template.background_url || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}">
                    <div class="template-overlay">
                        <button class="btn btn-primary preview-template-btn" data-id="${template.id}">
                            <i class="fas fa-eye"></i> Preview
                        </button>
                    </div>
                </div>
                <div class="template-content">
                    <div class="template-header">
                        <h3 class="template-title">${marketplace.sanitizeInput(template.name)}</h3>
                        <div class="template-price">KSh ${parseFloat(template.price).toFixed(2)}</div>
                    </div>
                    <p class="template-desc">${marketplace.sanitizeInput(template.description)}</p>
                    <div class="template-footer">
                        <div class="checkbox-container">
                            <input type="checkbox" id="template-${template.id}" 
                                   ${this.isTemplateSelected(template.id) ? 'checked' : ''}>
                            <label for="template-${template.id}">Select for purchase</label>
                        </div>
                        <button class="btn btn-outline buy-template-btn" data-id="${template.id}">
                            <i class="fas fa-shopping-cart"></i> Buy Now
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        this.attachTemplateEventListeners();
    }

    sortTemplates(sortBy) {
        let sortedTemplates = [...this.templates];

        switch (sortBy) {
            case 'price-low':
                sortedTemplates.sort((a, b) => a.price - b.price);
                break;
            case 'price-high':
                sortedTemplates.sort((a, b) => b.price - a.price);
                break;
            case 'newest':
                sortedTemplates.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                break;
            case 'popular':
                sortedTemplates.sort((a, b) => (b.downloads_count || 0) - (a.downloads_count || 0));
                break;
        }

        this.renderFilteredTemplates(sortedTemplates);
    }

    showAdminLogin() {
        const modal = document.getElementById('admin-login-modal');
        if (modal) {
            modal.style.display = 'flex';
        } else {
            // Redirect to admin page
            window.location.href = 'admin.html';
        }
    }

    async handleAdminLogin(e) {
        e.preventDefault();
        
        const form = e.target;
        const username = form.querySelector('#login-username').value;
        const password = form.querySelector('#login-password').value;

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
                
                // Redirect to admin page
                window.location.href = 'admin.html';
            } else {
                marketplace.showNotification(data.message || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            marketplace.showNotification('Network error. Please try again.', 'error');
        }
    }
}

// Initialize user interface
document.addEventListener('DOMContentLoaded', () => {
    const userInterface = new UserInterface();
});