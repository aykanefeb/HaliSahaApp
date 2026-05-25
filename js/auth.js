import { auth } from './firebase.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { customConfirm } from './state.js';

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
        const confirmed = await customConfirm("Çıkış yapmak istediğinize emin misiniz?");
        if (confirmed) {
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

// --- PROFILE EDIT ---
const btnEditProfile = document.getElementById('btn-edit-profile');
const editProfileModal = document.getElementById('edit-profile-modal');
const btnCloseProfile = document.getElementById('btn-close-profile');
const editProfileForm = document.getElementById('edit-profile-form');
const editProfileNameInput = document.getElementById('edit-profile-name');
const btnSaveProfile = document.getElementById('btn-save-profile');

if (btnEditProfile) {
    btnEditProfile.addEventListener('click', () => {
        if (auth.currentUser) {
            editProfileNameInput.value = auth.currentUser.displayName || '';
        }
        editProfileModal.classList.add('active');
    });
}

if (btnCloseProfile) {
    btnCloseProfile.addEventListener('click', () => {
        editProfileModal.classList.remove('active');
    });
}

if (editProfileForm) {
    editProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newName = editProfileNameInput.value.trim();
        if (!newName || !auth.currentUser) return;

        btnSaveProfile.disabled = true;
        btnSaveProfile.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kaydediliyor...';
        
        try {
            await updateProfile(auth.currentUser, { displayName: newName });
            
            // Update state
            import('./state.js').then(module => {
                const state = module.default;
                state.userName = newName;
                document.getElementById('user-welcome-msg').textContent = `Hoş geldin, ${state.userName}!`;
                
                // If in a group, update my presence doc so everyone sees the new name
                if (state.activeGroupId) {
                    import('./firebase.js').then(fbModule => {
                        const { db } = fbModule;
                        import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js').then(fsModule => {
                            fsModule.setDoc(fsModule.doc(db, `groups/${state.activeGroupId}/members`, state.userId), { 
                                userName: state.userName, 
                                lastActive: Date.now() 
                            });
                        });
                    });
                }
            });

            editProfileModal.classList.remove('active');
        } catch (error) {
            console.error("Profil güncellenirken hata:", error);
            alert("Profil güncellenirken bir hata oluştu.");
        } finally {
            btnSaveProfile.disabled = false;
            btnSaveProfile.textContent = 'Kaydet';
        }
    });
}
