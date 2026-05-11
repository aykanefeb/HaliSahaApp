import { db } from './firebase.js';
import { setDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import state from './state.js';

// --- TEAM BUILDER ALGORITHM ---
document.getElementById('btn-generate-teams').addEventListener('click', async () => {
    const errorDiv = document.getElementById('teambuilder-error');
    if (errorDiv) errorDiv.style.display = 'none';

    const availablePlayers = state.players.filter(p => p.isAvailable !== false);

    if (availablePlayers.length < 2) {
        if (errorDiv) {
            errorDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Takım kurmak için en az 2 oyuncunun katılımı (tiki) işaretli olmalıdır.`;
            errorDiv.style.display = 'block';
        }
        return;
    }

    if (availablePlayers.length % 2 !== 0) {
        if (errorDiv) {
            errorDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Hata: Oyuncu sayısı çift değil (${availablePlayers.length} kişi). Eşit takımlar kurabilmek için bir kişiyi daha eklemeli veya çıkarmalısınız.`;
            errorDiv.style.display = 'block';
        }
        return;
    }

    const goalkeepers = availablePlayers.filter(p => p.position === 'Kaleci');
    const outfielders = availablePlayers.filter(p => p.position !== 'Kaleci');

    if (goalkeepers.length !== 2) {
        if (errorDiv) {
            errorDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Hata: Takımları kurabilmek için maça gelen tam olarak 2 Kaleciye ihtiyacımız var. Şu anda hazırda ${goalkeepers.length} kaleci bulunuyor.`;
            errorDiv.style.display = 'block';
        }
        return;
    }

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

    let scoreA = parseFloat(teamA[0].rating) || 0;
    let scoreB = parseFloat(teamB[0].rating) || 0;

    const sortedOutfielders = [...outfielders].sort((a, b) => {
        const posOrder = ['Defans', 'Orta Saha', 'Kanat', 'Forvet'];
        const posA = posOrder.indexOf(a.position);
        const posB = posOrder.indexOf(b.position);

        if (posA !== posB) return posA - posB;

        const rA = (parseFloat(a.rating) || 0) + (Math.random() * 0.2 - 0.1);
        const rB = (parseFloat(b.rating) || 0) + (Math.random() * 0.2 - 0.1);
        return rB - rA;
    });

    let currentPos = null;
    let countA = 0;
    let countB = 0;

    sortedOutfielders.forEach(player => {
        if (player.position !== currentPos) {
            currentPos = player.position;
            countA = 0;
            countB = 0;
        }

        const pRating = parseFloat(player.rating) || 0;

        if (teamA.length < teamB.length) {
            teamA.push(player);
            scoreA += pRating;
            countA++;
        } else if (teamB.length < teamA.length) {
            teamB.push(player);
            scoreB += pRating;
            countB++;
        } else {
            if (countA < countB) {
                teamA.push(player);
                scoreA += pRating;
                countA++;
            } else if (countB < countA) {
                teamB.push(player);
                scoreB += pRating;
                countB++;
            } else {
                if (Math.abs(scoreA - scoreB) < 0.3) {
                    if (Math.random() > 0.5) {
                        teamA.push(player);
                        scoreA += pRating;
                        countA++;
                    } else {
                        teamB.push(player);
                        scoreB += pRating;
                        countB++;
                    }
                } else if (scoreA <= scoreB) {
                    teamA.push(player);
                    scoreA += pRating;
                    countA++;
                } else {
                    teamB.push(player);
                    scoreB += pRating;
                    countB++;
                }
            }
        }
    });

    const teamsData = {
        teamA: teamA.map(p => ({ id: p.id, name: p.name, position: p.position, rating: p.rating })),
        teamB: teamB.map(p => ({ id: p.id, name: p.name, position: p.position, rating: p.rating })),
        scoreA,
        scoreB,
        createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, `groups/${state.activeGroupId}/meta`, 'generatedTeams'), teamsData);
});

export function renderTeams(teamA, teamB, scoreA, scoreB) {
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
        if (e.type === 'touchstart') e.preventDefault();
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
        element.style.bottom = 'auto';
    }

    function stopDrag() {
        if (!isDragging) return;
        isDragging = false;
        element.style.zIndex = '10';
    }
}
