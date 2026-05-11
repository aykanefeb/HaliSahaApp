import { db } from './firebase.js';
import { setDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import state from './state.js';
import { positionWeights, universalAttributes, calculateRating } from './rating.js';

// Modal Elements
const addPlayerModal = document.getElementById('add-player-modal');
const btnAddPlayerModal = document.getElementById('btn-add-player-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const addPlayerForm = document.getElementById('add-player-form');
const positionSelect = document.getElementById('player-position');
const dynamicSkillsContainer = document.getElementById('dynamic-skills-container');

// Dynamic Form Logic
export function renderForm() {
    dynamicSkillsContainer.innerHTML = '';

    let currentStats = {};
    if (state.editingPlayerId) {
        const p = state.players.find(x => x.id === state.editingPlayerId);
        if (p && p.stats) currentStats = p.stats;
    }

    dynamicSkillsContainer.style.display = 'grid';
    dynamicSkillsContainer.style.gridTemplateColumns = '1fr 1fr';
    dynamicSkillsContainer.style.gap = '0 16px';

    for (const key in universalAttributes) {
        const label = universalAttributes[key];
        const defaultVal = currentStats[key] || 50;
        const html = `
            <div class="form-group range-group">
                <label for="skill-${key}">${label} <span id="val-${key}">${defaultVal}</span></label>
                <input type="range" id="skill-${key}" min="1" max="100" value="${defaultVal}">
            </div>
        `;
        dynamicSkillsContainer.insertAdjacentHTML('beforeend', html);
    }

    for (const key in universalAttributes) {
        const input = document.getElementById(`skill-${key}`);
        const display = document.getElementById(`val-${key}`);
        input.addEventListener('input', (e) => {
            display.textContent = e.target.value;
        });
    }
}

// Modal Logic
btnAddPlayerModal.addEventListener('click', () => {
    state.editingPlayerId = null;
    document.querySelector('#add-player-modal h2').textContent = 'Yeni Oyuncu Ekle';
    document.querySelector('#add-player-form button[type="submit"]').innerHTML = '<i class="fa-solid fa-user-plus"></i> Havuza Ekle';
    addPlayerForm.reset();
    addPlayerModal.classList.add('active');
    renderForm();
});

window.editPlayer = function (id) {
    state.editingPlayerId = id;
    const player = state.players.find(p => p.id === id);
    if (!player) return;

    document.querySelector('#add-player-modal h2').textContent = 'Oyuncuyu Düzenle';
    document.querySelector('#add-player-form button[type="submit"]').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Değişiklikleri Kaydet';

    document.getElementById('player-name').value = player.name;
    positionSelect.value = player.position;

    addPlayerModal.classList.add('active');
    renderForm();
};

btnCloseModal.addEventListener('click', () => {
    addPlayerModal.classList.remove('active');
    addPlayerForm.reset();
});

addPlayerModal.addEventListener('click', (e) => {
    if (e.target === addPlayerModal) btnCloseModal.click();
});

// Form Submission (Add/Edit Player)
addPlayerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.activeGroupId) return;

    const name = document.getElementById('player-name').value;
    const position = positionSelect.value;
    const newStats = {};
    for (const key in universalAttributes) {
        newStats[key] = parseInt(document.getElementById(`skill-${key}`).value);
    }

    if (state.editingPlayerId) {
        const playerIndex = state.players.findIndex(p => p.id === state.editingPlayerId);
        if (playerIndex > -1) {
            const updatedPlayer = { ...state.players[playerIndex] };
            updatedPlayer.name = name;
            updatedPlayer.position = position;
            updatedPlayer.stats = { ...updatedPlayer.stats, ...newStats };
            updatedPlayer.rating = calculateRating(updatedPlayer.stats, position);
            await setDoc(doc(db, `groups/${state.activeGroupId}/players`, state.editingPlayerId), updatedPlayer);
        }
    } else {
        const newId = Date.now().toString();
        const newPlayer = {
            id: newId,
            name,
            position,
            stats: newStats,
            rating: calculateRating(newStats, position),
            isAvailable: true
        };
        await setDoc(doc(db, `groups/${state.activeGroupId}/players`, newId), newPlayer);
    }

    btnCloseModal.click();
});

window.deletePlayer = async function (id) {
    if (!state.activeGroupId) return;
    await deleteDoc(doc(db, `groups/${state.activeGroupId}/players`, id));
};

window.toggleAvailability = async function (id) {
    if (!state.activeGroupId) return;
    const player = state.players.find(p => p.id === id);
    if (player) {
        await setDoc(doc(db, `groups/${state.activeGroupId}/players`, id), { ...player, isAvailable: !player.isAvailable });
    }
};

// Rendering Logic
function createPlayerCardHTML(player) {
    const weights = positionWeights[player.position];
    let skillsHTML = '';
    const stats = player.stats || player;

    if (player.isAvailable === undefined) player.isAvailable = true;

    for (const key in weights) {
        const label = weights[key].label;
        const val = stats[key] || 50;
        skillsHTML += `
            <div class="skill-bar-group">
                <div class="skill-label"><span>${label}</span> <span>${val}</span></div>
                <div class="skill-bar-bg"><div class="skill-bar-fill" style="width: ${val}%"></div></div>
            </div>
        `;
    }

    const availableClass = player.isAvailable ? 'is-available' : '';
    const checkedAttr = player.isAvailable ? 'checked' : '';

    return `
        <div class="player-card glass-panel ${availableClass}">
            <div class="player-availability">
                <input type="checkbox" id="avail-${player.id}" class="availability-checkbox" ${checkedAttr} onchange="toggleAvailability('${player.id}')">
                <label for="avail-${player.id}" class="availability-label" title="Maça Katılacak"><i class="fa-solid fa-check"></i></label>
            </div>
            <button class="delete-player-btn" onclick="deletePlayer('${player.id}')"><i class="fa-solid fa-trash"></i></button>
            <div class="player-header">
                <div class="player-info">
                    <h3>${player.name}</h3>
                    <span class="player-pos">${player.position}</span>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                    <div class="player-rating">
                        ${player.rating} <i class="fa-solid fa-star"></i>
                    </div>
                    <button class="edit-player-btn" onclick="editPlayer('${player.id}')"><i class="fa-solid fa-gear"></i> Düzenle</button>
                </div>
            </div>
            <div class="player-skills">
                ${skillsHTML}
            </div>
        </div>
    `;
}

export function renderPlayers(filterPos = 'all', searchQuery = '') {
    const grid = document.getElementById('all-players-grid');

    let filtered = state.players;
    if (filterPos !== 'all') {
        filtered = filtered.filter(p => p.position === filterPos);
    }
    if (searchQuery) {
        filtered = filtered.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    if (filtered.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1;">Oyuncu bulunamadı.</p>';
        return;
    }

    grid.innerHTML = filtered.map(p => createPlayerCardHTML(p)).join('');
}

export function renderRecentPlayers() {
    const grid = document.getElementById('recent-players-grid');
    const recent = [...state.players].sort((a, b) => b.id - a.id).slice(0, 3);

    if (recent.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-muted);">Henüz oyuncu eklenmedi.</p>';
        return;
    }

    grid.innerHTML = recent.map(p => createPlayerCardHTML(p)).join('');
}

export function updateDashboardStats() {
    document.getElementById('stat-total-players').textContent = state.players.length;

    if (state.players.length > 0) {
        const avg = state.players.reduce((sum, p) => sum + parseFloat(p.rating), 0) / state.players.length;
        document.getElementById('stat-avg-rating').textContent = avg.toFixed(1);
    } else {
        document.getElementById('stat-avg-rating').textContent = "0.0";
    }
}

// Filters
document.getElementById('filter-position').addEventListener('change', (e) => {
    const search = document.getElementById('search-player').value;
    renderPlayers(e.target.value, search);
});

document.getElementById('search-player').addEventListener('input', (e) => {
    const pos = document.getElementById('filter-position').value;
    renderPlayers(pos, e.target.value);
});
