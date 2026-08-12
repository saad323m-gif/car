/**
 * Loading Manager - Car Management System
 * English only | Latin digits only | Production-ready
 */

export const UI_TEXTS = {
    LOADING: 'Loading...',
    NO_DATA: 'No data found.',
    LOAD_MORE: 'Load More',
    ERROR_PREFIX: 'Error: '
};

export function setLoading(container, text = UI_TEXTS.LOADING) {
    if (!container) return;
    container.innerHTML = `<p class="loading-text">${text}</p>`;
}

export function appendLoading(container, text = UI_TEXTS.LOADING) {
    if (!container) return;
    removeLoading(container);
    const loader = document.createElement('p');
    loader.className = 'loading-text';
    loader.id = 'dynamic-loader';
    loader.textContent = text;
    container.appendChild(loader);
}

export function removeLoading(container) {
    if (!container) return;
    const loader = container.querySelector('#dynamic-loader');
    if (loader) loader.remove();
}

export function disableLoadMoreButton(btn) {
    if (btn) {
        btn.disabled = true;
        btn.textContent = UI_TEXTS.LOADING;
    }
}

export function enableLoadMoreButton(btn, text = UI_TEXTS.LOAD_MORE) {
    if (btn) {
        btn.disabled = false;
        btn.textContent = text;
    }
}