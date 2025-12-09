// header.js
document.addEventListener('DOMContentLoaded', () => {
    renderHeader();
});

function renderHeader() {
    const activeInfo = getActivePage();
    const headerHTML = `
    <header>
        <div class="logo">
            <svg class="brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 3v18h18"/>
                <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
            </svg>
            <span class="brand-name">Portfolio</span>
        </div>
        <nav>
            <a href="index.html" class="tab-btn ${activeInfo === 'stocks' ? 'active' : ''}">Stocks</a>
            <a href="funds.html" class="tab-btn ${activeInfo === 'mfs' ? 'active' : ''}">Mutual Funds</a>
        </nav>
    </header>
    `;

    const container = document.getElementById('header-container');
    if (container) {
        container.innerHTML = headerHTML;
    } else {
        // Fallback if no container, prepend to body (useful for migration)
        const headerDiv = document.createElement('div');
        headerDiv.id = 'header-container';
        headerDiv.innerHTML = headerHTML;
        document.body.prepend(headerDiv);
    }
}

function getActivePage() {
    const path = window.location.pathname;
    if (path.includes('funds.html')) return 'mfs';
    return 'stocks';
}
