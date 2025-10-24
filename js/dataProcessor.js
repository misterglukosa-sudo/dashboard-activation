// Data Processor - Handles data aggregation and processing
const DataProcessor = {
    // Target mapping
    TARGETS: {
        '1.3': {asc: 'DHORA ARSIANTY PERMATA', t: 430},
        '1.4': {asc: 'MUHAMMAD YAZID ULWAN', t: 370},
        '2.1': {asc: 'Y. B. PURWANTO NUGROHO', t: 320},
        '2.2': {asc: 'DONNI KURNIAWAN', t: 500},
        '2.3': {asc: 'EDY SUMARNO', t: 350},
        '3.3': {asc: 'BRAINY BRILLIANT', t: 270},
        '7.1': {asc: 'HERIYANTO', t: 113},
        '7.2': {asc: 'MUHAMMAD LUTHFI', t: 60},
        '8.1': {asc: 'JERRY SOKHA', t: 150},
        '8.4': {asc: 'MH VARGA FRYWENDA', t: 150}
    },

    // Aggregate data from rows
    aggregate(rows) {
        const bySub = {}, sgsUsers = {}, sdsUsers = {}, retailUsers = {}, subsSet = new Set();
        
        rows.forEach(r => {
            const sub = (this.getCellField(r, ['SUB CLUSTER', 'SUB_CLUSTER', 'CLUSTER']) || '').toString().trim();
            const role = (this.getCellField(r, ['PERFORMED USER ROLE', 'PERFORMED_USER_ROLE']) || '').toString().trim().toUpperCase();
            const nik = (this.getCellField(r, ['PERFORMED USER LOGIN ID', 'PERFORMED_USER_LOGIN_ID', 'PERFORMED_LOGIN']) || '').toString().trim();
            const name = (this.getCellField(r, ['PERFORMED USER NAME', 'PERFORMED_USER_NAME', 'NAMA']) || '').toString().trim();
            const nikSfa = (this.getCellField(r, ['NIK SFA', 'NIK_SFA', 'NIK']) || '').toString().trim();
            const namaSfa = (this.getCellField(r, ['NAMA SFA', 'NAMA_SFA', 'NAMA']) || '').toString().trim();
            
            if (!sub) return;
            
            subsSet.add(sub);
            if (!bySub[sub]) bySub[sub] = {SGS: 0, SDS: 0, RETAIL: 0};
            
            if (role === 'SGS') {
                bySub[sub].SGS++;
                const key = sub + nik + name;
                sgsUsers[key] = {
                    sub, nik, name,
                    total: (sgsUsers[key]?.total || 0) + 1
                };
            } else if (role === 'SDS') {
                bySub[sub].SDS++;
                const key = sub + nik + name;
                sdsUsers[key] = {
                    sub, nik, name,
                    total: (sdsUsers[key]?.total || 0) + 1
                };
            } else if (role.includes('RETAIL')) {
                if (!nikSfa && !namaSfa) return;
                bySub[sub].RETAIL++;
                const key = sub + nikSfa + namaSfa;
                retailUsers[key] = {
                    sub, nik: nikSfa, name: namaSfa,
                    total: (retailUsers[key]?.total || 0) + 1
                };
            }
        });
        
        return {
            bySub,
            subs: Array.from(subsSet).sort(),
            sgsUsers,
            sdsUsers,
            retailUsers
        };
    },

    // Get cell field with multiple possible names
    getCellField(row, variants) {
        for (const k of variants) {
            if (row[k] !== undefined && row[k] !== '') return row[k];
            const up = Object.keys(row).find(x => 
                x.toUpperCase().replace(/\s+/g, '_') === k.toUpperCase().replace(/\s+/g, '_')
            );
            if (up) return row[up];
        }
        return '';
    },

    // Format number
    fmt(n) {
        return (n === null || n === undefined || n === '') ? '-' : Number(n).toLocaleString('id-ID');
    },

    // Format percentage
    fmtPerc(v) {
        return isNaN(v) ? '-' : (v * 100).toFixed(2) + '%';
    },

    // Get color by achievement
    colorByAch(p) {
        if (p < 0.8) return '#f8bbd0';
        else if (p < 1) return '#fff9c4';
        else return '#c8e6c9';
    },

    // Validate data structure
    validateData(rows) {
        if (!Array.isArray(rows)) {
            return { valid: false, error: 'Data harus berupa array' };
        }
        
        if (rows.length === 0) {
            return { valid: false, error: 'Data kosong' };
        }

        const firstRow = rows[0];
        const requiredFields = ['SUB CLUSTER', 'PERFORMED USER ROLE'];
        const missingFields = requiredFields.filter(field => 
            !this.getCellField(firstRow, [field])
        );

        if (missingFields.length > 0) {
            return { 
                valid: false, 
                error: `Field yang diperlukan tidak ditemukan: ${missingFields.join(', ')}` 
            };
        }

        return { valid: true, recordCount: rows.length };
    }
};