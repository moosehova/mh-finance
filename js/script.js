// =============================================================================
// MH Finance — Multi-Employer Public Calculator & Lead Capture Engine
// =============================================================================

const MH_WHATSAPP = "260975931621"; 
const MH_ADMIN_RATE = 0.01;
const MH_ARRANGEMENT = 0.045;
const MH_INSURANCE = 0.04;
const MH_PROCESSING = 0.025;
const MH_INS_LEVY = 0.03;
const MH_CRB = 35;

function formatLeadCurrency(value) {
    return 'K' + Math.round(value || 0).toLocaleString();
}

function setLeadStatusMessage(message, state) {
    const statusNode = document.getElementById('lead-capture-status');
    if (!statusNode) return;

    statusNode.textContent = message || '';
    statusNode.classList.remove('is-error', 'is-success');
    if (state) {
        statusNode.classList.add(state);
    }
}

// ─── Core Calculations Engine ────────────────────────────────────────────────
function calculateLoanMetrics() {
    const amountSlider = document.getElementById('calc-range');
    const periodSlider = document.getElementById('calc-period');
    const employerSelect = document.getElementById('employer-select');
    if (!amountSlider || !periodSlider || !employerSelect) return null;

    const option = employerSelect.options[employerSelect.selectedIndex];
    const monthlyRate = parseFloat(option.getAttribute('data-rate')) || 0.0275;
    const maxMonths = parseInt(option.getAttribute('data-max'), 10) || 72;
    const employerCode = option.value || 'GRZ';
    const employerName = option.textContent.trim();

    periodSlider.max = maxMonths;
    if (parseInt(periodSlider.value, 10) > maxMonths) {
        periodSlider.value = String(maxMonths);
    }

    const grossAmount = parseFloat(amountSlider.value) || 0;
    const months = parseInt(periodSlider.value, 10) || maxMonths;
    
    const pmt = (grossAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
    const totalMonthly = pmt + (grossAmount * MH_ADMIN_RATE);
    
    const deductions = (grossAmount * MH_ARRANGEMENT)
        + (grossAmount * MH_INSURANCE)
        + (grossAmount * MH_PROCESSING)
        + (grossAmount * MH_INSURANCE * MH_INS_LEVY)
        + MH_CRB;
    const cashInHand = grossAmount - deductions;

    return {
        employerCode,
        employerName,
        monthlyRate,
        maxMonths,
        grossAmount,
        months,
        totalMonthly,
        cashInHand,
        affordabilityRate: 0.4
    };
}

function calculateLoan() {
    const metrics = calculateLoanMetrics();
    if (!metrics) return;

    const amountLabel = document.getElementById('calc-amount-label');
    const periodLabel = document.getElementById('calc-period-label');
    const resultDisplay = document.getElementById('calc-result');
    const cashDisplay = document.getElementById('cash-in-hand');
    const rateNote = document.getElementById('calc-rate-note');

    if (amountLabel) amountLabel.textContent = formatLeadCurrency(metrics.grossAmount);
    if (periodLabel) periodLabel.textContent = metrics.months + ' Months';
    if (resultDisplay) resultDisplay.textContent = Math.round(metrics.totalMonthly).toLocaleString();
    if (cashDisplay) cashDisplay.textContent = formatLeadCurrency(metrics.cashInHand);
    if (rateNote) rateNote.textContent = metrics.employerName.split('(')[0].trim() + ' rate: ' + (metrics.monthlyRate * 100).toFixed(2) + '% per month';
}

function normalizePhoneNumber(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.startsWith('260')) return digits;
    if (digits.startsWith('0')) return '260' + digits.slice(1);
    if (digits.length === 9) return '260' + digits;
    return digits;
}

// ─── Asynchronous Supabase Insertion Loop ───────────────────────────────────
async function checkoutWhatsApp() {
    const metrics = calculateLoanMetrics();
    if (!metrics) return;

    const nameInput = document.getElementById('lead-name');
    const phoneInput = document.getElementById('lead-phone');
    const salaryInput = document.getElementById('lead-salary');
    const nrcInput = document.getElementById('lead-nrc');

    // Fields Form Validations
    if (!nameInput || !nameInput.value.trim()) {
        setLeadStatusMessage('❌ Enter the client full name before applying.', 'is-error');
        return;
    }
    const cleanPhone = phoneInput ? normalizePhoneNumber(phoneInput.value) : '';
    if (!cleanPhone || cleanPhone.length < 12) {
        setLeadStatusMessage('❌ Enter a valid Zambia mobile number before applying.', 'is-error');
        return;
    }
    const basicSalary = parseFloat(salaryInput ? salaryInput.value : 0) || 0;
    if (basicSalary <= 0) {
        setLeadStatusMessage('❌ Enter the client basic salary before applying.', 'is-error');
        return;
    }

    setLeadStatusMessage('⏳ Routing application data directly to secure pipelines...');

    // Layout data strictly structured to match your mh_finance_leads columns
    const leadPayload = {
        client_name: nameInput.value.trim(),
        phone: cleanPhone,
        nrc_number: nrcInput ? nrcInput.value.trim().toUpperCase() : 'NOT PROVIDED',
        employer: metrics.employerCode,
        salary: basicSalary,
        loan_amount: metrics.grossAmount,
        months: metrics.months,
        monthly_repayment: Number(metrics.totalMonthly.toFixed(2)),
        net_payout: Number(metrics.cashInHand.toFixed(2)),
        status: 'new',
        created_at: new Date().toISOString()
    };

    // Fire data payload off to your active Supabase Postgres cloud cluster
    if (typeof _supabase !== 'undefined' && _supabase) {
        try {
            const { error } = await _supabase
                .from('mh_finance_leads')
                .insert([leadPayload]);

            if (error) {
                console.error("Database sync rejected payload:", error.message);
            } else {
                console.log("✓ Application data secured globally.");
            }
        } catch (err) {
            console.error("Network interface connection failure:", err);
        }
    }

    setLeadStatusMessage('✅ Handshake complete. Redirecting to encryption window...', 'is-success');

    // Build standard multi-line text parameters for immediate text communication
    const message = '*MH FINANCE - NEW LOAN APPLICATION*\n'
        + '--------------------------\n'
        + 'Name: *' + leadPayload.client_name + '*\n'
        + 'Phone: *+' + leadPayload.phone + '*\n'
        + 'NRC: *' + leadPayload.nrc_number + '*\n'
        + 'Employer: *' + metrics.employerName + '*\n'
        + 'Basic Salary: *' + formatLeadCurrency(leadPayload.salary) + '*\n'
        + 'Gross Loan: *' + formatLeadCurrency(leadPayload.loan_amount) + '*\n'
        + 'Period: *' + leadPayload.months + ' Months*\n'
        + 'Est. Monthly Repayment: *' + formatLeadCurrency(leadPayload.monthly_repayment) + '*\n'
        + 'Est. Cash in Hand: *' + formatLeadCurrency(leadPayload.net_payout) + '*\n'
        + '--------------------------\n'
        + 'Hello MH Finance, I have used your calculator and would like to proceed with this application. Please advise on the next steps.';

    window.open('https://wa.me/' + MH_WHATSAPP + '?text=' + encodeURIComponent(message), '_blank', 'noopener');
}

// Map function to global scope for HTML inline handlers
window.checkoutWhatsApp = checkoutWhatsApp;

// ─── DOM Initializations ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const amountSlider = document.getElementById('calc-range');
    const periodSlider = document.getElementById('calc-period');
    const employerSelect = document.getElementById('employer-select');
    const formContainer = document.querySelector('form');

    if (amountSlider) amountSlider.addEventListener('input', calculateLoan);
    if (periodSlider) periodSlider.addEventListener('input', calculateLoan);
    if (employerSelect) employerSelect.addEventListener('change', calculateLoan);

    // Intercept default button submissions to trigger our custom pipeline checkout
    if (formContainer) {
        formContainer.addEventListener('submit', (e) => {
            e.preventDefault();
            checkoutWhatsApp();
        });
    }

    // Safely drop any conflicting cookie tokens on the public page
    if (typeof _supabase !== 'undefined' && _supabase.auth) {
        _supabase.auth.signOut().catch(() => {});
    }

    calculateLoan();
    console.log("MH Finance lead capture ready. (Consolidated Supabase Mode)");
});