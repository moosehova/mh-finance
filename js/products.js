const products = [
    {
        id: 1,
        name: "Lender Alpha (Civil Servant Special)",
        category: "PMEC / Salary-Backed",
        price: "15% Annually",
        benefits: "Best for: Government workers. No collateral required. Deducted directly from PMEC payroll. Max K50,000.",
        specs: { interest: 0.15, max_term: 36, min_amount: 2000, speed: "24 Hours", type: "Salary-Backed" },
        image: "images/default-product.jpg"
    },
    {
        id: 2,
        name: "Lender Beta (Emergency Cash)",
        category: "Fast Microfinance",
        price: "18% Annually",
        benefits: "Best for: Private sector employees. Fast approval. Requirements: NRC, 3 month bank statements. Max K10,000.",
        specs: { interest: 0.18, max_term: 6, min_amount: 500, speed: "45 Minutes", type: "Short-term" },
        image: "images/default-product.jpg"
    },
    {
        id: 3,
        name: "Lender Gamma (SME Growth)",
        category: "Business Micro-Loan",
        price: "16% Annually",
        benefits: "Best for: Registered SMEs & traders. Working capital boost. Requires 3-6 months bank statements. Max K25,000.",
        specs: { interest: 0.16, max_term: 12, min_amount: 2000, speed: "3 Days", type: "Business" },
        image: "images/default-product.jpg"
    }
];
