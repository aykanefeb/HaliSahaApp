import { db, auth } from './firebase.js';
import { collection, setDoc, deleteDoc, doc, onSnapshot, getDoc, updateDoc, arrayUnion, arrayRemove, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import state, { customConfirm } from './state.js';
import { renderPlayers, renderRecentPlayers, updateDashboardStats } from './players.js';
import { renderTeams, clearTeams } from './teamBuilder.js';
import { renderChat } from './chat.js';

// --- LOBBY & GROUP SYSTEM ---
const sidebarGroupsList = document.getElementById('sidebar-groups-list');

export function initApp() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            state.userId = user.uid;
            state.userName = user.displayName || user.email.split('@')[0];
            document.getElementById('auth-overlay').classList.remove('active');
            document.getElementById('user-welcome-msg').textContent = `Hoş geldin, ${state.userName}!`;

            if (state.activeGroupId) {
                document.getElementById('lobby-overlay').classList.remove('active');
                document.getElementById('dashboard-container').style.display = 'flex';
                subscribeToGroup(state.activeGroupId);
            } else {
                document.getElementById('lobby-overlay').classList.add('active');
                document.getElementById('dashboard-container').style.display = 'none';
                document.getElementById('btn-close-lobby').style.display = 'none';
            }
            subscribeToMyGroups();
        } else {
            document.getElementById('auth-overlay').classList.add('active');
            document.getElementById('lobby-overlay').classList.remove('active');
            document.getElementById('dashboard-container').style.display = 'none';
        }
    });
}

export function subscribeToMyGroups() {
    if (state.myGroupsUnsubscribe) state.myGroupsUnsubscribe();
    const q = query(collection(db, "groups"), where("members", "array-contains", state.userId));
    state.myGroupsUnsubscribe = onSnapshot(q, (snapshot) => {
        sidebarGroupsList.innerHTML = '';
        const myGroups = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        if (!state.activeGroupId && myGroups.length > 0) {
            switchToGroup(myGroups[0].id);
            return;
        }

        if (state.activeGroupId && !myGroups.find(g => g.id === state.activeGroupId)) {
            state.activeGroupId = null;
            localStorage.removeItem('matchmaker_activeGroupId');
            
            if (myGroups.length > 0) {
                // User left the current group but has other groups. Switch to the first one.
                switchToGroup(myGroups[0].id);
                return;
            } else {
                // User has no groups left. Show lobby.
                document.getElementById('lobby-overlay').classList.add('active');
                document.getElementById('dashboard-container').style.display = 'none';
                if (state.playersUnsubscribe) state.playersUnsubscribe();
                if (state.messagesUnsubscribe) state.messagesUnsubscribe();
                if (state.requestsUnsubscribe) state.requestsUnsubscribe();
                if (state.membersUnsubscribe) state.membersUnsubscribe();
                if (state.presenceInterval) clearInterval(state.presenceInterval);
                if (state.presenceRenderInterval) clearInterval(state.presenceRenderInterval);
                document.getElementById('current-group-badge').style.display = 'none';
                document.getElementById('group-code-display').style.display = 'none';
                document.getElementById('btn-pending-requests').style.display = 'none';
                document.getElementById('btn-leave-group').style.display = 'none';
            }
        }

        myGroups.forEach(g => {
            const li = document.createElement('li');
            li.innerHTML = `<i class="fa-solid fa-users-rectangle"></i> <span>${g.name}</span>`;
            if (g.id === state.activeGroupId) li.classList.add('active');
            li.addEventListener('click', () => switchToGroup(g.id));
            sidebarGroupsList.appendChild(li);
        });
    });
}

export function switchToGroup(groupId) {
    state.activeGroupId = groupId;
    localStorage.setItem('matchmaker_activeGroupId', groupId);
    document.getElementById('lobby-overlay').classList.remove('active');
    document.getElementById('dashboard-container').style.display = 'flex';
    document.getElementById('lobby-error-msg').style.display = 'none';
    subscribeToGroup(groupId);

    document.querySelectorAll('#sidebar-groups-list li').forEach(li => li.classList.remove('active'));
    subscribeToMyGroups();
}

function subscribeToGroup(groupId) {
    if (state.playersUnsubscribe) state.playersUnsubscribe();
    if (state.messagesUnsubscribe) state.messagesUnsubscribe();
    if (state.requestsUnsubscribe) state.requestsUnsubscribe();
    if (state.membersUnsubscribe) state.membersUnsubscribe();
    if (state.presenceInterval) clearInterval(state.presenceInterval);
    if (state.presenceRenderInterval) clearInterval(state.presenceRenderInterval);

    // Presence update
    const myPresenceRef = doc(db, `groups/${groupId}/members`, state.userId);
    const updatePresence = async () => {
        if (state.activeGroupId === groupId) {
            await setDoc(myPresenceRef, { userName: state.userName, lastActive: Date.now() });
        }
    };
    updatePresence();
    state.presenceInterval = setInterval(updatePresence, 30000);

    const renderMembers = () => {
        const memberList = document.getElementById('chat-member-list');
        if (!memberList) return;
        memberList.innerHTML = '';
        const now = Date.now();
        const isAdmin = state.currentGroupAdmins.includes(state.userId);

        state.currentMembers.forEach(data => {
            const isOnline = now - data.lastActive < 60000;
            const isTargetAdmin = state.currentGroupAdmins.includes(data.userId);
            const isTargetTeamBuilder = state.currentGroupTeamBuilders.includes(data.userId);
            const li = document.createElement('li');
            li.className = 'chat-member-item';

            let roleBadge = '';
            if (isTargetAdmin) {
                roleBadge = '<span class="role-badge admin-badge">Admin</span>';
            } else if (isTargetTeamBuilder) {
                roleBadge = '<span class="role-badge tb-badge">Takım Kurucu</span>';
            }

            let lastSeenStr = '';
            if (!isOnline) {
                const date = new Date(data.lastActive);
                if (data.lastActive > 0) {
                    const dd = String(date.getDate()).padStart(2, '0');
                    const mm = String(date.getMonth() + 1).padStart(2, '0');
                    const yyyy = date.getFullYear();
                    const hh = String(date.getHours()).padStart(2, '0');
                    const mins = String(date.getMinutes()).padStart(2, '0');
                    lastSeenStr = `<div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">Son görülme: ${dd}/${mm}/${yyyy} - ${hh}.${mins}</div>`;
                }
            }

            let content = `
                <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
                    <span class="status-dot ${isOnline ? 'online' : 'offline'}"></span> 
                    <div style="display:flex; flex-direction:column; overflow:hidden;">
                        <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:6px;">
                            ${data.userName} ${data.userId === state.userId ? '<small style="color:var(--text-muted)">(Sen)</small>' : ''}
                            ${roleBadge}
                        </span>
                        ${lastSeenStr}
                    </div>
                </div>
            `;

            if (isAdmin && data.userId !== state.userId) {
                let actionBtns = '';
                if (!isTargetAdmin) {
                    const tbIcon = isTargetTeamBuilder ? 'fa-solid fa-star' : 'fa-regular fa-star';
                    const tbTitle = isTargetTeamBuilder ? 'Takım Kurucu Yetkisini Kaldır' : 'Takım Kurucu Yap';
                    actionBtns += `<button class="teambuilder-toggle-btn ${isTargetTeamBuilder ? 'active' : ''}" onclick="toggleTeamBuilder('${data.userId}', ${!isTargetTeamBuilder})" title="${tbTitle}"><i class="${tbIcon}"></i></button>`;
                }
                actionBtns += `<button class="kick-btn" onclick="kickMember('${data.userId}')" title="Gruptan At"><i class="fa-solid fa-circle-minus"></i></button>`;
                content += `<div style="display:flex; gap:6px; flex-shrink:0;">${actionBtns}</div>`;
            }

            li.innerHTML = content;
            memberList.appendChild(li);
        });
    };

    state.membersUnsubscribe = onSnapshot(collection(db, `groups/${groupId}/members`), (snapshot) => {
        state.currentMembers = snapshot.docs.map(d => ({ userId: d.id, ...d.data() }));
        renderMembers();
    });

    state.presenceRenderInterval = setInterval(renderMembers, 10000);

    state.requestsUnsubscribe = onSnapshot(doc(db, "groups", groupId), (d) => {
        if (!d.exists()) return;
        const groupData = d.data();
        document.getElementById('current-group-badge').textContent = groupData.name;
        document.getElementById('current-group-badge').style.display = 'block';
        document.getElementById('group-code-display').querySelector('b').textContent = groupData.id;
        document.getElementById('group-code-display').style.display = 'flex';
        document.getElementById('btn-leave-group').style.display = 'flex';

        state.currentGroupAdmins = groupData.admins || [];
        state.currentGroupTeamBuilders = groupData.teamBuilders || [];

        const btnGenerateTeams = document.getElementById('btn-generate-teams');
        const canBuildTeams = state.currentGroupAdmins.includes(state.userId) || state.currentGroupTeamBuilders.includes(state.userId);
        if (btnGenerateTeams) {
            btnGenerateTeams.style.display = canBuildTeams ? 'inline-flex' : 'none';
        }

        const btnPendingRequests = document.getElementById('btn-pending-requests');
        const pendingCountBadge = document.getElementById('pending-count-badge');
        if (state.currentGroupAdmins.includes(state.userId)) {
            btnPendingRequests.style.display = 'flex';
            const reqCount = (groupData.requests || []).length;
            pendingCountBadge.textContent = reqCount;
            pendingCountBadge.style.display = reqCount > 0 ? 'flex' : 'none';
            renderRequests(groupData.requests || []);
        } else {
            btnPendingRequests.style.display = 'none';
        }

        renderMembers();
    });

    // Listen for generated teams
    onSnapshot(doc(db, `groups/${groupId}/meta`, 'generatedTeams'), (d) => {
        if (!d.exists()) {
            clearTeams();
            return;
        }
        const data = d.data();
        renderTeams(data.teamA, data.teamB, data.scoreA, data.scoreB);
    });

    state.playersUnsubscribe = onSnapshot(collection(db, `groups/${groupId}/players`), (snapshot) => {
        state.players = snapshot.docs.map(d => d.data());
        updateDashboardStats();
        if (document.getElementById('players-section') && document.getElementById('players-section').classList.contains('active')) {
            renderPlayers();
        }
        renderRecentPlayers();
    });

    state.messagesUnsubscribe = onSnapshot(collection(db, `groups/${groupId}/messages`), (snapshot) => {
        state.messages = snapshot.docs.map(d => d.data());
        state.messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        renderChat();
    });
}

function renderRequests(requestsListArray) {
    const requestsList = document.getElementById('requests-list');
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
    if (!state.activeGroupId) return;
    const groupRef = doc(db, "groups", state.activeGroupId);
    await updateDoc(groupRef, {
        members: arrayUnion(reqUserId),
        requests: arrayRemove({ userId: reqUserId, userName: reqUserName })
    });
    await setDoc(doc(db, `groups/${state.activeGroupId}/members`, reqUserId), { userName: reqUserName, lastActive: 0 });
};

window.rejectRequest = async function (reqUserId, reqUserName) {
    if (!state.activeGroupId) return;
    const groupRef = doc(db, "groups", state.activeGroupId);
    await updateDoc(groupRef, {
        requests: arrayRemove({ userId: reqUserId, userName: reqUserName })
    });
};

window.kickMember = async function (targetUserId) {
    if (!state.activeGroupId) return;
    const confirmed = await customConfirm("Bu kullanıcıyı gruptan atmak istediğinize emin misiniz?");
    if (confirmed) {
        const groupRef = doc(db, "groups", state.activeGroupId);
        await updateDoc(groupRef, {
            members: arrayRemove(targetUserId),
            admins: arrayRemove(targetUserId),
            teamBuilders: arrayRemove(targetUserId)
        });
        await deleteDoc(doc(db, `groups/${state.activeGroupId}/members`, targetUserId));
    }
};

window.toggleTeamBuilder = async function (targetUserId, makeTeamBuilder) {
    if (!state.activeGroupId) return;
    const groupRef = doc(db, "groups", state.activeGroupId);
    if (makeTeamBuilder) {
        await updateDoc(groupRef, {
            teamBuilders: arrayUnion(targetUserId)
        });
    } else {
        await updateDoc(groupRef, {
            teamBuilders: arrayRemove(targetUserId)
        });
    }
};
