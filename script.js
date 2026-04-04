// ========== KONFIGURASI ==========
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxl8bjvZzM_1FYgCVawLYitwFkDvLBVcf0fqKnyUQPQwvComAJmCuMVFh74sP13TP8pCQ/exec';

// ========== JADWAL MATA KULIAH ==========
// Format: { mulai: {jam, menit}, durasiMenitHadir, durasiMenitTelat }
// Presensi bisa diakses 15 menit SEBELUM mulai
const JADWAL_MATA_KULIAH = {
    'Teknologi dan Rekayasa dalam Pembelajaran Fisika': {
        mulai: { jam: 10, menit: 0 },      // 12.45
        durasiHadir: 50,                    // Hadir sampai 13.10
        durasiTelat: 10,                    // Telat 13.10-13.20
        nama: "Teknologi dan Rekayasa dalam Pembelajaran Fisika"
    },
    'Listrik Magnet': {
        mulai: { jam: 8, menit: 25 },       // 21.15
        durasiHadir: 25,                    // Hadir sampai 21.40
        durasiTelat: 10,                    // Telat 21.40-21.50
        nama: "Listrik Magnet"
    },
    'Gelombang Optik': {
        mulai: { jam: 12, menit: 45 },      // 12:45
        durasiHadir: 25,                    // Hadir sampai 13:10
        durasiTelat: 10,                    // Telat 13:10-13:20
        nama: "Gelombang Optik"
    },
    'Strategi Pembelajaran': {
        mulai: { jam: 14, menit: 0 },       // 09:15
        durasiHadir: 50,                    // Hadir sampai 09.40
        durasiTelat: 10,                    // Telat 09.40-09.50
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

// ========== FUNGSI VALIDASI WAKTU UNTUK SEMUA MATA KULIAH ==========
function validasiWaktuPresensi(mataKuliah) {
    const jadwal = JADWAL_MATA_KULIAH[mataKuliah];
    if (!jadwal) {
        return { allowed: true, status: 'Hadir', message: '' };
    }
    
    const now = new Date();
    const jam = now.getHours();
    const menit = now.getMinutes();
    const waktuSekarang = jam * 60 + menit;
    
    // Waktu mulai (dalam menit)
    const waktuMulai = jadwal.mulai.jam * 60 + jadwal.mulai.menit;
    
    // Waktu buka presensi (15 menit SEBELUM mulai)
    const waktuBuka = waktuMulai - 15;
    
    // Waktu hadir (mulai + durasiHadir)
    const waktuHadir = waktuMulai + jadwal.durasiHadir;
    
    // Waktu telat (waktuHadir + durasiTelat)
    const waktuTelat = waktuHadir + jadwal.durasiTelat;
    
    // Format waktu untuk ditampilkan
    const formatWaktu = (menitTotal) => {
        const h = Math.floor(menitTotal / 60);
        const m = menitTotal % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };
    
    // CASE 1: Sebelum waktu buka
    if (waktuSekarang < waktuBuka) {
        const pesan = `⏰ Presensi untuk ${jadwal.nama} dapat diakses mulai pukul ${formatWaktu(waktuBuka)} (15 menit sebelum jadwal dimulai pukul ${formatWaktu(waktuMulai)}).`;
        return { allowed: false, status: '', message: pesan };
    }
    
    // CASE 2: Waktu hadir
    if (waktuSekarang >= waktuBuka && waktuSekarang <= waktuHadir) {
        return { allowed: true, status: 'Hadir', message: '' };
    }
    
    // CASE 3: Waktu telat
    if (waktuSekarang > waktuHadir && waktuSekarang <= waktuTelat) {
        return { allowed: true, status: 'Terlambat', message: '⚠️ Anda terlambat! Presensi masih bisa dilakukan.' };
    }
    
    // CASE 4: Setelah waktu telat
    if (waktuSekarang > waktuTelat) {
        const pesan = `⏰ Presensi untuk ${jadwal.nama} sudah ditutup. Presensi hanya dibuka dari pukul ${formatWaktu(waktuBuka)} sampai ${formatWaktu(waktuTelat)}.`;
        return { allowed: false, status: '', message: pesan };
    }
    
    return { allowed: true, status: 'Hadir', message: '' };
}

// ========== TAMPILKAN PERINGATAN WAKTU ==========
function showWarningModal(message) {
    warningMessage.textContent = message;
    warningModal.style.display = 'flex';
}

// ========== VALIDASI NIM (ANGKA, 7 DIGIT) ==========
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

// ========== VALIDASI NAMA (HURUF DAN SPASI) ==========
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

// ========== LOAD FACE DETECTION MODEL ==========
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
            statusDiv.style.display = 'none';
        }, 2000);
    } catch (error) {
        console.error("Gagal load model:", error);
    }
}

// ========== DETEKSI WAJAH DARI FOTO ==========
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

// ========== TAMPILKAN MODAL SUKSES (TERIMA KASIH) ==========
function showSuccessModal(nim, nama, mataKuliah, status) {
    const modalDetail = document.getElementById('modalDetail');
    const now = new Date();
    const waktuStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    modalDetail.innerHTML = `
        <strong>NIM:</strong> ${nim}<br>
        <strong>Nama:</strong> ${nama}<br>
        <strong>Mata Kuliah:</strong> ${mataKuliah}<br>
        <strong>Waktu:</strong> ${waktuStr}<br>
        <strong>Status:</strong> ${status}
    `;
    
    successModal.style.display = 'flex';
}

// ========== FUNGSI: PILIH MATA KULIAH ==========
function pilihMataKuliah(matkul) {
    // Validasi waktu sebelum masuk ke form
    const validasi = validasiWaktuPresensi(matkul);
    
    if (!validasi.allowed) {
        showWarningModal(validasi.message);
        return;
    }
    
    if (validasi.message) {
        showStatus(validasi.message, "warning");
    }
    
    selectedMataKuliah = matkul;
    selectedMatkulSpan.textContent = matkul;
    
    welcomePage.style.display = 'none';
    presensiPage.style.display = 'block';
    
    resetForm();
    startCamera();
}

// ========== FUNGSI: KEMBALI KE DAFTAR ==========
function kembaliKeDaftar() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    
    presensiPage.style.display = 'none';
    welcomePage.style.display = 'block';
    
    fotoData = null;
    selectedMataKuliah = '';
}

// ========== FUNGSI: AKSES KAMERA ==========
async function startCamera() {
    try {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
        }
        
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" }
        });
        video.srcObject = videoStream;
        await video.play();
        
        ambilFotoBtn.disabled = false;
        
    } catch (error) {
        console.error("Error kamera:", error);
        showStatus("Tidak dapat mengakses kamera. Pastikan izin diberikan.", "error");
        ambilFotoBtn.disabled = true;
    }
}

// ========== FUNGSI: AMBIL FOTO ==========
function ambilFoto() {
    if (!video.videoWidth || !video.videoHeight) {
        showStatus("Kamera belum siap. Tunggu sebentar.", "error");
        return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    fotoData = canvas.toDataURL('image/jpeg', 0.5);
    
    photoResultDiv.style.display = 'block';
    ambilFotoBtn.innerHTML = '✓ Foto Tersimpan';
    ambilFotoBtn.style.background = '#4caf50';
    
    checkFormComplete();
}

// ========== FUNGSI: CEK KELENGKAPAN FORM ==========
function checkFormComplete() {
    const nim = nimInput.value.trim();
    const nama = namaInput.value.trim();
    
    if (nim && nama && fotoData && selectedMataKuliah) {
        submitBtn.disabled = false;
    } else {
        submitBtn.disabled = true;
    }
}

// ========== FUNGSI: TAMPILKAN STATUS ==========
function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    
    if (type !== 'loading') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
            statusDiv.className = 'status';
        }, 5000);
    }
}

// ========== FUNGSI: KIRIM PRESENSI ==========
async function kirimPresensi() {
    const nim = nimInput.value.trim();
    const nama = namaInput.value.trim();
    
    if (!validasiNIM(nim)) return false;
    if (!validasiNama(nama)) return false;
    
    if (!fotoData) {
        showStatus("Ambil foto selfie terlebih dahulu!", "error");
        return false;
    }
    
    // Validasi waktu untuk mata kuliah yang dipilih
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
    
    submitBtn.disabled = true;
    ambilFotoBtn.disabled = true;
    
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
            submitBtn.disabled = false;
            ambilFotoBtn.disabled = false;
            return false;
        } else {
            showStatus("❌ Presensi gagal: " + result, "error");
            submitBtn.disabled = false;
            ambilFotoBtn.disabled = false;
            return false;
        }
        
    } catch (error) {
        console.error("Error saat mengirim:", error);
        showStatus("❌ Gagal mengirim data. Cek koneksi internet.", "error");
        submitBtn.disabled = false;
        ambilFotoBtn.disabled = false;
        return false;
    }
}

// ========== FUNGSI: RESET FORM ==========
function resetForm() {
    nimInput.value = '';
    namaInput.value = '';
    fotoData = null;
    photoResultDiv.style.display = 'none';
    ambilFotoBtn.innerHTML = '📷 Ambil Foto';
    ambilFotoBtn.style.background = '#ff9800';
    submitBtn.disabled = true;
    
    startCamera();
}

// ========== EVENT LISTENERS ==========
document.querySelectorAll('.matkul-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const matkul = btn.getAttribute('data-matkul
