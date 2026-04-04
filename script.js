// ========== KONFIGURASI ==========
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwwAv516IqJPrkPNf0R0iEe_XSo1rFPCUfD-EnW6Vh4aiqxZUwnYbPcYyUAvOLYCYVJ9Q/exec';

// ========== JADWAL MATA KULIAH (dalam menit) ==========
const JADWAL = {
    'Teknologi dan Rekayasa dalam Pembelajaran Fisika': { mulai: 600, hadirSampai: 650, telatSampai: 660 }, // 12:45
    'Listrik Magnet': { mulai: 505, hadirSampai: 530, telatSampai: 540 }, // 21.30
    'Gelombang Optik': { mulai: 765, hadirSampai: 790, telatSampai: 800 }, // 12:45
    'Strategi Pembelajaran': { mulai: 840, hadirSampai: 890, telatSampai: 900 } // 09.15
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
    if (modalDetail) {
        modalDetail.innerHTML = `<strong>NIM:</strong> ${nim}<br><strong>Nama:</strong> ${nama}<br><strong>Mata Kuliah:</strong> ${matkul}<br><strong>Status:</strong> ${status}`;
    }
    if (successModal) successModal.style.display = 'flex';
}

// ========== VALIDASI INPUT ==========
function validasiNIM(nim) {
    if (!/^\d+$/.test(nim)) { showStatus("NIM harus angka!", "error"); return false; }
    if (nim.length !== 7) { showStatus("NIM harus 7 digit!", "error"); return false; }
    return true;
}

function validasiNama(nama) {
    if (!/^[a-zA-Z\s\.]+$/.test(nama)) { showStatus("Nama harus huruf!", "error"); return false; }
    if (nama.length < 3) { showStatus("Nama minimal 3 karakter!", "error"); return false; }
    return true;
}

// ========== VALIDASI WAKTU ==========
function validasiWaktu(matkul) {
    const jadwal = JADWAL[matkul];
    if (!jadwal) return { allowed: true, status: 'Hadir' };
    
    const now = new Date();
    const menitSekarang = now.getHours() * 60 + now.getMinutes();
    const buka = jadwal.mulai - 15;
    
    if (menitSekarang < buka) {
        showWarningModal(`Presensi dapat diakses 15 menit sebelum jadwal dimulai (pukul ${Math.floor(buka/60)}:${buka%60 < 10 ? '0'+buka%60 : buka%60}).`);
        return { allowed: false };
    }
    if (menitSekarang <= jadwal.hadirSampai) return { allowed: true, status: 'Hadir' };
    if (menitSekarang <= jadwal.telatSampai) return { allowed: true, status: 'Terlambat' };
    
    showWarningModal(`Presensi sudah ditutup.`);
    return { allowed: false };
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
    console.log("Tombol diklik:", matkul); // Cek di console browser
    const validasi = validasiWaktu(matkul);
    if (!validasi.allowed) return;
    
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
    if (!fotoData) { showStatus("Ambil foto dulu!", "error"); return; }
    
    const waktu = validasiWaktu(selectedMataKuliah);
    if (!waktu.allowed) return;
    
    showStatus("Mengirim data...", "loading");
    if (submitBtn) submitBtn.disabled = true;
    if (ambilFotoBtn) ambilFotoBtn.disabled = true;
    
    const formData = new URLSearchParams();
    formData.append('action', 'submit');
    formData.append('nim', nim);
    formData.append('nama', nama);
    formData.append('mataKuliah', selectedMataKuliah);
    formData.append('foto', fotoData);
    formData.append('waktu', new Date().toISOString());
    formData.append('status', waktu.status);
    
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: formData });
        const result = await response.text();
        console.log("Response:", result);
        
        if (result === 'SUKSES') {
            showSuccessModal(nim, nama, selectedMataKuliah, waktu.status);
            resetForm();
        } else if (result === 'DUPLICATE') {
            showStatus("Anda sudah melakukan presensi!", "error");
            if (submitBtn) submitBtn.disabled = false;
            if (ambilFotoBtn) ambilFotoBtn.disabled = false;
        } else {
            showStatus("Gagal: " + result, "error");
            if (submitBtn) submitBtn.disabled = false;
            if (ambilFotoBtn) ambilFotoBtn.disabled = false;
        }
    } catch (err) {
        console.error(err);
        showStatus("Gagal mengirim data. Cek koneksi.", "error");
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
