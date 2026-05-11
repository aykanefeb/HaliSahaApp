import { db } from './firebase.js';
import { setDoc, getDoc, doc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import state from './state.js';

// --- SHARE & IMPORT PLAYER POOL ---
function normalizeName(name) {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function sharePlayerPool() {
    if (!state.activeGroupId) return;

    const shareBtn = document.getElementById('btn-share-pool');
    const shareModal = document.getElementById('share-code-modal');
    const shareCodeEl = document.getElementById('share-code-value');
    const shareCountEl = document.getElementById('share-player-count');
    const shareErrorEl = document.getElementById('share-error-msg');

    if (state.players.length === 0) {
        shareErrorEl.textContent = 'Paylaşılacak oyuncu bulunamadı.';
        shareErrorEl.style.display = 'block';
        setTimeout(() => shareErrorEl.style.display = 'none', 3000);
        return;
    }

    shareBtn.disabled = true;
    shareBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Oluşturuluyor...';
    shareErrorEl.style.display = 'none';

    try {
        const code = Math.random().toString(36).substr(2, 6).toUpperCase();
        const now = Date.now();
        const expiresAt = now + 3600000; // 1 hour

        const groupSnap = await getDoc(doc(db, 'groups', state.activeGroupId));
        const groupName = groupSnap.exists() ? groupSnap.data().name : 'Bilinmeyen Grup';

        const playerSnapshot = state.players.map(p => ({
            name: p.name,
            position: p.position,
            stats: p.stats || {},
            rating: p.rating,
            isAvailable: p.isAvailable !== undefined ? p.isAvailable : true
        }));

        await setDoc(doc(db, 'shareCodes', code), {
            code: code,
            sourceGroupId: state.activeGroupId,
            sourceGroupName: groupName,
            createdBy: state.userId,
            createdAt: now,
            expiresAt: expiresAt,
            players: playerSnapshot
        });

        shareCodeEl.textContent = code;
        shareCountEl.textContent = `${playerSnapshot.length} oyuncu paylaşılacak`;
        shareModal.classList.add('active');
    } catch (error) {
        console.error('Paylaşım hatası:', error);
        shareErrorEl.textContent = 'Paylaşım kodu oluşturulurken bir hata oluştu.';
        shareErrorEl.style.display = 'block';
        setTimeout(() => shareErrorEl.style.display = 'none', 3000);
    } finally {
        shareBtn.disabled = false;
        shareBtn.innerHTML = '<i class="fa-solid fa-share-nodes"></i> Paylaş';
    }
}

async function importPlayerPool() {
    if (!state.activeGroupId) return;

    const codeInput = document.getElementById('import-code-input');
    const importBtn = document.getElementById('btn-import-execute');
    const importModal = document.getElementById('import-pool-modal');
    const resultModal = document.getElementById('import-result-modal');
    const importErrorEl = document.getElementById('import-error-msg');

    const code = codeInput.value.trim().toUpperCase();
    if (!code || code.length !== 6) {
        importErrorEl.textContent = 'Lütfen 6 haneli paylaşım kodunu girin.';
        importErrorEl.style.display = 'block';
        return;
    }

    importBtn.disabled = true;
    importBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İçe Aktarılıyor...';
    importErrorEl.style.display = 'none';

    try {
        const shareSnap = await getDoc(doc(db, 'shareCodes', code));

        if (!shareSnap.exists()) {
            importErrorEl.textContent = 'Bu paylaşım kodu bulunamadı.';
            importErrorEl.style.display = 'block';
            importBtn.disabled = false;
            importBtn.innerHTML = '<i class="fa-solid fa-download"></i> İçe Aktar';
            return;
        }

        const shareData = shareSnap.data();

        if (Date.now() > shareData.expiresAt) {
            importErrorEl.textContent = 'Bu paylaşım kodunun süresi dolmuş.';
            importErrorEl.style.display = 'block';
            importBtn.disabled = false;
            importBtn.innerHTML = '<i class="fa-solid fa-download"></i> İçe Aktar';
            return;
        }

        if (shareData.sourceGroupId === state.activeGroupId) {
            importErrorEl.textContent = 'Kendi grubunuzun havuzunu içe aktaramazsınız.';
            importErrorEl.style.display = 'block';
            importBtn.disabled = false;
            importBtn.innerHTML = '<i class="fa-solid fa-download"></i> İçe Aktar';
            return;
        }

        const incomingPlayers = shareData.players || [];
        const existingNames = new Set(state.players.map(p => normalizeName(p.name)));

        const toAdd = [];
        const skipped = [];

        incomingPlayers.forEach(p => {
            if (existingNames.has(normalizeName(p.name))) {
                skipped.push(p);
            } else {
                toAdd.push(p);
            }
        });

        if (toAdd.length > 0) {
            const batch = writeBatch(db);
            toAdd.forEach(p => {
                const newId = Date.now().toString() + Math.random().toString(36).substr(2, 4);
                const playerDoc = doc(db, `groups/${state.activeGroupId}/players`, newId);
                batch.set(playerDoc, {
                    id: newId,
                    name: p.name,
                    position: p.position,
                    stats: p.stats || {},
                    rating: p.rating || '0.0',
                    isAvailable: true
                });
            });
            await batch.commit();
        }

        importModal.classList.remove('active');
        codeInput.value = '';

        document.getElementById('result-added-count').textContent = toAdd.length;
        document.getElementById('result-skipped-count').textContent = skipped.length;
        document.getElementById('result-source-name').textContent = shareData.sourceGroupName;

        const skippedListEl = document.getElementById('result-skipped-list');
        if (skipped.length > 0) {
            document.getElementById('result-skipped-section').style.display = 'block';
            skippedListEl.innerHTML = skipped.map(p =>
                `<li><i class="fa-solid fa-user"></i> ${p.name} <small style="color:var(--text-muted)">(${p.position})</small></li>`
            ).join('');
        } else {
            document.getElementById('result-skipped-section').style.display = 'none';
        }

        resultModal.classList.add('active');

    } catch (error) {
        console.error('İçe aktarma hatası:', error);
        importErrorEl.textContent = 'İçe aktarma sırasında bir hata oluştu.';
        importErrorEl.style.display = 'block';
    } finally {
        importBtn.disabled = false;
        importBtn.innerHTML = '<i class="fa-solid fa-download"></i> İçe Aktar';
    }
}

// Share Pool Button
document.getElementById('btn-share-pool').addEventListener('click', sharePlayerPool);

// Import Pool Modal Open
document.getElementById('btn-import-pool').addEventListener('click', () => {
    document.getElementById('import-pool-modal').classList.add('active');
    document.getElementById('import-error-msg').style.display = 'none';
    document.getElementById('import-code-input').value = '';
});

// Import Execute Button
document.getElementById('btn-import-execute').addEventListener('click', importPlayerPool);

// Close modals
document.getElementById('btn-close-share-modal').addEventListener('click', () => {
    document.getElementById('share-code-modal').classList.remove('active');
});

document.getElementById('btn-close-import-modal').addEventListener('click', () => {
    document.getElementById('import-pool-modal').classList.remove('active');
});

document.getElementById('btn-close-result-modal').addEventListener('click', () => {
    document.getElementById('import-result-modal').classList.remove('active');
});

// Copy share code
document.getElementById('btn-copy-share-code').addEventListener('click', () => {
    const code = document.getElementById('share-code-value').textContent;
    navigator.clipboard.writeText(code);
    const btn = document.getElementById('btn-copy-share-code');
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Kopyalandı!';
    setTimeout(() => {
        btn.innerHTML = '<i class="fa-solid fa-copy"></i> Kopyala';
    }, 2000);
});

// Close modals when clicking overlay
['share-code-modal', 'import-pool-modal', 'import-result-modal'].forEach(id => {
    document.getElementById(id).addEventListener('click', (e) => {
        if (e.target.id === id) {
            document.getElementById(id).classList.remove('active');
        }
    });
});
