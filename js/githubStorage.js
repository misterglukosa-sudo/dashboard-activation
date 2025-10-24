// GitHub Storage Handler
const GitHubStorage = {
    // Konfigurasi GitHub
    config: {
        owner: 'misterglukosa-sudo',
        repo: 'dashboard-activation',
        branch: 'main',
        token: null
    },

    // Initialize dengan token
    init(token) {
        this.config.token = token;
        localStorage.setItem('github_token', token);
        console.log('GitHub Storage initialized');
        return this;
    },

    // Get token dari localStorage
    getToken() {
        return localStorage.getItem('github_token') || this.config.token;
    },

    // Check if configured
    isConfigured() {
        return !!this.getToken();
    },

    // API call ke GitHub
    async apiCall(endpoint, options = {}) {
        const token = this.getToken();
        if (!token) {
            throw new Error('GitHub token belum dikonfigurasi. Silakan masukkan Personal Access Token.');
        }

        const url = `https://api.github.com${endpoint}`;
        const defaultOptions = {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            }
        };

        const response = await fetch(url, { ...defaultOptions, ...options });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new Error(`GitHub API Error (${response.status}): ${errorData.message}`);
        }

        return response.json();
    },

    // Upload file ke GitHub
    async uploadFile(fileName, content, commitMessage = 'Upload data file') {
        try {
            // Encode content to base64
            const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2))));
            
            // Check if file exists
            let sha = null;
            try {
                const existingFile = await this.apiCall(
                    `/repos/${this.config.owner}/${this.config.repo}/contents/uploads/${fileName}`
                );
                sha = existingFile.sha;
            } catch (error) {
                // File doesn't exist, that's okay
                console.log('Creating new file on GitHub');
            }

            const payload = {
                message: commitMessage,
                content: contentBase64,
                branch: this.config.branch
            };

            if (sha) {
                payload.sha = sha;
            }

            const result = await this.apiCall(
                `/repos/${this.config.owner}/${this.config.repo}/contents/uploads/${fileName}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                }
            );

            console.log('File berhasil diupload ke GitHub:', result.content.html_url);
            return {
                ...result,
                html_url: result.content.html_url
            };
        } catch (error) {
            console.error('Error uploading to GitHub:', error);
            throw new Error(`Gagal upload ke GitHub: ${error.message}`);
        }
    },

    // Download file dari GitHub
    async downloadFile(fileName) {
        try {
            const file = await this.apiCall(
                `/repos/${this.config.owner}/${this.config.repo}/contents/uploads/${fileName}?ref=${this.config.branch}`
            );

            // Decode base64 content
            const content = JSON.parse(decodeURIComponent(escape(atob(file.content))));
            return content;
        } catch (error) {
            console.error('Error downloading from GitHub:', error);
            throw new Error(`Gagal download dari GitHub: ${error.message}`);
        }
    },

    // Get list of files dari uploads folder
    async listFiles() {
        try {
            const response = await this.apiCall(
                `/repos/${this.config.owner}/${this.config.repo}/contents/uploads?ref=${this.config.branch}`
            );
            
            return response
                .filter(item => item.type === 'file' && item.name.endsWith('.json'))
                .map(file => ({
                    name: file.name,
                    size: file.size,
                    download_url: file.download_url,
                    html_url: file.html_url,
                    sha: file.sha,
                    last_modified: new Date(file.name.split('_').pop().replace('.json', '')).toLocaleString('id-ID')
                }));
        } catch (error) {
            // Jika folder uploads belum ada, return array kosong
            if (error.message.includes('404')) {
                console.log('Uploads folder not found, returning empty list');
                return [];
            }
            throw error;
        }
    },

    // Delete file dari GitHub
    async deleteFile(fileName, commitMessage = 'Delete data file') {
        try {
            // Get file SHA first
            const file = await this.apiCall(
                `/repos/${this.config.owner}/${this.config.repo}/contents/uploads/${fileName}?ref=${this.config.branch}`
            );

            const result = await this.apiCall(
                `/repos/${this.config.owner}/${this.config.repo}/contents/uploads/${fileName}`,
                {
                    method: 'DELETE',
                    body: JSON.stringify({
                        message: commitMessage,
                        sha: file.sha,
                        branch: this.config.branch
                    })
                }
            );

            console.log('File berhasil dihapus dari GitHub');
            return result;
        } catch (error) {
            console.error('Error deleting from GitHub:', error);
            throw new Error(`Gagal hapus dari GitHub: ${error.message}`);
        }
    },

    // Check repository accessibility
    async checkAccess() {
        try {
            const repo = await this.apiCall(
                `/repos/${this.config.owner}/${this.config.repo}`
            );
            return {
                accessible: true,
                repo: repo.full_name,
                default_branch: repo.default_branch,
                permissions: repo.permissions
            };
        } catch (error) {
            throw new Error(`Tidak dapat mengakses repository: ${error.message}`);
        }
    },

    // Create uploads folder jika belum ada
    async ensureUploadsFolder() {
        try {
            await this.apiCall(
                `/repos/${this.config.owner}/${this.config.repo}/contents/uploads`
            );
            // Folder exists
            return true;
        } catch (error) {
            if (error.message.includes('404')) {
                console.log('Uploads folder does not exist, will be created with first upload');
                return false;
            }
            throw error;
        }
    },

    // Sync local files dengan GitHub
    async syncWithGitHub() {
        try {
            if (!this.isConfigured()) {
                return JSON.parse(localStorage.getItem('savedFiles') || '[]');
            }

            const githubFiles = await this.listFiles();
            const localFiles = JSON.parse(localStorage.getItem('savedFiles') || '[]');
            
            console.log(`Found ${githubFiles.length} files on GitHub, ${localFiles.length} files locally`);
            
            // Download files dari GitHub yang belum ada di local
            for (const githubFile of githubFiles) {
                const localFileExists = localFiles.some(localFile => 
                    localFile.name === githubFile.name
                );
                
                if (!localFileExists) {
                    try {
                        console.log(`Downloading ${githubFile.name} from GitHub...`);
                        const content = await this.downloadFile(githubFile.name);
                        localFiles.push({
                            name: githubFile.name,
                            data: content,
                            date: githubFile.last_modified,
                            size: content.rawRows ? content.rawRows.length : 0,
                            source: 'github',
                            githubUrl: githubFile.html_url
                        });
                    } catch (error) {
                        console.error(`Error downloading ${githubFile.name}:`, error);
                    }
                }
            }
            
            localStorage.setItem('savedFiles', JSON.stringify(localFiles));
            console.log('Sync completed successfully');
            return localFiles;
        } catch (error) {
            console.error('Error syncing with GitHub:', error);
            throw error;
        }
    }
};