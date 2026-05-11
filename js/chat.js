import { db } from './firebase.js';
import { setDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import state, { customConfirm } from './state.js';

// --- CHAT SYSTEM ---
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const btnSendMessage = document.getElementById('btn-send-message');

export function renderChat() {
    chatMessages.innerHTML = '<div class="message system">Sohbete hoş geldiniz! Takım organizasyonu için buradan mesajlaşabilirsiniz.</div>';
    state.messages.forEach(msg => {
        const div = document.createElement('div');
        const isAdmin = state.currentGroupAdmins.includes(state.userId);
        const isMine = msg.userId === state.userId || (!msg.userId && msg.sender === state.userName);
        const canDelete = isMine || isAdmin;

        div.className = `message ${isMine ? 'user' : 'other'}`;

        div.innerHTML = `<strong>${isMine ? 'Sen' : msg.sender}:</strong> ${msg.text}`;

        if (canDelete) {
            div.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                deleteMessage(msg.id);
            });

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
    if (!text || !state.activeGroupId) return;

    const newId = Date.now().toString();
    const newMsg = {
        id: newId,
        userId: state.userId,
        sender: state.userName,
        text: text,
        timestamp: new Date().toISOString()
    };

    chatInput.value = '';
    await setDoc(doc(db, `groups/${state.activeGroupId}/messages`, newId), newMsg);
}

window.deleteMessage = async function (msgId) {
    if (!state.activeGroupId) return;
    const confirmed = await customConfirm("Bu mesajı silmek istediğinize emin misiniz?");
    if (confirmed) {
        await deleteDoc(doc(db, `groups/${state.activeGroupId}/messages`, msgId));
    }
};

btnSendMessage.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});
