// Main Application Controller dengan GitHub Integration
const app = {
    // Initialize application
    init() {
        this.bindEvents();
        this.showPage(2);
        FileManager.init().loadSavedFiles();
        this.checkGitHubStatus();
        this.loadGitHubTokenFromStorage();
    },

    // Bind event listeners
    bindEvents() {
        // File input change
        document.getElementById('fileInput').addEventListener('change', this.handleFileInput.bind(this));
        
        // View dashboard button
        document.getElementById('viewDashboardBtn').addEventListener('click', this.viewDashboard.bind(this));
        
        // Detail button
        document.getElementById('detailBtn').addEventListener('click', () => this.showPage(4));
        
        // GitHub token buttons
        document.getElementById('saveTokenBtn').addEventListener('click', this.saveGitHubToken.bind(this));
        document.getElementById('clearTokenBtn').addEventListener('click', this.clearGitHubToken.bind(this));
        
        // Enter key untuk token input
        document.getElementById('githubToken').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveGitHubToken();
            }
        });
    },

    // Load GitHub token from storage
    loadGitHubTokenFromStorage() {
        const token = GitHubStorage.getToken();
        if (token) {
            // Show masked token in input
            document.getElementById('githubToken').value = '••••••••' + token.slice(-4);
        }
    },

    // Handle file input
    async handleFileInput(e) {
        const files = [...e.target.files];
        
        if (!files.length) return;
        
        // Reset file input
        e.target.value = '';
        
        document.getElementById('uploadInfo').innerHTML = '<div>Memproses file...</div>';
        
        try {
            const allRows = await FileManager.handleFileUpload(files);
            
            window._RAW_ROWS = allRows;
            const {bySub, subs, sgsUsers, sdsUsers, retailUsers} = DataProcessor.aggregate(allRows);
            
            window._BY_SUB = bySub;
            window._SUBS = subs;
            window._SGS_USERS = sgsUsers;
            window._SDS_USERS = sdsUsers;
            window._RETAIL_USERS = retailUsers;
            
            // Save the uploaded file data
            const fileName = files.length === 1 ? 
                files[0].name : 
                `${files.length} files - ${new Date().toLocaleString('id-ID')}`;
            
            const fileInfo = await FileManager.saveFileData(fileName, {
                rawRows: allRows,
                bySub: bySub,
                subs: subs,
                sgsUsers: sgsUsers,
                sdsUsers: sdsUsers,
                retailUsers: retailUsers
            });

            let successMessage = `
                <div class="upload-success">
                    ${files.length} file berhasil diunggah dan diproses ✅ (${allRows.length} records)<br>
                    <small>Disimpan: ${fileInfo.source === 'both' ? 'GitHub & Local Storage' : 'Local Storage'}</small>
            `;

            if (fileInfo.githubUrl) {
                successMessage += `<br><small><a href="${fileInfo.githubUrl}" target="_blank" style="color: #0366d6;">📁 Lihat di GitHub</a></small>`;
            }

            successMessage += `</div>`;

            document.getElementById('uploadInfo').innerHTML = successMessage;
            
            document.getElementById('viewDashboardBtn').disabled = false;
            
            UIRenderer.renderASC(bySub);
            UIRenderer.populateGlobalFilter(subs);
            UIRenderer.applyFilters();
            this.showPage(3);
        } catch (error) {
            document.getElementById('uploadInfo').innerHTML = 
                `<div class="upload-error">❌ Error: ${error.message}</div>`;
            console.error('File upload error:', error);
        }
    },

    // View dashboard
    viewDashboard() {
        if (!window._BY_SUB || Object.keys(window._BY_SUB).length === 0) {
            alert('Belum ada data. Pastikan format Excel sesuai.');
            return;
        }
        
        UIRenderer.renderASC(window._BY_SUB);
        UIRenderer.populateGlobalFilter(window._SUBS);
        UIRenderer.applyFilters();
        this.showPage(3);
    },

    // GitHub token management
    async saveGitHubToken() {
        const tokenInput = document.getElementById('githubToken');
        const token = tokenInput.value.trim();
        
        if (!token) {
            alert('Masukkan GitHub Personal Access Token');
            return;
        }

        // Check if token is masked (already saved)
        if (token.startsWith('••••••••')) {
            alert('Token sudah disimpan. Untuk mengubah token, hapus dulu token yang ada.');
            return;
        }

        try {
            // Test the token
            document.getElementById('githubStatus').innerHTML = 
                '<div class="sync-status">🔄 Memverifikasi token GitHub...</div>';
            
            FileManager.setGitHubToken(token);
            
            // Test connection
            await GitHubStorage.checkAccess();
            
            // Mask the token in input
            tokenInput.value = '••••••••' + token.slice(-4);
            
            await this.checkGitHubStatus();
            await FileManager.loadSavedFiles();
            
            alert('✅ GitHub token berhasil disimpan dan terverifikasi!');
        } catch (error) {
            alert('❌ Error: ' + error.message);
            console.error('GitHub token error:', error);
        }
    },

    clearGitHubToken() {
        if (!confirm('Hapus GitHub token? File yang sudah diupload ke GitHub akan tetap tersimpan di repository.')) {
            return;
        }
        
        localStorage.removeItem('github_token');
        localStorage.removeItem('use_github_storage');
        FileManager.useGitHub = false;
        document.getElementById('githubToken').value = '';
        this.checkGitHubStatus();
        FileManager.loadSavedFiles();
        alert('GitHub token telah dihapus.');
    },

    async checkGitHubStatus() {
        const statusEl = document.getElementById('githubStatus');
        const token = GitHubStorage.getToken();

        if (!token) {
            statusEl.innerHTML = `
                <div class="sync-warning">
                    ⚠️ GitHub storage belum dikonfigurasi<br>
                    <small>File akan disimpan hanya di browser lokal</small>
                </div>
            `;
            return;
        }

        try {
            statusEl.innerHTML = '<div class="sync-status">🔄 Mengecek koneksi GitHub...</div>';
            const accessInfo = await GitHubStorage.checkAccess();
            statusEl.innerHTML = `
                <div class="sync-success">
                    ✅ Terhubung ke GitHub<br>
                    <small>Repository: ${accessInfo.repo} | Branch: ${accessInfo.default_branch}</small>
                </div>
            `;
        } catch (error) {
            statusEl.innerHTML = `
                <div class="sync-error">
                    ❌ Gagal terhubung ke GitHub: ${error.message}<br>
                    <small>Periksa token dan koneksi internet</small>
                </div>
            `;
        }
    },

    // Show page
    showPage(n) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page' + n).classList.add('active');
        
        // Scroll to top ketika ganti page
        window.scrollTo(0, 0);
    }
};

// Initialize app when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    app.init();
});

// Export untuk akses global
window.app = app;
window.FileManager = FileManager;
window.UIRenderer = UIRenderer;
window.DataProcessor = DataProcessor;
window.GitHubStorage = GitHubStorage;