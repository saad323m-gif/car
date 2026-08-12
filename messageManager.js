/**
 * Message Manager - Car Management System
 * English only | Latin digits only | Production-ready
 */

let messageTimeout = null;

export function showDashboardMessage(text, type = 'info', duration = null) {
    const box = document.getElementById('dashboard-message-box');
    if (!box) return;

    if (messageTimeout) {
        clearTimeout(messageTimeout);
        messageTimeout = null;
    }

    if (duration === null) {
        if (type === 'error') duration = 6000;
        else if (type === 'warning') duration = 4000;
        else duration = 3000;
    }

    box.textContent = text;
    box.className = `message-box ${type}`;
    box.style.display = 'block';

    if (duration > 0) {
        messageTimeout = setTimeout(() => {
            box.textContent = '';
            box.className = 'message-box';
            box.style.display = 'none';
            messageTimeout = null;
        }, duration);
    }
}

export function showAuthMessage(text, type = 'error') {
    const box = document.getElementById('message-box');
    if (!box) return;
    box.textContent = text;
    box.className = `message-box ${type}`;
    box.style.display = 'block';
}