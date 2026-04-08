// ========== KONFIGURASI ==========
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwwAv516IqJPrkPNf0R0iEe_XSo1rFPCUfD-EnW6Vh4aiqxZUwnYbPcYyUAvOLYCYVJ9Q/exec';

// ========== JADWAL MATA KULIAH (ATURAN BARU) ==========
// Rumus:
// - Buka akses: mulai - 25 menit
// - Hadir: (mulai - 15 menit) sampai (mulai + 10 menit)
// - Terlambat: (mulai + 10 menit) sampai (mulai + 20 menit)
// - Tutup: lebih dari (mulai + 20 menit)

const JADWAL = {
    'Teknologi dan Rekayasa dalam Pembelajaran Fisika': {
        mulai: 13 * 60 + 0,      // 13:00 = 780 menit
        buka: 12 * 60 + 35,      // 12:35 = 755 menit
        hadirSampai: 13 * 60 + 10,   // 13:10 = 790 menit
        telatSampai: 13 * 60 + 20,   // 13:20 = 800 menit
        nama: "Teknologi dan Rekayasa dalam Pembelajaran Fisika"
    },
    'Listrik Magnet': {
        mulai: 14 * 60 + 25,     // 14:25 = 865 menit
        buka: 14 * 60 + 0,      // 14:00 = 840 menit
        hadirSampai: 14 * 60 + 35,    // 14:35 = 875 menit
        telatSampai: 14 * 60 + 45,   // 14:45 = 885 menit
        nama: "Listrik Magnet"
    },
    'Gelombang Optik': {
        mulai: 13 * 60 + 0,      // 13:00 = 780 menit
        buka: 12 * 60 + 35,      // 12:35 = 755 menit
        hadirSampai: 13 * 60 + 10,   // 13:10 = 790 menit
        telatSampai: 13 * 60 + 20,   // 13:20 = 800 menit
        nama: "Gelombang Optik"
    },
    'Strategi Pembelajaran': {
        mulai: 9 * 60 + 30,      // 09:30 = 570 menit
        buka: 9 * 60 + 5,        // 09:05 = 545 menit
        hadirSampai: 9 * 60 + 40,    // 09:40 = 580 menit
        telatSampai: 9 * 60 + 50,    // 09:50 = 590 menit
        nama: "Strategi Pembelajaran"
    }
};

// ========== VARIABEL GLOBAL ==========
let fotoData = null;
let videoStream = null;
let selectedMataKuliah = '';

// ========== ELEMEN DOM ==========
const welcomePage = document.getElementById('welcomePage');
const presensiPage = document.getElementById('presensiPage');
const selectedMatkulSpan = document.getElementById('selectedMatkul');
const nimInput = document.getElementById('nim');
const namaInput = document.getElementById('nama');
const ambilFotoBtn = document.getElementById('ambilFotoBtn');
const submitBtn = document.getElementById('submitBtn');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const photoResultDiv = document.getElementById('photoResult');
const statusDiv = document.getElementById('statusMessage');
const backBtn = document.getElementById('backBtn');
const successModal = document.getElementById('successModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const warningModal = document.getElementById('warningModal');
const closeWarningBtn = document.getElementById('closeWarningBtn');
const warningMessage = document.getElementById('warningMessage');

// ========== FUNGSI BANTUAN ==========
function showStatus(msg, type) {
    if (!statusDiv) return;
    statusDiv.textContent = msg;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    setTimeout(() => { if (statusDiv) statusDiv.style.display = 'none'; }, 4000);
}

function showWarningModal(msg) {
    if (warningMessage) warningMessage.textContent = msg;
    if (warningModal) warningModal.style.display = 'flex';
}

function showSuccessModal(nim, nama, matkul, status) {
    const modalDetail = document.getElementById('modalDetail');
    const now = new Date();
    const waktuStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    
    if (modalDetail) {
        modalDetail.innerHTML = `<strong>NIM:</strong> ${nim}<br><strong>Nama:</strong> ${nama}<br><strong>Mata Kuliah:</strong> ${matkul}<br><strong>Waktu:</strong> ${waktuStr}<br><strong>Status:</strong> ${status}`;
    }
    if (successModal) successModal.style.display = 'flex';
}

// ========== FORMAT WAKTU ==========
function formatWaktu(menit) {
    const jam = Math.floor(menit / 60);
    const mnt = menit % 60;
    return `${jam.toString().padStart(2, '0')}:${mnt.toString().padStart(2, '0')}`;
}

// ========== VALIDASI WAKTU (ATURAN BARU) ==========
function validasiWaktu(matkul) {
    const jadwal = JADWAL[matkul];
    if (!jadwal) return { allowed: true, status: 'Hadir', message: '' };
    
    const now = new Date();
    const menitSekarang = now.getHours() * 60 + now.getMinutes();
    
    // Cek sebelum buka akses (25 menit sebelum mulai)
    if (menitSekarang < jadwal.buka) {
        const pesan = `⏰ Presensi untuk ${jadwal.nama} dapat diakses mulai pukul ${formatWaktu(jadwal.buka)} (25 menit sebelum jadwal dimulai pukul ${formatWaktu(jadwal.mulai)}).`;
        return { allowed: false, status: '', message: pesan };
    }
    
    // Cek waktu hadir (buka akses sampai hadirSampai)
    if (menitSekarang >= jadwal.buka && menitSekarang <= jadwal.hadirSampai) {
        return { allowed: true, status: 'Hadir', message: '' };
    }
    
    // Cek waktu terlambat (hadirSampai sampai telatSampai)
    if (menitSekarang > jadwal.hadirSampai && menitSekarang <= jadwal.telatSampai) {
        return { allowed: true, status: 'Terlambat', message: '⚠️ Anda terlambat! Presensi masih bisa dilakukan.' };
    }
    
    // Cek setelah tutup
    if (menitSekarang > jadwal.telatSampai) {
        const pesan = `⏰ Presensi untuk ${jadwal.nama} sudah ditutup. Presensi hanya dibuka dari pukul ${formatWaktu(jadwal.buka)} sampai ${formatWaktu(jadwal.telatSampai)}.`;
        return { allowed: false, status: '', message: pesan };
    }
    
    return { allowed: true, status: 'Hadir', message: '' };
}

// ========== VALIDASI INPUT ==========
function validasiNIM(nim) {
    if (!/^\d+$/.test(nim)) { showStatus("NIM harus berupa angka!", "error"); return false; }
    if (nim.length !== 7) { showStatus("NIM harus 7 digit angka!", "error"); return false; }
    return true;
}

function validasiNama(nama) {
    if (!/^[a-zA-Z\s\.]+$/.test(nama)) { showStatus("Nama harus berupa huruf!", "error"); return false; }
    if (nama.length < 3) { showStatus("Nama lengkap minimal 3 karakter!", "error"); return false; }
    return true;
}

// ========== KAMERA ==========
async function startCamera() {
    try {
        if (videoStream) videoStream.getTracks().forEach(t => t.stop());
        videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (video) video.srcObject = videoStream;
        if (ambilFotoBtn) ambilFotoBtn.disabled = false;
    } catch (e) {
        showStatus("Gagal akses kamera. Periksa izin browser.", "error");
        if (ambilFotoBtn) ambilFotoBtn.disabled = true;
    }
}

function ambilFoto() {
    if (!video || !video.videoWidth) { showStatus("Kamera belum siap", "error"); return; }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    fotoData = canvas.toDataURL('image/jpeg', 0.5);
    if (photoResultDiv) photoResultDiv.style.display = 'block';
    if (ambilFotoBtn) ambilFotoBtn.innerHTML = '✓ Foto Tersimpan';
    checkFormComplete();
}

function checkFormComplete() {
    const nim = nimInput?.value.trim();
    const nama = namaInput?.value.trim();
    if (submitBtn) submitBtn.disabled = !(nim && nama && fotoData && selectedMataKuliah);
}

function resetForm() {
    if (nimInput) nimInput.value = '';
    if (namaInput) namaInput.value = '';
    fotoData = null;
    if (photoResultDiv) photoResultDiv.style.display = 'none';
    if (ambilFotoBtn) { ambilFotoBtn.innerHTML = '📷 Ambil Foto'; ambilFotoBtn.style.background = '#ff9800'; }
    if (submitBtn) submitBtn.disabled = true;
    startCamera();
}

// ========== NAVIGASI ==========
function pilihMataKuliah(matkul) {
    console.log("Tombol diklik:", matkul);
    
    const validasi = validasiWaktu(matkul);
    if (!validasi.allowed) {
        showWarningModal(validasi.message);
        return;
    }
    
    if (validasi.message) {
        showStatus(validasi.message, "warning");
    }
    
    selectedMataKuliah = matkul;
    if (selectedMatkulSpan) selectedMatkulSpan.textContent = matkul;
    if (welcomePage) welcomePage.style.display = 'none';
    if (presensiPage) presensiPage.style.display = 'block';
    resetForm();
}

function kembaliKeDaftar() {
    if (videoStream) videoStream.getTracks().forEach(t => t.stop());
    if (presensiPage) presensiPage.style.display = 'none';
    if (welcomePage) welcomePage.style.display = 'block';
    selectedMataKuliah = '';
}

// ========== KIRIM DATA ==========
async function kirimPresensi() {
    const nim = nimInput?.value.trim();
    const nama = namaInput?.value.trim();
    
    if (!validasiNIM(nim)) return;
    if (!validasiNama(nama)) return;
    if (!fotoData) { showStatus("Ambil foto selfie terlebih dahulu!", "error"); return; }
    
    const validasi = validasiWaktu(selectedMataKuliah);
    if (!validasi.allowed) {
        showWarningModal(validasi.message);
        return;
    }
    
    showStatus("⏳ Mengirim data presensi...", "loading");
    if (submitBtn) submitBtn.disabled = true;
    if (ambilFotoBtn) ambilFotoBtn.disabled = true;
    
    const formData = new URLSearchParams();
    formData.append('action', 'submit');
    formData.append('nim', nim);
    formData.append('nama', nama);
    formData.append('mataKuliah', selectedMataKuliah);
    formData.append('foto', fotoData);
    formData.append('waktu', new Date().toISOString());
    formData.append('status', validasi.status);
    
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: formData });
        const result = await response.text();
        console.log("Response:", result);
        
        if (result === 'SUKSES') {
            showSuccessModal(nim, nama, selectedMataKuliah, validasi.status);
            resetForm();
        } else if (result === 'DUPLICATE') {
            showStatus("❌ Anda sudah melakukan presensi untuk mata kuliah ini.", "error");
            if (submitBtn) submitBtn.disabled = false;
            if (ambilFotoBtn) ambilFotoBtn.disabled = false;
        } else {
            showStatus("❌ Presensi gagal: " + result, "error");
            if (submitBtn) submitBtn.disabled = false;
            if (ambilFotoBtn) ambilFotoBtn.disabled = false;
        }
    } catch (err) {
        console.error(err);
        showStatus("❌ Gagal mengirim data. Cek koneksi internet.", "error");
        if (submitBtn) submitBtn.disabled = false;
        if (ambilFotoBtn) ambilFotoBtn.disabled = false;
    }
}

// ========== PASANG EVENT LISTENER ==========
document.querySelectorAll('.matkul-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const matkul = btn.getAttribute('data-matkul');
        pilihMataKuliah(matkul);
    });
});

if (backBtn) backBtn.addEventListener('click', kembaliKeDaftar);
if (nimInput) nimInput.addEventListener('input', checkFormComplete);
if (namaInput) namaInput.addEventListener('input', checkFormComplete);
if (ambilFotoBtn) ambilFotoBtn.addEventListener('click', ambilFoto);
if (submitBtn) submitBtn.addEventListener('click', kirimPresensi);

if (closeModalBtn) closeModalBtn.addEventListener('click', () => { if (successModal) successModal.style.display = 'none'; });
if (closeWarningBtn) closeWarningBtn.addEventListener('click', () => { if (warningModal) warningModal.style.display = 'none'; });

window.addEventListener('click', (e) => {
    if (e.target === successModal && successModal) successModal.style.display = 'none';
    if (e.target === warningModal && warningModal) warningModal.style.display = 'none';
});

// ========== MULAI APLIKASI ==========
if (!navigator.mediaDevices?.getUserMedia) {
    showStatus("Browser tidak mendukung akses kamera.", "error");
    if (ambilFotoBtn) ambilFotoBtn.disabled = true;
}
