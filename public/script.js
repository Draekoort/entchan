let currentUser = 'Anonymous';
let currentThreadId = null;

async function createTables() {
  await createTable('threads', '(id INTEGER PRIMARY KEY, title TEXT, body TEXT, image_url TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  await createTable('comments', '(id INTEGER PRIMARY KEY, thread_id INTEGER, user TEXT, text TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  await createTable('users', '(id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT)');
}

async function createTable(tableName, schema) {
  const query = `CREATE TABLE IF NOT EXISTS ${tableName} ${schema}`;
  await executeSql(query);
}

async function executeSql(query) {
  try {
    const response = await fetch('/api/v1/sql/?' + new URLSearchParams({sql: query}));
    const data = await response.json();
    console.log('SQL execution result:', data);
    return data;
  } catch (error) {
    console.error('Error executing SQL:', error);
  }
}

async function fetchThreads() {
  const query = 'SELECT threads.*, COUNT(comments.id) as comment_count FROM threads LEFT JOIN comments ON threads.id = comments.thread_id GROUP BY threads.id ORDER BY threads.created_at DESC';
  return await executeSql(query);
}

async function fetchComments(threadId) {
  const query = `SELECT * FROM comments WHERE thread_id = ${threadId} ORDER BY created_at ASC`;
  return await executeSql(query);
}

function showRegisterForm() {
  document.getElementById('confirm-password-input').classList.remove('hidden');
  document.getElementById('register-btn').classList.remove('hidden');
  document.querySelector('button[onclick="login()"]').classList.add('hidden');
  document.querySelector('button[onclick="showRegisterForm()"]').classList.add('hidden');
}

async function register() {
  const username = document.getElementById('username-input').value.trim();
  const password = document.getElementById('password-input').value;
  const confirmPassword = document.getElementById('confirm-password-input').value;

  if (!username || !password) {
    alert('Please enter both username and password.');
    return;
  }

  if (password !== confirmPassword) {
    alert('Passwords do not match.');
    return;
  }

  const query = `INSERT INTO users (username, password) VALUES ('${username}', '${password}')`;
  try {
    await executeSql(query);
    alert('Account created successfully. You can now log in.');
    resetLoginForm();
  } catch (error) {
    alert('Error creating account. Username may already exist.');
  }
}

async function login() {
  const username = document.getElementById('username-input').value.trim();
  const password = document.getElementById('password-input').value;

  if (!username || !password) {
    alert('Please enter both username and password.');
    return;
  }

  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  const result = await executeSql(query);

  if (result && result.length > 0) {
    currentUser = username;
    alert(`Welcome, ${currentUser}!`);
    document.getElementById('login-register-form').classList.add('hidden');
    updateUserStatus();
    switchTab('forum');
    updateLoginLogoutButton();
  } else {
    alert('Invalid username or password.');
  }
}

function logout() {
  currentUser = 'Anonymous';
  updateUserStatus();
  updateLoginLogoutButton();
  switchTab('forum');
}

function resetLoginForm() {
  document.getElementById('username-input').value = '';
  document.getElementById('password-input').value = '';
  document.getElementById('confirm-password-input').value = '';
  document.getElementById('confirm-password-input').classList.add('hidden');
  document.getElementById('register-btn').classList.add('hidden');
  document.querySelector('button[onclick="login()"]').classList.remove('hidden');
  document.querySelector('button[onclick="showRegisterForm()"]').classList.remove('hidden');
}

function updateUserStatus() {
  document.getElementById('user-status').textContent = `User: ${currentUser}`;
}

function updateLoginLogoutButton() {
  const loginTabButton = document.getElementById('login-tab-button');
  const tabBar = document.querySelector('.tab-bar');
  
  if (currentUser !== 'Anonymous') {
    loginTabButton.classList.add('hidden');
    
    if (!document.getElementById('logout-button')) {
      const logoutButton = document.createElement('div');
      logoutButton.id = 'logout-button';
      logoutButton.className = 'tab';
      logoutButton.textContent = 'Logout';
      logoutButton.onclick = logout;
      tabBar.appendChild(logoutButton);
    }
  } else {
    loginTabButton.classList.remove('hidden');
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
      logoutButton.remove();
    }
  }
}

async function renderThreadList() {
  const threads = await fetchThreads();
  const threadList = document.getElementById('thread-list');
  threadList.innerHTML = '';
  threads.forEach(thread => {
    const li = document.createElement('li');
    li.className = 'slide-in';
    li.innerHTML = `
      <div class="thread-preview">
        <div class="thread-info">
          <div class="thread-title">${thread.title}</div>
          <div class="thread-meta">Created: ${new Date(thread.created_at).toLocaleString()}</div>
        </div>
        <span class="comment-count">${thread.comment_count} comments</span>
      </div>
    `;
    li.onclick = () => showThread(thread.id);
    threadList.appendChild(li);
  });
  updateThreadCount(threads.length);
}

function updateThreadCount(count) {
  document.getElementById('thread-count').textContent = `Threads: ${count}`;
}

async function showThread(threadId) {
  const threadQuery = `SELECT * FROM threads WHERE id = ${threadId}`;
  const [thread] = await executeSql(threadQuery);
  if (thread) {
    currentThreadId = threadId;
    document.getElementById('thread-list-container').classList.add('hidden');
    document.getElementById('thread-view').classList.remove('hidden');
    document.getElementById('thread-title').textContent = thread.title;
    document.getElementById('thread-body').textContent = thread.body;
    if (thread.image_url) {
      const threadImage = document.getElementById('thread-image');
      threadImage.src = thread.image_url;
      threadImage.classList.remove('hidden');
    } else {
      document.getElementById('thread-image').classList.add('hidden');
    }
    await renderComments(threadId);
  }
}

function showThreadList() {
  document.getElementById('thread-list-container').classList.remove('hidden');
  document.getElementById('thread-view').classList.add('hidden');
}

async function renderComments(threadId) {
  const comments = await fetchComments(threadId);
  const commentsDiv = document.getElementById('comments');
  commentsDiv.innerHTML = '<h4>Comments:</h4>';
  comments.forEach(comment => {
    const commentDiv = document.createElement('div');
    commentDiv.className = 'comment slide-in';
    commentDiv.innerHTML = `
      <strong>${comment.user}</strong> (${new Date(comment.created_at).toLocaleString()}): 
      ${comment.text}
    `;
    commentsDiv.appendChild(commentDiv);
  });
}

async function addComment() {
  const commentInput = document.getElementById('comment-input');
  const commentText = commentInput.value.trim();
  if (commentText && currentThreadId) {
    if (currentUser === 'Anonymous') {
      alert('Please log in to post a comment.');
      return;
    }
    const query = `INSERT INTO comments (thread_id, user, text) VALUES (${currentThreadId}, '${currentUser}', '${commentText}')`;
    await executeSql(query);
    await renderComments(currentThreadId);
    commentInput.value = '';
  }
}

function showNewThreadForm() {
  if (currentUser === 'Anonymous') {
    alert('Please log in to create a new thread.');
    return;
  }
  document.getElementById('new-thread-form').classList.toggle('hidden');
}

async function addThread() {
  const titleInput = document.getElementById('new-thread-title');
  const bodyInput = document.getElementById('new-thread-body');
  const imageUrlInput = document.getElementById('thread-image-url');
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  const imageUrl = imageUrlInput.value.trim();
  if (title && body) {
    const query = `INSERT INTO threads (title, body, image_url) VALUES ('${title}', '${body}', '${imageUrl}')`;
    await executeSql(query);
    await renderThreadList();
    titleInput.value = '';
    bodyInput.value = '';
    imageUrlInput.value = '';
    document.getElementById('new-thread-form').classList.add('hidden');
  }
}

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.querySelector(`.tab:nth-child(${tabName === 'forum' ? 1 : (tabName === 'login' ? 2 : 3)})`).classList.add('active');
  document.getElementById('forum-tab').classList.toggle('hidden', tabName !== 'forum');
  document.getElementById('login-tab').classList.toggle('hidden', tabName !== 'login');
  document.getElementById('settings-tab').classList.toggle('hidden', tabName !== 'settings');
}

// Initialize the application
async function init() {
  await createTables();
  await renderThreadList();
  updateUserStatus();
  updateLoginLogoutButton();
}

// Call init when the page loads
window.onload = init;