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
