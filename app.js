import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, setDoc, deleteDoc, doc, onSnapshot, getDoc, updateDoc, arrayUnion, arrayRemove, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCHJa9W8UtESJyJMAR1f60gh5Rw35SfCCs",
    authDomain: "regista-bd253.firebaseapp.com",
    projectId: "regista-bd253",
    storageBucket: "regista-bd253.firebasestorage.app",
    messagingSenderId: "800859981775",
    appId: "1:800859981775:web:a78ec7700966198e70b4ba"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// State Management. aaaaa
let players = [];
let messages = [];
let editingPlayerId = null;

// User Identity
let userId = null;
let userName = null;
let activeGroupId = localStorage.getItem('matchmaker_activeGroupId');
let currentGroupAdmins = [];

let playersUnsubscribe = null;
let messagesUnsubscribe = null;
let requestsUnsubscribe = null;
let myGroupsUnsubscribe = null;
let membersUnsubscribe = null;
let presenceInterval = null;
let presenceRenderInterval = null;
let currentMembers = [];

// Algorithm Weights
const positionWeights = {
    'Kaleci': {
        'reflexes': { label: 'Refleks', weight: 0.40 },
        'footwork': { label: 'Ayak (Degaj)', weight: 0.20 },
        'physical': { label: 'Fizik', weight: 0.10 },
        'leadership': { label: 'Liderlik', weight: 0.10 },
        'aerial': { label: 'Hava Topu', weight: 0.10 },
        'passing': { label: 'Pas', weight: 0.10 }
    },
    'Defans': {
        'defense': { label: 'Defans', weight: 0.30 },
        'physical': { label: 'Fizik', weight: 0.20 },
        'aerial': { label: 'Hava Topu', weight: 0.15 },
        'pace': { label: 'Hız', weight: 0.10 },
        'passing': { label: 'Pas', weight: 0.10 },
        'stamina': { label: 'Dayanıklılık', weight: 0.10 },
        'leadership': { label: 'Liderlik', weight: 0.05 }
    },
    'Orta Saha': {
        'passing': { label: 'Pas', weight: 0.25 },
        'technique': { label: 'Teknik', weight: 0.18 },
        'stamina': { label: 'Dayanıklılık', weight: 0.17 },
        'defense': { label: 'Defans', weight: 0.10 },
        'physical': { label: 'Fizik', weight: 0.10 },
        'shooting': { label: 'Şut', weight: 0.09 },
        'pace': { label: 'Hız', weight: 0.08 },
        'leadership': { label: 'Liderlik', weight: 0.03 }
    },
    'Kanat': {
        'pace': { label: 'Hız', weight: 0.30 },
        'technique': { label: 'Teknik', weight: 0.25 },
        'stamina': { label: 'Dayanıklılık', weight: 0.20 },
        'passing': { label: 'Pas', weight: 0.10 },
        'shooting': { label: 'Şut', weight: 0.10 },
        'finishing': { label: 'Bitiricilik', weight: 0.05 }
    },
    'Forvet': {
        'finishing': { label: 'Bitiricilik', weight: 0.35 },
        'shooting': { label: 'Şut', weight: 0.20 },
        'physical': { label: 'Fizik', weight: 0.15 },
        'aerial': { label: 'Hava Topu', weight: 0.10 },
        'pace': { label: 'Hız', weight: 0.10 },
        'technique': { label: 'Teknik', weight: 0.10 }
    }
};

const universalAttributes = {
    pace: 'Hız',
    shooting: 'Şut',
    finishing: 'Bitiricilik',
    passing: 'Pas',
    physical: 'Fizik',
    defense: 'Defans',
    stamina: 'Dayanıklılık',
    technique: 'Teknik',
    leadership: 'Liderlik',
    aerial: 'Hava Topu',
    reflexes: 'Refleks',
    footwork: 'Ayak (Degaj)'
};

// Calculate overall rating based on skills and weights
function calculateRating(stats, position) {
    const weights = positionWeights[position];
    let score = 0;

    for (const key in weights) {
        const val = stats[key] || 50;
        score += val * weights[key].weight;
    }

    // Convert to 5-star scale
    return (score / 20).toFixed(1);
}

// DOM Elements
const sections = document.querySelectorAll('.content-section');
const navLinks = document.querySelectorAll('.nav-links li');
const pageTitle = document.getElementById('page-title');

// Modal Elements
const addPlayerModal = document.getElementById('add-player-modal');
const btnAddPlayerModal = document.getElementById('btn-add-player-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const addPlayerForm = document.getElementById('add-player-form');
const positionSelect = document.getElementById('player-position');
const dynamicSkillsContainer = document.getElementById('dynamic-skills-container');

// Navigation Logic
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

// Dynamic Form Logic
function renderForm() {
    dynamicSkillsContainer.innerHTML = '';

    let currentStats = {};
    if (editingPlayerId) {
        const p = players.find(x => x.id === editingPlayerId);
        if (p && p.stats) currentStats = p.stats;
    }

    // Add grid layout to container dynamically if needed
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

    // Re-attach listeners
    for (const key in universalAttributes) {
        const input = document.getElementById(`skill-${key}`);
        const display = document.getElementById(`val-${key}`);
        input.addEventListener('input', (e) => {
            display.textContent = e.target.value;
        });
    }
}

// Position Select no longer changes the form, but could be left here if needed
// positionSelect.addEventListener('change', (e) => {
//    // renderForm(); is not needed since form is universal
// });

// Modal Logic
btnAddPlayerModal.addEventListener('click', () => {
    editingPlayerId = null;
    document.querySelector('#add-player-modal h2').textContent = 'Yeni Oyuncu Ekle';
    document.querySelector('#add-player-form button[type="submit"]').innerHTML = '<i class="fa-solid fa-user-plus"></i> Havuza Ekle';
    addPlayerForm.reset();
    addPlayerModal.classList.add('active');
    renderForm(); // render universal form
});

window.editPlayer = function (id) {
    editingPlayerId = id;
    const player = players.find(p => p.id === id);
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
    if (!activeGroupId) return;

    const name = document.getElementById('player-name').value;
    const position = positionSelect.value;
    const newStats = {};
    for (const key in universalAttributes) {
        newStats[key] = parseInt(document.getElementById(`skill-${key}`).value);
    }

    if (editingPlayerId) {
        const playerIndex = players.findIndex(p => p.id === editingPlayerId);
        if (playerIndex > -1) {
            const updatedPlayer = { ...players[playerIndex] };
            updatedPlayer.name = name;
            updatedPlayer.position = position;
            updatedPlayer.stats = { ...updatedPlayer.stats, ...newStats };
            updatedPlayer.rating = calculateRating(updatedPlayer.stats, position);
            await setDoc(doc(db, `groups/${activeGroupId}/players`, editingPlayerId), updatedPlayer);
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
        await setDoc(doc(db, `groups/${activeGroupId}/players`, newId), newPlayer);
    }

    btnCloseModal.click();
});

window.deletePlayer = async function (id) {
    if (!activeGroupId) return;
    await deleteDoc(doc(db, `groups/${activeGroupId}/players`, id));
};

// Player Availability Toggle
window.toggleAvailability = async function (id) {
    if (!activeGroupId) return;
    const player = players.find(p => p.id === id);
    if (player) {
        await setDoc(doc(db, `groups/${activeGroupId}/players`, id), { ...player, isAvailable: !player.isAvailable });
    }
};

// Rendering Logic
function createPlayerCardHTML(player) {
    const weights = positionWeights[player.position];
    let skillsHTML = '';

    // If it's an old player without 'stats' object, fallback slightly to older attributes
    const stats = player.stats || player;

    // Default to available if not set
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

function renderPlayers(filterPos = 'all', searchQuery = '') {
    const grid = document.getElementById('all-players-grid');

    let filtered = players;
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

function renderRecentPlayers() {
    const grid = document.getElementById('recent-players-grid');
    const recent = [...players].sort((a, b) => b.id - a.id).slice(0, 3);

    if (recent.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-muted);">Henüz oyuncu eklenmedi.</p>';
        return;
    }

    grid.innerHTML = recent.map(p => createPlayerCardHTML(p)).join('');
}

function updateDashboardStats() {
    document.getElementById('stat-total-players').textContent = players.length;

    if (players.length > 0) {
        const avg = players.reduce((sum, p) => sum + parseFloat(p.rating), 0) / players.length;
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


// --- TEAM BUILDER ALGORITHM ---
document.getElementById('btn-generate-teams').addEventListener('click', () => {
    const errorDiv = document.getElementById('teambuilder-error');
    if (errorDiv) errorDiv.style.display = 'none';

    // Only consider players that are marked as available
    const availablePlayers = players.filter(p => p.isAvailable !== false);

    if (availablePlayers.length < 2) {
        if (errorDiv) {
            errorDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Takım kurmak için en az 2 oyuncunun katılımı (tiki) işaretli olmalıdır.`;
            errorDiv.style.display = 'block';
        } else {
            alert("Takım kurmak için en az 2 oyuncuya ihtiyacınız var.");
        }
        return;
    }

    if (availablePlayers.length % 2 !== 0) {
        if (errorDiv) {
            errorDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Hata: Oyuncu sayısı çift değil (${availablePlayers.length} kişi). Eşit takımlar kurabilmek için bir kişiyi daha eklemeli veya çıkarmalısınız.`;
            errorDiv.style.display = 'block';
        } else {
            alert(`Hata: Oyuncu sayısı çift değil (${availablePlayers.length} kişi).`);
        }
        return;
    }

    const goalkeepers = availablePlayers.filter(p => p.position === 'Kaleci');
    const outfielders = availablePlayers.filter(p => p.position !== 'Kaleci');

    if (goalkeepers.length !== 2) {
        if (errorDiv) {
            errorDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Hata: Takımları kurabilmek için maça gelen tam olarak 2 Kaleciye ihtiyacımız var. Şu anda hazırda ${goalkeepers.length} kaleci bulunuyor.`;
            errorDiv.style.display = 'block';
        } else {
            alert(`Hata: Tam olarak 2 Kaleciye ihtiyacımız var. Şu an: ${goalkeepers.length}`);
        }
        return;
    }

    // Assing one GK to each team (Randomly distribute to create variety in base scores)
    const gk1 = goalkeepers[0];
    const gk2 = goalkeepers[1];

    let teamA = [];
    let teamB = [];

    if (Math.random() > 0.5) {
        teamA.push(gk1);
        teamB.push(gk2);
    } else {
        teamA.push(gk2);
        teamB.push(gk1);
    }

    let scoreA = parseFloat(teamA[0].rating);
    let scoreB = parseFloat(teamB[0].rating);

    // Group other players by position and distribute them fairly
    const positions = ['Defans', 'Orta Saha', 'Kanat', 'Forvet'];

    positions.forEach(pos => {
        let playersInPos = outfielders.filter(p => p.position === pos);
        // Sort descending by rating (Add tiny random noise +/- 0.1 to swap players with same/close ratings)
        playersInPos.sort((a, b) => {
            const ratingA = parseFloat(a.rating) + (Math.random() * 0.2 - 0.1);
            const ratingB = parseFloat(b.rating) + (Math.random() * 0.2 - 0.1);
            return ratingB - ratingA;
        });

        let countA = 0; // Tracks number of players of this position in Team A
        let countB = 0; // Tracks number of players of this position in Team B

        playersInPos.forEach(player => {
            if (countA < countB) {
                // Rule 1: Assign to team with fewer players of this position
                teamA.push(player);
                scoreA += parseFloat(player.rating);
                countA++;
            } else if (countB < countA) {
                teamB.push(player);
                scoreB += parseFloat(player.rating);
                countB++;
            } else {
                // Rule 2: If equal count, assign to team with lower overall score
                // Add Variety: If scores are extremely close (less than 0.3 diff), randomly assign to either team
                if (Math.abs(scoreA - scoreB) < 0.3) {
                    if (Math.random() > 0.5) {
                        teamA.push(player);
                        scoreA += parseFloat(player.rating);
                        countA++;
                    } else {
                        teamB.push(player);
                        scoreB += parseFloat(player.rating);
                        countB++;
                    }
                } else if (scoreA <= scoreB) {
                    teamA.push(player);
                    scoreA += parseFloat(player.rating);
                    countA++;
                } else {
                    teamB.push(player);
                    scoreB += parseFloat(player.rating);
                    countB++;
                }
            }
        });
    });

    renderTeams(teamA, teamB, scoreA, scoreB);
});

function renderTeams(teamA, teamB, scoreA, scoreB) {
    document.getElementById('teams-result-container').style.display = 'flex';
    document.getElementById('tactical-boards-container').style.display = 'flex';

    const avgA = teamA.length > 0 ? (scoreA / teamA.length).toFixed(2) : "0.00";
    const avgB = teamB.length > 0 ? (scoreB / teamB.length).toFixed(2) : "0.00";

    document.getElementById('team-a-stats').innerHTML = `<i class="fa-solid fa-star"></i> ${avgA} Ort`;
    document.getElementById('team-b-stats').innerHTML = `<i class="fa-solid fa-star"></i> ${avgB} Ort`;

    const listA = document.getElementById('team-a-list');
    const listB = document.getElementById('team-b-list');

    listA.innerHTML = teamA.map((p, index) => `
        <li>
            <span><strong>${index + 1}. ${p.name}</strong> <small style="color:var(--text-muted)">(${p.position})</small></span>
            <span style="color: #fbbf24">${p.rating} <i class="fa-solid fa-star"></i></span>
        </li>
    `).join('');

    listB.innerHTML = teamB.map((p, index) => `
        <li>
            <span><strong>${index + 1}. ${p.name}</strong> <small style="color:var(--text-muted)">(${p.position})</small></span>
            <span style="color: #fbbf24">${p.rating} <i class="fa-solid fa-star"></i></span>
        </li>
    `).join('');

    generatePitch('pitch-team-a', teamA);
    generatePitch('pitch-team-b', teamB);
}

// --- TACTICAL BOARDS ---
function generatePitch(pitchId, team) {
    const pitch = document.getElementById(pitchId);

    // Remove old tokens
    const tokens = pitch.querySelectorAll('.player-token');
    tokens.forEach(t => t.remove());

    const posCounts = { 'Kaleci': 0, 'Defans': 0, 'Orta Saha': 0, 'Kanat': 0, 'Forvet': 0 };
    team.forEach(p => posCounts[p.position]++);

    const currentCounts = { 'Kaleci': 0, 'Defans': 0, 'Orta Saha': 0, 'Kanat': 0, 'Forvet': 0 };

    team.forEach((player, index) => {
        const token = document.createElement('div');
        token.className = 'player-token';
        token.innerHTML = `${index + 1} <span class="player-token-name">${player.name}</span>`;

        const totalInPos = posCounts[player.position];
        const currentIdx = currentCounts[player.position];
        currentCounts[player.position]++;

        let bottom = '50%';
        let left = '50%';

        if (player.position === 'Kaleci') {
            bottom = '8%';
            left = '50%';
        } else if (player.position === 'Defans') {
            bottom = '25%';
            left = `${(100 / (totalInPos + 1)) * (currentIdx + 1)}%`;
        } else if (player.position === 'Orta Saha') {
            bottom = '45%';
            left = `${(100 / (totalInPos + 1)) * (currentIdx + 1)}%`;
        } else if (player.position === 'Kanat') {
            bottom = '65%';
            left = totalInPos === 1 ? '50%' : (currentIdx === 0 ? '20%' : '80%');
            if (totalInPos > 2) left = `${(100 / (totalInPos + 1)) * (currentIdx + 1)}%`;
        } else if (player.position === 'Forvet') {
            bottom = '80%';
            left = `${(100 / (totalInPos + 1)) * (currentIdx + 1)}%`;
        }

        token.style.bottom = bottom;
        token.style.left = left;

        makeDraggable(token, pitch);
        pitch.appendChild(token);
    });
}

function makeDraggable(element, container) {
    let isDragging = false;

    element.addEventListener('mousedown', startDrag);
    element.addEventListener('touchstart', startDrag, { passive: false });

    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag, { passive: false });

    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchend', stopDrag);

    function startDrag(e) {
        if (e.target.classList.contains('player-token-name')) return;
        if (e.type === 'touchstart') e.preventDefault(); // Prevent scrolling while dragging
        isDragging = true;
        element.style.zIndex = '100';
    }

    function drag(e) {
        if (!isDragging) return;
        e.preventDefault();

        let clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        let clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

        const rect = container.getBoundingClientRect();

        let x = clientX - rect.left;
        let y = clientY - rect.top;

        x = Math.max(0, Math.min(x, rect.width));
        y = Math.max(0, Math.min(y, rect.height));

        element.style.left = `${(x / rect.width) * 100}%`;
        element.style.top = `${(y / rect.height) * 100}%`;
        element.style.bottom = 'auto'; // Disable bottom since we are setting top
    }

    function stopDrag() {
        if (!isDragging) return;
        isDragging = false;
        element.style.zIndex = '10';
    }
}


// --- CHAT SYSTEM ---
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const btnSendMessage = document.getElementById('btn-send-message');

function renderChat() {
    chatMessages.innerHTML = '<div class="message system">Sohbete hoş geldiniz! Takım organizasyonu için buradan mesajlaşabilirsiniz.</div>';
    messages.forEach(msg => {
        const div = document.createElement('div');
        const isAdmin = currentGroupAdmins.includes(userId);
        const isMine = msg.userId === userId || (!msg.userId && msg.sender === userName);
        const canDelete = isMine || isAdmin;
        
        div.className = `message ${isMine ? 'user' : 'other'}`;
        
        div.innerHTML = `<strong>${isMine ? 'Sen' : msg.sender}:</strong> ${msg.text}`;
        
        if (canDelete) {
            // Sağ tık (Masaüstü)
            div.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                deleteMessage(msg.id);
            });

            // Basılı tutma (Mobil)
            let pressTimer;
            div.addEventListener('touchstart', (e) => {
                pressTimer = setTimeout(() => {
                    deleteMessage(msg.id);
                }, 600);
            }, { passive: true });
            
            div.addEventListener('touchend', () => clearTimeout(pressTimer));
            div.addEventListener('touchmove', () => clearTimeout(pressTimer));
        }
        
        chatMessages.appendChild(div);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text || !activeGroupId) return;

    const newId = Date.now().toString();
    const newMsg = {
        id: newId,
        userId: userId,
        sender: userName,
        text: text,
        timestamp: new Date().toISOString()
    };

    chatInput.value = ''; // Clear immediately for UX
    await setDoc(doc(db, `groups/${activeGroupId}/messages`, newId), newMsg);
}

window.deleteMessage = async function(msgId) {
    if (!activeGroupId) return;
    if (confirm("Bu mesajı silmek istediğinize emin misiniz?")) {
        await deleteDoc(doc(db, `groups/${activeGroupId}/messages`, msgId));
    }
};

btnSendMessage.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});


// --- AUTHENTICATION ---
const authOverlay = document.getElementById('auth-overlay');
const loginForm = document.getElementById('login-form-container');
const registerForm = document.getElementById('register-form-container');
const forgotPasswordForm = document.getElementById('forgot-password-form-container');
const showRegister = document.getElementById('show-register');
const showLogin = document.getElementById('show-login');
const showForgotPassword = document.getElementById('show-forgot-password');
const showLoginFromReset = document.getElementById('show-login-from-reset');
const authErrorMsg = document.getElementById('auth-error-msg');
const userWelcomeMsg = document.getElementById('user-welcome-msg');

const btnLogin = document.getElementById('btn-login');
const btnRegister = document.getElementById('btn-register');
const btnResetPassword = document.getElementById('btn-reset-password');
const btnLogout = document.getElementById('btn-logout');
const btnLogoutLobby = document.getElementById('btn-logout-lobby');

showRegister.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    forgotPasswordForm.style.display = 'none';
    registerForm.style.display = 'block';
    authErrorMsg.style.display = 'none';
});

showLogin.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.style.display = 'none';
    forgotPasswordForm.style.display = 'none';
    loginForm.style.display = 'block';
    authErrorMsg.style.display = 'none';
});

showForgotPassword.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    registerForm.style.display = 'none';
    forgotPasswordForm.style.display = 'block';
    authErrorMsg.style.display = 'none';
});

showLoginFromReset.addEventListener('click', (e) => {
    e.preventDefault();
    forgotPasswordForm.style.display = 'none';
    loginForm.style.display = 'block';
    authErrorMsg.style.display = 'none';
});

btnRegister.addEventListener('click', async () => {
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value.trim();

    if (!name || !email || !password) {
        showAuthError("Lütfen tüm alanları doldurun.");
        return;
    }

    try {
        btnRegister.disabled = true;
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        window.location.reload();
    } catch (error) {
        showAuthError(translateAuthError(error.code));
    } finally {
        btnRegister.disabled = false;
    }
});

btnLogin.addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!email || !password) {
        showAuthError("Lütfen tüm alanları doldurun.");
        return;
    }

    try {
        btnLogin.disabled = true;
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        showAuthError(translateAuthError(error.code));
    } finally {
        btnLogin.disabled = false;
    }
});

btnLogout.addEventListener('click', async () => {
    handleLogout();
});

btnLogoutLobby.addEventListener('click', async () => {
    handleLogout();
});

async function handleLogout() {
    try {
        if (confirm("Çıkış yapmak istediğinize emin misiniz?")) {
            await signOut(auth);
            localStorage.removeItem('matchmaker_activeGroupId');
            location.reload();
        }
    } catch (error) {
        console.error("Çıkış hatası:", error);
    }
}

btnResetPassword.addEventListener('click', async () => {
    const email = document.getElementById('reset-email').value.trim();
    if (!email) {
        showAuthError("Lütfen e-posta adresinizi girin.");
        return;
    }
    
    try {
        btnResetPassword.disabled = true;
        await sendPasswordResetEmail(auth, email);
        showAuthError("Şifre sıfırlama bağlantısı e-posta adresinize gönderildi!", true);
    } catch (error) {
        showAuthError(translateAuthError(error.code));
    } finally {
        btnResetPassword.disabled = false;
    }
});

function showAuthError(msg, isSuccess = false) {
    authErrorMsg.textContent = msg;
    authErrorMsg.style.color = isSuccess ? '#10b981' : '#ef4444';
    authErrorMsg.style.display = 'block';
}

function translateAuthError(code) {
    switch (code) {
        case 'auth/invalid-email': return 'Geçersiz e-posta adresi.';
        case 'auth/user-disabled': return 'Kullanıcı hesabı devre dışı bırakılmış.';
        case 'auth/user-not-found': return 'Kullanıcı bulunamadı.';
        case 'auth/wrong-password': return 'Hatalı şifre.';
        case 'auth/email-already-in-use': return 'Bu e-posta adresi zaten kullanımda.';
        case 'auth/weak-password': return 'Şifre çok zayıf (en az 6 karakter olmalı).';
        default: return 'Bir hata oluştu: ' + code;
    }
}

// --- LOBBY & GROUP SYSTEM ---
const lobbyOverlay = document.getElementById('lobby-overlay');
const btnCreateGroup = document.getElementById('btn-create-group');
const btnJoinGroup = document.getElementById('btn-join-group');
const newGroupNameInput = document.getElementById('new-group-name');
const joinGroupCodeInput = document.getElementById('join-group-code');
const lobbyPendingMsg = document.getElementById('lobby-pending-msg');
const lobbyErrorMsg = document.getElementById('lobby-error-msg');
const btnReturnLobby = document.getElementById('btn-return-lobby');
const currentGroupBadge = document.getElementById('current-group-badge');
const groupCodeDisplay = document.getElementById('group-code-display');
const btnPendingRequests = document.getElementById('btn-pending-requests');
const pendingCountBadge = document.getElementById('pending-count-badge');
const requestsModal = document.getElementById('requests-modal');
const btnCloseRequests = document.getElementById('btn-close-requests');
const requestsList = document.getElementById('requests-list');
const sidebarGroupsList = document.getElementById('sidebar-groups-list');
const btnCloseLobby = document.getElementById('btn-close-lobby');
const btnLeaveGroup = document.getElementById('btn-leave-group');

function initApp() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            userId = user.uid;
            userName = user.displayName || user.email.split('@')[0];
            authOverlay.classList.remove('active');
            userWelcomeMsg.textContent = `Hoş geldin, ${userName}!`;

            if (activeGroupId) {
                lobbyOverlay.classList.remove('active');
                document.getElementById('dashboard-container').style.display = 'flex';
                subscribeToGroup(activeGroupId);
            } else {
                lobbyOverlay.classList.add('active');
                document.getElementById('dashboard-container').style.display = 'none';
                btnCloseLobby.style.display = 'none';
            }
            subscribeToMyGroups();
        } else {
            authOverlay.classList.add('active');
            lobbyOverlay.classList.remove('active');
            document.getElementById('dashboard-container').style.display = 'none';
        }
    });
}

function subscribeToMyGroups() {
    if (myGroupsUnsubscribe) myGroupsUnsubscribe();
    const q = query(collection(db, "groups"), where("members", "array-contains", userId));
    myGroupsUnsubscribe = onSnapshot(q, (snapshot) => {
        sidebarGroupsList.innerHTML = '';
        const myGroups = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        if (!activeGroupId && myGroups.length > 0) {
            switchToGroup(myGroups[0].id);
            return;
        }

        if (activeGroupId && !myGroups.find(g => g.id === activeGroupId)) {
            activeGroupId = null;
            localStorage.removeItem('matchmaker_activeGroupId');
            lobbyOverlay.classList.add('active');
            document.getElementById('dashboard-container').style.display = 'none';
            if (playersUnsubscribe) playersUnsubscribe();
            if (messagesUnsubscribe) messagesUnsubscribe();
            if (requestsUnsubscribe) requestsUnsubscribe();
            if (membersUnsubscribe) membersUnsubscribe();
            if (presenceInterval) clearInterval(presenceInterval);
            if (presenceRenderInterval) clearInterval(presenceRenderInterval);
            currentGroupBadge.style.display = 'none';
            groupCodeDisplay.style.display = 'none';
            btnPendingRequests.style.display = 'none';
            btnLeaveGroup.style.display = 'none';
        }

        myGroups.forEach(g => {
            const li = document.createElement('li');
            li.innerHTML = `<i class="fa-solid fa-users-rectangle"></i> <span>${g.name}</span>`;
            if (g.id === activeGroupId) li.classList.add('active');
            li.addEventListener('click', () => switchToGroup(g.id));
            sidebarGroupsList.appendChild(li);
        });
    });
}

function switchToGroup(groupId) {
    activeGroupId = groupId;
    localStorage.setItem('matchmaker_activeGroupId', groupId);
    lobbyOverlay.classList.remove('active');
    document.getElementById('dashboard-container').style.display = 'flex';
    lobbyErrorMsg.style.display = 'none';
    lobbyErrorMsg.style.display = 'none';
    subscribeToGroup(groupId);

    document.querySelectorAll('#sidebar-groups-list li').forEach(li => li.classList.remove('active'));
    subscribeToMyGroups();
}

function subscribeToGroup(groupId) {
    if (playersUnsubscribe) playersUnsubscribe();
    if (messagesUnsubscribe) messagesUnsubscribe();
    if (requestsUnsubscribe) requestsUnsubscribe();
    if (membersUnsubscribe) membersUnsubscribe();
    if (presenceInterval) clearInterval(presenceInterval);
    if (presenceRenderInterval) clearInterval(presenceRenderInterval);

    // Presence update
    const myPresenceRef = doc(db, `groups/${groupId}/members`, userId);
    const updatePresence = async () => {
        if (activeGroupId === groupId) {
            await setDoc(myPresenceRef, { userName, lastActive: Date.now() });
        }
    };
    updatePresence();
    presenceInterval = setInterval(updatePresence, 30000);

    const renderMembers = () => {
        const memberList = document.getElementById('chat-member-list');
        if (!memberList) return;
        memberList.innerHTML = '';
        const now = Date.now();
        const isAdmin = currentGroupAdmins.includes(userId);

        currentMembers.forEach(data => {
            const isOnline = now - data.lastActive < 60000;
            const li = document.createElement('li');
            li.className = 'chat-member-item';
            
            let content = `
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="status-dot ${isOnline ? 'online' : 'offline'}"></span> 
                    <span>${data.userName} ${data.userId === userId ? '<small style="color:var(--text-muted)">(Sen)</small>' : ''}</span>
                </div>
            `;
            
            if (isAdmin && data.userId !== userId) {
                content += `<button class="kick-btn" onclick="kickMember('${data.userId}')" title="Gruptan At"><i class="fa-solid fa-circle-minus"></i></button>`;
            }
            
            li.innerHTML = content;
            memberList.appendChild(li);
        });
    };

    membersUnsubscribe = onSnapshot(collection(db, `groups/${groupId}/members`), (snapshot) => {
        currentMembers = snapshot.docs.map(d => ({ userId: d.id, ...d.data() }));
        renderMembers();
    });

    presenceRenderInterval = setInterval(renderMembers, 10000); // re-render UI every 10 seconds

    requestsUnsubscribe = onSnapshot(doc(db, "groups", groupId), (d) => {
        if (!d.exists()) return;
        const groupData = d.data();
        currentGroupBadge.textContent = groupData.name;
        currentGroupBadge.style.display = 'block';
        groupCodeDisplay.querySelector('b').textContent = groupData.id;
        groupCodeDisplay.style.display = 'flex';
        btnLeaveGroup.style.display = 'flex';

        currentGroupAdmins = groupData.admins || [];
        if (currentGroupAdmins.includes(userId)) {
            btnPendingRequests.style.display = 'flex';
            const reqCount = (groupData.requests || []).length;
            pendingCountBadge.textContent = reqCount;
            pendingCountBadge.style.display = reqCount > 0 ? 'flex' : 'none';
            renderRequests(groupData.requests || []);
        } else {
            btnPendingRequests.style.display = 'none';
        }
    });

    playersUnsubscribe = onSnapshot(collection(db, `groups/${groupId}/players`), (snapshot) => {
        players = snapshot.docs.map(d => d.data());
        updateDashboardStats();
        if (document.getElementById('players-section') && document.getElementById('players-section').classList.contains('active')) {
            renderPlayers();
        }
        renderRecentPlayers();
    });

    messagesUnsubscribe = onSnapshot(collection(db, `groups/${groupId}/messages`), (snapshot) => {
        messages = snapshot.docs.map(d => d.data());
        messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        renderChat();
    });
}

btnCreateGroup.addEventListener('click', async () => {
    const name = newGroupNameInput.value.trim();
    if (!name) {
        lobbyErrorMsg.textContent = "Lütfen bir grup adı girin.";
        lobbyErrorMsg.style.display = 'block';
        return;
    }
    btnCreateGroup.disabled = true;
    const groupId = Math.random().toString(36).substr(2, 6).toUpperCase();
    await setDoc(doc(db, "groups", groupId), {
        id: groupId,
        name: name,
        admins: [userId],
        members: [userId],
        requests: []
    });
    await setDoc(doc(db, `groups/${groupId}/members`, userId), { userName: userName, lastActive: 0 });
    btnCreateGroup.disabled = false;
    newGroupNameInput.value = '';
    switchToGroup(groupId);
});

btnJoinGroup.addEventListener('click', async () => {
    const code = joinGroupCodeInput.value.trim().toUpperCase();
    if (!code) {
        lobbyErrorMsg.textContent = "Lütfen katılma kodunu girin.";
        lobbyErrorMsg.style.display = 'block';
        return;
    }
    btnJoinGroup.disabled = true;
    try {
        const groupRef = doc(db, "groups", code);
        const snap = await getDoc(groupRef);
        if (!snap.exists()) {
            lobbyErrorMsg.textContent = "Böyle bir grup bulunamadı.";
            lobbyErrorMsg.style.display = 'block';
            btnJoinGroup.disabled = false;
            return;
        }
        await updateDoc(groupRef, {
            requests: arrayUnion({ userId: userId, userName: userName })
        });
        lobbyErrorMsg.style.display = 'none';
        lobbyPendingMsg.style.display = 'block';
        joinGroupCodeInput.value = '';
    } catch (e) {
        lobbyErrorMsg.textContent = "Bir hata oluştu.";
        lobbyErrorMsg.style.display = 'block';
    }
    btnJoinGroup.disabled = false;
});

btnReturnLobby.addEventListener('click', () => {
    lobbyOverlay.classList.add('active');
    document.getElementById('dashboard-container').style.display = 'none';
    if (activeGroupId) {
        btnCloseLobby.style.display = 'block';
    } else {
        btnCloseLobby.style.display = 'none';
    }
});

btnCloseLobby.addEventListener('click', () => {
    lobbyOverlay.classList.remove('active');
    document.getElementById('dashboard-container').style.display = 'flex';
});

btnLeaveGroup.addEventListener('click', async () => {
    if (!activeGroupId) return;

    const isOnlyAdmin = currentGroupAdmins.includes(userId) && currentGroupAdmins.length === 1;
    const confirmMsg = isOnlyAdmin
        ? "Siz bu grubun tek yöneticisisiniz. Çıkarsanız grup tamamen silinecek. Onaylıyor musunuz?"
        : "Bu gruptan ayrılmak istediğinize emin misiniz?";

    if (!confirm(confirmMsg)) return;

    btnLeaveGroup.disabled = true;
    const groupRef = doc(db, "groups", activeGroupId);

    try {
        if (isOnlyAdmin) {
            await deleteDoc(groupRef);
        } else {
            await updateDoc(groupRef, {
                members: arrayRemove(userId),
                admins: arrayRemove(userId)
            });
        }
    } catch (e) {
        console.error("Gruptan ayrılırken hata:", e);
    }

    btnLeaveGroup.disabled = false;
    btnLeaveGroup.style.display = 'none';

    // UI resets are handled by subscribeToMyGroups() when activeGroupId goes missing
});

groupCodeDisplay.addEventListener('click', () => {
    navigator.clipboard.writeText(activeGroupId);
    alert('Katılma kodu kopyalandı: ' + activeGroupId);
});

btnPendingRequests.addEventListener('click', () => {
    requestsModal.classList.add('active');
});

btnCloseRequests.addEventListener('click', () => {
    requestsModal.classList.remove('active');
});

function renderRequests(requestsListArray) {
    requestsList.innerHTML = '';
    if (requestsListArray.length === 0) {
        requestsList.innerHTML = '<p style="text-align:center; color:var(--text-muted);">Bekleyen istek yok.</p>';
        return;
    }
    requestsListArray.forEach(req => {
        const div = document.createElement('div');
        div.className = 'request-item';
        div.innerHTML = `
            <div class="request-item-name">${req.userName}</div>
            <div class="request-actions">
                <button class="btn-icon approve" onclick="approveRequest('${req.userId}', '${req.userName}')"><i class="fa-solid fa-check"></i></button>
                <button class="btn-icon reject" onclick="rejectRequest('${req.userId}', '${req.userName}')"><i class="fa-solid fa-times"></i></button>
            </div>
        `;
        requestsList.appendChild(div);
    });
}

window.approveRequest = async function (reqUserId, reqUserName) {
    if (!activeGroupId) return;
    const groupRef = doc(db, "groups", activeGroupId);
    await updateDoc(groupRef, {
        members: arrayUnion(reqUserId),
        requests: arrayRemove({ userId: reqUserId, userName: reqUserName })
    });
    await setDoc(doc(db, `groups/${activeGroupId}/members`, reqUserId), { userName: reqUserName, lastActive: 0 });
};

window.rejectRequest = async function (reqUserId, reqUserName) {
    if (!activeGroupId) return;
    const groupRef = doc(db, "groups", activeGroupId);
    await updateDoc(groupRef, {
        requests: arrayRemove({ userId: reqUserId, userName: reqUserName })
    });
};

window.kickMember = async function(targetUserId) {
    if (!activeGroupId) return;
    if (confirm("Bu kullanıcıyı gruptan atmak istediğinize emin misiniz?")) {
        const groupRef = doc(db, "groups", activeGroupId);
        await updateDoc(groupRef, {
            members: arrayRemove(targetUserId),
            admins: arrayRemove(targetUserId)
        });
        await deleteDoc(doc(db, `groups/${activeGroupId}/members`, targetUserId));
    }
};

// Initialize App
initApp();
