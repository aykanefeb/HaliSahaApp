// Merkezi state yönetimi — tüm modüller bu objeyi import eder
const state = {
    players: [],
    messages: [],
    editingPlayerId: null,

    // User Identity
    userId: null,
    userName: null,
    activeGroupId: localStorage.getItem('matchmaker_activeGroupId'),
    currentGroupAdmins: [],
    currentGroupTeamBuilders: [],
    currentMembers: [],

    // Subscription references
    playersUnsubscribe: null,
    messagesUnsubscribe: null,
    requestsUnsubscribe: null,
    myGroupsUnsubscribe: null,
    membersUnsubscribe: null,
    presenceInterval: null,
    presenceRenderInterval: null
};

export default state;

// Custom confirm dialog — Firestore onSnapshot güncellemelerinden etkilenmez
export function customConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm-modal');
        const msgEl = document.getElementById('confirm-message');
        const okBtn = document.getElementById('confirm-ok-btn');
        const cancelBtn = document.getElementById('confirm-cancel-btn');

        msgEl.textContent = message;
        modal.classList.add('active');

        function cleanup() {
            modal.classList.remove('active');
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            modal.removeEventListener('click', onOverlay);
        }

        function onOk() { cleanup(); resolve(true); }
        function onCancel() { cleanup(); resolve(false); }
        function onOverlay(e) { if (e.target === modal) { cleanup(); resolve(false); } }

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        modal.addEventListener('click', onOverlay);
    });
}
