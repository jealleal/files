// jealleal: переписал некоторые функции, т.к был бэкдор
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, deleteUser } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, limit, doc, updateDoc, getDoc, setDoc, deleteDoc, where } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app-check.js";

const firebaseConfig = {
    apiKey: "AIzaSyBHZB9HAbtWL236KzxzLfGaCn9DcMGdWo0",
    authDomain: "deserted-fuel.firebaseapp.com",
    projectId: "deserted-fuel",
    storageBucket: "deserted-fuel.firebasestorage.app",
    messagingSenderId: "356070218652",
    appId: "1:356070218652:web:530d7d6b15fbb23d4fc659"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('6LeHKSEsAAAAAGmzkmcpMYe0irlsvezliKb_n-nD'), 
    isTokenAutoRefreshEnabled: true,
});

const DEFAULT_AVATAR = 'https://static.photos/people/200x200/1';
const DEFAULT_PROFILE_AVATAR = 'https://static.photos/people/320x320/2';

let currentUser = null;
let currentUserData = null;

function showToast(msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i data-feather="info" class="w-4 h-4"></i>${msg}`;
    
    container.appendChild(toast);
    
    feather.replace();
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showConfirmation(msg) {
    return new Promise(resolve => {
        const overlay = document.getElementById('modal-overlay');
        document.getElementById('modal-message').innerHTML = `<i data-feather="alert-triangle" class="w-5 h-5 text-yellow-500 inline mr-2"></i>${msg}`;
        overlay.classList.remove('hidden');
        feather.replace();

        const confirmBtn = document.getElementById('modal-confirm');
        const cancelBtn = document.getElementById('modal-cancel');

        const cleanUp = (result) => {
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
            overlay.classList.add('hidden');
            resolve(result);
        };

        confirmBtn.onclick = () => cleanUp(true);
        cancelBtn.onclick = () => cleanUp(false);
    });
}

window.showToast = showToast;
window.showConfirmation = showConfirmation;
// тут ошибка была
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        
        onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            if(docSnap.exists()) {
                currentUserData = docSnap.data();
                if(currentUserData.isBanned) {
                    showToast("Ваш аккаунт заблокирован.");
                    signOut(auth);
                    return;
                }
            }
        });

        document.getElementById('navbar').classList.remove('hidden');
        router('feed');
        loadFeed();
    } else {
        currentUser = null;
        currentUserData = null;
        document.getElementById('navbar').classList.add('hidden');
        router('auth');
    }
    setTimeout(() => feather.replace(), 100);
});

window.register = async () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        await setDoc(doc(db, "users", cred.user.uid), {
            email: email,
            displayName: "Новичок",
            photoURL: "",
            isAdmin: false,
            isBanned: false,
            lastPostTimestamp: serverTimestamp(), 
            createdAt: serverTimestamp()
        });
        showToast("Аккаунт создан! Пожалуйста, войдите.");
    } catch (e) { showToast("Ошибка: " + e.message); }
};

window.login = async () => {
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
    } catch (e) { showToast("Ошибка входа."); }
};

window.logout = () => signOut(auth);

window.deleteMyAccount = async () => {
    if(!(await showConfirmation("Точно удалить аккаунт? Это нельзя отменить."))) return;
    try {
        const uid = currentUser.uid;
        await deleteDoc(doc(db, "users", uid));
        await deleteUser(currentUser);
        showToast("Аккаунт удален.");
    } catch (e) {
        showToast("Ошибка. Пожалуйста, перезалогиньтесь и попробуйте снова.");
    }
};

async function getAuthorData(uid) {
    const docSnap = await getDoc(doc(db, "users", uid));
    return docSnap.exists() ? docSnap.data() : { displayName: "Deleted User", isAdmin: false, photoURL: "" };
}

function loadFeed() {
    const q = query(collection(db, "posts"), orderBy("timestamp", "desc"), limit(50));
    onSnapshot(q, async (snapshot) => {
        const container = document.getElementById('posts-container');
        container.innerHTML = "";
        
        const postPromises = snapshot.docs.map(async docSnap => {
            const post = docSnap.data();
            const pid = docSnap.id;
            const authorData = await getAuthorData(post.uid);
            return renderPost(pid, post, authorData);
        });

        const renderedPosts = await Promise.all(postPromises);
        renderedPosts.forEach(postEl => container.appendChild(postEl));
        setTimeout(() => feather.replace(), 100);
        onSearchInput();
    });
}

window.onSearchInput = () => {
    const query = document.getElementById('search-input').value.toLowerCase();
    const posts = document.querySelectorAll('.post-card');
    
    posts.forEach(card => {
        const content = card.dataset.searchContent || "";
        
        if (content.includes(query)) {
            card.style.display = "block";
        } else {
            card.style.display = "none";
        }
    });
}

function renderPost(pid, post, authorData) {
    const isAdmin = currentUserData?.isAdmin === true;
    const isOwner = currentUser?.uid === post.uid;
    const isAuthorAdmin = authorData.isAdmin === true;

    const div = document.createElement('div');
    div.className = 'post-card';
    
    div.dataset.searchContent = (post.text + " " + post.author).toLowerCase();
    
    const avatarImg = document.createElement('img');
    avatarImg.className = 'avatar';
    avatarImg.src = post.authorPhoto || authorData.photoURL || DEFAULT_AVATAR;
    avatarImg.onerror = () => { avatarImg.src = DEFAULT_AVATAR; };
    avatarImg.onclick = () => { openUserProfile(post.uid); };

    const headerDiv = document.createElement('div');
    headerDiv.className = 'post-header';
    
    let authorHtml = `
        <div class="author-info" onclick="openUserProfile('${post.uid}')">
            <span class="author-name">
                ${escapeHtml(post.author)}
                ${isAuthorAdmin ? '<span class="admin-checkmark"><i data-feather="check" class="w-3 h-3"></i></span>' : ''} 
            </span>
            <span class="post-date"><i data-feather="clock" class="w-3 h-3 mr-1"></i>${post.timestamp ? new Date(post.timestamp.toDate()).toLocaleString() : '...'}</span>
        </div>
    `;

    headerDiv.innerHTML = authorHtml;
    headerDiv.prepend(avatarImg);

    div.appendChild(headerDiv);
    
    let contentHtml = `<div class="post-content">${escapeHtml(post.text)}</div>`;
    if(post.img) {
        contentHtml += `<img src="${escapeHtml(post.img)}" class="post-img" onerror="this.style.display='none'">`;
    }
    div.innerHTML += contentHtml; 

    if (isOwner || isAdmin) {
        div.innerHTML += `<div style="text-align:right; margin-top:10px;">
            <button class="admin-btn px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-all flex items-center justify-center ml-auto" onclick="deletePost('${pid}')">
                <i data-feather="trash-2" class="w-3 h-3 mr-1"></i>Удалить
            </button>
        </div>`;
    }

    return div;
}

window.createPost = async () => {
    const publishButton = document.querySelector('#create-view button:not([onclick*="router"])');
    publishButton.disabled = true; 
    publishButton.innerHTML = '<i data-feather="loader" class="w-4 h-4 mr-2 animate-spin"></i>Публикация...'; 

    if (currentUserData?.isBanned) {
        publishButton.disabled = false;
        publishButton.innerHTML = '<i data-feather="send" class="w-4 h-4 mr-2"></i>Опубликовать';
        return showToast("Вы забанены!");
    }

    const text = document.getElementById('post-text').value;
    const img = document.getElementById('post-img-url').value;

    if (!text.trim()) {
        publishButton.disabled = false;
        publishButton.innerHTML = '<i data-feather="send" class="w-4 h-4 mr-2"></i>Опубликовать';
        return showToast("Напишите хоть что-то.");
    }

    try {
        await addDoc(collection(db, "posts"), {
            text: text,
            img: img,
            uid: currentUser.uid,
            author: currentUser.displayName || "Аноним",
            isAuthorAdmin: currentUserData?.isAdmin || false, 
            authorPhoto: currentUserData?.photoURL || "https://cdn-icons-png.flaticon.com/512/3282/3282224.png",
            timestamp: serverTimestamp()
        });
        
        await updateDoc(doc(db, "users", currentUser.uid), {
            lastPostTimestamp: serverTimestamp() 
        });
        
        document.getElementById('post-text').value = "";
        document.getElementById('post-img-url').value = "";
        
        publishButton.disabled = false; 
        publishButton.innerHTML = '<i data-feather="send" class="w-4 h-4 mr-2"></i>Опубликовать';
        
        router('feed');
        showToast("Опубликовано!");
    } catch (e) {
        publishButton.disabled = false; 
        publishButton.innerHTML = '<i data-feather="send" class="w-4 h-4 mr-2"></i>Опубликовать';
        
        showToast("Ошибка: Возможно, вы постите слишком часто (Rate Limited) или нарушили правила. " + e.message);
    }
};

window.deletePost = async (id) => {
    if(!(await showConfirmation("Удалить пост?"))) return;
    try {
        await deleteDoc(doc(db, "posts", id));
        showToast("Пост удален.");
    } catch(e) { showToast("Нет прав для удаления."); }
};

window.updateProfileData = async () => {
    const name = document.getElementById('set-name').value;
    const photo = document.getElementById('set-avatar').value;
    
    await updateProfile(currentUser, { displayName: name, photoURL: photo });
    await updateDoc(doc(db, "users", currentUser.uid), {
        displayName: name,
        photoURL: photo
    });
    showToast("Профиль сохранен.");
};

let currentViewingUid = null;

window.openUserProfile = async (uid) => {
    currentViewingUid = uid;
    router('user-profile');
    
    const container = document.getElementById('user-posts-container');
    container.innerHTML = '<div class="text-center py-8"><i data-feather="loader" class="w-6 h-6 text-purple-600 animate-spin"></i></div>';
    
    setTimeout(() => feather.replace(), 100);
    
    const userSnap = await getDoc(doc(db, "users", uid));
    if(!userSnap.exists()) {
        container.innerHTML = '<p class="text-center text-gray-500">Пользователь не найден</p>';
        return;
    }
    const data = userSnap.data();
    
    document.getElementById('up-name').innerText = data.displayName;
    document.getElementById('up-avatar').src = data.photoURL || DEFAULT_PROFILE_AVATAR;
    document.getElementById('up-avatar').onerror = function(){this.src=DEFAULT_PROFILE_AVATAR;};
    
    const checkmarkEl = document.getElementById('up-checkmark');
    if (data.isAdmin) {
        checkmarkEl.style.display = 'inline-block';
    } else {
        checkmarkEl.style.display = 'none';
    }

    const statusDiv = document.getElementById('up-status');
    statusDiv.innerHTML = data.isBanned ? '<span class="ban-badge"><i data-feather="shield-off" class="w-3 h-3 mr-1"></i>ЗАБАНЕН</span>' : '';

    const adminPanel = document.getElementById('admin-actions-area');
    if(currentUserData?.isAdmin && currentUser.uid !== uid) {
        adminPanel.style.display = 'flex';
    } else {
        adminPanel.style.display = 'none';
    }

    const q = query(collection(db, "posts"), where("uid", "==", uid), orderBy("timestamp", "desc"), limit(20));
    onSnapshot(q, (snap) => {
          const postPromises = snap.docs.map(async docSnap => {
            const post = docSnap.data();
            const pid = docSnap.id;
            return renderPost(pid, post, data);
        });
        
        Promise.all(postPromises).then(renderedPosts => {
            container.innerHTML = '';
            renderedPosts.forEach(postEl => container.appendChild(postEl));
            if (renderedPosts.length === 0) container.innerHTML = '<p class="text-center text-gray-500 py-8"><i data-feather="inbox" class="w-5 h-5 mr-2"></i>Постов пока нет.</p>';
            
            setTimeout(() => feather.replace(), 100);
        });
    });
};

window.adminBanUser = async () => {
    if(!(await showConfirmation("Забанить пользователя навсегда?"))) return;
    await updateDoc(doc(db, "users", currentViewingUid), { isBanned: true, mutedUntil: null });
    showToast("Пользователь забанен.");
    openUserProfile(currentViewingUid);
};

window.adminMuteUser = async () => {
    if(!(await showConfirmation("Выдать мут на 24 часа? Пользователь не сможет постить."))) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    await updateDoc(doc(db, "users", currentViewingUid), { mutedUntil: tomorrow });
    showToast("Мут выдан на 24 часа.");
};

window.router = (view) => {
    document.querySelectorAll('.view').forEach(e => e.classList.remove('active'));
    const el = document.getElementById(view + (view.endsWith('view') ? '' : '-view'));
    if(el) el.classList.add('active');

    if(view === 'settings') {
        document.getElementById('set-name').value = currentUser.displayName || "";
        document.getElementById('set-avatar').value = currentUserData?.photoURL || "";
    }

    setTimeout(() => feather.replace(), 100);
}

function escapeHtml(text) {
    if (!text) return "";
    return text
        .toString() 
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;") 
        .replace(/'/g, "&#39;"); 
}