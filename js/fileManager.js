// File Manager - Handles file storage and retrieval dengan GitHub integration
const FileManager = {
    // Konfigurasi storage
    useGitHub: false,

    // Initialize
    init() {
        this.useGitHub = GitHubStorage.isConfigured();
        console.log('File Manager initialized, GitHub:', this.useGitHub);
        return this;
    },

    // Set GitHub token
    setGitHubToken(token) {
        GitHubStorage.init(token);
        this.useGitHub = true;
        localStorage.setItem('use_github_storage', 'true');
        console.log('GitHub token set');
    },

    // Save file data ke localStorage dan/atau GitHub
    async saveFileData(fileName, fileData) {
        try {
            // Validasi data
            const validation = DataProcessor.validateData(fileData.rawRows);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const safeFileName = `${fileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.json`;
            
            let savedFiles = JSON.parse(localStorage.getItem('savedFiles') || '[]');
            
            const fileInfo = {
                name: safeFileName,
                data: fileData,
                date: new Date().toISOString(),
                size: fileData.rawRows ? fileData.rawRows.length : 0,
                source: 'local',
                recordCount: fileData.rawRows.length
            };

            // Simpan ke localStorage
            const existingIndex = savedFiles.findIndex(file => file.name === safeFileName);
            if (existingIndex !== -1) {
                savedFiles[existingIndex] = fileInfo;
            } else {
                savedFiles.push(fileInfo);
            }
            localStorage.setItem('savedFiles', JSON.stringify(savedFiles));

            // Simpan ke GitHub jika diaktifkan
            if (this.useGitHub) {
                try {
                    const githubResult = await GitHubStorage.uploadFile(
                        safeFileName, 
                        fileData, 
                        `Upload data: ${fileName} (${fileData.rawRows.length} records)`
                    );
                    
                    fileInfo.source = 'both';
                    fileInfo.githubUrl = githubResult.html_url;
                    fileInfo.syncedAt = new Date().toISOString();
                    
                    // Update local storage dengan info GitHub
                    if (existingIndex !== -1) {
                        savedFiles[existingIndex] = fileInfo;
                    } else {
                        savedFiles.push(fileInfo);
                    }
                    localStorage.setItem('savedFiles', JSON.stringify(savedFiles));
                    
                    console.log('File successfully saved to GitHub:', githubResult.html_url);
                } catch (githubError) {
                    console.error('Gagal menyimpan ke GitHub:', githubError);
                    // Tetap lanjut dengan penyimpanan lokal saja
                }
            }

            await this.loadSavedFiles();
            return fileInfo;
        } catch (error) {
            console.error('Error saving file:', error);
            throw error;
        }
    },

    // Load all saved files
    async loadSavedFiles() {
        try {
            // Sync dengan GitHub jika diaktifkan
            if (this.useGitHub) {
                try {
                    await GitHubStorage.syncWithGitHub();
                } catch (syncError) {
                    console.error('Sync with GitHub failed:', syncError);
                }
            }

            const savedFiles = JSON.parse(localStorage.getItem('savedFiles') || '[]');
            const savedFilesList = document.getElementById('savedFilesList');
            const noFilesMessage = document.getElementById('noFilesMessage');
            
            if (savedFiles.length === 0) {
                noFilesMessage.style.display = 'block';
                savedFilesList.innerHTML = '<p id="noFilesMessage">Belum ada file yang disimpan.</p>';
                return;
            }
            
            noFilesMessage.style.display = 'none';
            
            // Sort files by date (newest first)
            savedFiles.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            let html = '';
            savedFiles.forEach((file, index) => {
                const date = new Date(file.date).toLocaleString('id-ID');
                const size = file.size || (file.data.rawRows ? file.data.rawRows.length : 0);
                const sourceBadge = file.source === 'github' ? 
                    '<span class="github-badge">GitHub</span>' : 
                    file.source === 'both' ? 
                    '<span class="github-badge">GitHub+Local</span>' : 
                    '<span class="local-badge">Local</span>';
                
                html += `
                    <div class="file-item">
                        <div class="file-info">
                            <div class="file-name">
                                ${this.escapeHtml(file.name)} 
                                ${sourceBadge}
                            </div>
                            <div class="file-details">
                                <span class="file-date">Diunggah: ${date}</span>
                                <span class="file-size"> | Records: ${size}</span>
                                ${file.githubUrl ? `<span> | <a href="${file.githubUrl}" target="_blank" style="color: #0366d6;">View on GitHub</a></span>` : ''}
                            </div>
                        </div>
                        <div class="file-actions">
                            <button class="file-action-btn load-btn" onclick="FileManager.loadFileData(${index})">Load</button>
                            <button class="file-action-btn download-btn" onclick="FileManager.downloadFile(${index})">Download</button>
                            <button class="file-action-btn delete-btn" onclick="FileManager.deleteFile(${index})">Hapus</button>
                        </div>
                    </div>
                `;
            });
            
            savedFilesList.innerHTML = html;
        } catch (error) {
            console.error('Error loading files:', error);
        }
    },

    // Load specific file data
    async loadFileData(index) {
        try {
            const savedFiles = JSON.parse(localStorage.getItem('savedFiles') || '[]');
            
            if (index < 0 || index >= savedFiles.length) {
                alert('File tidak ditemukan.');
                return;
            }
            
            const file = savedFiles[index];
            let fileData = file.data;

            // Jika file dari GitHub, download ulang untuk memastikan data terbaru
            if ((file.source === 'github' || file.source === 'both') && this.useGitHub) {
                try {
                    console.log(`Downloading latest version of ${file.name} from GitHub...`);
                    fileData = await GitHubStorage.downloadFile(file.name);
                    
                    // Update local cache dengan data terbaru
                    file.data = fileData;
                    savedFiles[index] = file;
                    localStorage.setItem('savedFiles', JSON.stringify(savedFiles));
                } catch (error) {
                    console.error('Gagal download dari GitHub, menggunakan data lokal:', error);
                }
            }

            // Process the loaded data
            window._RAW_ROWS = fileData.rawRows;
            const {bySub, subs, sgsUsers, sdsUsers, retailUsers} = DataProcessor.aggregate(fileData.rawRows);
            
            window._BY_SUB = bySub;
            window._SUBS = subs;
            window._SGS_USERS = sgsUsers;
            window._SDS_USERS = sdsUsers;
            window._RETAIL_USERS = retailUsers;
            
            // Update UI
            document.getElementById('uploadInfo').innerHTML = 
                `<div class="upload-success">
                    File "${file.name}" berhasil dimuat ✅ 
                    (${fileData.rawRows.length} records)
                    ${file.source === 'both' ? '<br><small>✅ Data tersinkronisasi dengan GitHub</small>' : ''}
                </div>`;
            document.getElementById('viewDashboardBtn').disabled = false;
            
            // Render dashboard
            UIRenderer.renderASC(bySub);
            UIRenderer.populateGlobalFilter(subs);
            UIRenderer.applyFilters();
            
            // Show dashboard
            app.showPage(3);
        } catch (error) {
            alert('Error loading file: ' + error.message);
            console.error('Error loading file:', error);
        }
    },

    // Delete file
    async deleteFile(index) {
        if (!confirm('Apakah Anda yakin ingin menghapus file ini?')) {
            return;
        }
        
        try {
            const savedFiles = JSON.parse(localStorage.getItem('savedFiles') || '[]');
            
            if (index < 0 || index >= savedFiles.length) {
                alert('File tidak ditemukan.');
                return;
            }
            
            const file = savedFiles[index];
            
            // Hapus dari GitHub jika file ada di GitHub
            if ((file.source === 'github' || file.source === 'both') && this.useGitHub) {
                try {
                    await GitHubStorage.deleteFile(file.name, `Delete: ${file.name}`);
                    console.log('File deleted from GitHub');
                } catch (error) {
                    console.error('Gagal hapus dari GitHub:', error);
                    // Tetap lanjut hapus dari local
                }
            }
            
            // Hapus dari localStorage
            savedFiles.splice(index, 1);
            localStorage.setItem('savedFiles', JSON.stringify(savedFiles));
            
            await this.loadSavedFiles();
            alert('File berhasil dihapus.');
        } catch (error) {
            alert('Error deleting file: ' + error.message);
            console.error('Error deleting file:', error);
        }
    },

    // Download file as JSON
    downloadFile(index) {
        const savedFiles = JSON.parse(localStorage.getItem('savedFiles') || '[]');
        
        if (index < 0 || index >= savedFiles.length) {
            alert('File tidak ditemukan.');
            return;
        }
        
        const file = savedFiles[index];
        const dataStr = JSON.stringify(file.data, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    // Handle file upload
    async handleFileUpload(files) {
        return new Promise((resolve, reject) => {
            if (!files.length) {
                reject(new Error('Tidak ada file yang dipilih.'));
                return;
            }

            let allRows = [];
            const readPromises = files.map(f => 
                new Promise((res, rej) => {
                    const reader = new FileReader();
                    reader.onload = ev => {
                        try {
                            const wb = XLSX.read(ev.target.result, {type: 'array'});
                            const ws = wb.Sheets[wb.SheetNames[0]];
                            const rows = XLSX.utils.sheet_to_json(ws, {defval: ''});
                            allRows = allRows.concat(rows);
                            res();
                        } catch (error) {
                            rej(new Error(`Gagal membaca file ${f.name}: ${error.message}`));
                        }
                    };
                    reader.onerror = () => rej(new Error(`Gagal membaca file ${f.name}`));
                    reader.readAsArrayBuffer(f);
                })
            );

            Promise.all(readPromises)
                .then(() => {
                    if (allRows.length === 0) {
                        reject(new Error('Tidak ada data yang ditemukan dalam file.'));
                        return;
                    }
                    resolve(allRows);
                })
                .catch(error => {
                    reject(error);
                });
        });
    },

    // Clear all files
    async clearAllFiles() {
        if (!confirm('Apakah Anda yakin ingin menghapus SEMUA file? Tindakan ini tidak dapat dibatalkan.')) {
            return;
        }

        try {
            const savedFiles = JSON.parse(localStorage.getItem('savedFiles') || '[]');
            
            // Hapus dari GitHub jika diaktifkan
            if (this.useGitHub) {
                for (const file of savedFiles) {
                    if (file.source === 'github' || file.source === 'both') {
                        try {
                            await GitHubStorage.deleteFile(file.name, 'Bulk delete all files');
                        } catch (error) {
                            console.error(`Gagal hapus ${file.name} dari GitHub:`, error);
                        }
                    }
                }
            }
            
            // Hapus dari localStorage
            localStorage.removeItem('savedFiles');
            await this.loadSavedFiles();
            alert('Semua file berhasil dihapus.');
        } catch (error) {
            alert('Error clearing files: ' + error.message);
            console.error('Error clearing files:', error);
        }
    },

    // Utility function
    escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/[&<>"']/g, (m) => 
            ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    }
};