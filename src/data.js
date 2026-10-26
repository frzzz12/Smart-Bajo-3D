// Konten komponen interaktif Smart Bajo (bersumber dari infografis Smart Bajo)
// pos  : posisi titik (pin) di dunia 3D
// cam  : posisi kamera saat fokus, look : titik yang dilihat kamera

export const HOTSPOTS = [
  {
    id: 'rak',
    no: 1,
    title: 'Rak NFT & Tanaman',
    tag: 'Sistem Hidroponik',
    color: '#2faa3f',
    pos: [-0.2, 2.95, 0.1],
    cam: [3.2, 3.8, 8.6],
    look: [-0.2, 1.5, 0.1],
    text:
      'Pipa NFT (Nutrient Film Technique) bertingkat menumbuhkan sayuran tanpa tanah. Larutan nutrisi mengalir tipis di dasar pipa sehingga akar menyerap air dan nutrisi secara terus-menerus.',
    points: [
      'Rak 4 tingkat — hemat lahan, cocok untuk permukiman di atas laut',
      'Siklus tanam sekitar 20–25 hari',
      'Produktivitas panen meningkat 40%–60%',
    ],
    steps: ['Penyemaian', 'Pindah Tanam', 'Pertumbuhan & Monitoring', 'Panen'],
  },
  {
    id: 'tandon',
    no: 2,
    title: 'Tandon Nutrisi',
    tag: 'Nutrient Tank',
    color: '#1d6fd1',
    pos: [2.4, 0.6, 2.25],
    cam: [4.4, 3.6, 5.8],
    look: [2.2, 0.4, 1.5],
    text:
      'Menampung larutan nutrisi yang bersirkulasi. Air dari pipa NFT kembali ke tandon, lalu dipompa lagi ke rak sehingga air dan nutrisi tidak terbuang (sistem tertutup).',
    points: [
      'Sistem sirkulasi tertutup — hemat air',
      'Tempat sensor pH & EC mengukur larutan',
      'Dosis nutrisi dikendalikan otomatis',
    ],
  },
  {
    id: 'ph',
    no: 3,
    title: 'Sensor pH & EC',
    tag: 'Kualitas Air',
    color: '#e8a21a',
    pos: [1.9, 1.2, 1.28],
    cam: [3.2, 3.8, 6.6],
    look: [1.9, 0.6, 1.4],
    text:
      'Mengukur tingkat keasaman (pH) dan kepekatan nutrisi (EC) larutan di tandon. Data dikirim ke IoT Gateway untuk dianalisis AI agar nutrisi selalu pada kisaran ideal.',
    points: [
      'pH — keasaman larutan nutrisi',
      'EC — kepekatan / kadar nutrisi terlarut',
    ],
    live: [
      { k: 'ph', label: 'pH', unit: '', base: 6.2, amp: 0.15, dec: 2 },
      { k: 'ec', label: 'EC', unit: 'mS/cm', base: 1.8, amp: 0.1, dec: 2 },
    ],
  },
  {
    id: 'suhu',
    no: 4,
    title: 'Sensor Suhu & RH',
    tag: 'Lingkungan',
    color: '#e8a21a',
    pos: [-2.85, 1.95, -0.3],
    cam: [-5.0, 2.8, 5.0],
    look: [-2.6, 1.5, -0.2],
    text:
      'Memantau suhu dan kelembapan relatif (RH) udara di sekitar tanaman agar kondisi tumbuh tetap optimal dan perubahan cuaca dapat terdeteksi lebih awal.',
    points: ['Suhu air & udara', 'Kelembapan relatif (RH)'],
    live: [
      { k: 'suhu', label: 'Suhu', unit: '°C', base: 28.5, amp: 0.6, dec: 1 },
      { k: 'rh', label: 'RH', unit: '%', base: 72, amp: 2, dec: 0 },
    ],
  },
  {
    id: 'ro',
    no: 5,
    title: 'Sensor RO',
    tag: 'Kualitas Air',
    color: '#e8a21a',
    pos: [2.45, 1.55, 0.85],
    cam: [5.4, 3.2, 4.2],
    look: [2.45, 1.0, 0.85],
    text:
      'Bagian dari rangkaian sensor kualitas air (pH, EC, RO, suhu) yang dipasang pada jalur air. Hasil pembacaannya dikirim ke IoT Gateway melalui Wi-Fi lokal.',
    points: ['Terpasang pada jalur air', 'Data diteruskan ke IoT Gateway'],
  },
  {
    id: 'pompa',
    no: 6,
    title: 'Pompa Air',
    tag: 'Otomatisasi',
    color: '#d6453d',
    pos: [3.1, 0.55, 0.85],
    cam: [5.6, 3.1, 4.4],
    look: [2.6, 0.3, 0.9],
    text:
      'Mengalirkan larutan nutrisi dari tandon naik ke setiap tingkat rak NFT. Pompa dinyalakan dan dimatikan otomatis oleh sistem sesuai kebutuhan tanaman.',
    points: [
      'Kontrol otomatis nutrisi & pompa',
      'Dapat dipantau lewat website',
    ],
  },
  {
    id: 'gateway',
    no: 7,
    title: 'IoT Gateway',
    tag: 'Otak Sistem',
    color: '#0f3b78',
    pos: [3.0, 3.25, 0.5],
    cam: [6.6, 3.5, 6.0],
    look: [2.95, 1.9, 0.5],
    text:
      'Mengumpulkan data semua sensor lalu mengirimnya ke Cloud. AI menganalisis data, memberi rekomendasi, dan sistem otomatis mengatur pompa serta nutrisi. Data dapat diakses lewat website.',
    points: [
      'Koneksi Wi-Fi lokal',
      'Monitoring real-time',
      'Prediksi & rekomendasi berbasis AI',
      'Akses data via website',
    ],
    flow: [
      'Sensor mengukur kualitas air: pH, EC, RO, suhu',
      'Data dikirim ke Cloud melalui IoT Gateway',
      'AI menganalisis data & memberi rekomendasi',
      'Sistem otomatis mengatur pompa & nutrisi',
      'Tanaman tumbuh optimal, hasil panen meningkat',
    ],
  },
  {
    id: 'surya',
    no: 8,
    title: 'Panel Surya & Baterai',
    tag: 'Energi Mandiri',
    color: '#2faa3f',
    pos: [1.6, 4.0, -1.0],
    cam: [5.4, 5.2, 5.8],
    look: [1.4, 3.2, -0.8],
    text:
      'Panel surya menyuplai listrik untuk sensor, pompa, dan IoT Gateway. Kelebihan energi disimpan di baterai sehingga sistem tetap bekerja walau cuaca mendung.',
    points: ['Hemat energi (Solar Power)', 'Cocok untuk wilayah pesisir tanpa listrik andal'],
  },
  {
    id: 'rangka',
    no: 9,
    title: 'Rangka, Atap & Pagar',
    tag: 'Tahan Cuaca & Korosi',
    color: '#8a5a2b',
    pos: [-3.0, 3.3, 1.9],
    cam: [-6.6, 3.8, 6.2],
    look: [-1.0, 1.6, 0.2],
    text:
      'Rangka kayu dengan atap jaring peneduh melindungi tanaman dari terik matahari dan hujan. Pagar kawat menjaga instalasi dari gangguan. Dirancang tahan cuaca dan korosi di lingkungan laut.',
    points: ['Tahan cuaca & korosi', 'Atap jaring peneduh', 'Pagar kawat pelindung'],
  },
];

export const TOUR_ORDER = ['rak', 'tandon', 'ph', 'pompa', 'gateway', 'surya', 'suhu', 'rangka'];

export const HOME_VIEW = {
  cam: [-5.0, 4.7, 10.4],
  look: [0, 1.35, 0.1],
};
