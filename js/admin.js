let inventory = [];
let editingId = null;
const categorySeed = [...new Set(inventory.map((item) => item.category).filter(Boolean))];
if (!Array.isArray(window.categories) || !window.categories.length) {
    window.categories = categorySeed.length ? categorySeed : ['Nuts', 'Seeds', 'Specialty'];
}

let successPopupTimer = null;

function setAuthError(message = '') {
    const errorTag = document.getElementById('login-error');
    if (!errorTag) {
        return;
    }

    if (message) {
        errorTag.textContent = message;
        errorTag.classList.remove('hidden');
    } else {
        errorTag.textContent = '';
        errorTag.classList.add('hidden');
    }
}

function showLoginOverlay() {
    document.getElementById('login-overlay')?.classList.remove('hidden');
    document.getElementById('admin-dashboard')?.classList.add('hidden');
}

function showDashboard() {
    document.getElementById('login-overlay')?.classList.add('hidden');
    document.getElementById('admin-dashboard')?.classList.remove('hidden');
    setAuthError('');
}

async function requireSession() {
    if (!_supabase || !_supabase.auth) {
        return true;
    }

    const { data, error } = await _supabase.auth.getSession();
    if (error || !data?.session) {
        showLoginOverlay();
        setAdminStatus('Session required. Please sign in to continue.', 'warning');
        return false;
    }

    return true;
}

function setAdminStatus(message, tone = 'warning') {
    const status = document.getElementById('admin-status');
    if (!status) {
        return;
    }

    const tones = {
        warning: 'border-amber-200 bg-amber-50 text-amber-900',
        error: 'border-rose-200 bg-rose-50 text-rose-900',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-900'
    };

    status.className = `rounded-2xl px-4 py-3 text-sm ${tones[tone] || tones.warning}`;
    status.textContent = message;
}

function showSuccessPopup(message = 'Loan package is now live on MH Finance.') {
    const popup = document.getElementById('success-popup');
    const messageTag = document.getElementById('success-popup-message');
    if (!popup) {
        return;
    }

    if (messageTag) {
        messageTag.textContent = message;
    }

    popup.classList.remove('hidden');
    popup.classList.add('flex');

    if (successPopupTimer) {
        clearTimeout(successPopupTimer);
    }

    successPopupTimer = setTimeout(() => {
        closeSuccessPopup();
    }, 3000);
}

function closeSuccessPopup() {
    const popup = document.getElementById('success-popup');
    if (!popup) {
        return;
    }

    popup.classList.add('hidden');
    popup.classList.remove('flex');

    if (successPopupTimer) {
        clearTimeout(successPopupTimer);
        successPopupTimer = null;
    }
}

function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
}

async function uploadImageToStorage(file) {
    if (!_supabase || !_supabase.storage) {
        throw new Error('Supabase storage is not available.');
    }

    const bucket = (typeof CONFIG !== 'undefined' && CONFIG.storageBucket) ? CONFIG.storageBucket : 'product-images';
    const extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;

    const { error: uploadError } = await _supabase
        .storage
        .from(bucket)
        .upload(fileName, file, { upsert: false });

    if (uploadError) {
        throw uploadError;
    }

    const { data } = _supabase
        .storage
        .from(bucket)
        .getPublicUrl(fileName);

    if (!data?.publicUrl) {
        throw new Error('Could not generate a public URL for the uploaded image.');
    }

    return data.publicUrl;
}

function syncCategories(selectedCategory) {
    const tagContainer = document.getElementById('category-tags');
    const dropdown = document.getElementById('p-category');
    const currentSelected = selectedCategory || dropdown.value || window.categories[0] || '';

    tagContainer.innerHTML = window.categories.map((cat, index) => `
        <span class="bg-white border border-emerald-200 text-emerald-900 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-2">
            ${cat}
            <button onclick="deleteCategory(${index})" class="text-red-400 hover:text-red-600">&times;</button>
        </span>
    `).join('');

    dropdown.innerHTML = window.categories.map((cat) => `
        <option value="${cat}">${cat}</option>
    `).join('');

    if (window.categories.includes(currentSelected)) {
        dropdown.value = currentSelected;
    }
}

function hydrateCategoriesFromInventory() {
    const inventoryCategories = [...new Set(inventory.map((item) => item.category).filter(Boolean))];
    const merged = [...new Set([...(window.categories || []), ...inventoryCategories])];
    window.categories = merged.length ? merged : ['Nuts', 'Seeds', 'Specialty'];
    syncCategories();
}

function addCategory() {
    const input = document.getElementById('new-cat-name');
    const value = input.value.trim();
    if (value !== '' && !window.categories.includes(value)) {
        window.categories.push(value);
        input.value = '';
        syncCategories(value);
        alert('Category list updated.');
    }
}

function deleteCategory(index) {
    if (index < 0 || index >= window.categories.length) {
        return;
    }
    if (confirm('Remove this category? Products already assigned to it will keep their current value.')) {
        window.categories.splice(index, 1);
        syncCategories();
    }
}

function renderInventory() {
    const list = document.getElementById('admin-product-list');
    document.getElementById('item-count').innerText = `${inventory.length} Items`;

    if (!list) {
        return;
    }

    if (!inventory.length) {
        list.innerHTML = `
            <tr>
                <td colspan="5" class="p-6 text-sm text-slate-400 text-center">No products found.</td>
            </tr>
        `;
        return;
    }

    setAdminStatus(`Connected. Showing ${inventory.length} live product${inventory.length === 1 ? '' : 's'}.`, 'success');

    list.innerHTML = inventory.map((product, index) => `
        <tr class="border-b border-emerald-900/10">
            <td class="p-4">
                <div class="flex items-center gap-3">
                    <img src="${product.image}" class="w-12 h-12 rounded-xl object-cover" onerror="this.src='images/default-product.jpg'">
                    <div>
                        <p class="text-xs font-bold text-emerald-900">${product.name}</p>
                        <p class="text-[11px] text-slate-500">${product.benefits || ''}</p>
                    </div>
                </div>
            </td>
            <td class="p-4 text-xs text-slate-500">${product.category}</td>
            <td class="p-4 text-xs text-emerald-700 font-black">${product.price}</td>
            <td class="p-4">
                <span class="px-2 py-1 rounded-full text-[9px] ${product.is_in_stock === false ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}">
                    ${product.is_in_stock === false ? 'OUT OF STOCK' : 'IN STOCK'}
                </span>
            </td>
            <td class="p-4 text-right">
                <button onclick="editProduct(${index})" class="text-blue-600 hover:text-blue-800 text-xs font-bold mr-3">Edit</button>
                <button onclick="deleteProduct(${product.id})" class="text-red-500 hover:text-red-700 text-xs font-bold">Delete</button>
            </td>
        </tr>
    `).join('');
}

function editProduct(index) {
    const product = inventory[index];
    if (!product) {
        return;
    }

    document.getElementById('form-title').innerText = 'Edit Product';
    document.getElementById('edit-index').value = index;
    editingId = product.id || null;
    document.getElementById('p-name').value = product.name || '';
    document.getElementById('p-price').value = product.price || '';
    document.getElementById('p-benefits').value = product.benefits || '';
    document.getElementById('is_in_stock').checked = product.is_in_stock !== false;

    if (product.category && !window.categories.includes(product.category)) {
        window.categories.push(product.category);
        syncCategories(product.category);
    }

    document.getElementById('p-category').value = product.category || 'Nuts';
    document.getElementById('p-image').value = product.image || '';
    document.getElementById('product-image-file').value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function saveProduct() {
    if (!(await requireSession())) {
        return;
    }

    const index = parseInt(document.getElementById('edit-index').value, 10);
    const fileInput = document.getElementById('product-image-file');
    const urlInput = document.getElementById('p-image').value.trim();
    const existingImage = index >= 0 && inventory[index] ? inventory[index].image : '';
    const newImageFile = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;

    let imageData = urlInput || existingImage;

    if (_supabase && newImageFile) {
        try {
            imageData = await uploadImageToStorage(newImageFile);
        } catch (error) {
            console.error('Storage upload failed:', error.message || error);
            alert(`Image upload failed: ${error.message || 'Unknown error'}`);
            return;
        }
    } else if (newImageFile) {
        try {
            imageData = await getBase64(newImageFile);
        } catch (error) {
            alert(`Error reading image file: ${error.message}`);
            return;
        }
    }

    const newProduct = {
        name: document.getElementById('p-name').value.trim(),
        price: document.getElementById('p-price').value.trim(),
        category: document.getElementById('p-category').value,
        benefits: document.getElementById('p-benefits').value.trim(),
        image: imageData,
        is_in_stock: document.getElementById('is_in_stock').checked
    };

    if (!newProduct.name || !newProduct.price || !newProduct.image) {
        alert('Please complete name, price, and upload or paste an image before saving.');
        return;
    }

    if (_supabase) {
        const payload = {
            name: newProduct.name,
            price: newProduct.price,
            category: newProduct.category,
            benefits: newProduct.benefits,
            image_url: newProduct.image,
            is_in_stock: newProduct.is_in_stock
        };

        let error;
        if (editingId) {
            ({ error } = await _supabase.from('products').update(payload).eq('id', editingId));
        } else {
            ({ error } = await _supabase.from('products').insert([payload]));
        }

        if (error) {
            console.error('Error saving:', error.message);
            alert('Failed to save. Check console.');
            return;
        }

        await loadInventory();
    } else {
        if (index === -1) {
            inventory.push(newProduct);
        } else {
            inventory[index] = { ...inventory[index], ...newProduct };
        }
        renderInventory();
    }

    if (newProduct.category && !window.categories.includes(newProduct.category)) {
        window.categories.push(newProduct.category);
    }

    resetForm();
    const successMessage = _supabase
        ? 'Loan package is now live on MH Finance.'
        : 'Inventory updated locally. Generate product data to export.';
    setAdminStatus(successMessage, 'success');
    showSuccessPopup(successMessage);
}

async function deleteProduct(id) {
    if (!(await requireSession())) {
        return;
    }

    const item = inventory.find((product) => product.id === id);
    if (!item) {
        return;
    }

    if (!confirm('Are you sure you want to remove this loan package from MH Finance?')) {
        return;
    }

    if (_supabase && item.id) {
        const { error } = await _supabase.from('products').delete().eq('id', item.id);
        if (error) {
            console.error('Admin Fetch Error:', error.message);
            alert('Error deleting product');
            return;
        }
        await refreshAdminTable();
    } else {
        inventory = inventory.filter((product) => product.id !== id);
        renderInventory();
    }

    resetForm();
}

function resetForm() {
    document.getElementById('admin-form').reset();
    document.getElementById('edit-index').value = '-1';
    document.getElementById('form-title').innerText = 'Add New Product';
    editingId = null;
    document.getElementById('product-image-file').value = '';
    document.getElementById('p-image').value = '';
    document.getElementById('p-benefits').value = '';
    document.getElementById('is_in_stock').checked = true;
    syncCategories();
}

function buildProductsCode() {
    const portable = inventory.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        price: item.price,
        benefits: item.benefits || '',
        image: item.image,
        is_in_stock: item.is_in_stock !== false
    }));
    return `const products = ${JSON.stringify(portable, null, 4)};`;
}

function exportCode() {
    const output = document.getElementById('output-code');
    output.classList.remove('hidden');
    output.textContent = buildProductsCode();
    output.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function exportData() {
    const code = buildProductsCode();
    console.log(code);

    try {
        await navigator.clipboard.writeText(code);
        alert('Product code copied. Paste it into js/products.js, then commit and push.');
    } catch (error) {
        alert('Code printed to console. Copy it from DevTools Console and paste into js/products.js.');
    }
}

async function refreshAdminTable() {
    if (!_supabase) {
        setAdminStatus('Supabase is not connected. Add your Project URL and Anon Public Key in js/config.js.', 'warning');
        renderInventory();
        hydrateCategoriesFromInventory();
        return;
    }

    if (!(await requireSession())) {
        return;
    }

    const { data, error } = await _supabase
        .from('products')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        console.error('Admin Fetch Error:', error.message);
        setAdminStatus(`Supabase fetch failed: ${error.message}`, 'error');
        renderInventory();
        hydrateCategoriesFromInventory();
        return;
    }

    inventory = (data || []).map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        category: item.category,
        benefits: item.benefits,
        image: item.image_url,
        is_in_stock: item.is_in_stock !== false
    }));

    if (!inventory.length) {
        setAdminStatus('Supabase connected, but the products table returned 0 rows.', 'warning');
    }

    renderInventory();
    hydrateCategoriesFromInventory();
}

async function loadInventory() {
    await refreshAdminTable();
}

async function handleLogin() {
    if (!_supabase || !_supabase.auth) {
        alert('Supabase auth is not available. Check js/config.js credentials.');
        return;
    }

    const email = document.getElementById('auth-email')?.value.trim();
    const password = document.getElementById('auth-password')?.value || '';

    if (!email || !password) {
        setAuthError('Enter both email and password.');
        return;
    }

    setAuthError('');
    const { error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) {
        setAuthError(`Access denied: ${error.message}`);
        return;
    }

    showDashboard();
    await refreshAdminTable();
}

async function handleLogout() {
    if (_supabase && _supabase.auth) {
        await _supabase.auth.signOut();
    }
    showLoginOverlay();
    setAdminStatus('Signed out. Please sign in to continue.', 'warning');
}

window.addCategory = addCategory;
window.deleteCategory = deleteCategory;
window.editProduct = editProduct;
window.saveProduct = saveProduct;
window.deleteProduct = deleteProduct;
window.resetForm = resetForm;
window.exportCode = exportCode;
window.exportData = exportData;
window.refreshAdminTable = refreshAdminTable;
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.closeSuccessPopup = closeSuccessPopup;

window.addEventListener('DOMContentLoaded', async () => {
    syncCategories();

    if (!_supabase || !_supabase.auth) {
        showDashboard();
        setAdminStatus('Supabase auth unavailable; dashboard opened in fallback mode.', 'warning');
        await refreshAdminTable();
        return;
    }

    const { data, error } = await _supabase.auth.getSession();
    if (error) {
        showLoginOverlay();
        setAuthError(error.message);
        return;
    }

    if (data?.session) {
        showDashboard();
        await refreshAdminTable();
    } else {
        showLoginOverlay();
        setAdminStatus('Please sign in to access inventory controls.', 'warning');
    }

    _supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session) {
            showDashboard();
            await refreshAdminTable();
        } else {
            showLoginOverlay();
        }
    });
});
