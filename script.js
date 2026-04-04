// ========== KONFIGURASI ==========
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwwAv516IqJPrkPNf0R0iEe_XSo1rFPCUfD-EnW6Vh4aiqxZUwnYbPcYyUAvOLYCYVJ9Q/exec';

// ========== JADWAL MATA KULIAH ==========
// Format: { mulai: {jam, menit}, durasiMenitHadir, durasiMenitTelat }
// Presensi bisa diakses 15 menit SEBELUM mulai
const JADWAL_MATA_KULIAH = {
    'Teknologi dan Rekayasa dalam Pembelajaran Fisika': {
        mulai: { jam: 10, menit: 0 },
        durasiHadir: 50,
        durasiTelat: 10,
        nama: "Teknologi dan Rekayasa dalam Pembelajaran Fisika"
    },
    'Listrik Magnet': {
        mulai: { jam: 8, menit: 25 },
        durasiHadir: 25,
        durasiTelat: 10,
        nama: "Listrik Magnet"
    },
    'Gelombang Optik': {
        mulai: { jam: 12, menit: 45 },
        durasiHadir: 25,
        durasiTelat: 10,
        nama: "Gelombang Optik"
    },
    'Strategi Pembelajaran': {
        mulai: { jam: 14, menit: 0 },
        durasiHadir: 50,
        durasiTelat: 10,
        nama: "Strategi Pembelajaran"
    }
};

// ========== VARIABEL GLOBAL ==========
let fotoData = null;
let videoStream = null;
let selectedMataKuliah = '';
let faceDetectionModelLoaded = false;

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

// ========== FUNGSI VALIDASI WAKTU ==========
function validasiWaktuPresensi(mataKuliah) {
    const jadwal = JADWAL_MATA_KULIAH[mataKuliah];
    if (!jadwal) {
        return { allowed: true, status: 'Hadir', message: '' };
    }
    
    const now = new Date();
    const jam = now.getHours();
    const menit = now.getMinutes();
    const waktuSekarang = jam * 60 + menit;
    
    const waktuMulai = jadwal.mulai.jam * 60 + jadwal.mulai.menit;
    const waktuBuka = waktuMulai - 15;
    const waktuHadir = waktuMulai + jadwal.durasiHadir;
    const waktuTelat = waktuHadir + jadwal.durasiTelat;
    
    const formatWaktu = (menitTotal) => {
        const h = Math.floor(menitTotal / 60);
        const m = menitTotal % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };
    
    if (waktuSekarang < waktuBuka) {
        const pesan = `⏰ Presensi untuk ${jadwal.nama} dapat diakses mulai pukul ${formatWaktu(waktuBuka)} (15 menit sebelum jadwal dimulai pukul ${formatWaktu(waktuMulai)}).`;
        return { allowed: false, status: '', message: pesan };
    }
    
    if (waktuSekarang >= waktuBuka && waktuSekarang <= waktuHadir) {
        return { allowed: true, status: 'Hadir', message: '' };
    }
    
    if (waktuSekarang > waktuHadir && waktuSekarang <= waktuTelat) {
        return { allowed: true, status: 'Terlambat', message: '⚠️ Anda terlambat! Presensi masih bisa dilakukan.' };
    }
    
    if (waktuSekarang > waktuTelat) {
        const pesan = `⏰ Presensi untuk ${jadwal.nama} sudah ditutup. Presensi hanya dibuka dari pukul ${formatWaktu(waktuBuka)} sampai ${formatWaktu(waktuTelat)}.`;
        return { allowed: false, status: '', message: pesan };
    }
    
    return { allowed: true, status: 'Hadir', message: '' };
}

function showWarningModal(message) {
    if (warningMessage) warningMessage.textContent = message;
    if (warningModal) warningModal.style.display = 'flex';
}

function validasiNIM(nim) {
    if (!/^\d+$/.test(nim)) {
        showStatus("NIM harus berupa angka!", "error");
        return false;
    }
    if (nim.length !== 7) {
        showStatus("NIM harus 7 digit angka!", "error");
        return false;
    }
    return true;
}

function validasiNama(nama) {
    if (!/^[a-zA-Z\s\.]+$/.test(nama)) {
        showStatus("Nama harus berupa huruf!", "error");
        return false;
    }
    if (nama.length < 3) {
        showStatus("Nama lengkap minimal 3 karakter!", "error");
        return false;
    }
    return true;
}

async function loadFaceDetectionModel() {
    if (typeof faceapi === 'undefined') {
        console.log("Face-api.js tidak terload");
        return;
    }
    
    showStatus("Memuat sistem deteksi wajah...", "loading");
    try {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        faceDetectionModelLoaded = true;
        console.log("Model deteksi wajah siap");
        setTimeout(() => {
            if (statusDiv) statusDiv.style.display = 'none';
        }, 2000);
    } catch (error) {
        console.error("Gagal load model:", error);
    }
}

async function deteksiWajah(fotoBase64) {
    if (!faceDetectionModelLoaded || typeof faceapi === 'undefined') {
        return null;
    }
    
    try {
        const img = new Image();
        img.src = fotoBase64;
        await new Promise((resolve) => { img.onload = resolve; });
        
        const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();
        
        if (detections.length === 0) {
            showStatus("Tidak terdeteksi wajah. Pastikan foto selfie jelas.", "error");
            return null;
        }
        
        if (detections.length > 1) {
            showStatus("Terdeteksi lebih dari satu wajah. Hanya boleh satu orang.", "error");
            return null;
        }
        
        return detections[0].descriptor;
        
    } catch (error) {
        console.error("Error deteksi wajah:", error);
        return null;
    }
}

function showSuccessModal(nim, nama, mataKuliah, status) {
    const modalDetail = document.getElementById('modalDetail');
    const now = new Date();
    const waktuStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    if (modalDetail) {
        modalDetail.innerHTML = `
            <strong>NIM:</strong> ${nim}<br>
            <strong>Nama:</strong> ${nama}<br>
            <strong>Mata Kuliah:</strong> ${mataKuliah}<br>
            <strong>Waktu:</strong> ${waktuStr}<br>
            <strong>Status:</strong> ${status}
        `;
    }
    
    if (successModal) successModal.style.display = 'flex';
}

function pilihMataKuliah(matkul) {
    const validasi = validasiWaktuPresensi(matkul);
    
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
    startCamera();
}

function kembaliKeDaftar() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    
    if (presensiPage) presensiPage.style.display = 'none';
    if (welcomePage) welcomePage.style.display = 'block';
    
    fotoData = null;
    selectedMataKuliah = '';
}

async function startCamera() {
    try {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
        }
        
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" }
        });
        if (video) video.srcObject = videoStream;
        if (video) await video.play();
        
        if (ambilFotoBtn) ambilFotoBtn.disabled = false;
        
    } catch (error) {
        console.error("Error kamera:", error);
        showStatus("Tidak dapat mengakses kamera. Pastikan izin diberikan.", "error");
        if (ambilFotoBtn) ambilFotoBtn.disabled = true;
    }
}

function ambilFoto() {
    if (!video || !video.videoWidth || !video.videoHeight) {
        showStatus("Kamera belum siap. Tunggu sebentar.", "error");
        return;
    }

    if (canvas) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        fotoData = canvas.toDataURL('image/jpeg', 0.5);
    }
    
    if (photoResultDiv) photoResultDiv.style.display = 'block';
    if (ambilFotoBtn) {
        ambilFotoBtn.innerHTML = '✓ Foto Tersimpan';
        ambilFotoBtn.style.background = '#4caf50';
    }
    
    checkFormComplete();
}

function checkFormComplete() {
    const nim = nimInput ? nimInput.value.trim() : '';
    const nama = namaInput ? namaInput.value.trim() : '';
    
    if (nim && nama && fotoData && selectedMataKuliah) {
        if (submitBtn) submitBtn.disabled = false;
    } else {
        if (submitBtn) submitBtn.disabled = true;
    }
}

function showStatus(message, type) {
    if (!statusDiv) return;
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    
    if (type !== 'loading') {
        setTimeout(() => {
            if (statusDiv) {
                statusDiv.style.display = 'none';
                statusDiv.className = 'status';
            }
        }, 5000);
    }
}

async function kirimPresensi() {
    const nim = nimInput ? nimInput.value.trim() : '';
    const nama = namaInput ? namaInput.value.trim() : '';
    
    if (!validasiNIM(nim)) return false;
    if (!validasiNama(nama)) return false;
    
    if (!fotoData) {
        showStatus("Ambil foto selfie terlebih dahulu!", "error");
        return false;
    }
    
    const validasi = validasiWaktuPresensi(selectedMataKuliah);
    if (!validasi.allowed) {
        showWarningModal(validasi.message);
        return false;
    }
    
    showStatus("⏳ Memverifikasi wajah...", "loading");
    
    let faceDescriptor = null;
    
    if (faceDetectionModelLoaded && typeof faceapi !== 'undefined') {
        faceDescriptor = await deteksiWajah(fotoData);
        if (!faceDescriptor) {
            showStatus("Wajah tidak terdeteksi. Pastikan foto selfie jelas.", "error");
            return false;
        }
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
    if (faceDescriptor) {
        formData.append('faceDescriptor', JSON.stringify(faceDescriptor));
    }
    
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString()
        });
        
        const result = await response.text();
        console.log("Response:", result);
        
        if (result === 'SUKSES' || result.includes('SUKSES')) {
            showSuccessModal(nim, nama, selectedMataKuliah, validasi.status);
            resetForm();
            return true;
        } else if (result === 'DUPLICATE') {
            showStatus("❌ Anda sudah melakukan presensi untuk mata kuliah ini.", "error");
            if (submitBtn) submitBtn.disabled = false;
            if (ambilFotoBtn) ambilFotoBtn.disabled = false;
            return false;
        } else {
            showStatus("❌ Presensi gagal: " + result, "error");
            if (submitBtn) submitBtn.disabled = false;
            if (ambilFotoBtn) ambilFotoBtn.disabled = false;
            return false;
        }
        
    } catch (error) {
        console.error("Error saat mengirim:", error);
        showStatus("❌ Gagal mengirim data. Cek koneksi internet.", "error");
        if (submitBtn) submitBtn.disabled = false;
        if (ambilFotoBtn) ambilFotoBtn.disabled = false;
        return false;
    }
}

function resetForm() {
    if (nimInput) nimInput.value = '';
    if (namaInput) namaInput.value = '';
    fotoData = null;
    if (photoResultDiv) photoResultDiv.style.display = 'none';
    if (ambilFotoBtn) {
        ambilFotoBtn.innerHTML = '📷 Ambil Foto';
        ambilFotoBtn.style.background = '#ff9800';
    }
    if (submitBtn) submitBtn.disabled = true;
    
    startCamera();
}

// ========== EVENT LISTENERS ==========
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

if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
        if (successModal) successModal.style.display = 'none';
    });
}

if (closeWarningBtn) {
    closeWarningBtn.addEventListener('click', () => {
        if (warningModal) warningModal.style.display = 'none';
    });
}

window.addEventListener('click', (e) => {
    if (e.target === successModal && successModal) {
        successModal.style.display = 'none';
    }
    if (e.target === warningModal && warningModal) {
        warningModal.style.display = 'none';
    }
});

// ========== INITIALISASI ==========
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showStatus("Browser Anda tidak mendukung akses kamera.", "error");
    if (ambilFotoBtn) ambilFotoBtn.disabled = true;
}

loadFaceDetectionModel();
