// Regista — Ana giriş noktası
// Tüm modüller burada import edilerek başlatılır

import './firebase.js';
import './state.js';
import './rating.js';
import './players.js';
import './teamBuilder.js';
import './chat.js';
import './auth.js';
import './lobby.js';
import './groups.js';
import './poolShare.js';

import { renderPlayers, renderRecentPlayers, updateDashboardStats } from './players.js';
import { initApp } from './groups.js';

// Navigation Logic
const sections = document.querySelectorAll('.content-section');
const navLinks = document.querySelectorAll('.nav-links li');
const pageTitle = document.getElementById('page-title');

navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        pageTitle.textContent = link.querySelector('span').textContent;
        const targetId = link.getAttribute('data-target');
        sections.forEach(sec => sec.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');
        if (targetId === 'players-section') renderPlayers();
        if (targetId === 'dashboard-section') {
            updateDashboardStats();
            renderRecentPlayers();
        }
    });
});

// Initialize App
initApp();

// --- Sidebar Toggle Logic ---
const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
const sidebar = document.querySelector('.sidebar');
const btnToggleChatSidebar = document.getElementById('btn-toggle-chat-sidebar');
const chatSidebarPanel = document.getElementById('chat-sidebar-panel');

if (btnToggleSidebar && sidebar) {
    btnToggleSidebar.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });

    // Close sidebar on mobile when a link is clicked
    if (window.innerWidth <= 768) {
        sidebar.classList.add('collapsed'); // start collapsed on mobile
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    sidebar.classList.add('collapsed');
                }
            });
        });
    }
}

if (btnToggleChatSidebar && chatSidebarPanel) {
    // Start collapsed on mobile
    if (window.innerWidth <= 768) {
        chatSidebarPanel.classList.add('collapsed');
    }
    
    btnToggleChatSidebar.addEventListener('click', () => {
        chatSidebarPanel.classList.toggle('collapsed');
    });
}
