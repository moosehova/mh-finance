document.addEventListener('DOMContentLoaded', () => {
    const grid = document.querySelector('#product-grid');
    const filterBar = document.querySelector('#category-filters');
    const searchInput = document.querySelector('#productSearch');
    const modal = document.querySelector('#productModal');
    const modalContent = document.querySelector('#modalContent');
    const productCount = document.querySelector('#productCount');
    const cartFab = document.querySelector('#cart-fab');
    const cartFabBtn = document.querySelector('#cart-fab-btn');
    const cartCount = document.querySelector('#cart-count');
    const cartModal = document.querySelector('#cartModal');
    const cartItems = document.querySelector('#cart-items');
    const cartCheckout = document.querySelector('#cart-checkout');
    const cartClear = document.querySelector('#cart-clear');
    if (!grid) {
        return;
    }

    const fallbackProducts = Array.isArray(products) ? products : [];
    const hasCartUI = Boolean(cartFab && cartFabBtn && cartCount && cartModal && cartItems && cartCheckout && cartClear);
    let allProducts = [];
    let activeCategory = 'All';
    let searchTerm = '';
    let cart = [];
    const CART_STORAGE_KEY = 'mh_finance_cart';
    let productsChannel = null;

    function normalizeProduct(product) {
        let specs = {};
        try {
            specs = typeof product.specs === 'object' && product.specs !== null
                ? product.specs
                : JSON.parse(product.specs || '{}');
        } catch (_) {}
        return {
            id: product.id,
            name: product.name || 'Unnamed Package',
            category: product.category || 'Loan',
            price: product.price || 'Contact Us',
            benefits: product.description || product.benefits || '',
            speed: specs.speed || '',
            term: specs.term || '',
            image: product.image_url || product.image || 'images/default-product.jpg',
            isInStock: product.is_active !== false && product.is_in_stock !== false
        };
    }

    function renderProductCards(items) {
        grid.innerHTML = '';
        if (productCount) {
            productCount.textContent = `${items.length} loan package${items.length === 1 ? '' : 's'} available`;
        }

        if (!items.length) {
            grid.innerHTML = '<div class="product-card" style="grid-column: 1 / -1; text-align: center;"><h3 style="color: var(--keria-emerald); font-family: \"Playfair Display\", serif;">No products found</h3><p style="color: #64748b; margin-bottom: 0;">Try another category.</p></div>';
            return;
        }

        items.forEach((product) => {
            const messagePrefix = typeof CONFIG !== 'undefined' && CONFIG.whatsappMessage
                ? CONFIG.whatsappMessage
                : 'Hello MH Finance, I would like to apply for ';
            const whatsappNumber = typeof CONFIG !== 'undefined' && CONFIG.whatsapp
                ? CONFIG.whatsapp
                : 'YOUR_WIFES_NUMBER';
            const outOfStock = product.isInStock === false;
            const badgeClass = outOfStock ? 'category-badge category-badge--soldout' : 'category-badge';
            const statusText = outOfStock ? 'Unavailable' : product.category;
            const buttonClass = outOfStock ? 'btn-primary btn-primary--disabled' : 'btn-primary';
            const buttonText = outOfStock ? 'Unavailable' : 'Apply Now';
            const cardClass = outOfStock ? 'product-card product-card--soldout' : 'product-card';
            const modalPointerClass = modal ? 'product-card--interactive' : '';
            const rateClass = outOfStock ? 'comparison-card__rate comparison-card__rate--muted' : 'comparison-card__rate';

            const actionMarkup = outOfStock
                ? `<button type="button" class="${buttonClass}" style="font-size: 0.7rem; padding: 8px 16px;">${buttonText}</button>`
                : (hasCartUI
                    ? `<button type="button" class="${buttonClass}" data-add-cart="${product.id}" data-interest="${product.specs?.interest || 0.125}" style="font-size: 0.7rem; padding: 8px 16px;">${buttonText}</button>`
                    : `<a href="https://wa.me/${whatsappNumber}?text=${encodeURIComponent(messagePrefix + product.name)}" class="${buttonClass}" style="font-size: 0.7rem; padding: 8px 16px;" target="_blank" rel="noopener noreferrer">${buttonText}</a>`);

            const chipsMarkup = (product.speed || product.term)
                ? `<div class="comparison-card__chips">
                        ${product.speed ? `<span class="comparison-chip">⚡ ${product.speed}</span>` : ''}
                        ${product.term ? `<span class="comparison-chip">📅 ${product.term}</span>` : ''}
                   </div>`
                : '';

            const card = `
                <div class="${cardClass} ${modalPointerClass}" ${modal ? `data-product-id="${product.id}"` : ''}>
                    <div class="comparison-card__header">
                        <span class="${badgeClass}">${statusText}</span>
                        <span class="${rateClass}">${product.price}</span>
                    </div>
                    <h3 class="comparison-card__name">${product.name}</h3>
                    <p class="comparison-card__desc">${product.benefits}</p>
                    ${chipsMarkup}
                    <div class="comparison-card__action">
                        ${actionMarkup}
                    </div>
                </div>
            `;

            grid.innerHTML += card;
        });
    }

    function openModal(productId) {
        if (!modal || !modalContent) {
            return;
        }

        const product = allProducts.find((item) => String(item.id) === String(productId));
        if (!product) {
            return;
        }

        const messagePrefix = typeof CONFIG !== 'undefined' && CONFIG.whatsappMessage
            ? CONFIG.whatsappMessage
            : 'Hello MH Finance, I would like to apply for ';
        const whatsappNumber = typeof CONFIG !== 'undefined' && CONFIG.whatsapp
            ? CONFIG.whatsapp
            : 'YOUR_WIFES_NUMBER';
        const outOfStock = product.isInStock === false;

        const modalActionMarkup = outOfStock
            ? '<button type="button" class="btn-primary btn-primary--disabled">Unavailable</button>'
            : (hasCartUI
                ? `<button type="button" class="btn-primary" data-modal-add-cart="${product.id}">Apply Now</button>`
                : `<a href="https://wa.me/${whatsappNumber}?text=${encodeURIComponent(messagePrefix + product.name)}" class="btn-primary" target="_blank" rel="noopener noreferrer">Apply via WhatsApp</a>`);

        const modalChips = (product.speed || product.term)
            ? `<div class="comparison-card__chips" style="margin-bottom: 18px;">
                ${product.speed ? `<span class="comparison-chip">⚡ Approval: ${product.speed}</span>` : ''}
                ${product.term ? `<span class="comparison-chip">📅 Max Term: ${product.term}</span>` : ''}
               </div>`
            : '';

        modalContent.innerHTML = `
            <span class="category-badge ${outOfStock ? 'category-badge--soldout' : ''}">${outOfStock ? 'Unavailable' : product.category}</span>
            <h2 id="modal-title" class="modal-title">${product.name}</h2>
            <div class="comparison-modal__rate">${product.price}</div>
            <p class="modal-copy">${product.benefits || 'Contact us for full loan terms and requirements.'}</p>
            ${modalChips}
            <div class="modal-row">
                ${modalActionMarkup}
            </div>
        `;

        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        if (!modal) {
            return;
        }
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    function getNumericPrice(price) {
        const parsed = Number(String(price || '').replace(/[^0-9.]/g, ''));
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function formatCurrency(value) {
        return `K${value.toFixed(0)}`;
    }

    function saveCart() {
        try {
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
        } catch (error) {
            console.error('Cart save failed:', error);
        }
        updateCartUI();
    }

    function loadCart() {
        try {
            const saved = localStorage.getItem(CART_STORAGE_KEY);
            if (!saved) {
                return;
            }

            const parsed = JSON.parse(saved);
            if (!Array.isArray(parsed)) {
                return;
            }

            cart = parsed
                .filter((item) => item && item.id && item.name)
                .map((item) => ({
                    ...item,
                    quantity: Math.max(1, Number(item.quantity) || 1)
                }));
        } catch (error) {
            console.error('Cart load failed:', error);
            cart = [];
        }
    }

    function renderCartItems() {
        if (!hasCartUI) {
            return;
        }

        if (!cart.length) {
            cartItems.innerHTML = '<p class="modal-copy" style="margin: 0;">Your cart is empty. Add products to build your order.</p>';
            return;
        }

        const total = cart.reduce((sum, item) => sum + (getNumericPrice(item.price) * item.quantity), 0);
        const rows = cart.map((item) => `
            <div class="cart-item">
                <div>
                    <p class="cart-item__title">${item.name}</p>
                    <p class="cart-item__meta">${item.price} x ${item.quantity}</p>
                </div>
                <button type="button" class="cart-item__remove" data-cart-remove="${item.id}">Remove</button>
            </div>
        `).join('');

        cartItems.innerHTML = `${rows}<div class="cart-total">Total: ${formatCurrency(total)}</div>`;
    }

    function updateCartUI() {
        if (!hasCartUI) {
            return;
        }

        const totalUnits = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCount.textContent = String(totalUnits);
        if (totalUnits > 0) {
            cartFab.classList.remove('hidden');
            cartFab.setAttribute('aria-hidden', 'false');
        } else {
            cartFab.classList.add('hidden');
            cartFab.setAttribute('aria-hidden', 'true');
            cartModal.classList.remove('is-open');
            cartModal.setAttribute('aria-hidden', 'true');
            if (!modal || !modal.classList.contains('is-open')) {
                document.body.style.overflow = '';
            }
        }

        renderCartItems();
    }

    function addToCart(productId) {
        const product = allProducts.find((item) => String(item.id) === String(productId));
        if (!product || product.isInStock === false) {
            return;
        }

        const existingItem = cart.find((item) => String(item.id) === String(product.id));
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({ ...product, quantity: 1 });
        }

        saveCart();
    }

    function toggleCartModal(forceOpen = null) {
        if (!hasCartUI) {
            return;
        }
        if (!cart.length) {
            return;
        }

        const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !cartModal.classList.contains('is-open');
        if (shouldOpen) {
            cartModal.classList.add('is-open');
            cartModal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        } else {
            cartModal.classList.remove('is-open');
            cartModal.setAttribute('aria-hidden', 'true');
            if (!modal || !modal.classList.contains('is-open')) {
                document.body.style.overflow = '';
            }
        }
    }

    function checkoutWhatsApp() {
        if (!cart.length) {
            return;
        }

        const whatsappNumber = typeof CONFIG !== 'undefined' && CONFIG.whatsapp
            ? CONFIG.whatsapp
            : 'YOUR_WIFES_NUMBER';

        let message = '*MH FINANCE - LOAN MATCHING REQUEST*\n';
        message += '--------------------------\n';

        cart.forEach((item) => {
            message += `Interested in: *${item.name}*\n`;
            message += `Rate: ${item.price}\n`;
            message += `Category: ${item.category}\n`;
        });

        message += '--------------------------\n';
        message += 'Hello MH Finance, I saw these lender profiles on your portal. Based on my profile, please advise which one I qualify for and help me with the application.';

        window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
    }

    function getCategories(items) {
        return ['All', ...new Set(items.map((item) => item.category).filter(Boolean))];
    }

    function applyFilter(category) {
        activeCategory = category;
        const normalizedSearch = searchTerm.trim().toLowerCase();
        const filtered = allProducts.filter((item) => {
            const matchesCategory = category === 'All' || item.category === category;
            const haystack = `${item.name} ${item.category} ${item.benefits}`.toLowerCase();
            const matchesSearch = !normalizedSearch || haystack.includes(normalizedSearch);
            return matchesCategory && matchesSearch;
        });
        renderFilterButtons(getCategories(allProducts));
        renderProductCards(filtered);
    }

    function renderFilterButtons(categories) {
        if (!filterBar) {
            return;
        }

        filterBar.innerHTML = categories.map((category) => `
            <button class="filter-btn ${category === activeCategory ? 'active' : ''}" data-category="${category}">
                ${category}
            </button>
        `).join('');

        filterBar.querySelectorAll('.filter-btn').forEach((button) => {
            button.addEventListener('click', () => {
                applyFilter(button.dataset.category);
            });
        });
    }

    async function loadProducts() {
        if (!_supabase) {
            allProducts = fallbackProducts.map(normalizeProduct);
            renderFilterButtons(getCategories(allProducts));
            applyFilter('All');
            return;
        }

        try {
            const { data, error } = await _supabase
                .from('studio_inventory')
                .select('*')
                .eq('client_id', CLIENT_ID || 'mh-finance')
                .eq('is_active', true)
                .order('id', { ascending: false });

            if (error) {
                allProducts = fallbackProducts.map(normalizeProduct);
                renderFilterButtons(getCategories(allProducts));
                applyFilter('All');
                return;
            }

            const liveProducts = Array.isArray(data) ? data.map(normalizeProduct) : [];
            allProducts = liveProducts.length ? liveProducts : fallbackProducts.map(normalizeProduct);
            renderFilterButtons(getCategories(allProducts));
            applyFilter('All');
        } catch (error) {
            allProducts = fallbackProducts.map(normalizeProduct);
            renderFilterButtons(getCategories(allProducts));
            applyFilter('All');
        }
    }

    function subscribeToProductChanges() {
        if (!_supabase || typeof _supabase.channel !== 'function' || productsChannel) {
            return;
        }

        productsChannel = _supabase
            .channel('public:studio-inventory-live')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'studio_inventory' },
                () => {
                    loadProducts();
                }
            )
            .subscribe();
    }

    searchInput?.addEventListener('input', (event) => {
        searchTerm = event.target.value || '';
        applyFilter(activeCategory);
    });

    cartFabBtn?.addEventListener('click', () => {
        toggleCartModal(true);
    });

    cartCheckout?.addEventListener('click', () => {
        checkoutWhatsApp();
    });

    cartClear?.addEventListener('click', () => {
        cart = [];
        saveCart();
    });

    if (modal) {
        grid.addEventListener('click', (event) => {
            const addCartButton = event.target.closest('[data-add-cart]');
            if (addCartButton) {
                event.stopPropagation();
                const interest = addCartButton.getAttribute('data-interest');
                if (interest) syncCalculator(parseFloat(interest));
                addToCart(addCartButton.dataset.addCart);
                toggleCartModal(true);
                return;
            }

            const card = event.target.closest('[data-product-id]');
            if (!card) {
                return;
            }
            openModal(card.dataset.productId);
        });

        modal.addEventListener('click', (event) => {
            if (event.target.closest('[data-modal-close]')) {
                closeModal();
                return;
            }

            const modalAddCart = event.target.closest('[data-modal-add-cart]');
            if (modalAddCart) {
                addToCart(modalAddCart.dataset.modalAddCart);
                closeModal();
                toggleCartModal(true);
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeModal();
                toggleCartModal(false);
            }
        });
    }

    cartModal?.addEventListener('click', (event) => {
        if (event.target.closest('[data-cart-close]')) {
            toggleCartModal(false);
            return;
        }

        const removeBtn = event.target.closest('[data-cart-remove]');
        if (!removeBtn) {
            return;
        }

        const removeId = removeBtn.dataset.cartRemove;
        const existing = cart.find((item) => String(item.id) === String(removeId));
        if (existing) {
            cart = cart.filter((item) => String(item.id) !== String(removeId));
            saveCart();
        }
    });

    loadCart();
    updateCartUI();

    subscribeToProductChanges();
    loadProducts();

    const lenderSelect = document.getElementById('lender-select');
    const amountSlider = document.getElementById('calc-range');
    const resultDisplay = document.getElementById('calc-result');
    const amountLabel = document.getElementById('calc-amount-label');
    const termInfo = document.getElementById('calc-term-info');

    function syncCalculator(lenderValue) {
        if (!lenderSelect) return;
        lenderSelect.value = lenderValue;
        if (typeof calculateLoan === 'function') {
            calculateLoan();
        }
        lenderSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    if (lenderSelect && amountSlider && resultDisplay) {
        function calculateLoan() {
            const amount = parseFloat(amountSlider.value);
            const selectedOption = lenderSelect.options[lenderSelect.selectedIndex];
            const interestRate = parseFloat(selectedOption.value);
            const termMonths = parseInt(selectedOption.getAttribute('data-term'));
            const lenderName = selectedOption.getAttribute('data-name') || 'Selected Lender';

            // Update UI labels
            if (amountLabel) amountLabel.textContent = `K${amount.toLocaleString()}`;
            if (termInfo) termInfo.textContent = `Based on a ${termMonths}-month term`;

            // The Math: (Principal + (Principal * Rate)) / Term
            // Simple interest calculation common in micro-finance
            const totalRepayment = amount + (amount * interestRate);
            const monthly = totalRepayment / termMonths;

            if (resultDisplay) resultDisplay.textContent = `K${Math.round(monthly).toLocaleString()}`;
        }

        // Listen for interactions
        lenderSelect.addEventListener('change', calculateLoan);
        amountSlider.addEventListener('input', calculateLoan);

        // Initial calculation on page load
        calculateLoan();
    }

    // ============================================================
    // FAIL-SAFE: Robust Calculator with Console Debugging
    // This runs independently to ensure the slider always works
    // ============================================================
    const failsafeAmountSlider = document.getElementById('calc-range');
    const failsafeLenderSelect = document.getElementById('lender-select');
    const failsafeAmountLabel = document.getElementById('calc-amount-label');
    const failsafeResultDisplay = document.getElementById('calc-result');
    const failsafeTermInfo = document.getElementById('calc-term-info');

    if (!failsafeAmountSlider) console.error('❌ Calculator: calc-range slider not found in HTML');
    if (!failsafeLenderSelect) console.error('❌ Calculator: lender-select dropdown not found in HTML');

    function updateLoanMath() {
        if (!failsafeAmountSlider || !failsafeLenderSelect || !failsafeResultDisplay) {
            return;
        }

        try {
            const amount = parseFloat(failsafeAmountSlider.value);
            const selectedOption = failsafeLenderSelect.options[failsafeLenderSelect.selectedIndex];
            const interestRate = parseFloat(selectedOption.value);
            const termMonths = parseInt(selectedOption.getAttribute('data-term'));

            if (failsafeAmountLabel) {
                failsafeAmountLabel.innerText = `K${amount.toLocaleString()}`;
            }
            if (failsafeTermInfo) {
                failsafeTermInfo.innerText = `Based on a ${termMonths}-month term`;
            }

            const total = amount + (amount * interestRate);
            const monthly = total / termMonths;

            failsafeResultDisplay.innerText = `K${Math.round(monthly).toLocaleString()}`;
        } catch (error) {
            console.error('❌ Calculator math error:', error);
        }
    }

    if (failsafeAmountSlider && failsafeLenderSelect) {
        failsafeAmountSlider.addEventListener('input', updateLoanMath);
        failsafeLenderSelect.addEventListener('change', updateLoanMath);
        updateLoanMath();
        console.log('✓ Calculator initialized successfully');
    } else {
        console.warn('⚠ Calculator fail-safe: Required elements missing from HTML');
    }

    // Make syncCalculator available globally for product card clicks
    window.syncCalculator = function(lenderValue) {
        if (!failsafeLenderSelect) {
            console.error('❌ syncCalculator: lender-select not found');
            return;
        }
        failsafeLenderSelect.value = lenderValue;
        updateLoanMath();
        setTimeout(() => {
            failsafeLenderSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    };
});

// =====================================================
// MH Finance — Multi-Employer Calculator
// Rates from Loan Tools All Employers spreadsheet
// =====================================================

var MH_WHATSAPP  = (typeof CONFIG !== 'undefined' && CONFIG.whatsapp) ? CONFIG.whatsapp : '260975931621';
var MH_ADMIN_RATE  = 0.01;    // 1.0%  monthly admin fee (recurring, all employers)
var MH_ARRANGEMENT = 0.045;   // 4.5%  upfront
var MH_INSURANCE   = 0.04;    // 4.0%  upfront
var MH_PROCESSING  = 0.025;   // 2.5%  upfront
var MH_INS_LEVY    = 0.03;    // 3.0%  of insurance fee
var MH_CRB         = 35;      // K35   flat CRB fee

function calculateLoan() {
    var amountSlider    = document.getElementById('calc-range');
    var periodSlider    = document.getElementById('calc-period');
    var employerSelect  = document.getElementById('employer-select');
    if (!amountSlider || !periodSlider || !employerSelect) return;

    // Get employer-specific rate and max period
    var opt = employerSelect.options[employerSelect.selectedIndex];
    var monthlyRate = parseFloat(opt.getAttribute('data-rate')) || 0.0275;
    var maxMonths = parseInt(opt.getAttribute('data-max')) || 72;
    var employerName = opt.textContent.trim();

    // Enforce period slider max for employer rules (e.g., G4S max 48)
    periodSlider.max = maxMonths;
    if (parseInt(periodSlider.value) > maxMonths) {
        periodSlider.value = maxMonths;
    }

    var grossAmount = parseFloat(amountSlider.value);
    var months      = parseInt(periodSlider.value);
    // Repayment math: standard amortization PMT + monthly admin fee
    var pmt = (grossAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
    var totalMonthly = pmt + (grossAmount * MH_ADMIN_RATE);

    // Deductions math from MFZ schedule
    var deductions = (grossAmount * MH_ARRANGEMENT)
        + (grossAmount * MH_INSURANCE)
        + (grossAmount * MH_PROCESSING)
        + (grossAmount * MH_INSURANCE * MH_INS_LEVY)
        + MH_CRB;
    var cashInHand = grossAmount - deductions;
    var rateDisplay = (monthlyRate * 100).toFixed(2);

    var amountLabel  = document.getElementById('calc-amount-label');
    var periodLabel  = document.getElementById('calc-period-label');
    var resultDisplay = document.getElementById('calc-result');
    var cashDisplay  = document.getElementById('cash-in-hand');
    var rateNote     = document.getElementById('calc-rate-note');

    if (amountLabel)   amountLabel.textContent  = 'K' + grossAmount.toLocaleString();
    if (periodLabel)   periodLabel.textContent  = months + ' Months';
    if (resultDisplay) resultDisplay.textContent = Math.round(totalMonthly).toLocaleString();
    if (cashDisplay)   cashDisplay.textContent  = 'K' + Math.round(cashInHand).toLocaleString();
    if (rateNote)      rateNote.textContent     = employerName.split('(')[0].trim() + ' rate: ' + rateDisplay + '% per month';
}

function checkoutWhatsApp() {
    var amountSlider   = document.getElementById('calc-range');
    var periodSlider   = document.getElementById('calc-period');
    var employerSelect = document.getElementById('employer-select');
    var monthly        = document.getElementById('calc-result');
    var cash           = document.getElementById('cash-in-hand');

    var amount      = amountSlider   ? parseInt(amountSlider.value)   : 100000;
    var period      = periodSlider   ? parseInt(periodSlider.value)   : 72;
    var employer    = employerSelect ? employerSelect.options[employerSelect.selectedIndex].textContent.trim() : 'Not specified';
    var monthlyText = monthly ? monthly.textContent : 'N/A';
    var cashText    = cash    ? cash.textContent    : 'N/A';

    var message = '*MH FINANCE \u2014 NEW LOAN APPLICATION*\n'
        + '--------------------------\n'
        + 'Employer: *' + employer + '*\n'
        + 'Gross Loan: *K' + amount.toLocaleString() + '*\n'
        + 'Period: *' + period + ' Months*\n'
        + 'Est. Monthly Repayment: *K' + monthlyText + '*\n'
        + 'Est. Cash in Hand: *' + cashText + '*\n'
        + '--------------------------\n'
        + 'Hello MH Finance, I have used your calculator and would like to proceed with this application. Please advise on the next steps.';

    window.open('https://wa.me/' + MH_WHATSAPP + '?text=' + encodeURIComponent(message), '_blank', 'noopener');
}

// Wire all inputs on load
document.addEventListener('DOMContentLoaded', function() {
    var amountSlider   = document.getElementById('calc-range');
    var periodSlider   = document.getElementById('calc-period');
    var employerSelect = document.getElementById('employer-select');
    if (amountSlider) amountSlider.addEventListener('input', calculateLoan);
    if (periodSlider) periodSlider.addEventListener('input', calculateLoan);
    if (employerSelect) employerSelect.addEventListener('change', calculateLoan);
    calculateLoan();
    console.log('\u2705 MH Finance Multi-Employer Calculator ready.');
});

// Fail-safe: re-run after DOM is fully settled
setTimeout(calculateLoan, 600);
