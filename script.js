document.addEventListener('DOMContentLoaded', async () => {
    // First get all DOM elements
    const folderTree = document.getElementById('folder-tree');
    const fileGrid = document.getElementById('file-grid');
    const currentPathElement = document.getElementById('current-path');
    const globalSearch = document.getElementById('global-search');
    const newFolderBtn = document.getElementById('new-folder');
    const uploadFilesBtn = document.getElementById('upload-files');
    const fileUploadInput = document.getElementById('file-upload-input');
    const contextMenu = document.getElementById('context-menu');
    const newFolderModal = document.getElementById('new-folder-modal');
    const newFolderNameInput = document.getElementById('new-folder-name');
    const createNewFolderBtn = document.getElementById('create-new-folder');
    const cancelNewFolderBtn = document.getElementById('cancel-new-folder');
    const filePreviewModal = document.getElementById('file-preview-modal');
    const previewContainer = document.getElementById('preview-container');

    // State variables
    let currentPath = 'files';
    let clipboard = null;
    let clipboardAction = null;
    let db;

    // Initialize IndexedDB
    const initDB = () => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('FileManagerDB', 2);

            request.onerror = (event) => {
                console.error('Database error:', event.target.error);
                reject('Failed to open database');
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object store for file system structure
                if (!db.objectStoreNames.contains('fileSystem')) {
                    const fileSystemStore = db.createObjectStore('fileSystem', { keyPath: 'path' });
                    fileSystemStore.createIndex('parentPath', 'parentPath', { unique: false });
                }

                // Create object store for file contents
                if (!db.objectStoreNames.contains('fileContents')) {
                    db.createObjectStore('fileContents', { keyPath: 'id', autoIncrement: true });
                }
            };

            request.onsuccess = (event) => {
                db = event.target.result;

                // Check if root folder exists, create if not
                const transaction = db.transaction(['fileSystem'], 'readwrite');
                const store = transaction.objectStore('fileSystem');
                const request = store.get('files');

                request.onsuccess = (e) => {
                    if (!e.target.result) {
                        const rootFolder = {
                            path: 'files',
                            name: 'My Files',
                            type: 'folder',
                            parentPath: '',
                            created: new Date(),
                            modified: new Date()
                        };
                        store.put(rootFolder);
                    }
                    resolve();
                };

                request.onerror = (e) => {
                    console.error('Error checking root folder:', e.target.error);
                    reject('Failed to initialize root folder');
                };
            };
        });
    };

    // Initialize the app
    try {
        await initDB();
        loadDirectory(currentPath);
        buildFolderTree();
        setupEventListeners();
        setupTouchEvents();
    } catch (error) {
        console.error('Initialization failed:', error);
        alert('Failed to initialize file manager. Please refresh the page.');
    }

    // Core Functions
    function loadDirectory(path) {
        currentPath = path;
        updatePathDisplay();
        fileGrid.innerHTML = '';

        const transaction = db.transaction(['fileSystem'], 'readonly');
        const store = transaction.objectStore('fileSystem');
        const index = store.index('parentPath');
        const request = index.getAll(path);

        request.onsuccess = (e) => {
            const items = e.target.result;

            // Display folders first
            items.filter(item => item.type === 'folder')
                .forEach(item => createFolderElement(item));

            // Then display files
            items.filter(item => item.type !== 'folder')
                .forEach(item => createFileElement(item));
        };

        request.onerror = (e) => {
            console.error('Error loading directory:', e.target.error);
        };
    }

    function createFolderElement(item) {
        const folderElement = document.createElement('div');
        folderElement.className = 'folder-item-grid';
        folderElement.dataset.name = item.name;
        folderElement.dataset.path = item.path;
        folderElement.dataset.type = 'folder';

        folderElement.innerHTML = `
            <i class="fas fa-folder folder-icon"></i>
            <span>${item.name}</span>
        `;

        folderElement.addEventListener('dblclick', () => loadDirectory(item.path));
        folderElement.addEventListener('click', handleItemClick);
        fileGrid.appendChild(folderElement);
    }

    function createFileElement(item) {
        const fileElement = document.createElement('div');
        fileElement.className = 'file-item';
        fileElement.dataset.name = item.name;
        fileElement.dataset.path = item.path;
        fileElement.dataset.type = 'file';

        const icon = getFileIcon(item.name.split('.').pop());
        fileElement.innerHTML = `
            <i class="${icon} file-icon"></i>
            <span>${item.name}</span>
        `;

        fileElement.addEventListener('dblclick', () => openFile(item));
        fileElement.addEventListener('click', handleItemClick);
        fileGrid.appendChild(fileElement);
    }

    function getFileIcon(extension) {
        const iconMap = {
            pdf: 'fas fa-file-pdf',
            doc: 'fas fa-file-word',
            docx: 'fas fa-file-word',
            xls: 'fas fa-file-excel',
            xlsx: 'fas fa-file-excel',
            ppt: 'fas fa-file-powerpoint',
            pptx: 'fas fa-file-powerpoint',
            txt: 'fas fa-file-alt',
            jpg: 'fas fa-file-image',
            jpeg: 'fas fa-file-image',
            png: 'fas fa-file-image',
            gif: 'fas fa-file-image',
            mp3: 'fas fa-file-audio',
            wav: 'fas fa-file-audio',
            mp4: 'fas fa-file-video',
            mov: 'fas fa-file-video',
            zip: 'fas fa-file-archive',
            rar: 'fas fa-file-archive',
            exe: 'fas fa-file-code',
            js: 'fas fa-file-code',
            html: 'fas fa-file-code',
            css: 'fas fa-file-code',
            json: 'fas fa-file-code'
        };
        return iconMap[extension.toLowerCase()] || 'fas fa-file';
    }

    function updatePathDisplay() {
        if (currentPathElement) {
            currentPathElement.textContent = currentPath + '/';
        }
    }

    function buildFolderTree() {
    const rootElement = folderTree.querySelector('.folder-item');
    rootElement.innerHTML = `
        <i class="fas fa-folder"></i>
        <span>My Files</span>
        <button class="add-folder-btn"><i class="fas fa-plus"></i></button>
    `;

    rootElement.addEventListener('click', (e) => {
        if (!e.target.classList.contains('add-folder-btn')) {
            loadDirectory('files');
        }
    });

    rootElement.querySelector('.add-folder-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        showNewFolderModal('files');
    });

    // Clear existing tree
    const existingLists = folderTree.querySelectorAll('ul ul');
    existingLists.forEach(list => list.remove());

    // Build the complete tree structure
    const transaction = db.transaction(['fileSystem'], 'readonly');
    const store = transaction.objectStore('fileSystem');
    const request = store.getAll();

    request.onsuccess = (e) => {
        const allItems = e.target.result;
        const rootUl = document.createElement('ul');
        
        // Build tree recursively starting from root
        const buildTree = (parentElement, parentPath) => {
            const children = allItems.filter(item => 
                item.parentPath === parentPath && item.type === 'folder'
            );
            
            children.forEach(item => {
                const li = document.createElement('li');
                li.className = 'folder-item';
                li.dataset.path = item.path;
                
                li.innerHTML = `
                    <i class="fas fa-folder"></i>
                    <span>${item.name}</span>
                    <button class="add-folder-btn"><i class="fas fa-plus"></i></button>
                `;
                
                li.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('add-folder-btn')) {
                        loadDirectory(item.path);
                    }
                });
                
                li.querySelector('.add-folder-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    showNewFolderModal(item.path);
                });
                
                const subUl = document.createElement('ul');
                buildTree(subUl, item.path);
                li.appendChild(subUl);
                
                parentElement.appendChild(li);
            });
        };
        
        buildTree(rootUl, 'files');
        rootElement.appendChild(rootUl);
    };
}

    function buildFolderTreeRecursive(items, parentUl, parentPath) {
        const children = items.filter(item => item.parentPath === parentPath && item.type === 'folder');
        
        children.forEach(item => {
            const li = document.createElement('li');
            li.className = 'folder-item';
            li.dataset.path = item.path;
            
            li.innerHTML = `
                <i class="fas fa-folder"></i>
                <span>${item.name}</span>
                <button class="add-folder-btn"><i class="fas fa-plus"></i></button>
            `;
            
            li.addEventListener('click', (e) => {
                if (!e.target.classList.contains('add-folder-btn')) {
                    loadDirectory(item.path);
                }
            });
            
            li.querySelector('.add-folder-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                showNewFolderModal(item.path);
            });
            
            const subUl = document.createElement('ul');
            buildFolderTreeRecursive(items, subUl, item.path);
            li.appendChild(subUl);
            
            parentUl.appendChild(li);
        });
    }

    function showNewFolderModal(parentPath = currentPath) {
        newFolderModal.style.display = 'flex';
        newFolderModal.dataset.parentPath = parentPath;
        newFolderNameInput.value = '';
        newFolderNameInput.focus();
    }

    function hideNewFolderModal() {
        newFolderModal.style.display = 'none';
    }

    function createNewFolder() {
    const folderName = newFolderNameInput.value.trim();
    if (!folderName) return;

    const parentPath = newFolderModal.dataset.parentPath;
    const folderPath = `${parentPath}/${folderName}`;

    const transaction = db.transaction(['fileSystem'], 'readwrite');
    const store = transaction.objectStore('fileSystem');

    // Check if folder already exists
    const checkRequest = store.get(folderPath);

    checkRequest.onsuccess = (e) => {
        if (e.target.result) {
            alert('A folder with this name already exists!');
            return;
        }

        const newFolder = {
            path: folderPath,
            name: folderName,
            type: 'folder',
            parentPath: parentPath,
            created: new Date(),
            modified: new Date()
        };

        const putRequest = store.put(newFolder);

        putRequest.onsuccess = () => {
            loadDirectory(currentPath);
            buildFolderTree(); // Add this line to rebuild the tree
            hideNewFolderModal();
        };

        putRequest.onerror = (e) => {
            console.error('Error creating folder:', e.target.error);
            alert('Failed to create folder');
        };
    };
}

    function handleFileUpload(event) {
        const files = event.target.files;
        if (files.length === 0) return;

        Array.from(files).forEach(file => {
            const filePath = `${currentPath}/${file.name}`;

            const transaction = db.transaction(['fileSystem', 'fileContents'], 'readwrite');
            const fileSystemStore = transaction.objectStore('fileSystem');
            const contentsStore = transaction.objectStore('fileContents');

            // Check if file exists
            const checkRequest = fileSystemStore.get(filePath);

            checkRequest.onsuccess = (e) => {
                if (e.target.result && !confirm(`"${file.name}" already exists. Overwrite?`)) {
                    return;
                }

                const fileEntry = {
                    path: filePath,
                    name: file.name,
                    type: 'file',
                    parentPath: currentPath,
                    created: new Date(),
                    modified: new Date(),
                    size: file.size,
                    mimeType: file.type
                };

                const putRequest = fileSystemStore.put(fileEntry);

                putRequest.onsuccess = () => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const contentRequest = contentsStore.put({
                            filePath: filePath,
                            content: e.target.result,
                            lastModified: file.lastModified
                        });

                        contentRequest.onsuccess = () => {
                            loadDirectory(currentPath);
                        };

                        contentRequest.onerror = (err) => {
                            console.error('Error storing file content:', err);
                            fileSystemStore.delete(filePath);
                        };
                    };
                    reader.readAsDataURL(file);
                };

                putRequest.onerror = (err) => {
                    console.error('Error adding file:', err);
                };
            };
        });

        fileUploadInput.value = '';
    }

    function openFile(fileItem) {
        const transaction = db.transaction(['fileContents'], 'readonly');
        const store = transaction.objectStore('fileContents');
        const request = store.get(fileItem.path);

        request.onsuccess = (e) => {
            const fileContent = e.target.result;
            if (!fileContent) {
                alert('File content not found');
                return;
            }

            if (fileItem.mimeType.startsWith('image/')) {
                previewFile(fileContent.content, fileItem.name, fileItem.mimeType);
            } else if (fileItem.mimeType === 'application/pdf') {
                previewPdf(fileContent.content);
            } else if (fileItem.mimeType.startsWith('text/')) {
                previewText(fileContent.content);
            } else {
                downloadFile(fileContent.content, fileItem.name);
            }
        };
    }

    function previewFile(content, name, type) {
        previewContainer.innerHTML = `
            <h3>${name}</h3>
            <img src="${content}" alt="${name}" style="max-width: 100%; max-height: 70vh;">
        `;
        filePreviewModal.style.display = 'flex';
    }

    function previewPdf(content) {
        downloadFile(content, 'preview.pdf');
    }

    function previewText(content) {
        const text = atob(content.split(',')[1]);
        previewContainer.innerHTML = `
            <h3>Text Preview</h3>
            <pre style="white-space: pre-wrap; word-wrap: break-word;">${text}</pre>
        `;
        filePreviewModal.style.display = 'flex';
    }

    function downloadFile(content, fileName) {
        const a = document.createElement('a');
        a.href = content;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function handleItemClick(e) {
        if (e.ctrlKey || e.metaKey) {
            this.classList.toggle('selected');
        } else {
            clearSelection();
            this.classList.add('selected');
        }
    }

    function clearSelection() {
        document.querySelectorAll('.selected').forEach(item => {
            item.classList.remove('selected');
        });
    }

    function showContextMenu(e, target) {
        e.preventDefault();
        hideContextMenu();

        contextMenu.style.display = 'block';
        contextMenu.style.left = `${e.pageX}px`;
        contextMenu.style.top = `${e.pageY}px`;
        contextMenu.dataset.targetPath = target.dataset.path;
        contextMenu.dataset.targetName = target.dataset.name;
        contextMenu.dataset.targetType = target.dataset.type;

        document.getElementById('menu-paste').style.display = clipboard ? 'block' : 'none';
    }

    function hideContextMenu() {
        contextMenu.style.display = 'none';
    }

    function handleMenuOpen() {
        const path = contextMenu.dataset.targetPath;
        const type = contextMenu.dataset.targetType;

        if (type === 'folder') {
            loadDirectory(path);
        } else {
            const transaction = db.transaction(['fileSystem'], 'readonly');
            const store = transaction.objectStore('fileSystem');
            const request = store.get(path);

            request.onsuccess = (e) => {
                const file = e.target.result;
                if (file) openFile(file);
            };
        }
        hideContextMenu();
    }

    function handleMenuRename() {
        const oldPath = contextMenu.dataset.targetPath;
        const oldName = contextMenu.dataset.targetName;
        const type = contextMenu.dataset.targetType;

        const newName = prompt(`Rename ${type}`, oldName);
        if (!newName || newName === oldName) {
            hideContextMenu();
            return;
        }

        const newPath = oldPath.replace(/[^/]+$/, newName);

        const transaction = db.transaction(['fileSystem', 'fileContents'], 'readwrite');
        const fileSystemStore = transaction.objectStore('fileSystem');
        const contentsStore = transaction.objectStore('fileContents');

        const checkRequest = fileSystemStore.get(newPath);

        checkRequest.onsuccess = (e) => {
            if (e.target.result) {
                alert('A file/folder with this name already exists!');
                return;
            }

            const getRequest = fileSystemStore.get(oldPath);

            getRequest.onsuccess = (e) => {
                const item = e.target.result;
                if (!item) return;

                item.path = newPath;
                item.name = newName;
                item.modified = new Date();

                const putRequest = fileSystemStore.put(item);

                putRequest.onsuccess = () => {
                    if (type === 'file') {
                        const contentRequest = contentsStore.get(oldPath);
                        contentRequest.onsuccess = (e) => {
                            const content = e.target.result;
                            if (content) {
                                content.filePath = newPath;
                                contentsStore.put(content);
                                contentsStore.delete(oldPath);
                            }
                        };
                    }

                    loadDirectory(currentPath);
                    buildFolderTree();
                };

                putRequest.onerror = (err) => {
                    console.error('Error renaming:', err);
                };
            };
        };

        hideContextMenu();
    }

    function handleMenuCutCopy(action) {
        const path = contextMenu.dataset.targetPath;
        const name = contextMenu.dataset.targetName;
        const type = contextMenu.dataset.targetType;

        clipboard = { path, name, type };
        clipboardAction = action;

        if (action === 'cut') {
            const item = document.querySelector(`[data-path="${path}"]`);
            if (item) item.style.opacity = '0.5';
        }

        hideContextMenu();
    }

    function handleMenuPaste() {
        if (!clipboard) return;

        const sourcePath = clipboard.path;
        const sourceName = clipboard.name;
        const type = clipboard.type;
        const action = clipboardAction;

        const destPath = `${currentPath}/${sourceName}`;

        const transaction = db.transaction(['fileSystem', 'fileContents'], 'readwrite');
        const fileSystemStore = transaction.objectStore('fileSystem');
        const contentsStore = transaction.objectStore('fileContents');

        const checkRequest = fileSystemStore.get(destPath);

        checkRequest.onsuccess = (e) => {
            if (e.target.result && !confirm(`"${sourceName}" already exists. Overwrite?`)) {
                return;
            }

            const getRequest = fileSystemStore.get(sourcePath);

            getRequest.onsuccess = (e) => {
                const item = e.target.result;
                if (!item) return;

                const newItem = { ...item };
                newItem.path = destPath;
                newItem.parentPath = currentPath;
                newItem.modified = new Date();

                const putRequest = fileSystemStore.put(newItem);

                putRequest.onsuccess = () => {
                    if (type === 'file') {
                        const contentRequest = contentsStore.get(sourcePath);
                        contentRequest.onsuccess = (e) => {
                            const content = e.target.result;
                            if (content) {
                                content.filePath = destPath;
                                contentsStore.put(content);
                            }
                        };
                    }

                    if (action === 'cut') {
                        fileSystemStore.delete(sourcePath);
                        if (type === 'file') {
                            contentsStore.delete(sourcePath);
                        }
                    }

                    loadDirectory(currentPath);
                    buildFolderTree();
                };
            };
        };

        clipboard = null;
        clipboardAction = null;
        hideContextMenu();
    }

    function handleMenuDelete() {
        const path = contextMenu.dataset.targetPath;
        const type = contextMenu.dataset.targetType;

        if (!confirm(`Delete "${path.split('/').pop()}"?`)) {
            hideContextMenu();
            return;
        }

        const transaction = db.transaction(['fileSystem', 'fileContents'], 'readwrite');
        const fileSystemStore = transaction.objectStore('fileSystem');
        const contentsStore = transaction.objectStore('fileContents');

        fileSystemStore.delete(path);
        if (type === 'file') {
            contentsStore.delete(path);
        }

        transaction.oncomplete = () => {
            loadDirectory(currentPath);
            buildFolderTree();
        };

        hideContextMenu();
    }

    function handleMenuDownload() {
        const path = contextMenu.dataset.targetPath;
        const name = contextMenu.dataset.targetName;

        const transaction = db.transaction(['fileContents'], 'readonly');
        const store = transaction.objectStore('fileContents');
        const request = store.get(path);

        request.onsuccess = (e) => {
            const content = e.target.result;
            if (content) {
                downloadFile(content.content, name);
            }
        };

        hideContextMenu();
    }

    function setupEventListeners() {
        newFolderBtn.addEventListener('click', showNewFolderModal);
        uploadFilesBtn.addEventListener('click', () => fileUploadInput.click());
        fileUploadInput.addEventListener('change', handleFileUpload);

        createNewFolderBtn.addEventListener('click', createNewFolder);
        cancelNewFolderBtn.addEventListener('click', hideNewFolderModal);
        newFolderNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') createNewFolder();
        });

        document.querySelector('.close-preview').addEventListener('click', () => {
            filePreviewModal.style.display = 'none';
        });

        document.getElementById('menu-open').addEventListener('click', handleMenuOpen);
        document.getElementById('menu-rename').addEventListener('click', handleMenuRename);
        document.getElementById('menu-cut').addEventListener('click', () => handleMenuCutCopy('cut'));
        document.getElementById('menu-copy').addEventListener('click', () => handleMenuCutCopy('copy'));
        document.getElementById('menu-paste').addEventListener('click', handleMenuPaste);
        document.getElementById('menu-delete').addEventListener('click', handleMenuDelete);
        document.getElementById('menu-download').addEventListener('click', handleMenuDownload);

        globalSearch.addEventListener('input', () => {
            const searchTerm = globalSearch.value.toLowerCase();
            if (!searchTerm) {
                loadDirectory(currentPath);
                return;
            }

            const transaction = db.transaction(['fileSystem'], 'readonly');
            const store = transaction.objectStore('fileSystem');
            const request = store.getAll();

            request.onsuccess = (e) => {
                const items = e.target.result;
                const results = items.filter(item => 
                    item.name.toLowerCase().includes(searchTerm)
                );

                fileGrid.innerHTML = '';
                results.forEach(item => {
                    if (item.type === 'folder') {
                        createFolderElement(item);
                    } else {
                        createFileElement(item);
                    }
                });
            };
        });

        window.addEventListener('click', (e) => {
            if (e.target === newFolderModal) hideNewFolderModal();
            if (e.target === filePreviewModal) filePreviewModal.style.display = 'none';
        });
    }

    function setupTouchEvents() {
        if ('ontouchstart' in window) {
            let longPressTimer;
            const longPressDelay = 700;

            document.addEventListener('touchstart', (e) => {
                const target = e.target.closest('.file-item, .folder-item-grid');
                if (target) {
                    longPressTimer = setTimeout(() => {
                        showContextMenu({
                            target: target,
                            pageX: e.touches[0].pageX,
                            pageY: e.touches[0].pageY,
                            preventDefault: () => {}
                        }, target);
                    }, longPressDelay);
                }
            });

            document.addEventListener('touchend', () => {
                clearTimeout(longPressTimer);
            });

            document.addEventListener('touchmove', () => {
                clearTimeout(longPressTimer);
            });
        }
    }
});