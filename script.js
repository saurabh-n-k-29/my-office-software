const DB_NAME = 'fileManagerDB', DB_VERSION = 1;
let db;
let currentFolderId = null;

// Open or create DB
const openReq = indexedDB.open(DB_NAME, DB_VERSION);
openReq.onupgradeneeded = e => {
  const d = e.target.result;
  if (!d.objectStoreNames.contains('folders'))
    d.createObjectStore('folders', { keyPath: 'id', autoIncrement: true });
  if (!d.objectStoreNames.contains('files'))
    d.createObjectStore('files', { keyPath: ['folderId', 'name'] });
};
openReq.onsuccess = e => { db = e.target.result; renderFolders(); };
openReq.onerror = e => console.error('IndexedDB error:', e.target.errorCode);

function tx(storeName, mode='readonly') {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function createFolder() {
  const name = prompt('Enter folder name:');
  if (!name) return;
  const store = tx('folders', 'readwrite');
  store.add({ name }).onsuccess = () => renderFolders();
}

function deleteFolder(id) {
  if (!confirm('Delete folder and all its files?')) return;
  const fStore = tx('folders', 'readwrite');
  fStore.delete(id).onsuccess = () => {
    const filesTx = tx('files', 'readwrite');
    const index = filesTx.openCursor();
    index.onsuccess = ev => {
      const cursor = ev.target.result;
      if (cursor) {
        if (cursor.value.folderId === id) cursor.delete();
        cursor.continue();
      } else renderFolders();
    };
  };
}

function renderFolders() {
  const container = document.getElementById('folderList');
  container.innerHTML = '';
  const query = document.getElementById('searchBox').value.toLowerCase();

  const fStore = tx('folders');
  fStore.openCursor().onsuccess = e => {
    const cursor = e.target.result;
    if (cursor) {
      const { id, name } = cursor.value;
      if (name.toLowerCase().includes(query)) {
        const div = document.createElement('div'); div.className='folder';
        const title = document.createElement('div'); title.className='folder-title';
        title.innerHTML = `📁 ${name} <div>
          <button onclick="triggerUpload(${id})">Upload</button>
          <button onclick="deleteFolder(${id})">Delete</button>
        </div>`;
        div.appendChild(title);
        const fileList = document.createElement('div'); fileList.className='files';

        const fileStore = tx('files');
        fileStore.openCursor().onsuccess = fe => {
          const fcur = fe.target.result;
          if (fcur) {
            const f = fcur.value;
            if (f.folderId === id) {
              const fileDiv = document.createElement('div'); fileDiv.className='file';
              const link = document.createElement('a');
              link.href = '#'; link.textContent = `📄 ${f.name}`;
              link.onclick = e => { e.preventDefault(); openFile(f); };
              const delBtn = document.createElement('button');
              delBtn.textContent = '🗑️'; delBtn.onclick = () => deleteFile(id, f.name);
              fileDiv.appendChild(link);
              fileDiv.appendChild(delBtn);
              fileList.appendChild(fileDiv);
            }
            fcur.continue();
          }
        };
        div.appendChild(fileList);
        container.appendChild(div);
      }
      cursor.continue();
    }
  };
}

function triggerUpload(folderId) {
  currentFolderId = folderId;
  document.getElementById('fileInput').click();
}

function uploadFiles(event) {
  const files = event.target.files;
  if (!currentFolderId || !files.length) return;
  const fStore = tx('files', 'readwrite');
  Array.from(files).forEach(file => {
    fStore.put({ folderId: currentFolderId, name: file.name, blob: file });
  });
  fStore.transaction.oncomplete = () => {
    renderFolders();
    event.target.value = ''; currentFolderId = null;
  };
}

function deleteFile(folderId, name) {
  const store = tx('files', 'readwrite');
  store.delete([folderId, name]).onsuccess = () => renderFolders();
}

function openFile(f) {
  const blobRequest = tx('files').get([f.folderId, f.name]);
  blobRequest.onsuccess = () => {
    const file = blobRequest.result;
    if (!file) return alert('File not found');
    const url = URL.createObjectURL(file.blob);
    const win = window.open();
    win.document.write(`<iframe src="${url}" style="width:100%; height:100%;" frameborder="0"></iframe>`);
  };
}

document.getElementById('searchBox').addEventListener('input', renderFolders);
