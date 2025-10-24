// UI Renderer - Handles all UI rendering
const UIRenderer = {
    // Render ASC table
    renderASC(bySub) {
        let html = '<table><thead><tr><th>CLUSTER</th><th>ASC</th><th>TARGET</th><th>SGS</th><th>SDS</th><th>RETAIL</th><th>TOTAL</th><th>ACH%</th></tr></thead><tbody>';
        let sumSgs = 0, sumSds = 0, sumRetail = 0;
        
        Object.keys(DataProcessor.TARGETS).forEach(k => {
            const t = DataProcessor.TARGETS[k].t;
            const a = DataProcessor.TARGETS[k].asc;
            const c = bySub[k] || {SGS: 0, SDS: 0, RETAIL: 0};
            const total = (c.SGS || 0) + (c.SDS || 0) + (c.RETAIL || 0);
            const ach = (t > 0) ? (total / t) : 0;
            
            sumSgs += c.SGS;
            sumSds += c.SDS;
            sumRetail += c.RETAIL;
            
            html += `<tr>
                <td>${k}</td>
                <td class="asc">${a}</td>
                <td>${DataProcessor.fmt(t)}</td>
                <td>${DataProcessor.fmt(c.SGS)}</td>
                <td>${DataProcessor.fmt(c.SDS)}</td>
                <td>${DataProcessor.fmt(c.RETAIL)}</td>
                <td>${DataProcessor.fmt(total)}</td>
                <td style="background:${DataProcessor.colorByAch(ach)}">${DataProcessor.fmtPerc(ach)}</td>
            </tr>`;
        });
        
        const grand = sumSgs + sumSds + sumRetail;
        const achY = (2713 > 0) ? (grand / 2713) : 0;
        
        html += `</tbody><tfoot><tr class="footer-row">
            <td colspan="2">TOTAL</td>
            <td>${DataProcessor.fmt(2713)}</td>
            <td>${DataProcessor.fmt(sumSgs)}</td>
            <td>${DataProcessor.fmt(sumSds)}</td>
            <td>${DataProcessor.fmt(sumRetail)}</td>
            <td>${DataProcessor.fmt(grand)}</td>
            <td>${DataProcessor.fmtPerc(achY)}</td>
        </tr></tfoot></table>`;
        
        document.getElementById('ascTableWrap').innerHTML = html;
    },

    // Render user table with filters
    renderUserTableFiltered(users, wrapId, filterSub, filterGroup) {
        const wrap = document.getElementById(wrapId);
        const keys = Object.keys(users).sort();
        let html = '<table><thead><tr><th>SUB CLUSTER</th><th>NIK</th><th>NAMA</th><th>TOTAL</th></tr></thead><tbody>';
        let total = 0;
        
        keys.forEach(k => {
            const u = users[k];
            
            // Apply SUB CLUSTER filter
            if (filterSub !== 'ALL' && u.sub !== filterSub) return;
            
            // Apply Group filter
            if (filterGroup !== 'ALL') {
                if (wrapId === 'sgsWrap' && filterGroup !== 'SGS') return;
                if (wrapId === 'sdsWrap' && filterGroup !== 'SDS') return;
                if (wrapId === 'retailWrap' && filterGroup !== 'RETAIL') return;
            }
            
            total += u.total;
            
            if (wrapId === 'retailWrap') {
                html += `<tr class="retail-row clickable" data-nik="${this.escapeHtml(u.nik)}" data-name="${this.escapeHtml(u.name)}">
                    <td>${u.sub}</td>
                    <td>${u.nik}</td>
                    <td class="asc">${u.name}</td>
                    <td>${DataProcessor.fmt(u.total)}</td>
                </tr>`;
            } else {
                html += `<tr>
                    <td>${u.sub}</td>
                    <td>${u.nik}</td>
                    <td class="asc">${u.name}</td>
                    <td>${DataProcessor.fmt(u.total)}</td>
                </tr>`;
            }
        });
        
        html += `<tfoot><tr class="footer-row"><td colspan="3">TOTAL</td><td>${DataProcessor.fmt(total)}</td></tr></tfoot></table>`;
        wrap.innerHTML = html;
        
        if (wrapId === 'retailWrap') {
            document.querySelectorAll('#retailWrap .retail-row').forEach(row => {
                row.addEventListener('click', () => {
                    this.openRetailDetailModal(row.dataset.nik, row.dataset.name);
                });
            });
        }
    },

    // Populate global filter
    populateGlobalFilter(subs) {
        const sel = document.getElementById('globalFilter');
        sel.innerHTML = '<option value="ALL">All SUB CLUSTER</option>' + 
            subs.map(s => `<option value="${s}">${s}</option>`).join('');
        
        sel.onchange = this.applyFilters;
        document.getElementById('groupFilter').onchange = this.applyFilters;
    },

    // Apply filters
    applyFilters() {
        const subFilter = document.getElementById('globalFilter').value;
        const groupFilter = document.getElementById('groupFilter').value;
        
        UIRenderer.renderUserTableFiltered(window._SGS_USERS, 'sgsWrap', subFilter, groupFilter);
        UIRenderer.renderUserTableFiltered(window._SDS_USERS, 'sdsWrap', subFilter, groupFilter);
        UIRenderer.renderUserTableFiltered(window._RETAIL_USERS, 'retailWrap', subFilter, groupFilter);
    },

    // Modal functions
    openRetailDetailModal(nikSfa, namaSfa) {
        const rows = (window._RAW_ROWS || []).filter(r => {
            const rNik = (DataProcessor.getCellField(r, ['NIK SFA', 'NIK_SFA', 'NIK']) || '').toString().trim();
            const rNama = (DataProcessor.getCellField(r, ['NAMA SFA', 'NAMA_SFA', 'NAMA']) || '').toString().trim();
            return rNik === nikSfa && rNama === namaSfa;
        });
        
        const modalContent = document.getElementById('modalContent');
        document.getElementById('modalTitle').textContent = `Detail Retail — ${namaSfa} (${nikSfa})`;
        
        if (!rows.length) {
            modalContent.innerHTML = '<div>No detail data found.</div>';
            this.showModal();
            return;
        }
        
        let html = '<table><thead><tr><th>PERFORMED USER LOGIN ID</th><th>PERFORMED USER NAME</th><th>CUSTOMER MDN</th><th>CUSTOMER ICCID</th></tr></thead><tbody>';
        
        rows.forEach(r => {
            const pid = this.escapeHtml(DataProcessor.getCellField(r, ['PERFORMED USER LOGIN ID']) || '');
            const pname = this.escapeHtml(DataProcessor.getCellField(r, ['PERFORMED USER NAME']) || '');
            const mdn = this.escapeHtml(DataProcessor.getCellField(r, ['CUSTOMER MDN']) || '');
            const iccid = this.escapeHtml(DataProcessor.getCellField(r, ['CUSTOMER ICCID']) || '');
            
            html += `<tr>
                <td>${pid}</td>
                <td class="asc">${pname}</td>
                <td>${mdn}</td>
                <td>${iccid}</td>
            </tr>`;
        });
        
        html += '</tbody></table>';
        modalContent.innerHTML = html;
        this.showModal();
    },

    showModal() {
        document.getElementById('modalBackdrop').classList.add('active');
    },

    hideModal() {
        document.getElementById('modalBackdrop').classList.remove('active');
    },

    closeModal(e) {
        if (e.target.id === 'modalBackdrop') this.hideModal();
    },

    // Utility function
    escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/[&<>"']/g, (m) => 
            ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    }
};