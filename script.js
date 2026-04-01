// ========== KONFIGURASI ==========
// GANTI DENGAN URL APPS SCRIPT ANDA
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyiWwpBMMP6tODtBWhAU-BwHL2v04fsuvrgpX_ZEJxduqkRZK-gfERGF6Jucy_Myd-qRw/exec';

// ========== VARIABEL GLOBAL ==========
let fotoData = null;
let videoStream = null;
let selectedMataKuliah = '';
let faceDetectionModelLoaded = false;
let currentFaceDescriptor = null;

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

// ========== LOAD FACE DETECTION MODEL ==========
async function loadFaceDetectionModel() {
    showStatus("Memuat sistem deteksi wajah...", "loading");
    try {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        faceDetectionModelLoaded = true;
        console.log("Model deteksi wajah siap");
        setTimeout(() => {
            statusDiv.style.display = 'none';
            statusDiv.className = 'status';
        }, 2000);
    } catch (error) {
        console.error("Gagal load model:", error);
        showStatus("Deteksi wajah tidak tersedia, presensi tetap bisa dilakukan", "error");
    }
}

// ========== DETEKSI WAJAH DARI FOTO ==========
async function deteksiWajah(fotoBase64) {
    if (!faceDetectionModelLoaded) {
        console.log("Model deteksi wajah belum siap");
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

// ========== CEK APAKAH SUDAH PERNAH ABSEN ==========
async function cekAbsenGanda(nim, mataKuliah, faceDescriptor) {
    try {
        const formData = new URLSearchParams();
        formData.append('action', 'checkDuplicate');
        formData.append('nim', nim);
        formData.append('mataKuliah', mataKuliah);
        if (faceDescriptor) {
            formData.append('faceDescriptor', JSON.stringify(faceDescriptor));
        }
        
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString()
        });
        
        const result = await response.text();
        return result === 'ALLOWED';
        
    } catch (error) {
        console.error("Error cek absen ganda:", error);
        return true;
    }
}

// ========== FUNGSI: PILIH MATA KULIAH ==========
function pilihMataKuliah(matkul) {
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
    
    if (!nim || !nama || !fotoData || !selectedMataKuliah) {
        showStatus("Lengkapi semua data dan foto!", "error");
        return false;
    }
    
    showStatus("⏳ Memverifikasi wajah...", "loading");
    
    let faceDescriptor = null;
    
    if (faceDetectionModelLoaded) {
        faceDescriptor = await deteksiWajah(fotoData);
        
        if (!faceDescriptor) {
            showStatus("Wajah tidak terdeteksi. Pastikan foto selfie jelas dan pencahayaan cukup.", "error");
            return false;
        }
        
        showStatus("⏳ Mengecek riwayat presensi...", "loading");
        
        const isAllowed = await cekAbsenGanda(nim, selectedMataKuliah, faceDescriptor);
        
        if (!isAllowed) {
            showStatus("❌ Anda sudah melakukan presensi untuk mata kuliah ini.", "error");
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
            showStatus("✅ Presensi berhasil! Data telah tersimpan.", "success");
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
        const matkul = btn.getAttribute('data-matkul');
        pilihMataKuliah(matkul);
    });
});

backBtn.addEventListener('click', kembaliKeDaftar);
nimInput.addEventListener('input', checkFormComplete);
namaInput.addEventListener('input', checkFormComplete);
ambilFotoBtn.addEventListener('click', ambilFoto);
submitBtn.addEventListener('click', kirimPresensi);

// ========== INITIALISASI ==========
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showStatus("Browser Anda tidak mendukung akses kamera. Gunakan Chrome, Firefox, atau Safari.", "error");
    ambilFotoBtn.disabled = true;
}

// Load model deteksi wajah
loadFaceDetectionModel();
