// ─── Secure Admin UI Auth (Zero Browser Popups!) ────────────────────────────
async function initAdminAuth() {
    const overlay = document.getElementById('admin-login-overlay');
    const form = document.getElementById('admin-login-form');
    const submitBtn = document.getElementById('login-submit-btn');
    const feedbackBox = document.getElementById('login-feedback');

    if (!overlay || !form) return;

    // Direct token check using our Supabase client instance
    const { data: { session } } = await _supabase.auth.getSession();

    if (session) {
        // User has a valid session! Ensure layout overlay stays hidden and CONTINUE execution
        console.log("Admin session authorized.");
        overlay.classList.add('hidden');
        return; // This exits initAdminAuth quietly, allowing DOMContentLoaded to proceed to step 2!
    }

    // NO ACTIVE SESSION: Reveal the modern login card smoothly
    overlay.classList.remove('hidden');
    overlay.classList.add('flex'); 

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        // Clear previous states
        feedbackBox.classList.add('hidden');
        feedbackBox.innerText = '';

        submitBtn.disabled = true;
        submitBtn.innerText = "AUTHENTICATING...";

        const { data, error } = await _supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            feedbackBox.innerText = `❌ Access Denied: ${error.message}`;
            feedbackBox.classList.remove('hidden');

            submitBtn.disabled = false;
            submitBtn.innerText = "VERIFY CREDENTIALS";
            return;
        }

        // Authentication successful: Hide overlay card smoothly and reload to state hydrate
        overlay.classList.add('hidden');
        window.location.reload();
    });
}

// Global UI sign-out trigger (Replaces native window.confirm)
async function triggerSignOut() {
    const modal = document.getElementById('logout-confirm-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

async function confirmSignOut() {
    await _supabase.auth.signOut();
    window.location.reload();
}

function cancelSignOut() {
    const modal = document.getElementById('logout-confirm-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

// Map handlers to global scope for HTML inline calls
window.triggerSignOut = triggerSignOut;
window.confirmSignOut = confirmSignOut;
window.cancelSignOut = cancelSignOut;

// Unified DOM content execution
document.addEventListener('DOMContentLoaded', () => {
    initAdminAuth();
    initNavigation();

    const logoutButton = document.querySelector('.logout-btn');
    if (logoutButton) {
        // Intercept logout to display our custom confirmation dialog box
        logoutButton.removeAttribute('onclick');
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            triggerSignOut();
        });
    }
});

// ─── Employer Rules & Calculations ───────────────────────────────────────────
const employerRules = {
    GRZ: { name: 'GRZ Ministries', interest: 0.0275, maxMonths: 60 },
    ZAF: { name: 'ZAF', interest: 0.0275, maxMonths: 72 },
    ZNS: { name: 'ZNS', interest: 0.0258, maxMonths: 72 },
    ARMY: { name: 'Zambia Army', interest: 0.0242, maxMonths: 72 },
    ZAMTEL: { name: 'ZAMTEL', interest: 0.0258, maxMonths: 72 },
    G4S: { name: 'G4S', interest: 0.0358, maxMonths: 48 }
};

const adminFeeRate = 0.01;
const whatsappNumber = (typeof CONFIG !== 'undefined' && CONFIG.whatsapp) ? CONFIG.whatsapp : '260975931621';
const sampleLeads = [
    {
        leadId: 'MHF-240001',
        name: 'Luyando Phiri',
        phone: '260977123456',
        nrc: '302188/10/1',
        employer: 'GRZ',
        basicSalary: 14250,
        loanAmount: 120000,
        months: 72,
        status: 'new',
        source: 'WhatsApp',
        createdAt: '2026-04-06T08:15:00.000Z',
        missingDocs: ['Stamped Bank Statement']
    },
    {
        leadId: 'MHF-240002',
        name: 'Chola Banda',
        phone: '260966345678',
        nrc: '289003/54/1',
        employer: 'G4S',
        basicSalary: 5200,
        loanAmount: 45000,
        months: 48,
        status: 'review',
        source: 'Referral',
        createdAt: '2026-04-06T09:40:00.000Z',
        missingDocs: ['Employer Letter', 'Payslip 3']
    },
    {
        leadId: 'MHF-240003',
        name: 'Mwaka Tembo',
        phone: '260975456789',
        nrc: '334521/67/1',
        employer: 'ZNS',
        basicSalary: 9800,
        loanAmount: 70000,
        months: 60,
        status: 'pending-docs',
        source: 'Website',
        createdAt: '2026-04-06T10:05:00.000Z',
        missingDocs: ['Green NRC Copy']
    }
];

let leadsState = [];
let currentStatusFilter = 'all';
let currentSearchTerm = '';
let currentEmployerFilter = 'all';
let firebaseLeadsRef = null;
let currentLeadId = null;

function formatCurrency(value) {
    return new Intl.NumberFormat('en-ZM', {
        style: 'currency',
        currency: 'ZMW',
        minimumFractionDigits: 2
    }).format(Number(value) || 0);
}

function calculateMonthlyRepayment(amount, months, monthlyRate) {
    const principal = Number(amount) || 0;
    const duration = Number(months) || 0;
    if (!principal || !duration || !monthlyRate) {
        return 0;
    }

    const pmtBase = (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -duration));
    return pmtBase + principal * adminFeeRate;
}

function calculateCashInHand(amount) {
    const principal = Number(amount) || 0;
    const arrangementFee = principal * 0.045;
    const insurance = principal * 0.04;
    const processingFee = principal * 0.025;
    const insuranceLevy = insurance * 0.03;
    const crbFee = 35;

    return principal - arrangementFee - insurance - processingFee - insuranceLevy - crbFee;
}

function normalizeEmployerCode(value) {
    const normalized = String(value || '').trim().toUpperCase();
    if (employerRules[normalized]) {
        return normalized;
    }
    if (normalized.includes('ARMY')) {
        return 'ARMY';
    }
    if (normalized.includes('MINISTR') || normalized.includes('GRZ')) {
        return 'GRZ';
    }
    if (normalized.includes('AIR FORCE') || normalized.includes('ZAF')) {
        return 'ZAF';
    }
    if (normalized.includes('ZNS')) {
        return 'ZNS';
    }
    if (normalized.includes('ZAMTEL')) {
        return 'ZAMTEL';
    }
    if (normalized.includes('G4S')) {
        return 'G4S';
    }
    return 'GRZ';
}

function normalizeLead(rawLead, key) {
    const employerCode = normalizeEmployerCode(rawLead.employer || 'GRZ');
    const employerRule = employerRules[employerCode] || employerRules.GRZ;

    // Safely parse properties directly out of your real schema layout
    const name = rawLead.client_name || rawLead.name || 'Unknown Client';
    const phone = rawLead.phone || '';
    const nrc = rawLead.nrc_number || rawLead.nrc || '';
    const loanAmount = Number(rawLead.loan_amount || rawLead.loanAmount) || 0;
    const basicSalary = Number(rawLead.salary || rawLead.basicSalary) || 0;
    const months = Math.min(Number(rawLead.months) || employerRule.maxMonths, employerRule.maxMonths);

    const monthlyRepayment = Number(rawLead.monthly_repayment) || calculateMonthlyRepayment(loanAmount, months, employerRule.interest);
    const affordabilityLimit = (basicSalary * 0.4);
    const qualifies = basicSalary > 0 ? monthlyRepayment <= affordabilityLimit : false;
    const missingDocs = Array.isArray(rawLead.missingDocs) ? rawLead.missingDocs : [];

    return {
        firebaseKey: key || '',
        leadId: rawLead.id && rawLead.id.length > 8 ? `MHF-${rawLead.id.slice(0, 6).toUpperCase()}` : `MHF-${String(key).slice(-6).toUpperCase()}`,
        name,
        phone,
        nrc,
        employer: employerCode,
        employerName: employerRule.name,
        basicSalary,
        loanAmount,
        months,
        status: String(rawLead.status || 'new').toLowerCase(),
        source: 'Website Calculator',
        createdAt: rawLead.created_at || new Date().toISOString(),
        missingDocs,
        monthlyRepayment,
        cashInHand: Number(rawLead.net_payout) || calculateCashInHand(loanAmount),
        affordabilityLimit,
        qualifies,
        documentPaths: typeof rawLead.client_docs === 'object' ? rawLead.client_docs : {}
    };
}

function persistLocalState() {
    if (typeof setLocalLeads !== 'function') {
        return;
    }

    setLocalLeads(leadsState.map((lead) => ({
        firebaseKey: lead.firebaseKey,
        leadId: lead.leadId,
        name: lead.name,
        phone: lead.phone,
        nrc: lead.nrc,
        employer: lead.employer,
        employerName: lead.employerName,
        basicSalary: lead.basicSalary,
        loanAmount: lead.loanAmount,
        months: lead.months,
        status: lead.status,
        source: lead.source,
        createdAt: lead.createdAt,
        missingDocs: lead.missingDocs,
        monthlyRepayment: lead.monthlyRepayment,
        cashInHand: lead.cashInHand,
        affordabilityLimit: lead.affordabilityLimit,
        qualifies: lead.qualifies,
        documentPaths: lead.documentPaths || {}
    })));
}

function setCloudStatus(message) {
    const cloudStatus = document.getElementById('cloud-status');
    if (cloudStatus) {
        cloudStatus.textContent = message;
    }
}

function hydrateLeads(rawLeads, sourceLabel) {
    leadsState = rawLeads.map((lead, index) => normalizeLead(lead, lead.firebaseKey || lead.leadId || String(index)))
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));

    if (!leadsState.length) {
        const fallbackLocal = typeof getLocalLeads === 'function' ? getLocalLeads() : [];
        if (fallbackLocal.length) {
            leadsState = fallbackLocal.map((lead, index) => normalizeLead(lead, lead.firebaseKey || lead.leadId || String(index)));
            setCloudStatus('Loaded from local backup');
        } else {
            leadsState = sampleLeads.map((lead, index) => normalizeLead(lead, String(index)));
            setCloudStatus(sourceLabel || 'Using sample leads');
        }
    } else {
        setCloudStatus(sourceLabel);
    }

    persistLocalState();
    renderAll();
}

function matchesStatusFilter(lead) {
    if (currentStatusFilter === 'approved') {
        return lead.status === 'approved';
    }
    if (currentStatusFilter === 'new') {
        return ['new', 'pending-docs', 'review'].includes(lead.status);
    }
    return true;
}

function matchesSearchFilter(lead) {
    if (!currentSearchTerm) {
        return true;
    }
    const haystack = [lead.name, lead.phone, lead.nrc, lead.employerName, lead.leadId, lead.source]
        .join(' ')
        .toLowerCase();
    return haystack.includes(currentSearchTerm);
}

function matchesEmployerFilter(lead) {
    return currentEmployerFilter === 'all' || lead.employer === currentEmployerFilter;
}

function getFilteredLeads() {
    return leadsState.filter((lead) => matchesStatusFilter(lead) && matchesSearchFilter(lead) && matchesEmployerFilter(lead));
}

function getStatusMarkup(lead) {
    const styles = {
        new: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
        'pending-docs': 'bg-amber-500/15 text-amber-300 border-amber-500/20',
        approved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
        review: 'bg-rose-500/15 text-rose-300 border-rose-500/20'
    };

    const labels = {
        new: 'New Lead',
        'pending-docs': 'Pending Docs',
        approved: 'Approved',
        review: 'Needs Review'
    };

    const note = lead.qualifies ? 'Within affordability band' : 'Above 40% salary limit';

    return `
        <div class="space-y-2">
            <span class="inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${styles[lead.status] || styles.new}">${labels[lead.status] || labels.new}</span>
            <p class="text-xs ${lead.qualifies ? 'text-slate-500' : 'text-rose-300 font-bold'}">${note}</p>
        </div>
    `;
}

function renderStats() {
    const total = leadsState.length;
    const qualified = leadsState.filter((lead) => lead.qualifies).length;
    const review = leadsState.filter((lead) => !lead.qualifies).length;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-qualified').textContent = qualified;
    document.getElementById('stat-review').textContent = review;
    document.getElementById('engine-summary').textContent = `${review} lead${review === 1 ? '' : 's'} currently flagged for review`;
}

function renderLeadTable() {
    const body = document.getElementById('lead-table-body');
    const visibleLeads = getFilteredLeads();

    body.innerHTML = visibleLeads.map((lead) => `
        <tr class="${lead.qualifies ? 'bg-transparent' : 'bg-rose-500/10'}">
            <td class="p-6 align-top">
                <p class="text-sm font-black text-white">${lead.name}</p>
                <p class="text-xs text-slate-500 mt-1">${lead.leadId} • ${lead.employerName} • ${lead.source}</p>
                <p class="text-xs text-slate-400 mt-3">Phone +${lead.phone || 'N/A'}${lead.nrc ? ` • NRC ${lead.nrc}` : ''}</p>
            </td>
            <td class="p-6 align-top">
                <p class="text-sm font-black text-white">${formatCurrency(lead.loanAmount)}</p>
                <p class="text-xs text-slate-500 mt-1">Basic salary ${formatCurrency(lead.basicSalary)}</p>
                <p class="text-xs text-slate-400 mt-3">${lead.months} months</p>
            </td>
            <td class="p-6 align-top">
                <p class="text-sm font-black text-amber-400">${formatCurrency(lead.cashInHand)}</p>
                <p class="text-xs text-slate-500 mt-1">Monthly ${formatCurrency(lead.monthlyRepayment)}</p>
                <p class="text-xs ${lead.qualifies ? 'text-slate-500' : 'text-rose-300'} mt-1">40% cap ${formatCurrency(lead.affordabilityLimit)}</p>
            </td>
            <td class="p-6 align-top">${getStatusMarkup(lead)}</td>
            <td class="p-6 align-top text-right">
                <div class="flex justify-end gap-2 flex-wrap">
                    <button class="view-lead rounded-full border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-[10px] uppercase tracking-widest font-black text-amber-400 hover:bg-amber-500 hover:text-slate-900 transition-all" data-lead-id="${lead.leadId}">View File</button>
                    <button class="contact-lead rounded-full border border-slate-700 px-4 py-2 text-[10px] uppercase tracking-widest font-black text-white hover:border-amber-500 hover:text-amber-400 transition-all" data-lead-id="${lead.leadId}">WhatsApp</button>
                    <button class="cycle-status rounded-full border border-slate-700 px-4 py-2 text-[10px] uppercase tracking-widest font-black text-slate-400 hover:text-white transition-all" data-lead-id="${lead.leadId}">Advance</button>
                </div>
            </td>
        </tr>
    `).join('');

    if (!visibleLeads.length) {
        body.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-sm text-slate-500">No leads match the current search and filter settings.</td></tr>';
    }

    bindRowActions();
}

function renderLeadCards() {
    const container = document.getElementById('lead-cards');
    const visibleLeads = getFilteredLeads();

    container.innerHTML = visibleLeads.map((lead) => `
        <article class="rounded-[1.75rem] border ${lead.qualifies ? 'border-slate-800 bg-slate-950' : 'border-rose-500/30 bg-rose-950/20'} p-6 shadow-xl">
            <div class="flex items-start justify-between gap-4">
                <div>
                    <p class="text-xs uppercase tracking-widest text-slate-500 font-black">${lead.leadId}</p>
                    <h4 class="text-lg font-black text-white mt-2">${lead.name}</h4>
                    <p class="text-sm text-slate-400 mt-1">${lead.employerName} • +${lead.phone || 'N/A'}</p>
                </div>
                <span class="text-[10px] font-black uppercase tracking-widest ${lead.qualifies ? 'text-emerald-300' : 'text-rose-300'}">${lead.qualifies ? 'Qualified' : 'Review'}</span>
            </div>

            <div class="grid grid-cols-2 gap-4 mt-6 text-sm">
                <div class="rounded-2xl border border-slate-800 p-4">
                    <p class="text-[10px] uppercase tracking-widest text-slate-500 font-black">Monthly</p>
                    <p class="text-white font-black mt-2">${formatCurrency(lead.monthlyRepayment)}</p>
                </div>
                <div class="rounded-2xl border border-slate-800 p-4">
                    <p class="text-[10px] uppercase tracking-widest text-slate-500 font-black">Limit</p>
                    <p class="${lead.qualifies ? 'text-emerald-300' : 'text-rose-300'} font-black mt-2">${formatCurrency(lead.affordabilityLimit)}</p>
                </div>
            </div>

            <div class="mt-6 space-y-2">
                <p class="text-[10px] uppercase tracking-widest text-slate-500 font-black">Missing Documents</p>
                <p class="text-sm text-slate-300">${lead.missingDocs.length ? lead.missingDocs.join(', ') : 'Complete file pack received'}</p>
            </div>
        </article>
    `).join('');

    if (!visibleLeads.length) {
        container.innerHTML = '<p class="text-sm text-slate-500">No leads match the current search and filter settings.</p>';
    }
}

function renderDocuments() {
    const container = document.getElementById('document-list');
    const leadsMissingDocs = getFilteredLeads().filter((lead) => lead.missingDocs.length > 0);

    container.innerHTML = leadsMissingDocs.map((lead) => `
        <article class="rounded-[1.5rem] border border-slate-800 bg-slate-950 p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
                <p class="text-sm font-black text-white">${lead.name}</p>
                <p class="text-xs text-slate-500 mt-1">${lead.leadId} • ${lead.employerName} • ${new Date(lead.createdAt).toLocaleString()}</p>
            </div>
            <div class="flex-1 md:px-8">
                <p class="text-[10px] uppercase tracking-widest text-slate-500 font-black">Outstanding</p>
                <p class="text-sm text-amber-300 mt-2">${lead.missingDocs.join(', ')}</p>
            </div>
            <button class="contact-lead rounded-full border border-slate-700 px-4 py-2 text-[10px] uppercase tracking-widest font-black text-white hover:border-amber-500 hover:text-amber-400 transition-all self-start md:self-auto" data-lead-id="${lead.leadId}">Request Docs</button>
        </article>
    `).join('');

    if (!leadsMissingDocs.length) {
        container.innerHTML = '<p class="text-sm text-slate-500">No missing documents for the current filter selection.</p>';
    }

    bindRowActions();
}

function renderSettings() {
    const body = document.getElementById('settings-table');

    body.innerHTML = Object.entries(employerRules).map(([code, rule]) => `
        <tr>
            <td class="py-5 pr-4 text-sm font-black text-white">${rule.name}</td>
            <td class="py-5 pr-4 text-sm text-slate-400">${(rule.interest * 100).toFixed(2)}%</td>
            <td class="py-5 pr-4 text-sm text-slate-400">${(adminFeeRate * 100).toFixed(2)}%</td>
            <td class="py-5 pr-4 text-sm text-slate-400">${rule.maxMonths} months</td>
        </tr>
    `).join('');
}

function renderAll() {
    renderStats();
    renderLeadTable();
    renderLeadCards();
    renderDocuments();
    renderSettings();
}

function persistLead(lead) {
    const leadIndex = leadsState.findIndex((item) => item.leadId === lead.leadId);
    if (leadIndex !== -1) {
        leadsState[leadIndex] = lead;
    }
    persistLocalState();

    if (firebaseLeadsRef && lead.firebaseKey) {
        firebaseLeadsRef.child(lead.firebaseKey).update({
            status: lead.status,
            missingDocs: lead.missingDocs,
            documentPaths: lead.documentPaths || {}
        });
    }
}

function openWhatsApp(leadId) {
    const lead = leadsState.find((item) => item.leadId === leadId);
    if (!lead) {
        return;
    }

    const message = [
        `Hello ${lead.name},`,
        `Your MH Finance application ${lead.leadId} is under review.`,
        `Employer: ${lead.employerName}`,
        `Requested amount: ${formatCurrency(lead.loanAmount)}`,
        `Monthly repayment: ${formatCurrency(lead.monthlyRepayment)}`,
        lead.missingDocs.length ? `Outstanding documents: ${lead.missingDocs.join(', ')}` : 'Your file pack is complete.',
        'MH Finance will update you shortly.'
    ].join('\n');

    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
}

function advanceStatus(leadId) {
    const lead = leadsState.find((item) => item.leadId === leadId);
    if (!lead) {
        return;
    }

    const order = ['new', 'pending-docs', 'review', 'approved'];
    const currentIndex = order.indexOf(lead.status);
    const nextStatus = order[(currentIndex + 1) % order.length];
    lead.status = nextStatus;
    persistLead(lead);
    renderAll();
}

function bindRowActions() {
    document.querySelectorAll('.view-lead').forEach((button) => {
        button.onclick = () => openLeadPanel(button.dataset.leadId);
    });

    document.querySelectorAll('.contact-lead').forEach((button) => {
        button.onclick = () => openWhatsApp(button.dataset.leadId);
    });

    document.querySelectorAll('.cycle-status').forEach((button) => {
        button.onclick = () => advanceStatus(button.dataset.leadId);
    });
}

function setActivePanel(view) {
    document.querySelectorAll('.admin-panel').forEach((panel) => {
        panel.classList.toggle('hidden', panel.dataset.panel !== view);
    });

    document.querySelectorAll('.admin-nav-item').forEach((button) => {
        const isActive = button.dataset.view === view;
        button.classList.toggle('text-amber-500', isActive);
        button.classList.toggle('text-slate-500', !isActive);
        button.classList.toggle('hover:text-white', !isActive);
    });
}

function setLeadFilter(filter) {
    currentStatusFilter = filter;
    document.querySelectorAll('.lead-filter').forEach((button) => {
        const isActive = button.dataset.filter === filter;
        button.classList.toggle('bg-slate-800', isActive);
        button.classList.toggle('text-white', isActive);
        button.classList.toggle('text-slate-400', !isActive);
    });

    renderAll();
}

function initNavigation() {
    document.querySelectorAll('.admin-nav-item').forEach((button) => {
        button.addEventListener('click', () => {
            setActivePanel(button.dataset.view);
        });
    });

    document.querySelectorAll('.lead-filter').forEach((button) => {
        button.addEventListener('click', () => {
            setLeadFilter(button.dataset.filter);
        });
    });

    const searchInput = document.getElementById('lead-search');
    const employerFilter = document.getElementById('employer-filter');

    searchInput?.addEventListener('input', (event) => {
        currentSearchTerm = String(event.target.value || '').trim().toLowerCase();
        renderAll();
    });

    employerFilter?.addEventListener('change', (event) => {
        currentEmployerFilter = event.target.value || 'all';
        renderAll();
    });
}

function subscribeToLeadStream() {
    const localLeads = typeof getLocalLeads === 'function' ? getLocalLeads() : [];
    hydrateLeads(localLeads, localLeads.length ? 'Loaded from local backup' : 'Using sample leads');

    if (typeof _supabase === 'undefined' || !_supabase) {
        setCloudStatus('Supabase unavailable, running locally');
        return;
    }

    async function fetchInitialLeads() {
        const { data, error } = await _supabase
            .from('mh_finance_leads') // Corrected Table Target!
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            hydrateLeads(data, 'Supabase live pipeline connected');
        } else {
            console.error('Initial data fetch failed:', error);
        }
    }

    fetchInitialLeads();

    _supabase
        .channel('public:mh_finance_leads')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mh_finance_leads' }, (payload) => {
            console.log('✨ Live submission captured from mobile device:', payload.new);

            const calibratedNewLead = normalizeLead(payload.new, payload.new.id || String(Date.now()));
            leadsState.unshift(calibratedNewLead);
            renderAll();
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                setCloudStatus('Supabase Live Sync Active 🟢');
            }
        });
}
// ─── Lead Detail Panel ───────────────────────────────────────────────────────

function openLeadPanel(leadId) {
    const lead = leadsState.find((item) => item.leadId === leadId);
    if (!lead) return;

    currentLeadId = leadId;

    document.getElementById('panel-lead-id').textContent = lead.leadId;
    document.getElementById('panel-client-name').textContent = lead.name;
    document.getElementById('panel-client-employer').textContent = `${lead.employerName} \u2022 ${lead.months} months`;
    document.getElementById('panel-payout').textContent = formatCurrency(lead.cashInHand);
    document.getElementById('panel-repayment').textContent = formatCurrency(lead.monthlyRepayment);

    const affordEl = document.getElementById('panel-affordability');
    affordEl.textContent = formatCurrency(lead.affordabilityLimit);
    affordEl.className = `text-base font-black mt-2 ${lead.qualifies ? 'text-emerald-400' : 'text-rose-400'}`;

    document.getElementById('panel-phone').textContent = `+${lead.phone || 'N/A'}`;
    document.getElementById('panel-nrc').textContent = lead.nrc ? `NRC ${lead.nrc}` : 'NRC not captured';

    const waBtn = document.getElementById('panel-whatsapp-btn');
    if (waBtn) waBtn.onclick = () => openWhatsApp(leadId);

    ['nrc', 'payslips', 'statement', 'employer-letter'].forEach((docType) => {
        const el = document.getElementById(`status-${docType}`);
        if (!el) return;
        const secured = lead.documentPaths && lead.documentPaths[docType];
        el.textContent = secured ? 'Document Secured' : 'Not Uploaded';
        el.className = `mt-3 text-[9px] font-bold uppercase tracking-widest ${secured ? 'text-emerald-400' : 'text-slate-600'}`;
    });

    const backdrop = document.getElementById('lead-panel-backdrop');
    const panel = document.getElementById('lead-panel');
    backdrop.classList.remove('hidden');
    panel.classList.remove('hidden');
    requestAnimationFrame(() => {
        panel.classList.remove('translate-x-full');
        panel.classList.add('translate-x-0');
    });
}

function closeLeadPanel() {
    const backdrop = document.getElementById('lead-panel-backdrop');
    const panel = document.getElementById('lead-panel');
    panel.classList.remove('translate-x-0');
    panel.classList.add('translate-x-full');
    setTimeout(() => {
        panel.classList.add('hidden');
        backdrop.classList.add('hidden');
        currentLeadId = null;
    }, 310);
}

async function handleUpload(input, docType) {
    const file = input.files[0];
    const statusEl = document.getElementById(`status-${docType}`);
    if (!file || !currentLeadId || !statusEl) return;

    statusEl.textContent = 'Uploading\u2026';
    statusEl.className = 'mt-3 text-[9px] font-bold uppercase tracking-widest text-amber-400';

    if (typeof _supabase === 'undefined' || !_supabase) {
        statusEl.textContent = 'Storage not configured \u2014 add Supabase keys to config.js';
        statusEl.className = 'mt-3 text-[9px] font-bold uppercase tracking-widest text-rose-400';
        return;
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${currentLeadId}/${docType}-${Date.now()}-${safeName}`;

    const { data, error } = await _supabase.storage
        .from('client-docs')
        .upload(storagePath, file, { upsert: true });

    if (error) {
        statusEl.textContent = 'Upload failed \u2014 check bucket permissions';
        statusEl.className = 'mt-3 text-[9px] font-bold uppercase tracking-widest text-rose-400';
        console.error('Supabase storage error:', error.message);
        return;
    }

    statusEl.textContent = 'Document Secured';
    statusEl.className = 'mt-3 text-[9px] font-bold uppercase tracking-widest text-emerald-400';
    updateLeadDocStatus(currentLeadId, docType, data.path);
}

function updateLeadDocStatus(leadId, docType, filePath) {
    const lead = leadsState.find((item) => item.leadId === leadId);
    if (!lead) return;

    if (!lead.documentPaths) lead.documentPaths = {};
    lead.documentPaths[docType] = filePath;

    const docKeywords = {
        'nrc': ['nrc', 'national id'],
        'payslips': ['payslip'],
        'statement': ['bank statement', 'statement'],
        'employer-letter': ['employer letter', 'employer']
    };
    const keywords = docKeywords[docType] || [];
    lead.missingDocs = lead.missingDocs.filter(
        (doc) => !keywords.some((kw) => doc.toLowerCase().includes(kw))
    );

    persistLead(lead);
    renderAll();
}

async function downloadAllDocs() {
    if (!currentLeadId) return;

    if (typeof _supabase === 'undefined' || !_supabase) {
        alert('Storage not configured. Add Supabase keys to config.js to enable downloads.');
        return;
    }

    const { data: files, error } = await _supabase.storage
        .from('client-docs')
        .list(currentLeadId);

    if (error || !files || !files.length) {
        alert('No uploaded documents found for this lead yet.');
        return;
    }

    for (const fileEntry of files) {
        const { data } = _supabase.storage
            .from('client-docs')
            .getPublicUrl(`${currentLeadId}/${fileEntry.name}`);

        if (data && data.publicUrl) {
            const anchor = document.createElement('a');
            anchor.href = data.publicUrl;
            anchor.download = fileEntry.name;
            anchor.target = '_blank';
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            await new Promise((resolve) => setTimeout(resolve, 400));
        }
    }
}

window.openLeadPanel = openLeadPanel;
window.closeLeadPanel = closeLeadPanel;
window.handleUpload = handleUpload;
window.downloadAllDocs = downloadAllDocs;

// ─────────────────────────────────────────────────────────────────────────────

// Ensure this master setup handles the initialization order perfectly
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Kickstart your authentication interface check first
    await initAdminAuth();
    
    // 2. Boot up your navigation event handlers
    initNavigation();

    // 3. FORCE RE-RENDER AND ACTIVE LIVE WEBSOCKETS IMMEDIATELY!
    if (typeof subscribeToLeadStream === 'function') {
        console.log("Initializing live database channels...");
        subscribeToLeadStream();
    }

    const logoutButton = document.querySelector('.logout-btn');
    if (logoutButton) {
        logoutButton.removeAttribute('onclick');
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            triggerSignOut();
        });
    }
});
