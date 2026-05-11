import { db } from './firebase.js';
import { setDoc, deleteDoc, getDoc, doc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import state, { customConfirm } from './state.js';
import { switchToGroup } from './groups.js';

// --- LOBBY & GROUP SYSTEM ---
const lobbyOverlay = document.getElementById('lobby-overlay');
const btnCreateGroup = document.getElementById('btn-create-group');
const btnJoinGroup = document.getElementById('btn-join-group');
const newGroupNameInput = document.getElementById('new-group-name');
const joinGroupCodeInput = document.getElementById('join-group-code');
const lobbyPendingMsg = document.getElementById('lobby-pending-msg');
const lobbyErrorMsg = document.getElementById('lobby-error-msg');
const btnReturnLobby = document.getElementById('btn-return-lobby');
const groupCodeDisplay = document.getElementById('group-code-display');
const btnPendingRequests = document.getElementById('btn-pending-requests');
const requestsModal = document.getElementById('requests-modal');
const btnCloseRequests = document.getElementById('btn-close-requests');
const btnCloseLobby = document.getElementById('btn-close-lobby');
const btnLeaveGroup = document.getElementById('btn-leave-group');

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
        admins: [state.userId],
        teamBuilders: [],
        members: [state.userId],
        requests: []
    });
    await setDoc(doc(db, `groups/${groupId}/members`, state.userId), { userName: state.userName, lastActive: 0 });
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
            requests: arrayUnion({ userId: state.userId, userName: state.userName })
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
    if (state.activeGroupId) {
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
    if (!state.activeGroupId) return;

    const isOnlyAdmin = state.currentGroupAdmins.includes(state.userId) && state.currentGroupAdmins.length === 1;
    const confirmMsg = isOnlyAdmin
        ? "Siz bu grubun tek yöneticisisiniz. Çıkarsanız grup tamamen silinecek. Onaylıyor musunuz?"
        : "Bu gruptan ayrılmak istediğinize emin misiniz?";

    const confirmed = await customConfirm(confirmMsg);
    if (!confirmed) return;

    btnLeaveGroup.disabled = true;
    const groupRef = doc(db, "groups", state.activeGroupId);

    try {
        if (isOnlyAdmin) {
            await deleteDoc(groupRef);
        } else {
            await updateDoc(groupRef, {
                members: arrayRemove(state.userId),
                admins: arrayRemove(state.userId)
            });
        }
    } catch (e) {
        console.error("Gruptan ayrılırken hata:", e);
    }

    btnLeaveGroup.disabled = false;
    btnLeaveGroup.style.display = 'none';
});

groupCodeDisplay.addEventListener('click', () => {
    navigator.clipboard.writeText(state.activeGroupId);
    alert('Katılma kodu kopyalandı: ' + state.activeGroupId);
});

btnPendingRequests.addEventListener('click', () => {
    requestsModal.classList.add('active');
});

btnCloseRequests.addEventListener('click', () => {
    requestsModal.classList.remove('active');
});
