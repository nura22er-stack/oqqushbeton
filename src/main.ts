import './index.css';
import { PhoneAgentWidget } from './phoneAgent';

interface Project {
  id: string;
  name: string;
  image: string;
  mediaType?: 'image' | 'video';
  location: string;
  year: string;
}

interface Transport {
  id: string;
  name: string;
  image: string;
  specs: string;
  price: string;
  available: boolean;
}

interface Social {
  tg: string;
  ig: string;
  yt: string;
  fb: string;
  ph: string;
}

interface Product {
  id: string;
  name: string;
  image: string;
  description: string;
}

interface ProductPanel {
  id: string;
  name: string;
  image: string;
  description: string;
  meta?: string;
}

interface ProductSection {
  id: string;
  name: string;
  image: string;
  description: string;
  panels?: ProductPanel[];
}

interface Service {
  id: string;
  name: string;
  image: string;
  description: string;
}

interface LabItem {
  id: string;
  name: string;
  image: string;
  description: string;
}

interface PanelViewerItem {
  title: string;
  image: string;
  description: string;
  meta?: string;
  mediaType?: 'image' | 'video';
  eyebrow?: string;
}

interface Settings {
  compName: string;
  heroTitle: string;
  heroSub: string;
  s1: string;
  s2: string;
  s3: string;
}

type NavigationTarget =
  | {type: 'section'; id: string; label: string; key: string}
  | {type: 'admin'; tab?: string; label: string; key: string};

type PanelCollection = 'products' | 'product-panels' | 'transport' | 'projects' | 'laboratory';

const MAX_UPLOAD_SIZE = 100 * 1024 * 1024;

class App {
  private projects: Project[] = [];
  private transport: Transport[] = [];
  private products: Product[] = [];
  private productSections: ProductSection[] = [];
  private services: Service[] = [];
  private laboratory: LabItem[] = [];
  private social: Social = { tg: '', ig: '', yt: '', fb: '', ph: '' };
  private settings: Settings = { 
    compName: 'OQQUSH BETON', 
    heroTitle: 'OQQUSH BETON', 
    heroSub: "O'zbekistondagi eng ishonchli beton quyish kompaniyasi", 
    s1: '500+', s2: '12', s3: '100%' 
  };
  private adminPass: string = 'admin123';
  private currentSlideIndex: { [key: string]: number } = {};
  private slideImages: { [key: string]: string[] } = {
    hero: ['photo-1600585154340-be6161a56a0c', 'photo-1486325212027-8081e485255e', 'photo-1558618666-fcd25c85cd64'],
    about: ['photo-1504307651254-35680f356dfd', 'photo-1590496793929-36417d3117de', 'photo-1581094794329-c8112a89af12'],
    services: ['photo-1504307651254-35680f356dfd', 'photo-1558618047-3c8c76ca7d13', 'photo-1601584115197-04ecc0da31d7'],
    projects: ['photo-1486325212027-8081e485255e', 'photo-1600585154340-be6161a56a0c', 'photo-1558618666-fcd25c85cd64'],
    transport: ['photo-1601584115197-04ecc0da31d7', 'photo-1581094794329-c8112a89af12', 'photo-1590496793929-36417d3117de'],
    products: ['photo-1584622650111-993a426fbf0a', 'photo-1574359411659-15573a27f812', 'photo-1533234407053-ada8c9502b70'],
    productFeatures: ['photo-1574359411659-15573a27f812', 'photo-1584622650111-993a426fbf0a', 'photo-1533234407053-ada8c9502b70'],
    concreteMix: ['photo-1541888941259-79ad73220563', 'photo-1590069000107-233ed4969e4b', 'photo-1503387762-592dea58ef21'],
    highPerformance: ['photo-1518709368324-4d896174775e', 'photo-1513828583688-c52646db42da', 'photo-1574359411659-15573a27f812'],
    laboratory: ['photo-1576086213369-97a306d36557', 'photo-1581093458791-9f3c3900df4b', 'photo-1532187863486-abf51ad990c5'],
    plitalar: ['photo-1533234407053-ada8c9502b70', 'photo-1541888941259-79ad73220563', 'photo-1590069000107-233ed4969e4b'],
    gisht: ['photo-1590069000107-233ed4969e4b', 'photo-1581094794329-c8112a89af12', 'photo-1590496793929-36417d3117de'],
    contact: ['photo-1486406146926-c627a92ad1ab', 'photo-1497366811353-6870744d04b2', 'photo-1503387762-592dea58ef21']
  };

  private editingProjectId: string | null = null;
  private editingTransportId: string | null = null;
  private editingProductId: string | null = null;

  private tempProductImage: string = '';
  private tempProjectImage: string = '';
  private tempProjectMediaType: 'image' | 'video' = 'image';
  private tempTransportImage: string = '';
  private editingContentType: 'product' | 'product-section' | 'product-panel' | 'service' | 'lab' | null = null;
  private editingContentId: string | null = null;
  private editingPanelId: string | null = null;
  private tempContentImage = '';
  private chatBusy = false;
  private chatGreeted = false;
  private chatButtonBound = false;
  private phoneAgent = new PhoneAgentWidget();
  private bodyScrollLockCount = 0;
  private mediaUrlCache = new Map<string, string>();
  private projectVideoObserver: IntersectionObserver | null = null;
  private panelViewerItems: PanelViewerItem[] = [];
  private panelViewerCollection: PanelCollection | null = null;
  private panelViewerIndex = 0;
  private panelViewerOpen = false;
  private siteSyncTimer: number | null = null;
  private siteSyncInFlight = false;
  private siteSyncReady = false;
  private siteSyncPendingAfterReady = false;
  private siteSyncImportInFlight = false;
  private siteSyncPollTimer: number | null = null;
  private lastServerSyncCheck = 0;
  private slideshowTimers: number[] = [];
  private backgroundLoadObserver: IntersectionObserver | null = null;

  constructor() {
    this.loadData();
    this.initUI();
    this.initSlideshows();
    this.initAnimations();
    this.render();
    this.migrateStoredImages();
    const syncDelay = this.isMobileViewport() ? 2600 : 2200;
    window.setTimeout(() => void this.importBundledSiteBackupIfNeeded(), syncDelay);
    this.startServerSiteSyncWatcher();
  }

  private loadData() {
    const p = localStorage.getItem('oqqush_projects');
    if (p) {
      this.projects = JSON.parse(p).map((project: Project) => ({
        ...project,
        mediaType: project.mediaType || (project.image?.startsWith('data:video') ? 'video' : 'image'),
      }));
    } else {
      this.projects = [
        { id: '1', name: 'Tashkent City Lot 4', image: 'photo-1486325212027-8081e485255e', location: 'Toshkent', year: '2023' },
        { id: '2', name: 'Olmazor Business City', image: 'photo-1600585154340-be6161a56a0c', location: 'Toshkent', year: '2022' },
        { id: '3', name: 'Samarkand Silk Road', image: 'photo-1558618666-fcd25c85cd64', location: 'Samarqand', year: '2023' },
        { id: '4', name: 'Nukus Industrial Hub', image: 'photo-1504307651254-35680f356dfd', location: 'Nukus', year: '2021' },
      ];
    }

    const t = localStorage.getItem('oqqush_transport');
    if (t) {
      this.transport = JSON.parse(t);
    } else {
      this.transport = [
        { id: '1', name: "Beton nasos", specs: "Uzatib berish: 40-56 m\nIsh unumdorligi: 70 - 100 m³/soat", price: "40-56 m", available: true, image: "https://images.unsplash.com/photo-1541888941259-79ad73220563?w=800" },
        { id: '2', name: "Ekskavatorlar", specs: "Kovlash chuqurligi: 8 m gacha\nIsh unumdorligi: 40 - 200 m³/soat\nKovush kattaligi: 0.5 - 1.1 m³", price: "0.5-1.1 m³", available: true, image: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800" },
        { id: '3', name: "Yuk mashinalari", specs: "Pretsep: 10 - 25 m³", price: "10-25 m³", available: true, image: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=800" },
        { id: '4', name: "Beton mikser", specs: "Bochka: 8 - 11 m³\nSuv sig'imi: 200 L", price: "8-11 m³", available: true, image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800" },
        { id: '5', name: "Pogruzchik", specs: "Ish unumdorligi: 40 - 180 m³/soat\nKovush kattaligi: 3 m³", price: "3 m³", available: true, image: "https://images.unsplash.com/photo-1590496793929-36417d3117de?w=800" },
        { id: '6', name: "Kran", specs: "Uzatish balandligi: 50 m\nYuk ko'tarish qobiliyati: 5 tonna", price: "50 m", available: true, image: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800" }
      ];
    }

    const pr = localStorage.getItem('oqqush_products');
    if (pr) {
      this.products = JSON.parse(pr);
      if (this.products.length === 0) {
        this.products = [
          { id: '1', name: "Yuvilmagan shag'al", description: "Tabiiy holda qazib olingan\nO'rta darajadagi mustahkamlik\nVaqtinchalik qurilish ishlari uchun", image: "photo-1574359411659-15573a27f812" },
          { id: '2', name: "Yuvilmagan sheben", description: "Tabiiy qo'shimcha tozalashsiz\nBeton sifati biroz past\nAsos qatlamlari uchun", image: "photo-1584622650111-993a426fbf0a" },
          { id: '3', name: "Yuvilmagan pesok", description: "Tabiiy qum aralashmasi\nSilliqlik pastroq\nPast talabli qurilish ishlari uchun", image: "photo-1533234407053-ada8c9502b70" },
          { id: '4', name: "Yuvilgan shag'al", description: "Chang va loydan tozalangan shag'al\nSamarali mustahkamlik ko'rsatkichi\nFundament konstruksiyalar", image: "photo-1517487881594-2787fef5ebf7" },
          { id: '5', name: "Yuvilgan sheben", description: "Yuvilgan va chaqilgan tosh material\nYuqori zichlik hosil qiladi\nOg'ir yuklama talab qilinadigan betonlar uchun", image: "photo-1546484475-7f7bd55792da" },
          { id: '6', name: "Yuvilgan pesok", description: "Fraksiyali va tozalangan aralashma\nBeton strukturasini zichlashtiradi\nPardozlash ishlari", image: "photo-1578301978018-3005759f48f7" }
        ];
      }
    } else {
      this.products = [
        { id: '1', name: "Yuvilmagan shag'al", description: "Tabiiy holda qazib olingan\nO'rta darajadagi mustahkamlik\nVaqtinchalik qurilish ishlari uchun", image: "photo-1574359411659-15573a27f812" },
        { id: '2', name: "Yuvilmagan sheben", description: "Tabiiy qo'shimcha tozalashsiz\nBeton sifati biroz past\nAsos qatlamlari uchun", image: "photo-1584622650111-993a426fbf0a" },
        { id: '3', name: "Yuvilmagan pesok", description: "Tabiiy qum aralashmasi\nSilliqlik pastroq\nPast talabli qurilish ishlari uchun", image: "photo-1533234407053-ada8c9502b70" },
        { id: '4', name: "Yuvilgan shag'al", description: "Chang va loydan tozalangan shag'al\nSamarali mustahkamlik ko'rsatkichi\nFundament konstruksiyalar", image: "photo-1517487881594-2787fef5ebf7" },
        { id: '5', name: "Yuvilgan sheben", description: "Yuvilgan va chaqilgan tosh material\nYuqori zichlik hosil qiladi\nOg'ir yuklama talab qilinadigan betonlar uchun", image: "photo-1546484475-7f7bd55792da" },
        { id: '6', name: "Yuvilgan pesok", description: "Fraksiyali va tozalangan aralashma\nBeton strukturasini zichlashtiradi\nPardozlash ishlari", image: "photo-1578301978018-3005759f48f7" }
      ];
    }

    const defaultProductSections: ProductSection[] = [
      {
        id: 'concreteMix',
        name: 'Tayyor beton aralashma',
        image: 'photo-1541888941259-79ad73220563',
        description: "Biz ishlab chiqaradigan beton aralashmalar GOST standartlari asosida tayyorlanadi. Tarkibida inert materiallar yuvilgan pesok, tosh sheben va mavsumiy kimyoviy qo'shimchalar bilan boyitilgan.",
        panels: [
          { id: 'm100', name: 'M100 | B5 | C4/5', image: 'photo-1541888941259-79ad73220563', description: 'Tayyorlov ishlari, asos osti qatlamlari', meta: 'Iqtisodiy va minimal yuklama uchun optimal' },
          { id: 'm150', name: 'M150 | B10 | C8/10', image: 'photo-1621905251189-08b45d6a269e', description: 'Pol quyish, trotuarlar', meta: 'Mustahkamlik va narx balansida optimal' },
          { id: 'm200', name: 'M200 | B15 | C12/15', image: 'photo-1590069000107-233ed4969e4b', description: 'Poydevor, devorlar, ustunlar', meta: "Yuqori ishonchlilik va universal qo'llanish" },
          { id: 'm250', name: 'M250 | B20 | C16/20', image: 'photo-1503387762-592dea58ef21', description: "Ko'p qavatli obyektlar", meta: 'Mustahkamlik va uzoq xizmat muddati' },
        ],
      },
      {
        id: 'highPerformance',
        name: 'Yuqori mustahkamlikdagi maxsus betonlar',
        image: 'photo-1518709368324-4d896174775e',
        description: "M300 dan M550 gacha bo'lgan yuqori mustahkam betonlar ko'p qavatli obyektlar, ko'priklar, zavodlar va maxsus inshootlar uchun ishlab chiqariladi.",
        panels: [
          { id: 'm300', name: 'M300 | B22,5 | C18/22', image: 'photo-1518709368324-4d896174775e', description: "Ko'p qavatli obyektlar, regel va kolonnalar", meta: 'Mustahkamlik va uzoq xizmat muddati yemirilishga chidamli' },
          { id: 'm350', name: 'M350 | B25 | C20/25', image: 'photo-1541888941259-79ad73220563', description: "Zavodlar, yo'l qurilishi", meta: 'Yuqori zichlik va deformatsiyaga chidamli' },
          { id: 'm400', name: 'M400 | B30 | C25/30', image: 'photo-1533234407053-ada8c9502b70', description: "Ko'priklar", meta: 'Ekstremal yuklamalarga bardoshli' },
          { id: 'm450', name: 'M450 | B35 | C28/35', image: 'photo-1513828583688-c52646db42da', description: "Ko'priklar, maxsus obyektlar", meta: 'Ekstremal yuklamalarga bardoshli' },
          { id: 'm550', name: 'M550 | B40 | C32/40', image: 'photo-1574359411659-15573a27f812', description: 'Suv omborlar, suv inshootlari', meta: "Yemirilishga chidamli, suv o'tkazmas yuqori bosimga chidamli" },
        ],
      },
      {
        id: 'plitalar',
        name: 'Beton plitalar',
        image: 'photo-1533234407053-ada8c9502b70',
        panels: [
          { id: 'plita-12', name: '12 mm armatura asosida:', image: 'photo-1590069000107-233ed4969e4b', description: "O'lchamlari: Eni 1m va 1,2m. Uzunligi 1,8m-5,9m.", meta: '600-900 kg/m²' },
          { id: 'plita-14', name: '14 mm armatura asosida:', image: 'photo-1541888941259-79ad73220563', description: "O'lchamlari: Eni 1m va 1,2m. Uzunligi 1,8m-5,9m.", meta: '900-1300 kg/m²' },
        ],
        description: "Oqqush Beton tomonidan ishlab chiqariladigan beton plitalar — yuqori yuklama va uzoq muddatli ekspluatatsiya uchun mo'ljallangan tayyor konstruktiv elementlardir.\nMahsulotlar zamonaviy texnologiyalar asosida ishlab chiqarilib, har bir partiya mustahkamlik va zichlik ko'rsatkichlari bo'yicha nazoratdan o'tkaziladi.",
      },
      {
        id: 'gisht',
        name: "G'isht mahsuloti",
        image: 'photo-1590069000107-233ed4969e4b',
        panels: [
          { id: 'hom-gisht', name: "Hom g'isht", image: 'photo-1590069000107-233ed4969e4b', description: 'Arzon va iqtisodiy. Tabiiy mikroklim yaratadi.', meta: 'Mavjud' },
          { id: 'pishiq-gisht', name: "Pishiq g'isht", image: 'photo-1584622650111-993a426fbf0a', description: 'Maxsus pechlarda yuqori haroratda pishirilgan. Ekologik xavfsiz material. Mustahkam va bardoshli.', meta: 'Mavjud' },
        ],
        description: "Binolarni qurishda devor, to'siq va yuk ko'taruvchi konstruksiyalar uchun mo'ljallangan asosiy qurilish materiali. Yuqori mustahkamlik, issiqlikni ushlab turish va uzoq xizmat muddati bilan ajralib turadi.\nO'lchami: 25x12x6,5 sm",
      },
    ];

    const productSections = localStorage.getItem('oqqush_product_sections');
    const savedProductSections = productSections ? JSON.parse(productSections) as ProductSection[] : [];
    this.productSections = defaultProductSections.map(section => {
      const saved = savedProductSections.find(item => item.id === section.id);
      if (!saved) return section;
      const panels = section.panels?.map(panel => ({
        ...panel,
        ...saved.panels?.find(item => item.id === panel.id),
      }));
      return {...section, ...saved, panels};
    });

    const s = localStorage.getItem('oqqush_social');
    if (s) this.social = JSON.parse(s);

    const set = localStorage.getItem('oqqush_settings');
    if (set) this.settings = JSON.parse(set);

    const pass = localStorage.getItem('admin_pass');
    if (pass) this.adminPass = pass;

    const ss = localStorage.getItem('oqqush_slideshows');
    if (ss) {
      this.slideImages = {...this.slideImages, ...JSON.parse(ss)};
    }

    const defaultLaboratory = this.getDefaultLaboratoryItems();
    const labs = localStorage.getItem('oqqush_lab');
    const savedLabs = labs ? JSON.parse(labs) as LabItem[] : [];
    const oldLabNames = ['Beton Markasi Testi', 'Mustahkamlik Sinovi', 'Kimyoviy Tahlil', 'Sifat Sertifikati'];
    const shouldReplaceOldLabs = !savedLabs.length || savedLabs.some(item => oldLabNames.includes(item.name));
    this.laboratory = shouldReplaceOldLabs
      ? defaultLaboratory
      : defaultLaboratory.map(item => ({...item, ...savedLabs.find(saved => saved.id === item.id)}));
    if (shouldReplaceOldLabs) this.saveLocalJson('oqqush_lab', this.laboratory);

    const servs = localStorage.getItem('oqqush_services');
    if (servs) this.services = JSON.parse(servs);
    else this.services = [
      { id: '1', name: 'Beton Quyish', image: 'photo-1504307651254-35680f356dfd', description: 'Yuqori sifatli beton quyish xizmatlari' },
      { id: '2', name: 'Beton Nasos', image: 'photo-1558618047-3c8c76ca7d13', description: 'Zamonaviy beton nasoslar ijarasi' }
    ];
  }

  private getDefaultLaboratoryItems(): LabItem[] {
    return [
      {
        id: '1',
        name: 'Normal qotish kamerasi',
        image: 'https://images.unsplash.com/photo-1581093458791-9f3c3900df4b?auto=format&fit=crop&q=80&w=900',
        description: 'Olingan namunalarni 20°C (±5°) haroratda 95% namlikda 28 sutka davomida saqlanadi.',
      },
      {
        id: '2',
        name: 'Laboratoriya elagi (Sita)',
        image: 'https://images.unsplash.com/photo-1590069000107-233ed4969e4b?auto=format&fit=crop&q=80&w=900',
        description: 'Beton zavodga keladigan inert mahsulotni fraksiyalarga ajratib doimiy ravishda sifat nazorati olib boriladi.',
      },
      {
        id: '3',
        name: 'Gidravlik press',
        image: 'https://images.unsplash.com/photo-1574680077531-15ee809bc662?auto=format&fit=crop&q=80&w=900',
        description: 'Olingan namunalarni GOST 10180 - 2012 bo\'yicha 3; 7 va 28 sutkalik parvarishdan so\'ng press orqali sinovdan o\'tkaziladi.',
      },
      {
        id: '4',
        name: 'Abrams konusi',
        image: 'https://images.unsplash.com/photo-1581094288338-2314dddb7903?auto=format&fit=crop&q=80&w=900',
        description: 'Tayyorlangan betondan namuna olib GOST 7473 bo\'yicha uning oquvchanlik holati aniqlanadi (P1, P2, P3, P4 va P5).',
      },
    ];
  }

  private initUI() {
    window.addEventListener('scroll', () => {
      const nav = document.getElementById('navbar');
      if (window.scrollY > 50) nav?.classList.add('scrolled');
      else nav?.classList.remove('scrolled');
    });

    document.getElementById('admin-trigger')?.addEventListener('click', () => this.openAdminModal());
    document.getElementById('admin-trigger-mobile')?.addEventListener('click', () => {
      this.closeMobileMenu();
      this.openAdminModal();
    });
    
    // Mobile Menu Logic
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const mobileClose = document.getElementById('mobile-menu-close');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileLinks = document.querySelectorAll('.mobile-nav-link');

    mobileBtn?.addEventListener('click', () => {
      mobileMenu?.classList.remove('-translate-y-full');
    });

    const closeMenu = () => {
      mobileMenu?.classList.add('-translate-y-full');
    };

    mobileClose?.addEventListener('click', closeMenu);
    mobileLinks.forEach(link => link.addEventListener('click', closeMenu));
    
    document.getElementById('modal-backdrop')?.addEventListener('click', () => this.closeAdminModal());
    document.getElementById('admin-login-btn')?.addEventListener('click', () => this.handleLogin());
    document.getElementById('admin-password-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.handleLogin(); });
    
    document.getElementById('admin-close')?.addEventListener('click', () => this.closeSidebar());
    document.getElementById('admin-overlay')?.addEventListener('click', () => this.closeSidebar());
    
    document.querySelectorAll('.admin-nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const tab = target.dataset.tab;
        this.switchTab(tab!);
      });
    });

    document.getElementById('save-social-btn')?.addEventListener('click', () => this.saveSocial());
    
    document.getElementById('add-prod-btn')?.addEventListener('click', () => this.showProdForm());
    document.getElementById('prod-cancel')?.addEventListener('click', () => { this.editingProductId = null; this.hideProdForm(); });
    document.getElementById('prod-save')?.addEventListener('click', () => this.saveProd());

    document.getElementById('add-project-btn')?.addEventListener('click', () => this.showProjectForm());
    document.getElementById('p-cancel')?.addEventListener('click', () => { this.editingProjectId = null; this.hideProjectForm(); });
    document.getElementById('p-save')?.addEventListener('click', () => this.saveProject());

    document.getElementById('add-transport-btn')?.addEventListener('click', () => this.showTransModal());
    document.getElementById('close-transport-modal')?.addEventListener('click', () => this.hideTransModal());
    document.getElementById('save-transport-btn')?.addEventListener('click', () => this.saveTransportData());
    document.getElementById('close-content-modal')?.addEventListener('click', () => this.hideContentModal());
    document.getElementById('save-content-btn')?.addEventListener('click', () => this.saveContentData());
    document.getElementById('panel-viewer-close')?.addEventListener('click', () => this.closePanelViewer());
    document.getElementById('panel-viewer-backdrop')?.addEventListener('click', () => this.closePanelViewer());
    document.getElementById('panel-viewer-prev')?.addEventListener('click', () => this.movePanelViewer(-1));
    document.getElementById('panel-viewer-next')?.addEventListener('click', () => this.movePanelViewer(1));
    document.getElementById('save-hero-btn')?.addEventListener('click', () => this.saveSettings());
    document.getElementById('save-settings-btn')?.addEventListener('click', () => this.saveSettings());
    document.getElementById('export-site-data-btn')?.addEventListener('click', () => void this.exportSiteDataBackup());
    document.getElementById('import-site-data-btn')?.addEventListener('click', () => document.getElementById('site-backup-input')?.click());
    document.getElementById('site-backup-input')?.addEventListener('change', event => {
      const input = event.currentTarget as HTMLInputElement;
      const file = input.files?.[0];
      if (file) void this.importSiteDataBackup(file);
      input.value = '';
    });
    document.getElementById('save-slideshows-btn')?.addEventListener('click', () => this.saveSlideshows());
    document.getElementById('add-service-btn')?.addEventListener('click', () => this.addService());
    document.getElementById('add-lab-btn')?.addEventListener('click', () => this.addLab());

    this.handleFileSelect('prod-file-input', 'prod-img-preview', (b64) => this.tempProductImage = b64);
    this.handleProjectFileSelect();
    this.handleFileSelect('t-file-input', 't-img-preview', (b64) => this.tempTransportImage = b64);
    this.handleFileSelect('content-file-input', 'content-img-preview', (b64) => this.tempContentImage = b64);

    this.initScrollContainment();
    this.initOutsideClose();
    this.initChat();
    this.phoneAgent.init();

    window.addEventListener('keydown', (e) => {
      if (this.panelViewerOpen && e.key === 'ArrowLeft') this.movePanelViewer(-1);
      if (this.panelViewerOpen && e.key === 'ArrowRight') this.movePanelViewer(1);
      if (e.key === 'Escape') {
        if (this.panelViewerOpen) this.closePanelViewer();
        else this.closeSidebar();
      }
    });
  }

  private initOutsideClose() {
    document.addEventListener('pointerdown', (event) => {
      const target = event.target as Node | null;
      if (!target) return;

      const chatContainer = document.getElementById('chat-container');
      if (chatContainer?.contains(target)) return;

      const chatOpen = !document.getElementById('chat-panel')?.classList.contains('hidden');
      if (chatOpen) this.closeChat();
    });
  }

  private initScrollContainment() {
    const trapWheel = (event: WheelEvent) => {
      const el = event.currentTarget as HTMLElement;
      const canScroll = el.scrollHeight > el.clientHeight;
      event.stopPropagation();

      if (!canScroll) {
        event.preventDefault();
        return;
      }

      const atTop = el.scrollTop <= 0;
      const atBottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;
      if ((event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom)) {
        event.preventDefault();
      }
    };

    document.querySelectorAll<HTMLElement>('.scroll-contained, .admin-scroll').forEach((el) => {
      el.addEventListener('wheel', trapWheel, {passive: false});
    });
  }

  private lockBodyScroll() {
    this.bodyScrollLockCount += 1;
    document.body.style.overflow = 'hidden';
  }

  private unlockBodyScroll() {
    this.bodyScrollLockCount = Math.max(0, this.bodyScrollLockCount - 1);
    if (this.bodyScrollLockCount === 0) document.body.style.overflow = '';
  }

  public initChat() {
    if (this.chatButtonBound) return;
    this.chatButtonBound = true;

    document.getElementById('chat-btn')?.addEventListener('click', () => this.toggleChat());
    document.getElementById('chat-close')?.addEventListener('click', () => this.closeChat());
    document.getElementById('chat-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.sendChatMessage();
    });
  }

  private resolveSectionDomId(sectionId: string) {
    const id = this.normalizeVoiceCommand(sectionId).replace(/\s+/g, '-');
    const aliases: Record<string, string> = {
      tech: 'transport',
      texnika: 'transport',
      transport: 'transport',
      products: 'products-section',
      product: 'products-section',
      mahsulot: 'products-section',
      maxsulot: 'products-section',
      mahsulotlar: 'products-section',
      maxsulotlar: 'products-section',
      'beton-qorishma': 'concrete-mix',
      concrete: 'concrete-mix',
      'concrete-mix': 'concrete-mix',
      'maxsus-beton': 'high-performance-concrete',
      'maxsus-betonlar': 'high-performance-concrete',
      'high-performance': 'high-performance-concrete',
      'high-performance-concrete': 'high-performance-concrete',
      plita: 'plitalar-section',
      plitalar: 'plitalar-section',
      'plitalar-section': 'plitalar-section',
      gisht: 'gisht-section',
      'g-isht': 'gisht-section',
      'gisht-section': 'gisht-section',
      laboratory: 'laboratory',
      laboratoriya: 'laboratory',
      labaratoriya: 'laboratory',
      projects: 'projects',
      loyiha: 'projects',
      loyihalar: 'projects',
      'bajarilgan-ish': 'projects',
      'bajarilgan-ishlar': 'projects',
      contact: 'footer',
      aloqa: 'footer',
      footer: 'footer',
      home: 'home',
      about: 'about',
      services: 'services',
      xizmatlar: 'services',
    };
    return aliases[id] || sectionId;
  }

  private resolveSectionKey(sectionId: string) {
    const domId = this.resolveSectionDomId(sectionId);
    const keys: Record<string, string> = {
      home: 'home',
      about: 'about',
      services: 'services',
      transport: 'transport',
      'products-section': 'products',
      'concrete-mix': 'concrete-mix',
      'high-performance-concrete': 'high-performance',
      'plitalar-section': 'plitalar',
      'gisht-section': 'gisht',
      laboratory: 'laboratory',
      projects: 'projects',
      footer: 'footer',
    };
    return keys[domId] || sectionId;
  }

  private resolvePanelCollectionByDataId(panelId: string): {collection: PanelCollection; index: number} | null {
    const transportIndex = this.transport.findIndex(item => item.id === panelId);
    if (transportIndex >= 0) return {collection: 'transport', index: transportIndex};

    const productPanelIndex = this.productSections.flatMap(section => section.panels || []).findIndex(panel => panel.id === panelId);
    if (productPanelIndex >= 0) return {collection: 'product-panels', index: productPanelIndex};

    const productIndex = this.products.findIndex(item => `product-${item.id}` === panelId);
    if (productIndex >= 0) return {collection: 'products', index: productIndex};

    const projectIndex = this.projects.findIndex(item => `project-${item.id}` === panelId);
    if (projectIndex >= 0) return {collection: 'projects', index: projectIndex};

    const labIndex = this.laboratory.findIndex(item => `laboratory-${item.id}` === panelId);
    if (labIndex >= 0) return {collection: 'laboratory', index: labIndex};

    return null;
  }

  private showAnimatedModal(id: string) {
    const modal = document.getElementById(id);
    const card = modal?.firstElementChild as HTMLElement | null;
    if (!modal) return;
    modal.classList.remove('hidden', 'opacity-100');
    modal.classList.add('flex', 'opacity-0');
    card?.classList.add('opacity-0', 'scale-95', 'translate-y-6');
    card?.classList.remove('opacity-100', 'scale-100', 'translate-y-0');
    window.setTimeout(() => {
      modal.classList.remove('opacity-0');
      modal.classList.add('opacity-100');
      card?.classList.remove('opacity-0', 'scale-95', 'translate-y-6');
      card?.classList.add('opacity-100', 'scale-100', 'translate-y-0');
    }, 20);
  }

  private hideAnimatedModal(id: string, after?: () => void) {
    const modal = document.getElementById(id);
    const card = modal?.firstElementChild as HTMLElement | null;
    if (!modal) {
      after?.();
      return;
    }
    modal.classList.remove('opacity-100');
    modal.classList.add('opacity-0');
    card?.classList.add('opacity-0', 'scale-95', 'translate-y-6');
    card?.classList.remove('opacity-100', 'scale-100', 'translate-y-0');
    window.setTimeout(() => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      after?.();
    }, 300);
  }

  private toggleChat() {
    const panel = document.getElementById('chat-panel');
    panel?.classList.toggle('hidden');
    if (!panel?.classList.contains('hidden')) {
      this.greetChat();
      setTimeout(() => (document.getElementById('chat-input') as HTMLInputElement | null)?.focus(), 20);
    }
  }

  private closeChat() {
    document.getElementById('chat-panel')?.classList.add('hidden');
  }

  private greetChat() {
    if (this.chatGreeted) return;
    this.chatGreeted = true;
    this.appendChatMessage('Assalomu aleykum, men Oqqush Beton kompaniyasining virtual yordamchisiman. Qanday yordam bera olaman?', 'assistant');
  }

  private userAskedPanelOpen(text: string) {
    return ['panel och', 'panelni och', 'ochib ber', 'korsat', 'ko rsat'].some(phrase => text.includes(phrase));
  }

  private resolveFallbackInfoPanel(text: string): {collection: PanelCollection; index: number; sectionId: string; label: string} | null {
    if (!this.hasInfoIntent(text)) return null;
    if (!this.isVagueSectionCommand(text) && !this.userAskedPanelOpen(text) && !text.includes('shu haqda') && !text.includes('u haqda')) return null;
    const sectionTarget = this.resolveNavigationTarget(text);
    const key = sectionTarget?.type === 'section' ? sectionTarget.key : '';
    if (!key) return null;
    if (!key) return null;
    return this.resolveFirstReadingTarget(`section-${key}`)
      || this.resolveFirstReadingTarget(key)
      || this.resolveFirstReadingTarget(key === 'products' ? 'products-all' : `${key}-all`);
  }

  private isExactPanelKeyword(text: string, target: {label: string; collection: PanelCollection; index: number}) {
    const label = this.normalizeVoiceCommand(target.label);
    if (!label) return false;
    if (this.findKeywordPosition(text, label) >= 0) return true;
    const entry = this.getAllPanelKeywordEntries().find(item => (
      item.collection === target.collection && item.index === target.index
    ));
    return (entry?.keywords || []).some(keyword => {
      const normalizedKeyword = this.normalizeVoiceCommand(keyword);
      return normalizedKeyword.length >= 4 && this.findKeywordPosition(text, normalizedKeyword) >= 0;
    });
  }

  private resolveFirstReadingTarget(key: string): {collection: PanelCollection; index: number; sectionId: string; label: string} | null {
    if (key === 'transport-all') return {collection: 'transport', index: 0, sectionId: 'transport', label: this.transport[0]?.name || 'Texnika'};
    if (key.startsWith('transport-')) {
      const index = Number(key.replace('transport-', ''));
      if (Number.isFinite(index) && this.transport[index]) return {collection: 'transport', index, sectionId: 'transport', label: this.transport[index].name};
    }
    if (key === 'products-all') return {collection: 'products', index: 0, sectionId: 'products-section', label: this.products[0]?.name || 'Mahsulotlar'};
    if (key === 'laboratory-all') return {collection: 'laboratory', index: 0, sectionId: 'laboratory', label: 'Laboratoriya'};
    if (key === 'projects-all') return {collection: 'projects', index: 0, sectionId: 'projects', label: this.projects[0]?.name || 'Bajarilgan ishlar'};
    if (key === 'all-panels') return {collection: 'products', index: 0, sectionId: 'products-section', label: this.products[0]?.name || 'Mahsulotlar'};

    const sectionMap: Record<string, string> = {
      'section-gisht': 'gisht',
      'section-plitalar': 'plitalar',
      'section-concrete': 'concreteMix',
    };
    const sectionId = sectionMap[key];
    if (sectionId) {
      const panels = this.productSections.flatMap(section => section.panels || []);
      const firstPanel = this.productSections.find(section => section.id === sectionId)?.panels?.[0];
      const index = firstPanel ? panels.findIndex(panel => panel.id === firstPanel.id) : -1;
      if (index >= 0) return this.presentationByPanelAlias(panels[index].id);
    }
    if (key.startsWith('product-panel-')) return this.presentationByPanelAlias(key.replace('product-panel-', ''));
    return null;
  }

  private getProductReadablePanels(): Pick<PanelViewerItem, 'title' | 'description' | 'meta' | 'eyebrow'>[] {
    return [
      ...this.products.map(item => ({
        title: item.name,
        description: item.description,
        eyebrow: 'Mahsulot',
      })),
      ...this.productSections.flatMap(section => (section.panels || []).map(panel => ({
        title: panel.name,
        description: panel.description,
        meta: panel.meta,
        eyebrow: section.name,
      }))),
    ];
  }

  private isVagueInfoCommand(text: string) {
    return [
      'u haqida', 'shu haqida', 'osha haqida', 'o sha haqida', 'u haqida malumot',
      'shu bolim haqida', 'shu bo lim haqida', 'o sha bolim haqida', 'osha bolim haqida',
      'u haqida malumot ber', 'malumot ber', 'ma lumot ber',
    ].some(phrase => text.includes(phrase));
  }

  private panelFromTransport(item: Transport) {
    return {
      title: item.name,
      description: item.specs,
      meta: item.available ? 'Mavjud' : 'Mavjud emas',
      eyebrow: 'Texnika',
    };
  }

  private resolvePanelKeywordTarget(text: string): {collection: PanelCollection; index: number; sectionId: string; label: string} | null {
    const candidates = this.getAllPanelKeywordEntries();
    const matches: Array<{candidate: typeof candidates[number]; score: number; length: number; exact: boolean; phrase: boolean}> = [];

    candidates.forEach(candidate => {
      candidate.keywords
        .map(keyword => keyword.trim())
        .filter(keyword => this.isStrongPanelKeyword(keyword))
        .forEach(keyword => {
          const normalizedKeyword = this.normalizeVoiceCommand(keyword);
          const score = this.scoreKeywordMatch(text, normalizedKeyword);
          if (score <= 0) return;
          matches.push({
            candidate,
            score,
            length: normalizedKeyword.length,
            exact: normalizedKeyword === this.normalizeVoiceCommand(candidate.label),
            phrase: this.findKeywordPosition(text, normalizedKeyword) >= 0,
          });
        });
    });

    if (!matches.length) return null;
    matches.sort((a, b) => Number(b.phrase) - Number(a.phrase) || b.score - a.score || Number(b.exact) - Number(a.exact) || b.length - a.length);
    const best = matches[0];
    const runnerUp = matches.find(match => (
      `${match.candidate.collection}:${match.candidate.index}` !== `${best.candidate.collection}:${best.candidate.index}`
    ));
    if (best.candidate.index < 0 || best.score < 620) return null;
    if (!best.phrase && runnerUp && runnerUp.score >= best.score - 120) return null;
    if (!best.phrase && !best.exact && best.score < 900) return null;
    const found = best.candidate;
    return {
      collection: found.collection,
      index: found.index,
      sectionId: found.sectionId,
      label: found.label,
    };
  }

  private isStrongPanelKeyword(keyword: string) {
    const normalized = this.normalizeVoiceCommand(keyword);
    if (['kran', 'sita'].includes(normalized)) return true;
    if (normalized.length >= 5) return true;
    if (/\d/.test(normalized) && normalized.length >= 3) return true;
    return normalized.split(/\s+/).length >= 2;
  }

  private findKeywordPosition(text: string, keyword: string) {
    const normalizedKeyword = this.normalizeVoiceCommand(keyword);
    if (!normalizedKeyword) return -1;
    const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const suffixes = '(?:si|sini|sining|siga|sida|sidan|ni|ning|ga|da|dan|lar|lari|larni|larga|larda|lardan)?';
    const regex = new RegExp(`(^|\\s)${escaped}${suffixes}(?=\\s|$)`, 'g');
    let match: RegExpExecArray | null;
    let foundAt = -1;
    while ((match = regex.exec(text)) !== null) {
      foundAt = match.index + (match[1]?.length || 0);
    }
    return foundAt;
  }

  private getAllPanelKeywordEntries(): Array<{
    id: string;
    collection: PanelCollection;
    index: number;
    sectionId: string;
    label: string;
    keywords: string[];
  }> {
    const normalize = (value: string) => this.normalizeVoiceCommand(value);
    const sectionIdMap: Record<string, string> = {
      concreteMix: 'concrete-mix',
      highPerformance: 'high-performance-concrete',
      plitalar: 'plitalar-section',
      gisht: 'gisht-section',
    };
    const expand = (...values: string[]) => {
      const keywords = new Set<string>();
      values
        .flatMap(value => [value, normalize(value)])
        .map(value => value.trim())
        .filter(value => this.isStrongPanelKeyword(value))
        .forEach(value => {
          keywords.add(value);
          const pluralVariant = value.endsWith('lar') ? value.slice(0, -3) : `${value}lar`;
          if (this.isStrongPanelKeyword(pluralVariant)) keywords.add(pluralVariant);
        });
      return Array.from(keywords);
    };
    const entries: ReturnType<typeof this.getAllPanelKeywordEntries> = [];
    const domKeywords = (panelId: string) => {
      const el = Array.from(document.querySelectorAll<HTMLElement>('[data-panel]'))
        .find(item => item.dataset.panel === panelId);
      return [
        ...(el?.dataset.keywords || '').split(','),
        el?.querySelector<HTMLElement>('[data-panel-title]')?.textContent || '',
      ].map(item => item.trim()).filter(Boolean);
    };

    const transportAliases = [
      ['beton nasos', 'beton nassos', 'nasos'],
      ['ekskavator', 'ekskavatorlar'],
      ['yuk mashina', 'yuk mashinalari', 'pretsep'],
      ['beton mikser', 'mikser'],
      ['pogruzchik', 'yuklagich'],
      ['kran'],
    ];
    this.transport.forEach((item, index) => {
      entries.push({
        id: item.id,
        collection: 'transport',
        index,
        sectionId: 'transport',
        label: item.name,
        keywords: expand(item.name, `texnika ${item.name}`, `transport ${item.name}`, ...(transportAliases[index] || []), ...domKeywords(item.id)),
      });
    });

    const productPanels = this.productSections.flatMap(section => (section.panels || []).map(panel => ({section, panel})));
    productPanels.forEach(({section, panel}, index) => {
      entries.push({
        id: panel.id,
        collection: 'product-panels',
        index,
        sectionId: sectionIdMap[section.id] || 'products-section',
        label: panel.name,
        keywords: expand(panel.name, `${section.name} ${panel.name}`, ...this.panelAliases(panel.id).filter(alias => alias.length > 3 || /\d/.test(alias)), ...domKeywords(panel.id)),
      });
    });

    this.products.forEach((item, index) => {
      entries.push({
        id: `product-${item.id}`,
        collection: 'products',
        index,
        sectionId: 'products-section',
        label: item.name,
        keywords: expand(item.name, `mahsulot ${item.name}`, ...domKeywords(`product-${item.id}`)),
      });
    });

    this.getLaboratoryViewerItems().forEach((item, index) => {
      const labId = this.laboratory[index]?.id || String(index + 1);
      entries.push({
        id: `laboratory-${labId}`,
        collection: 'laboratory',
        index,
        sectionId: 'laboratory',
        label: item.title,
        keywords: expand(item.title, `laboratoriya ${item.title}`, `labaratoriya ${item.title}`, ...domKeywords(`laboratory-${labId}`)),
      });
    });

    this.projects.forEach((item, index) => {
      entries.push({
        id: `project-${item.id}`,
        collection: 'projects',
        index,
        sectionId: 'projects',
        label: item.name,
        keywords: expand(item.name, `bajarilgan ish ${item.name}`, `loyiha ${item.name}`, ...domKeywords(`project-${item.id}`)),
      });
    });

    return this.enrichPanelKeywords(entries);
  }

  private enrichPanelKeywords<T extends Array<{
    id: string;
    collection: PanelCollection;
    index: number;
    sectionId: string;
    label: string;
    keywords: string[];
  }>>(entries: T): T {
    const blocked = new Set([
      'beton',
      'mahsulot',
      'maxsulot',
      'texnika',
      'transport',
      'laboratoriya',
      'labaratoriya',
      'bajarilgan',
      'ishlar',
      'panel',
      'bolim',
      'bo lim',
      'haqida',
      'malumot',
      'ma lumot',
      'xizmat',
      'rasm',
      'video',
    ]);
    const wordTargets = new Map<string, Set<string>>();
    entries.forEach(entry => {
      const targetKey = `${entry.collection}:${entry.index}`;
      [entry.label, ...entry.keywords].forEach(value => {
        this.normalizeVoiceCommand(value)
          .split(/\s+/)
          .map(word => word.trim())
          .filter(word => word.length >= 5 && !blocked.has(word))
          .forEach(word => {
            if (!wordTargets.has(word)) wordTargets.set(word, new Set());
            wordTargets.get(word)?.add(targetKey);
          });
      });
    });

    entries.forEach(entry => {
      const targetKey = `${entry.collection}:${entry.index}`;
      const keywords = new Set(entry.keywords);
      this.normalizeVoiceCommand(entry.label)
        .split(/\s+/)
        .map(word => word.trim())
        .filter(word => word.length >= 5 && wordTargets.get(word)?.size === 1 && wordTargets.get(word)?.has(targetKey))
        .forEach(word => {
          keywords.add(word);
          if (word.endsWith('lar')) keywords.add(word.slice(0, -3));
        });
      entry.keywords = Array.from(keywords);
    });

    return entries;
  }

  private resolveTransportAliasTarget(text: string) {
    const aliases = [
      {index: 0, words: ['beton nasos', 'beton nassos', 'nasos']},
      {index: 1, words: ['ekskavator', 'ekskavatorlar']},
      {index: 2, words: ['yuk mashina', 'yuk mashinalari', 'pretsep']},
      {index: 3, words: ['beton mikser', 'mikser']},
      {index: 4, words: ['pogruzchik', 'yuklagich']},
      {index: 5, words: ['kran']},
    ];
    let found: {index: number; words: string[]} | null = null;
    let foundAt = -1;
    aliases.forEach(item => {
      item.words.forEach(word => {
        const at = this.findKeywordPosition(text, word);
        if (at > foundAt) {
          foundAt = at;
          found = item;
        }
      });
    });
    if (!found || !this.transport[found.index]) return null;
    return {
      collection: 'transport' as const,
      index: found.index,
      sectionId: 'transport',
      label: this.transport[found.index].name,
    };
  }

  private resolveProductPanelAliasIndex(text: string) {
    const panels = this.productSections.flatMap(section => section.panels || []);
    let foundIndex = -1;
    let foundAt = -1;

    panels.forEach((panel, index) => {
      const aliases = [
        this.normalizeVoiceCommand(panel.name),
        ...this.panelAliases(panel.id),
      ].filter(Boolean);

      aliases.forEach(alias => {
        const at = text.lastIndexOf(alias);
        if (at > foundAt) {
          foundAt = at;
          foundIndex = index;
        }
      });
    });

    return foundIndex;
  }

  private presentationByPanelAlias(panelId: string) {
    const index = this.productSections.flatMap(section => section.panels || []).findIndex(panel => panel.id === panelId);
    if (index < 0) return null;
    const panel = this.productSections.flatMap(section => section.panels || [])[index];
    const section = this.productSections.find(item => item.panels?.some(p => p.id === panelId));
    const sectionIdMap: Record<string, string> = {
      concreteMix: 'concrete-mix',
      highPerformance: 'high-performance-concrete',
      plitalar: 'plitalar-section',
      gisht: 'gisht-section',
    };
    return {
      collection: 'product-panels' as const,
      index,
      sectionId: section ? sectionIdMap[section.id] || 'products-section' : 'products-section',
      label: panel?.name || 'Panel',
    };
  }

  private panelAliases(panelId: string) {
    const aliases: Record<string, string[]> = {
      'hom-gisht': ['hom gisht', 'xom gisht'],
      'pishiq-gisht': ['pishiq gisht'],
      'plita-12': ['12 mm armatura', '12 armatura', 'plita 12'],
      'plita-14': ['14 mm armatura', '14 armatura', 'plita 14'],
      m100: ['m100'],
      m150: ['m150'],
      m200: ['m200'],
      m250: ['m250'],
      m300: ['m300'],
      m350: ['m350'],
      m400: ['m400'],
      m450: ['m450'],
      m550: ['m550'],
    };
    return aliases[panelId] || [];
  }

  private normalizeVoiceCommand(text: string) {
    return text
      .toLowerCase()
      .replace(/[\u2018\u2019\x60\u00b4]/g, String.fromCharCode(39))
      .replace(/g'/g, 'g')
      .replace(/o'/g, 'o')
      .replace(/[^\p{L}\p{N}\s']/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private stripUzbekSuffix(word: string) {
    return word.replace(/(larning|laridan|larida|larga|larni|lari|ning|dan|ga|da|ni|lar)$/i, '');
  }

  private commandTokens(text: string) {
    return this.normalizeVoiceCommand(text)
      .split(/\s+/)
      .map(word => this.stripUzbekSuffix(word.trim()))
      .filter(word => word.length > 1);
  }

  private scoreKeywordMatch(text: string, keyword: string) {
    const normalizedText = this.normalizeVoiceCommand(text);
    const normalizedKeyword = this.normalizeVoiceCommand(keyword);
    if (!normalizedText || !normalizedKeyword) return 0;

    const exactAt = this.findKeywordPosition(normalizedText, normalizedKeyword);
    if (exactAt >= 0) return 1200 + normalizedKeyword.length * 3 - exactAt;

    const textTokens = this.commandTokens(normalizedText);
    const keywordTokens = this.commandTokens(normalizedKeyword);
    if (!keywordTokens.length) return 0;

    let matched = 0;
    let prefixMatched = 0;
    keywordTokens.forEach(keywordToken => {
      if (textTokens.includes(keywordToken)) {
        matched += 1;
        return;
      }
      if (keywordToken.length >= 4 && textTokens.some(token => token.startsWith(keywordToken) || keywordToken.startsWith(token))) {
        prefixMatched += 1;
      }
    });

    const tokenScore = matched + prefixMatched * 0.72;
    if (tokenScore <= 0) return 0;
    const coverage = tokenScore / keywordTokens.length;
    if (coverage < (keywordTokens.length === 1 ? 0.7 : 0.68)) return 0;
    return Math.round(450 + coverage * 420 + normalizedKeyword.length * 2);
  }

  private hasNavigationIntent(text: string) {
    return [
      ' och', 'och ', 'ochib', 'korsat', 'ko rsat', 'olib bor', 'obor', 'otkaz', 'ot ',
      'ga ot', 'ga bor', 'ga olib', 'ga obor', 'boraylik', 'kir', 'tepaga', 'pastga',
      ' bolim', ' bo lim', 'section',
    ].some(phrase => text.includes(phrase));
  }

  private hasInfoIntent(text: string) {
    return [
      'malumot', 'ma lumot', 'haqida', 'nima', 'qanaqa', 'qanday', 'bor mi', 'bormi',
      'kerak', 'ayt', 'tushuntir', 'sanab ber', 'royxat', 'ro yxat',
    ].some(phrase => text.includes(phrase));
  }

  private isVagueSectionCommand(text: string) {
    return [
      'shu bolim', 'shu bo lim', 'o sha bolim', 'osha bolim', 'mana shu bolim',
      'o sha bo lim', 'osha bo lim', 'mana shu bo lim', 'manashu bolim',
      'bu bolim', 'bu bo lim', 'bolimni och', 'bo limni och',
    ].some(phrase => text.includes(phrase));
  }

  private resolveNavigationTarget(text: string): NavigationTarget | null {
    const sectionTargets = [
      {id: 'home', label: 'Bosh sahifa', key: 'home', words: ['bosh sahifa', 'asosiy sahifa', 'asosiy', 'home', 'tepaga', 'banner', 'main']},
      {id: 'about', label: 'Biz haqimizda', key: 'about', words: ['biz haqimizda', 'haqimizda', 'biz haqda', 'kompaniya haqida', 'kompaniya tarixi', 'tarix', 'about']},
      {id: 'services', label: 'Xizmatlar', key: 'services', words: ['xizmatlar', 'xizmat', 'nima ish qilasizlar', 'narxlar', 'narx', 'service', 'services']},
      {id: 'transport', label: 'Texnika', key: 'transport', words: ['texnika', 'texnikalar', 'transport', 'ijara transport', 'uskunalar', 'mashinalar', 'beton nasos', 'ekskavator', 'yuk mashina', 'beton mikser', 'pogruzchik', 'kran']},
      {id: 'products-section', label: 'Mahsulotlar', key: 'products', words: [
        'maxsulotlar', 'mahsulotlar', 'maxsulot', 'mahsulot', 'product', 'products', 'yuvilgan', 'yuvilmagan', 'shagal', 'shag al',
        'shag', 'shagʻal', 'shag`al', 'sheben', 'shaben', 'shpen', 'pesok', 'qum',
        'inert material', 'tosh', 'qum shag al',
      ]},
      {id: 'concrete-mix', label: 'Tayyor beton aralashma', key: 'concrete-mix', words: ['beton qorishma', 'qorishma', 'concrete mix', 'tayyor beton aralashma', 'm100', 'm150', 'm200', 'm250']},
      {id: 'high-performance-concrete', label: 'Yuqori mustahkamlikdagi maxsus betonlar', key: 'high-performance', words: ['yuqori sifat', 'high performance', 'yuqori mustahkam', 'maxsus beton', 'm300', 'm350', 'm400', 'm450', 'm550']},
      {id: 'plitalar-section', label: 'Beton plitalar', key: 'plitalar', words: ['plita', 'plitalar', 'beton plita', 'beton plitalar', 'armatura']},
      {id: 'gisht-section', label: "G'isht mahsuloti", key: 'gisht', words: ['gisht', 'gish', 'g isht', 'hom gisht', 'xom gisht', 'pishiq gisht']},
      {id: 'laboratory', label: 'Laboratoriya', key: 'laboratory', words: ['laboratoriya', 'labaratoriya', 'laboratory', 'lab', 'sinov', 'test', 'sita', 'press', 'abrams']},
      {id: 'projects', label: 'Bajarilgan ishlar', key: 'projects', words: ['bajarilgan ish', 'bajarilgan ishlar', 'qilingan ishlar', 'loyiha', 'loyihalar', 'projects', 'video', 'reel']},
      {id: 'footer', label: 'Aloqa', key: 'footer', words: ['aloqa', 'aloqalar', 'boglanish', 'telefon', 'telefon raqam', 'manzil', 'kontakt', 'contact', 'pastga', 'telegram', 'instagram', 'youtube', 'facebook']},
    ];

    const sectionMatch = sectionTargets
      .flatMap(target => target.words.map(word => ({target, word, score: this.scoreKeywordMatch(text, word)})))
      .filter(match => match.score >= 500)
      .sort((a, b) => b.score - a.score || b.word.length - a.word.length)[0];
    const section = sectionMatch?.target;
    if (section) return {type: 'section', id: section.id, label: section.label, key: section.key};

    if (!text.includes('admin')) return null;
    const adminTabs = [
      {tab: 'social', label: 'Admin aloqa', words: ['aloqa', 'social', 'telegram', 'telefon']},
      {tab: 'hero', label: 'Admin bosh sahifa', words: ['banner', 'bosh sahifa', 'hero']},
      {tab: 'products', label: 'Admin mahsulotlar', words: ['maxsulot', 'mahsulot']},
      {tab: 'projects', label: 'Admin bajarilgan ishlar', words: ['loyiha', 'bajarilgan ish']},
      {tab: 'transport', label: 'Admin texnika', words: ['texnika', 'transport']},
      {tab: 'services', label: 'Admin xizmatlar', words: ['xizmat']},
      {tab: 'laboratory', label: 'Admin laboratoriya', words: ['laboratoriya', 'labaratoriya']},
      {tab: 'slideshows', label: 'Admin fon rasmlari', words: ['rasm', 'slayd', 'slideshow']},
      {tab: 'settings', label: 'Admin sozlamalar', words: ['sozlama', 'parol']},
    ];
    const admin = adminTabs.find(target => target.words.some(word => text.includes(word)));
    return {type: 'admin', tab: admin?.tab, label: admin?.label || 'Admin panel', key: `admin-${admin?.tab || 'login'}`};
  }

  private isMobileViewport() {
    return window.matchMedia('(max-width: 767px)').matches;
  }

  private async sendChatMessage() {
    const input = document.getElementById('chat-input') as HTMLInputElement | null;
    const text = input?.value.trim();
    if (!text || this.chatBusy) return;

    input.value = '';
    this.chatBusy = true;
    this.appendChatMessage(text, 'user');
    const thinking = this.appendChatMessage('Javob tayyorlanmoqda...', 'assistant');

    try {
      await this.waitForBrowserIdle();
      const answer = this.buildChatAnswer(text);
      this.renderAssistantMessage(thinking, answer);
      this.scrollChatToBottom();
    } finally {
      this.chatBusy = false;
    }
  }

  private buildChatAnswer(text: string) {
    const normalized = this.normalizeVoiceCommand(text);
    const localAnswer = this.buildLocalChatAnswer(normalized);
    if (localAnswer) return localAnswer;

    if (['salom', 'assalom', 'assalomu alaykum', 'assalomu aleykum'].some(word => normalized.includes(word))) {
      return 'Assalomu aleykum. Oqqush Beton haqida qaysi bo\'lim ma\'lumotini bilmoqchisiz? Masalan: mahsulotlar, texnika, laboratoriya, xizmatlar yoki aloqa.';
    }

    if (['rahmat', 'raxmat', 'tashakkur'].some(word => normalized.includes(word))) {
      return 'Arzimaydi. Oqqush Beton bo\'limlari yoki mahsulotlari haqida yana savol yozishingiz mumkin.';
    }

    return 'Bu ma\'lumot Oqqush Beton ma\'lumotlarida ko\'rsatilmagan. Mahsulotlar, texnika, laboratoriya, xizmatlar, loyihalar yoki aloqa haqida so\'rashingiz mumkin.';
  }

  private buildLocalChatAnswer(text: string) {
    const sectionTarget = this.resolveNavigationTarget(text);
    const panelTarget = this.resolvePanelKeywordTarget(text);
    if (sectionTarget?.type === 'section' && !panelTarget) {
      return this.buildSectionInfoAnswer(sectionTarget.key);
    }

    if (panelTarget && (this.hasInfoIntent(text) || this.userAskedPanelOpen(text) || this.isExactPanelKeyword(text, panelTarget))) {
      const item = this.getPanelViewerItem(panelTarget.collection, panelTarget.index);
      return item ? this.formatPanelAnswer([item]) : 'Bu ma\'lumot Oqqush Beton ma\'lumotlarida ko\'rsatilmagan';
    }

    const fallbackPanel = this.resolveFallbackInfoPanel(text);
    if (fallbackPanel) {
      const item = this.getPanelViewerItem(fallbackPanel.collection, fallbackPanel.index);
      return item ? this.formatPanelAnswer([item]) : 'Bu ma\'lumot Oqqush Beton ma\'lumotlarida ko\'rsatilmagan';
    }

    if (!this.hasInfoIntent(text)) return null;

    if (['texnika', 'transport', 'nasos', 'mikser', 'kran', 'ekskavator', 'yuk mashina'].some(word => text.includes(word))) {
      return this.formatPanelAnswer(this.transport.map(item => this.panelFromTransport(item)));
    }

    if (['mahsulot', 'maxsulot', 'shagal', 'shag al', 'qum', 'pesok', 'gisht', 'plita', 'beton'].some(word => text.includes(word))) {
      return this.formatPanelAnswer(this.getProductReadablePanels());
    }

    if (['laboratoriya', 'labaratoriya', 'sita', 'press', 'abrams', 'qotish'].some(word => text.includes(word))) {
      return this.formatPanelAnswer(this.getLaboratoryViewerItems());
    }

    if (['bajarilgan ish', 'loyiha', 'loyihalar', 'video'].some(word => text.includes(word))) {
      return this.formatPanelAnswer(this.projects.map(item => ({
        title: item.name,
        image: item.image,
        description: `${item.location}\n${item.year}`,
        eyebrow: 'Bajarilgan ish',
      })));
    }

    if (['xizmat', 'xizmatlar', 'nima qilasizlar'].some(word => text.includes(word))) {
      return this.formatPanelAnswer(this.services.map(item => ({
        title: item.name,
        image: item.image,
        description: item.description,
        eyebrow: 'Xizmat',
      })));
    }

    if (['aloqa', 'telefon', 'telegram', 'instagram', 'manzil'].some(word => text.includes(word))) {
      return [
        `1. **Telefonlar** - ${this.social.ph || 'ko\'rsatilmagan'}`,
        `2. **Telegram** - ${this.social.tg || 'ko\'rsatilmagan'}`,
        `3. **Instagram** - ${this.social.ig || 'ko\'rsatilmagan'}`,
      ].join('\n');
    }

    return null;
  }

  private buildSectionInfoAnswer(sectionKey: string) {
    if (['transport', 'tech', 'texnika'].includes(sectionKey)) {
      return this.formatPanelAnswer(this.transport.map(item => this.panelFromTransport(item)));
    }

    if (['products', 'mahsulotlar'].includes(sectionKey)) {
      return this.formatPanelAnswer(this.getProductReadablePanels());
    }

    if (sectionKey === 'laboratory') {
      return this.formatPanelAnswer(this.getLaboratoryViewerItems());
    }

    if (sectionKey === 'projects') {
      return this.formatPanelAnswer(this.projects.map(item => ({
        title: item.name,
        image: item.image,
        description: `${item.location}\n${item.year}`,
        eyebrow: 'Bajarilgan ish',
      })));
    }

    if (sectionKey === 'services') {
      return this.formatPanelAnswer(this.services.map(item => ({
        title: item.name,
        image: item.image,
        description: item.description,
        eyebrow: 'Xizmat',
      })));
    }

    if (sectionKey === 'about') {
      return [
        '1. **OQQUSH BETON** - Zamonaviy qurilish kompaniyasi, ishonch, tajriba va sifatga sodiqlik tamoyillari asosida ishlaydi.',
        '2. **ISHLAB CHIQARISH** - Zamonaviy uskunalar va qat\'iy laboratoriya nazorati ostida olib boriladi.',
        '3. **TEXNIKA VA QUVVAT** - Yirik hajmdagi buyurtmalarni qisqa muddatda, sifatni pasaytirmasdan bajaradi.',
      ].join('\n');
    }

    if (sectionKey === 'footer') {
      return [
        `1. **Telefonlar** - ${this.social.ph || 'ko\'rsatilmagan'}`,
        `2. **Telegram** - ${this.social.tg || 'ko\'rsatilmagan'}`,
        `3. **Instagram** - ${this.social.ig || 'ko\'rsatilmagan'}`,
      ].join('\n');
    }

    return null;
  }

  private formatPanelAnswer(items: Pick<PanelViewerItem, 'title' | 'description' | 'meta'>[]) {
    const valid = items.filter(item => item.title || item.description || item.meta);
    if (!valid.length) return 'Bu ma\'lumot Oqqush Beton ma\'lumotlarida ko\'rsatilmagan';
    return valid.map((item, index) => {
      const details = [
        ...(item.description || '').split(/\n+/).map(line => line.trim()).filter(Boolean),
        ...(item.meta ? [item.meta] : []),
      ].join('; ');
      return `${index + 1}. **${item.title || 'Ma\'lumot'}** - ${details || 'Bu ma\'lumot Oqqush Beton ma\'lumotlarida ko\'rsatilmagan'}`;
    }).join('\n');
  }

  private appendChatMessage(text: string, role: 'user' | 'assistant') {
    const messages = document.getElementById('chat-messages')!;
    const bubble = document.createElement('div');
    bubble.className = role === 'user'
      ? 'ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-cyan-300 px-4 py-3 text-sm font-semibold text-black'
      : 'max-w-[85%] rounded-2xl rounded-tl-sm bg-white/10 px-4 py-3 text-sm leading-relaxed text-white/85';
    bubble.textContent = text;
    messages.appendChild(bubble);
    this.scrollChatToBottom();
    return bubble;
  }

  private renderAssistantMessage(bubble: HTMLElement, text: string) {
    bubble.textContent = '';
    const lines = text
      .replace(/\bMijoz:\s*/gi, '')
      .replace(/\bJavob:\s*/gi, '')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    lines.forEach((line, index) => {
      const row = document.createElement('div');
      if (index > 0) row.className = 'mt-2';

      const numbered = line.match(/^(\d+)\.\s*(?:\*\*)?(.+?)(?:\*\*)?\s*[-–—]\s*(.+)$/);
      if (numbered) {
        row.append(`${numbered[1]}. `);
        const strong = document.createElement('strong');
        strong.className = 'font-black text-white';
        strong.textContent = numbered[2].trim();
        row.append(strong, ` - ${numbered[3].trim()}`);
      } else {
        this.appendInlineBold(row, line);
      }

      bubble.appendChild(row);
    });
  }

  private appendInlineBold(parent: HTMLElement, text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    parts.forEach((part) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const strong = document.createElement('strong');
        strong.className = 'font-black text-white';
        strong.textContent = part.slice(2, -2);
        parent.appendChild(strong);
      } else {
        parent.append(part);
      }
    });
  }

  private scrollChatToBottom() {
    const messages = document.getElementById('chat-messages');
    if (messages) messages.scrollTop = messages.scrollHeight;
  }

  private handleFileSelect(inputId: string, previewId: string, callback: (base64: string) => void) {
    const input = document.getElementById(inputId) as HTMLInputElement;
    input?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        if (!file.type.startsWith('image/')) {
          this.toast('Faqat rasm fayl yuklang', true);
          input.value = '';
          return;
        }
        if (file.size > MAX_UPLOAD_SIZE) {
          this.toast('Rasm hajmi juda katta (maks: 100MB)', true);
          input.value = '';
          return;
        }
        try {
          const base64 = await this.readImageAsStoredValue(file);
          const previewUrl = await this.getMediaBlobUrl(base64);
          const preview = document.getElementById(previewId);
          if (preview) preview.style.backgroundImage = `url(${previewUrl})`;
          callback(base64);
        } catch (error) {
          console.error('Image upload error:', error);
          this.toast('Rasmni yuklab bo\'lmadi', true);
        }
      }
    });
  }

  private handleProjectFileSelect() {
    const input = document.getElementById('p-file-input') as HTMLInputElement;
    input?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      if (!isImage && !isVideo) {
        this.toast('Faqat rasm yoki video yuklang', true);
        input.value = '';
        return;
      }

      if (file.size > MAX_UPLOAD_SIZE) {
        this.toast(isVideo ? 'Video juda katta (maks: 100MB)' : 'Rasm juda katta (maks: 100MB)', true);
        input.value = '';
        return;
      }

      this.tempProjectMediaType = isVideo ? 'video' : 'image';
      if (isVideo) {
        const key = await this.storeMediaBlob(file);
        this.tempProjectImage = key;
        this.renderProjectPreview(URL.createObjectURL(file), 'video');
        return;
      }

      const base64 = await this.readImageAsStoredValue(file);
      this.tempProjectImage = base64;
      this.renderProjectPreview(base64, 'image');
    });
  }

  private initAnimations() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal, .reveal-stagger').forEach(el => observer.observe(el));
  }

  private initSlideshows() {
    this.slideshowTimers.forEach(timer => window.clearInterval(timer));
    this.slideshowTimers = [];
    const isMobile = this.isMobileViewport();
    const sections = document.querySelectorAll('.slideshow-section');
    sections.forEach(sec => {
      const group = (sec as HTMLElement).dataset.group;
      if (!group || !this.slideImages[group]) return;
      const sectionEl = sec as HTMLElement;
      const isPrioritySection = sectionEl.id === 'home' || sectionEl.id === 'about' || sectionEl.getBoundingClientRect().top < window.innerHeight * 1.4;
      
      const imageWidth = isMobile ? 640 : 1800;
      const images = this.slideImages[group].map(img => this.formatImg(img, imageWidth)).filter(Boolean).reverse();
      const container = sec.querySelector('.slide-container');
      if (!container || images.length === 0) return;
      container.innerHTML = '';
      sectionEl.classList.remove('bg-ready');
      if (isMobile) {
        const div = document.createElement('div');
        div.className = 'slide-div opacity-100';
        const overlay = document.createElement('div');
        overlay.className = 'absolute inset-0 z-[1] bg-black/10';
        container.appendChild(div);
        container.appendChild(overlay);
        this.queueBackgroundLoad(div, images[0], sectionEl, true);
        this.hydrateProjectMediaElements(container);
        return;
      }
      if (images.length === 1) images.push(images[0]);
      
      const div1 = document.createElement('div');
      div1.className = 'slide-div opacity-100';
      
      const div2 = document.createElement('div');
      div2.className = 'slide-div opacity-0';

      const overlay = document.createElement('div');
      overlay.className = 'absolute inset-0 z-[1] bg-black/25';

      container.appendChild(div1);
      container.appendChild(div2);
      container.appendChild(overlay);
      this.queueBackgroundLoad(div1, images[0], sectionEl, isPrioritySection);
      this.queueBackgroundLoad(div2, images[1], sectionEl, isPrioritySection && sectionEl.id === 'home');
      this.hydrateProjectMediaElements(container);

      let current = 0;
      let activeDiv = div1;
      let nextDiv = div2;

      const timer = window.setInterval(() => {
        current = (current + 1) % images.length;
        const nextImg = images[(current + 1) % images.length];
        
        this.queueBackgroundLoad(nextDiv, images[current], sectionEl);
        this.hydrateProjectMediaElements(container);
        nextDiv.classList.replace('opacity-0', 'opacity-100');
        activeDiv.classList.replace('opacity-100', 'opacity-0');

        setTimeout(() => {
           this.queueBackgroundLoad(activeDiv, nextImg, sectionEl);
           this.hydrateProjectMediaElements(container);
           [activeDiv, nextDiv] = [nextDiv, activeDiv];
        }, 1500);
      }, 6000);
      this.slideshowTimers.push(timer);
    });
  }

  private queueBackgroundLoad(target: HTMLElement, imageUrl: string, section: HTMLElement, immediate = false) {
    if (!imageUrl) return;
    target.dataset.bgSrc = imageUrl;
    target.dataset.bgSection = section.id || section.dataset.group || '';
    if (immediate) {
      void this.applyBackgroundImageWhenIdle(target, imageUrl, section, true);
      return;
    }
    if (!this.backgroundLoadObserver) {
      this.backgroundLoadObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const element = entry.target as HTMLElement;
          this.backgroundLoadObserver?.unobserve(element);
          const hostSection = element.closest<HTMLElement>('.slideshow-section');
          const urgent = hostSection?.id === 'home';
          void this.applyBackgroundImageWhenIdle(element, element.dataset.bgSrc || '', hostSection, urgent);
        });
      }, {rootMargin: '720px 0px'});
    }
    this.backgroundLoadObserver.observe(target);
  }

  private async applyBackgroundImageWhenIdle(target: HTMLElement, imageUrl: string, section: HTMLElement | null, immediate = false) {
    if (!imageUrl) return;
    if (immediate) {
      target.style.backgroundImage = `url(${imageUrl})`;
      section?.classList.add('bg-ready');
    }
    if (!immediate) await this.waitForBrowserIdle();
    const image = new Image();
    image.decoding = 'async';
    image.loading = 'eager';
    image.src = imageUrl;
    try {
      if (typeof image.decode === 'function') await image.decode();
      else await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Background decode failed'));
      });
    } catch {
      // If decode fails, let the browser still try to paint the image.
    }
    target.style.backgroundImage = `url(${imageUrl})`;
    section?.classList.add('bg-ready');
  }

  private waitForBrowserIdle() {
    return new Promise<void>(resolve => {
      const win = window as Window & {
        requestIdleCallback?: (callback: () => void, options?: {timeout: number}) => number;
      };
      if (typeof win.requestIdleCallback === 'function') {
        win.requestIdleCallback(() => resolve(), {timeout: 180});
        return;
      }
      window.setTimeout(() => resolve(), 32);
    });
  }

  // Admin Logic
  private openAdminModal() {
    const modal = document.getElementById('admin-modal')!;
    const input = document.getElementById('admin-password-input') as HTMLInputElement;
    input.type = 'password';
    input.autocomplete = 'new-password';
    if (modal.classList.contains('hidden')) this.lockBodyScroll();
    modal.classList.remove('hidden');
    modal.classList.remove('opacity-0');
    modal.classList.add('opacity-100');
    input.value = '';
    setTimeout(() => input.focus(), 10);
  }

  private closeAdminModal() {
    const modal = document.getElementById('admin-modal')!;
    modal.classList.remove('opacity-100');
    modal.classList.add('opacity-0');
    setTimeout(() => {
      modal.classList.add('hidden');
      this.unlockBodyScroll();
    }, 300);
  }

  private closeMobileMenu() {
    document.getElementById('mobile-menu')?.classList.add('-translate-y-full');
  }

  private handleLogin() {
    const input = document.getElementById('admin-password-input') as HTMLInputElement;
    if (input.value === this.adminPass) {
      this.closeAdminModal();
      this.openSidebar();
      input.value = '';
    } else {
      input.classList.add('shake', 'border-red-500');
      setTimeout(() => input.classList.remove('shake', 'border-red-500'), 400);
    }
  }

  private openSidebar() {
    const sidebar = document.getElementById('admin-sidebar')!;
    const overlay = document.getElementById('admin-overlay')!;
    if (sidebar.classList.contains('translate-x-full')) this.lockBodyScroll();
    sidebar.classList.remove('translate-x-full');
    overlay.classList.remove('hidden');
    overlay.classList.remove('opacity-0');
    overlay.classList.add('opacity-100');
    this.populateSidebar();
  }

  private closeSidebar() {
    const sidebar = document.getElementById('admin-sidebar');
    const wasOpen = sidebar && !sidebar.classList.contains('translate-x-full');
    sidebar?.classList.add('translate-x-full');
    const overlay = document.getElementById('admin-overlay')!;
    overlay.classList.remove('opacity-100');
    overlay.classList.add('opacity-0');
    setTimeout(() => {
      overlay.classList.add('hidden');
      if (wasOpen) this.unlockBodyScroll();
    }, 300);
  }

  private switchTab(tab: string) {
    document.querySelectorAll('.admin-nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
    
    const tabs = ['social', 'hero', 'services', 'products', 'projects', 'transport', 'laboratory', 'slideshows', 'settings'];
    tabs.forEach(t => document.getElementById(`tab-${t}`)?.classList.add('hidden'));
    
    document.getElementById(`tab-${tab}`)?.classList.remove('hidden');
  }

  private populateSidebar() {
    // Social
    (document.getElementById('s-tg') as HTMLInputElement).value = this.social.tg;
    (document.getElementById('s-ig') as HTMLInputElement).value = this.social.ig;
    (document.getElementById('s-yt') as HTMLInputElement).value = this.social.yt;
    (document.getElementById('s-fb') as HTMLInputElement).value = this.social.fb;
    (document.getElementById('s-ph') as HTMLTextAreaElement).value = this.social.ph;
    // Settings
    (document.getElementById('set-name') as HTMLInputElement).value = this.settings.compName;
    (document.getElementById('set-h1') as HTMLInputElement).value = this.settings.heroTitle;
    (document.getElementById('set-sub') as HTMLInputElement).value = this.settings.heroSub;
    (document.getElementById('set-s1') as HTMLInputElement).value = this.settings.s1;
    (document.getElementById('set-s2') as HTMLInputElement).value = this.settings.s2;
    (document.getElementById('set-s3') as HTMLInputElement).value = this.settings.s3;

    this.renderAdminProductsList();
    this.renderAdminProductSectionsList();
    this.renderAdminProjectsList();
    this.renderAdminTransportList();
    this.renderAdminServicesList();
    this.renderAdminLabList();
    this.renderAdminSlideshows();
  }

  private renderAdminSlideshows() {
    const container = document.getElementById('slideshow-edit-list');
    if (!container) return;
    
    const categories: { [key: string]: string } = {
      hero: 'Bosh sahifa',
      about: 'Biz haqimizda',
      services: 'Xizmatlar',
      projects: 'Bajarilgan ishlar',
      transport: 'Texnika',
      products: 'Mahsulotlar',
      productFeatures: 'Mahsulot afzalliklari',
      concreteMix: 'Tayyor beton aralashma',
      highPerformance: 'Yuqori mustahkamlikdagi maxsus betonlar',
      laboratory: 'Laboratoriya',
      plitalar: 'Beton plitalar',
      gisht: 'G\'isht mahsuloti',
      contact: 'Aloqa'
    };

    container.innerHTML = Object.entries(categories).map(([key, label]) => `
      <div class="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div class="flex items-center justify-between gap-4">
          <label class="text-[10px] font-black uppercase tracking-[3px] text-white/50">${label}</label>
          <span class="text-[9px] font-bold uppercase tracking-[2px] text-white/25">${(this.slideImages[key] || []).length} rasm</span>
        </div>
        <div class="grid grid-cols-2 gap-3">
          ${(this.slideImages[key] || []).map((img, index) => `
            <div class="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-white/5">
              <div class="size-full bg-cover bg-center" style="background-image: url(${this.formatImg(img, 320)})"></div>
              <button onclick="window.app.deleteSlideImage('${key}', ${index})" class="absolute right-2 top-2 rounded-lg bg-black/70 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white hover:bg-red-500">O'chirish</button>
            </div>
          `).join('')}
        </div>
        <input id="ss-file-${key}" type="file" accept="image/*" multiple class="hidden" onchange="window.app.uploadSlideImages('${key}', this.files); this.value = ''">
        <button onclick="document.getElementById('ss-file-${key}').click()" class="btn-outline w-full !py-3 !text-[10px]">Rasm yuklash</button>
      </div>
    `).join('');
    this.hydrateProjectMediaElements(container);
  }

  private saveSlideshows() {
    if (!this.saveLocalJson('oqqush_slideshows', this.slideImages)) return;
    this.toast('Fon rasmlari saqlandi. Rasmlar faqat fayl yuklash orqali qo\'shiladi.');
  }

  public async uploadSlideImages(key: string, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).filter(file => file.type.startsWith('image/'));
    if (files.length === 0) return this.toast('Faqat rasm fayl yuklang', true);

    const loaded: string[] = [];
    for (const file of files) {
      if (file.size > MAX_UPLOAD_SIZE) {
        this.toast(`${file.name} juda katta (maks: 100MB)`, true);
        continue;
      }
      loaded.push(await this.readImageAsStoredValue(file, 1920, 0.84, 'image/webp'));
    }

    if (loaded.length === 0) return;
    this.slideImages[key] = [...(this.slideImages[key] || []), ...loaded];
    if (!this.saveLocalJson('oqqush_slideshows', this.slideImages)) return;
    this.initSlideshows();
    this.renderAdminSlideshows();
    this.toast('Rasm yuklandi');
  }

  public deleteSlideImage(key: string, index: number) {
    this.slideImages[key] = (this.slideImages[key] || []).filter((_, i) => i !== index);
    if (!this.saveLocalJson('oqqush_slideshows', this.slideImages)) return;
    this.initSlideshows();
    this.renderAdminSlideshows();
    this.toast('Rasm o\'chirildi');
  }

  private async readSingleImage(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return null;
    if (!file.type.startsWith('image/')) {
      this.toast('Faqat rasm fayl yuklang', true);
      return null;
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      this.toast('Rasm juda katta (maks: 100MB)', true);
      return null;
    }
    return this.readImageAsStoredValue(file);
  }

  public async uploadServiceImage(id: string, fileList: FileList | null) {
    const image = await this.readSingleImage(fileList);
    if (!image) return;
    const service = this.services.find(s => s.id === id);
    if (!service) return;
    service.image = image;
    if (!this.saveLocalJson('oqqush_services', this.services)) return;
    this.renderAdminServicesList();
    this.render();
    this.toast('Xizmat rasmi yuklandi');
  }

  public async uploadLabImage(id: string, fileList: FileList | null) {
    const image = await this.readSingleImage(fileList);
    if (!image) return;
    const item = this.laboratory.find(l => l.id === id);
    if (!item) return;
    item.image = image;
    if (!this.saveLocalJson('oqqush_lab', this.laboratory)) return;
    this.renderAdminLabList();
    this.render();
    this.toast('Laboratoriya rasmi yuklandi');
  }

  private readFileAsDataUrl(file: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  private async readImageAsCompressedDataUrl(file: File, maxSide = 1600, quality = 0.82) {
    const source = await this.readFileAsDataUrl(file);
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = source;
    });

    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return source;
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  }

  private async readImageAsStoredValue(file: File, maxSide = 1600, quality = 0.82, mimeType = 'image/jpeg') {
    const blob = await this.readImageAsCompressedBlob(file, maxSide, quality, mimeType);
    return this.storeMediaBlob(blob, 'image');
  }

  private async readImageAsCompressedBlob(file: Blob, maxSide = 1600, quality = 0.82, mimeType = 'image/jpeg') {
    const source = await this.readFileAsDataUrl(file);
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = source;
    });

    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(image, 0, 0, width, height);
    return new Promise<Blob>((resolve) => {
      canvas.toBlob(blob => resolve(blob || file), mimeType, quality);
    });
  }

  private dataUrlToBlob(dataUrl: string) {
    const [meta, data] = dataUrl.split(',');
    const mime = meta.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
    const binary = atob(data || '');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  private async migrateStoredImages() {
    let changedProducts = false;
    let changedSections = false;
    let changedServices = false;
    let changedLab = false;
    let changedTransport = false;
    let changedSlides = false;
    let changedProjects = false;

    const migrateImage = async (value: string) => {
      if (!value?.startsWith('data:image/')) return value;
      const blob = await this.readImageAsCompressedBlob(this.dataUrlToBlob(value));
      return this.storeMediaBlob(blob, 'image');
    };

    try {
      for (const item of this.products) {
        const next = await migrateImage(item.image);
        if (next !== item.image) {
          item.image = next;
          changedProducts = true;
        }
      }
      for (const section of this.productSections) {
        const next = await migrateImage(section.image);
        if (next !== section.image) {
          section.image = next;
          changedSections = true;
        }
        for (const panel of section.panels || []) {
          const panelNext = await migrateImage(panel.image);
          if (panelNext !== panel.image) {
            panel.image = panelNext;
            changedSections = true;
          }
        }
      }
      for (const item of this.services) {
        const next = await migrateImage(item.image);
        if (next !== item.image) {
          item.image = next;
          changedServices = true;
        }
      }
      for (const item of this.laboratory) {
        const next = await migrateImage(item.image);
        if (next !== item.image) {
          item.image = next;
          changedLab = true;
        }
      }
      for (const item of this.projects) {
        if (this.getProjectMediaType(item) === 'video') continue;
        const next = await migrateImage(item.image);
        if (next !== item.image) {
          item.image = next;
          item.mediaType = 'image';
          changedProjects = true;
        }
      }
      for (const item of this.transport) {
        const next = await migrateImage(item.image);
        if (next !== item.image) {
          item.image = next;
          changedTransport = true;
        }
      }
      for (const key of Object.keys(this.slideImages)) {
        const nextImages = await Promise.all(this.slideImages[key].map(migrateImage));
        if (nextImages.some((img, index) => img !== this.slideImages[key][index])) {
          this.slideImages[key] = nextImages;
          changedSlides = true;
        }
      }

      if (changedProducts) this.saveLocalJson('oqqush_products', this.products);
      if (changedSections) this.saveLocalJson('oqqush_product_sections', this.productSections);
      if (changedServices) this.saveLocalJson('oqqush_services', this.services);
      if (changedLab) this.saveLocalJson('oqqush_lab', this.laboratory);
      if (changedTransport) this.saveLocalJson('oqqush_transport', this.transport);
      if (changedProjects) this.saveLocalJson('oqqush_projects', this.projects);
      if (changedSlides) this.saveLocalJson('oqqush_slideshows', this.slideImages);
      if (changedProducts || changedSections || changedServices || changedLab || changedTransport || changedProjects || changedSlides) {
        if (changedSlides) this.initSlideshows();
        this.render();
        this.renderAdminProductsList();
        this.renderAdminProductSectionsList();
        this.renderAdminServicesList();
        this.renderAdminLabList();
      }
    } catch (error) {
      console.error('Image migration error:', error);
    }
  }

  private saveLocalJson(key: string, value: unknown) {
    return this.saveLocalValue(key, JSON.stringify(value));
  }

  private markLocalSiteDirty() {
    localStorage.setItem('oqqush_last_local_change_at', String(Date.now()));
  }

  private hasUnsyncedLocalSiteChanges() {
    const changedAt = Number(localStorage.getItem('oqqush_last_local_change_at') || '0');
    const syncedAt = Number(localStorage.getItem('oqqush_last_local_sync_at') || '0');
    if (changedAt <= syncedAt) return false;

    // A failed/old sync marker should not block another device's fresh server state forever.
    // Recent edits still get a short window to finish uploading before we import anything.
    if (Date.now() - changedAt > 45000) {
      localStorage.setItem('oqqush_last_local_sync_at', String(changedAt));
      return false;
    }
    return true;
  }

  private saveLocalValue(key: string, value: string | null) {
    try {
      if (value === null || value === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
      this.markLocalSiteDirty();
      this.queueServerSiteSync();
      return true;
    } catch (error) {
      console.error(`${key} save error:`, error);
      this.toast('Ma\'lumot hajmi katta. Rasm yoki videoni kichraytirib qayta urinib ko\'ring.', true);
      return false;
    }
  }

  private openMediaDb() {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('oqqush_media', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('files');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async storeMediaBlob(file: Blob, namespace = 'project') {
    const db = await this.openMediaDb();
    const key = `idb:${namespace}:${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').put(file, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return key;
  }

  private async readAllMediaBackup() {
    const db = await this.openMediaDb();
    const media: Record<string, string> = {};
    const {keys, values} = await new Promise<{keys: IDBValidKey[]; values: Blob[]}>((resolve, reject) => {
      const tx = db.transaction('files', 'readonly');
      const store = tx.objectStore('files');
      const keysRequest = store.getAllKeys();
      const valuesRequest = store.getAll();
      tx.oncomplete = () => resolve({keys: keysRequest.result, values: valuesRequest.result as Blob[]});
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    await Promise.all(values.map((blob, index) => new Promise<void>(resolve => {
      const reader = new FileReader();
      reader.onload = () => {
        media[String(keys[index])] = String(reader.result || '');
        resolve();
      };
      reader.onerror = () => resolve();
      reader.readAsDataURL(blob);
    })));
    return media;
  }

  private async writeMediaBackup(media: Record<string, string>) {
    const entries = Object.entries(media || {});
    const db = await this.openMediaDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      const store = tx.objectStore('files');
      store.clear();
      entries.forEach(([key, value]) => {
        if (typeof value === 'string' && value.startsWith('data:')) store.put(this.dataUrlToBlob(value), key);
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  private async exportSiteDataBackup() {
    const backup = await this.buildSiteBackup();
    const blob = new Blob([JSON.stringify(backup)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `oqqush-beton-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    this.toast('Sayt ma\'lumotlari eksport qilindi');
  }

  private async buildSiteBackup() {
    const keys = [
      'oqqush_projects',
      'oqqush_transport',
      'oqqush_products',
      'oqqush_product_sections',
      'oqqush_social',
      'oqqush_settings',
      'admin_pass',
      'oqqush_slideshows',
      'oqqush_lab',
      'oqqush_services',
    ];
    const localStorageData = Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      localStorage: localStorageData,
      media: await this.readAllMediaBackup(),
    };
  }

  private queueServerSiteSync(delay = 450) {
    if (!this.siteSyncReady) {
      this.siteSyncPendingAfterReady = true;
      return;
    }
    if (window.location.hostname !== 'oqqushbeton.duckdns.org') return;
    if (this.siteSyncTimer) window.clearTimeout(this.siteSyncTimer);
    this.siteSyncTimer = window.setTimeout(() => {
      this.siteSyncTimer = null;
      void this.syncSiteBackupToServer();
    }, delay);
  }

  private async syncSiteBackupToServer() {
    if (this.siteSyncInFlight || window.location.hostname !== 'oqqushbeton.duckdns.org') return;
    this.siteSyncInFlight = true;
    try {
      const backup = await this.buildSiteBackup();
      const response = await fetch('/api/site-backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Oqqush-Admin-Pass': this.adminPass,
        },
        body: JSON.stringify(backup),
      });
      if (!response.ok) throw new Error(`Sync status ${response.status}`);
      const result = await response.json().catch(() => ({})) as {exportedAt?: string; signature?: string};
      const seedVersion = result.signature || result.exportedAt || backup.exportedAt || String(backup.version || 2);
      localStorage.setItem('oqqush_bundled_backup_version', seedVersion);
      localStorage.setItem('oqqush_last_local_sync_at', String(Date.now()));
    } catch (error) {
      console.error('Server sync error:', error);
      this.toast('Serverga sinxronlashda xatolik', true);
      window.setTimeout(() => {
        if (this.hasUnsyncedLocalSiteChanges()) this.queueServerSiteSync(1200);
      }, 1200);
    } finally {
      this.siteSyncInFlight = false;
    }
  }

  private async importSiteDataBackup(file: File) {
    try {
      const backup = JSON.parse(await file.text()) as {
        localStorage?: Record<string, string | null>;
        media?: Record<string, string>;
      };
      if (!backup.localStorage || typeof backup.localStorage !== 'object') {
        this.toast('Backup fayl noto\'g\'ri', true);
        return;
      }
      Object.entries(backup.localStorage).forEach(([key, value]) => {
        if (value === null || value === undefined) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      });
      await this.writeMediaBackup(backup.media || {});
      localStorage.setItem('oqqush_last_local_sync_at', String(Date.now()));
      this.toast('Ma\'lumotlar import qilindi. Sahifa yangilanmoqda...');
      window.setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      console.error('Backup import error:', error);
      this.toast('Backup import qilishda xatolik', true);
    }
  }

  private async importBundledSiteBackupIfNeeded() {
    const isLiveSite = window.location.hostname === 'oqqushbeton.duckdns.org';
    if (!isLiveSite) {
      this.siteSyncReady = true;
      return;
    }
    if (this.siteSyncImportInFlight) return;
    if (this.siteSyncInFlight || this.siteSyncTimer) return;
    if (this.hasUnsyncedLocalSiteChanges()) {
      this.queueServerSiteSync(400);
      return;
    }

    this.siteSyncImportInFlight = true;
    try {
      const markerKey = 'oqqush_bundled_backup_version';
      const metaResponse = await fetch('/api/site-backup?meta=1', {cache: 'no-store'});
      if (metaResponse.ok) {
        const meta = await metaResponse.json() as {exportedAt?: string; signature?: string};
        const metaVersion = meta.signature || meta.exportedAt;
        if (
          metaVersion &&
          localStorage.getItem(markerKey) === metaVersion &&
          this.localStorageMatchesServerSignature(meta.signature)
        ) return;
      }

      const response = await fetch('/api/site-backup', {cache: 'no-store'});
      if (!response.ok) return;

      const backup = await response.json() as {
        version?: number;
        exportedAt?: string;
        localStorage?: Record<string, string | null>;
        media?: Record<string, string>;
      };
      const seedVersion = this.getBackupVersionMarker(backup);
      if (
        !backup.localStorage ||
        (
          localStorage.getItem(markerKey) === seedVersion &&
          this.localStorageMatchesServerSignature(seedVersion)
        )
      ) return;

      Object.entries(backup.localStorage).forEach(([key, value]) => {
        if (value === null || value === undefined) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      });
      await this.writeMediaBackup(backup.media || {});
      localStorage.setItem(markerKey, seedVersion);
      localStorage.setItem('oqqush_last_local_sync_at', String(Date.now()));
      this.loadData();
      this.render();
      this.initSlideshows();
      this.renderAdminProductsList();
      this.renderAdminProductSectionsList();
      this.renderAdminProjectsList();
      this.renderAdminTransportList();
      this.renderAdminServicesList();
      this.renderAdminLabList();
      this.renderAdminSlideshows();
    } catch (error) {
      console.error('Bundled backup import error:', error);
    } finally {
      this.siteSyncImportInFlight = false;
      this.siteSyncReady = true;
      if (this.siteSyncPendingAfterReady) {
        this.siteSyncPendingAfterReady = false;
        this.queueServerSiteSync(400);
      }
    }
  }

  private startServerSiteSyncWatcher() {
    if (window.location.hostname !== 'oqqushbeton.duckdns.org') return;
    this.siteSyncPollTimer = window.setInterval(() => {
      void this.checkServerSiteBackupFreshness();
    }, this.isMobileViewport() ? 4000 : 5000);
    window.addEventListener('focus', () => void this.checkServerSiteBackupFreshness(true));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) void this.checkServerSiteBackupFreshness(true);
    });
  }

  private async checkServerSiteBackupFreshness(force = false) {
    if (this.siteSyncInFlight || this.siteSyncImportInFlight || this.siteSyncTimer) return;
    if (!force && this.hasUnsyncedLocalSiteChanges()) {
      this.queueServerSiteSync(400);
      return;
    }
    const now = Date.now();
    if (!force && now - this.lastServerSyncCheck < 2500) return;
    this.lastServerSyncCheck = now;
    try {
      const response = await fetch('/api/site-backup?meta=1', {cache: 'no-store'});
      if (!response.ok) return;
      const meta = await response.json() as {exportedAt?: string; signature?: string};
      const version = meta.signature || meta.exportedAt;
      if (
        version &&
        (
          localStorage.getItem('oqqush_bundled_backup_version') !== version ||
          !this.localStorageMatchesServerSignature(meta.signature)
        )
      ) {
        await this.importBundledSiteBackupIfNeeded();
      }
    } catch (error) {
      console.error('Server freshness check error:', error);
    }
  }

  private getBackupVersionMarker(backup: {
    version?: number;
    exportedAt?: string;
    localStorage?: Record<string, string | null>;
    media?: Record<string, string>;
  }) {
    return this.buildBackupSignatureFromStorage(backup.localStorage || {});
  }

  private localStorageMatchesServerSignature(signature?: string) {
    if (!signature) return true;
    return this.buildCurrentLocalSignature() === signature;
  }

  private buildCurrentLocalSignature() {
    return this.buildBackupSignatureFromStorage(this.getRelevantSiteLocalStorage());
  }

  private getRelevantSiteLocalStorage() {
    const keys = [
      'oqqush_projects',
      'oqqush_transport',
      'oqqush_products',
      'oqqush_product_sections',
      'oqqush_social',
      'oqqush_settings',
      'admin_pass',
      'oqqush_slideshows',
      'oqqush_lab',
      'oqqush_services',
    ];
    return Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
  }

  private buildBackupSignatureFromStorage(storage: Record<string, string | null>) {
    const ordered = Object.keys(storage)
      .sort()
      .reduce<Record<string, string | null>>((acc, key) => {
        acc[key] = storage[key] ?? null;
        return acc;
      }, {});
    const source = JSON.stringify(ordered);
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `sig-${(hash >>> 0).toString(16)}`;
  }

  private async getMediaBlobUrl(key: string) {
    if (!key.startsWith('idb:')) return key;
    const cached = this.mediaUrlCache.get(key);
    if (cached) return cached;

    const db = await this.openMediaDb();
    const blob = await new Promise<Blob | undefined>((resolve, reject) => {
      const tx = db.transaction('files', 'readonly');
      const request = tx.objectStore('files').get(key);
      request.onsuccess = () => resolve(request.result as Blob | undefined);
      request.onerror = () => reject(request.error);
    });
    db.close();

    if (!blob) return '';
    const url = URL.createObjectURL(blob);
    this.mediaUrlCache.set(key, url);
    return url;
  }

  private async deleteMediaBlob(key: string) {
    if (!key.startsWith('idb:')) return;
    const cached = this.mediaUrlCache.get(key);
    if (cached) URL.revokeObjectURL(cached);
    this.mediaUrlCache.delete(key);

    const db = await this.openMediaDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  private hydrateProjectMediaElements(root: ParentNode = document) {
    root.querySelectorAll<HTMLVideoElement>('video[data-idb-media]').forEach(async (video) => {
      const key = video.dataset.idbMedia;
      if (!key || video.src) return;
      video.src = await this.getMediaBlobUrl(key);
    });
    root.querySelectorAll<HTMLImageElement>('img[src^="idb:"]').forEach(async (img) => {
      const key = img.getAttribute('src');
      if (!key) return;
      const url = await this.getMediaBlobUrl(key);
      if (url) img.src = url;
    });

    const elements: HTMLElement[] = [];
    if (root instanceof HTMLElement) elements.push(root);
    root.querySelectorAll<HTMLElement>('*').forEach(el => elements.push(el));
    elements.forEach(async (el) => {
      const match = el.style.backgroundImage.match(/url\(["']?(idb:[^"')]+)["']?\)/);
      const key = match?.[1];
      if (!key) return;
      const url = await this.getMediaBlobUrl(key);
      if (url) el.style.backgroundImage = `url(${url})`;
    });
  }

  private getProjectMediaType(project: Project): 'image' | 'video' {
    return project.mediaType || (project.image?.startsWith('data:video') ? 'video' : 'image');
  }

  private renderProjectPreview(src: string, mediaType: 'image' | 'video') {
    const preview = document.getElementById('p-img-preview');
    if (!preview) return;

    preview.style.backgroundImage = '';
    preview.innerHTML = '';

    if (!src) return;

    if (mediaType === 'video') {
      preview.innerHTML = src.startsWith('idb:')
        ? `<video data-idb-media="${src}" class="size-full object-cover" muted playsinline></video>`
        : `<video src="${src}" class="size-full object-cover" muted playsinline></video>`;
      this.hydrateProjectMediaElements(preview);
      return;
    }

    preview.style.backgroundImage = `url(${this.formatImg(src, 200)})`;
    this.hydrateProjectMediaElements(preview);
  }

  private renderProjectMedia(project: Project, variant: 'card' | 'thumb') {
    const mediaType = this.getProjectMediaType(project);
    if (mediaType === 'video') {
      const controls = variant === 'card' ? 'loop' : '';
      const projectAttr = `data-project-video-id="${this.escapeHtml(project.id)}"`;
      const extra = variant === 'card'
        ? `class="size-full object-cover transition-transform duration-700 group-hover:scale-105" ${projectAttr}`
        : 'class="size-full object-cover" muted';
      if (project.image.startsWith('idb:')) {
        return `<video data-idb-media="${project.image}" ${extra} ${controls} muted playsinline preload="metadata"></video>`;
      }
      return `<video src="${project.image}" ${extra} ${controls} muted playsinline preload="metadata"></video>`;
    }

    const image = this.formatImg(project.image, variant === 'card' ? 1200 : 200);
    return `<div class="size-full bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style="background-image: url(${image})"></div>`;
  }

  private saveSocial() {
    this.social = {
      tg: (document.getElementById('s-tg') as HTMLInputElement).value,
      ig: (document.getElementById('s-ig') as HTMLInputElement).value,
      yt: (document.getElementById('s-yt') as HTMLInputElement).value,
      fb: (document.getElementById('s-fb') as HTMLInputElement).value,
      ph: (document.getElementById('s-ph') as HTMLTextAreaElement).value,
    };
    if (!this.saveLocalJson('oqqush_social', this.social)) return;
    this.renderFooter();
    this.toast('Ijtimoiy tarmoqlar saqlandi');
  }

  private showProdForm() { 
    document.getElementById('prod-form')?.classList.remove('hidden'); 
    this.tempProductImage = '';
    const preview = document.getElementById('prod-img-preview');
    if (preview) preview.style.backgroundImage = '';
    (document.getElementById('prod-file-input') as HTMLInputElement).value = '';
  }
  private hideProdForm() { document.getElementById('prod-form')?.classList.add('hidden'); }
  private saveProd() {
    const name = (document.getElementById('prod-name') as HTMLInputElement).value;
    const desc = (document.getElementById('prod-desc') as HTMLTextAreaElement).value;
    const img = this.tempProductImage;

    if (!name || (!img && !this.editingProductId)) return this.toast('Barcha maydonlarni to\'ldiring', true);

    if (this.editingProductId) {
      const idx = this.products.findIndex(p => p.id === this.editingProductId);
      const finalImg = img || this.products[idx].image;
      this.products[idx] = { ...this.products[idx], name, image: finalImg, description: desc };
      this.editingProductId = null;
    } else {
      this.products.push({ id: Date.now().toString(), name, image: img, description: desc });
    }

    if (!this.saveLocalJson('oqqush_products', this.products)) return;
    this.hideProdForm();
    this.render();
    this.renderAdminProductsList();
    this.toast('Mahsulot saqlandi');
  }

  private renderAdminProductsList() {
    const container = document.getElementById('admin-products-list');
    if (!container) return;
    container.innerHTML = this.products.map(p => `
      <div class="bg-white/5 backdrop-blur-xl border border-white/5 rounded-2xl p-4 flex justify-between items-center hover:border-white/20 transition-all duration-300 group">
        <div class="flex items-center gap-4">
          <div class="size-12 bg-cover bg-center rounded-xl ring-2 ring-white/5" style="background-image: url(${this.formatImg(p.image, 200)})"></div>
          <div class="text-[11px] font-black uppercase tracking-[2px] text-white/90 group-hover:text-white transition-colors">${p.name}</div>
        </div>
        <div class="flex gap-2">
          <button onclick="window.app.editProduct('${p.id}')" class="text-blue-400 p-2 hover:bg-white/5 rounded-lg transition-all"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button onclick="window.app.deleteProduct('${p.id}')" class="text-red-400 p-2 hover:bg-white/5 rounded-lg transition-all"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
        </div>
      </div>
    `).join('');
    this.hydrateProjectMediaElements(container);
  }

  private renderAdminProductSectionsList() {
    const container = document.getElementById('admin-product-sections-list');
    if (!container) return;
    container.innerHTML = this.productSections.map(section => `
      <div class="space-y-3 rounded-2xl border border-white/5 bg-white/5 p-4 backdrop-blur-xl transition-all duration-300 hover:border-white/20">
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <div class="size-12 bg-cover bg-center rounded-xl ring-2 ring-white/5" style="background-image: url(${this.formatImg(section.image, 200)})"></div>
            <div>
              <div class="text-[11px] font-black uppercase tracking-[2px] text-white/90">${section.name}</div>
              <div class="mt-1 text-[8px] font-black uppercase tracking-[2px] text-white/30">Mahsulot bo'limi</div>
            </div>
          </div>
          <button onclick="window.app.editProductSection('${section.id}')" class="text-blue-400 p-2 hover:bg-white/5 rounded-lg transition-all" title="Tahrirlash"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        </div>
        ${(section.panels || []).map(panel => `
          <div class="ml-6 flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/20 p-3">
            <div class="flex items-center gap-3">
              <div class="size-10 rounded-lg bg-cover bg-center ring-1 ring-white/10" style="background-image: url(${this.formatImg(panel.image, 160)})"></div>
              <div>
                <div class="text-[10px] font-black uppercase tracking-[2px] text-white/80">${panel.name}</div>
                <div class="mt-1 text-[8px] font-bold uppercase tracking-[2px] text-white/30">Ichki panelcha</div>
              </div>
            </div>
            <button onclick="window.app.editProductPanel('${section.id}', '${panel.id}')" class="text-cyan-300 p-2 hover:bg-white/5 rounded-lg transition-all" title="Panelchani tahrirlash"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          </div>
        `).join('')}
      </div>
    `).join('');
    this.hydrateProjectMediaElements(container);
  }

  private formatImg(img: string | undefined | null, w = 800) {
    if (!img) return '';
    if (typeof img !== 'string') return '';
    if (img.startsWith('photo-')) {
      const quality = w <= 900 ? 58 : 72;
      return `https://images.unsplash.com/${img}?w=${w}&auto=format&fit=crop&q=${quality}`;
    }
    return img;
  }

  public editProduct(id: string) {
    const item = this.products.find(p => p.id === id);
    if (item) this.showContentModal('product', item);
  }

  public editProductSection(id: string) {
    const item = this.productSections.find(section => section.id === id);
    if (item) this.showContentModal('product-section', item);
  }

  public editProductPanel(sectionId: string, panelId: string) {
    const section = this.productSections.find(item => item.id === sectionId);
    const panel = section?.panels?.find(item => item.id === panelId);
    if (!section || !panel) return;
    this.editingPanelId = panelId;
    this.showContentModal('product-panel', panel);
    this.editingContentId = sectionId;
  }

  public deleteProduct(id: string) {
    if (confirm('O\'chirilsinmi?')) {
      this.products = this.products.filter(p => p.id !== id);
      if (!this.saveLocalJson('oqqush_products', this.products)) return;
      this.render();
      this.renderAdminProductsList();
      this.toast('O\'chirildi');
    }
  }

  private saveSettings() {
    const oldP = (document.getElementById('old-pass') as HTMLInputElement).value;
    const newP = (document.getElementById('new-pass') as HTMLInputElement).value;
    const confP = (document.getElementById('conf-pass') as HTMLInputElement).value;

    if (newP) {
      if (oldP !== this.adminPass) return this.toast('Eski parol noto\'g\'ri', true);
      if (newP !== confP) return this.toast('Yangi parollar mos emas', true);
      this.adminPass = newP;
      if (!this.saveLocalValue('admin_pass', newP)) return;
      (document.getElementById('old-pass') as HTMLInputElement).value = '';
      (document.getElementById('new-pass') as HTMLInputElement).value = '';
      (document.getElementById('conf-pass') as HTMLInputElement).value = '';
    }

    this.settings = {
      compName: (document.getElementById('set-name') as HTMLInputElement).value,
      heroTitle: (document.getElementById('set-h1') as HTMLInputElement).value,
      heroSub: (document.getElementById('set-sub') as HTMLInputElement).value,
      s1: (document.getElementById('set-s1') as HTMLInputElement).value,
      s2: (document.getElementById('set-s2') as HTMLInputElement).value,
      s3: (document.getElementById('set-s3') as HTMLInputElement).value,
    };
    if (!this.saveLocalJson('oqqush_settings', this.settings)) return;
    this.render();
    this.toast('Sozlamalar yangilandi');
  }

  private showProjectForm() { 
    this.editingProjectId = null;
    this.showProjectEditor();
    this.tempProjectImage = '';
    this.tempProjectMediaType = 'image';
    this.renderProjectPreview('', 'image');
    (document.getElementById('p-file-input') as HTMLInputElement).value = '';
  }
  private hideProjectForm() {
    const form = document.getElementById('p-form');
    if (!form) return;
    form.classList.add('opacity-0', 'scale-95', '-translate-y-3');
    form.classList.remove('opacity-100', 'scale-100', 'translate-y-0');
    window.setTimeout(() => form.classList.add('hidden'), 300);
  }

  private showProjectEditor() {
    const form = document.getElementById('p-form');
    if (!form) return;
    form.classList.remove('hidden', 'opacity-100', 'scale-100', 'translate-y-0');
    form.classList.add('opacity-0', 'scale-95', '-translate-y-3');
    window.setTimeout(() => {
      form.classList.remove('opacity-0', 'scale-95', '-translate-y-3');
      form.classList.add('opacity-100', 'scale-100', 'translate-y-0');
    }, 20);
  }
  private async saveProject() {
    const name = (document.getElementById('p-name') as HTMLInputElement).value;
    const loc = (document.getElementById('p-loc') as HTMLInputElement).value;
    const year = (document.getElementById('p-year') as HTMLInputElement).value;
    const img = this.tempProjectImage;
    const mediaType = this.tempProjectMediaType;

    if (!name || (!img && !this.editingProjectId)) return this.toast('Barcha maydonlarni to\'ldiring', true);

    if (this.editingProjectId) {
      const idx = this.projects.findIndex(p => p.id === this.editingProjectId);
      const oldImage = this.projects[idx].image;
      const finalImg = img || this.projects[idx].image;
      const finalType = img ? mediaType : this.getProjectMediaType(this.projects[idx]);
      this.projects[idx] = { ...this.projects[idx], name, image: finalImg, mediaType: finalType, location: loc, year };
      if (img && oldImage?.startsWith('idb:') && oldImage !== img) await this.deleteMediaBlob(oldImage);
      this.editingProjectId = null;
    } else {
      this.projects.push({ id: Date.now().toString(), name, image: img, mediaType, location: loc, year });
    }

    if (!this.saveLocalJson('oqqush_projects', this.projects)) {
      return this.toast('Fayl hajmi katta. Kichikroq video yuklang.', true);
    }
    this.hideProjectForm();
    this.render();
    this.renderAdminProjectsList();
    this.hydrateProjectMediaElements();
    this.toast('Muvaffaqiyatli saqlandi');
  }

  private renderAdminProjectsList() {
    const container = document.getElementById('admin-projects-list');
    if (!container) return;
    container.innerHTML = this.projects.map(p => `
      <div class="bg-white/5 backdrop-blur-xl border border-white/5 rounded-2xl p-4 flex justify-between items-center hover:border-white/20 transition-all duration-300 group">
        <div class="flex items-center gap-4">
          <div class="size-12 overflow-hidden rounded-xl ring-2 ring-white/5 bg-white/5">${this.renderProjectMedia(p, 'thumb')}</div>
          <div>
            <div class="text-[11px] font-black uppercase tracking-[2px] text-white/90 group-hover:text-white transition-colors">${p.name}</div>
            <div class="mt-1 text-[8px] font-black uppercase tracking-[2px] text-white/30">${this.getProjectMediaType(p) === 'video' ? 'Video' : 'Rasm'}</div>
          </div>
        </div>
        <div class="flex gap-2">
          <button onclick="window.app.editProject('${p.id}')" class="text-blue-400 p-2 hover:bg-white/5 rounded-lg transition-all"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button onclick="window.app.deleteProject('${p.id}')" class="text-red-400 p-2 hover:bg-white/5 rounded-lg transition-all"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
        </div>
      </div>
    `).join('');
    this.hydrateProjectMediaElements(container);
  }

  public editProject(id: string) {
    const p = this.projects.find(x => x.id === id)!;
    this.editingProjectId = id;
    (document.getElementById('p-name') as HTMLInputElement).value = p.name;
    (document.getElementById('p-loc') as HTMLInputElement).value = p.location;
    (document.getElementById('p-year') as HTMLInputElement).value = p.year;
    this.tempProjectImage = '';
    this.tempProjectMediaType = this.getProjectMediaType(p);
    this.renderProjectPreview(p.image, this.tempProjectMediaType);
    this.showProjectEditor();
  }

  public async deleteProject(id: string) {
    if (confirm('O\'chirilsinmi?')) {
      const project = this.projects.find(p => p.id === id);
      if (project?.image?.startsWith('idb:')) await this.deleteMediaBlob(project.image);
      this.projects = this.projects.filter(p => p.id !== id);
      if (!this.saveLocalJson('oqqush_projects', this.projects)) return;
      this.render();
      this.renderAdminProjectsList();
      this.toast('O\'chirildi');
    }
  }

  private showTransModal() {
    this.editingTransportId = null;
    (document.getElementById('t-name') as HTMLInputElement).value = '';
    (document.getElementById('t-specs') as HTMLTextAreaElement).value = '';
    this.tempTransportImage = '';
    const preview = document.getElementById('t-img-preview');
    if (preview) preview.style.backgroundImage = '';
    (document.getElementById('t-file-input') as HTMLInputElement).value = '';
    this.showAnimatedModal('transport-modal');
  }

  private hideTransModal() {
    this.hideAnimatedModal('transport-modal', () => {
      this.editingTransportId = null;
    });
  }

  private saveTransportData() {
    const name = (document.getElementById('t-name') as HTMLInputElement).value;
    const image = this.tempTransportImage;
    const specs = (document.getElementById('t-specs') as HTMLTextAreaElement).value;

    if (!name || (!image && !this.editingTransportId) || !specs) return this.toast('Barcha maydonlarni to\'ldiring', true);

    if (this.editingTransportId) {
      const idx = this.transport.findIndex(t => t.id === this.editingTransportId);
      const finalImage = image || this.transport[idx].image;
      this.transport[idx] = { ...this.transport[idx], name, image: finalImage, specs };
    } else {
      this.transport.push({
        id: Date.now().toString(),
        name,
        image,
        specs,
        price: '',
        available: true
      });
    }

    if (!this.saveLocalJson('oqqush_transport', this.transport)) return;
    this.hideTransModal();
    this.render();
    this.renderAdminTransportList();
    this.toast('Texnika saqlandi');
  }

  public editTransport(id: string) {
    const t = this.transport.find(x => x.id === id)!;
    this.editingTransportId = id;
    (document.getElementById('t-name') as HTMLInputElement).value = t.name;
    (document.getElementById('t-specs') as HTMLTextAreaElement).value = t.specs;
    this.tempTransportImage = '';
    const preview = document.getElementById('t-img-preview');
    if (preview) preview.style.backgroundImage = `url(${this.formatImg(t.image, 200)})`;
    this.hydrateProjectMediaElements(document.getElementById('transport-modal') || document);
    (document.getElementById('t-file-input') as HTMLInputElement).value = '';
    this.showAnimatedModal('transport-modal');
  }

  public deleteTransport(id: string) {
    if (confirm('O\'chirilsinmi?')) {
      this.transport = this.transport.filter(t => t.id !== id);
      if (!this.saveLocalJson('oqqush_transport', this.transport)) return;
      this.render();
      this.renderAdminTransportList();
      this.toast('O\'chirildi');
    }
  }

  private renderAdminTransportList() {
    const container = document.getElementById('admin-transport-list');
    if (!container) return;
    container.innerHTML = this.transport.map(t => `
      <div class="bg-white/5 backdrop-blur-xl border border-white/5 rounded-2xl p-4 flex justify-between items-center hover:border-white/20 transition-all duration-300 group">
        <div class="flex items-center gap-4">
          <div class="size-12 bg-cover bg-center rounded-xl ring-2 ring-white/5" style="background-image: url(${this.formatImg(t.image, 200)})"></div>
          <div class="text-[11px] font-black uppercase tracking-[2px] text-white/90 group-hover:text-white transition-colors">${t.name}</div>
        </div>
        <div class="flex gap-2">
          <button onclick="window.app.editTransport('${t.id}')" class="text-blue-400 p-2 hover:bg-white/5 rounded-lg transition-all"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button onclick="window.app.deleteTransport('${t.id}')" class="text-red-400 p-2 hover:bg-white/5 rounded-lg transition-all"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
        </div>
      </div>
    `).join('');
    this.hydrateProjectMediaElements(container);
  }

  private renderAdminServicesList() {
    const container = document.getElementById('admin-services-list');
    if (!container) return;
    container.innerHTML = this.services.map(s => `
      <div class="bg-white/5 backdrop-blur-xl border border-white/5 rounded-2xl p-4 flex justify-between items-center hover:border-white/20 transition-all duration-300 group">
        <div class="flex items-center gap-4">
          <div class="size-12 bg-cover bg-center rounded-xl ring-2 ring-white/5" style="background-image: url(${this.formatImg(s.image, 200)})"></div>
          <div class="text-[11px] font-black uppercase tracking-[2px] text-white/90 group-hover:text-white transition-colors">${s.name}</div>
        </div>
        <div class="flex gap-2">
          <input id="service-img-${s.id}" type="file" accept="image/*" class="hidden" onchange="window.app.uploadServiceImage('${s.id}', this.files); this.value = ''">
          <button onclick="document.getElementById('service-img-${s.id}').click()" class="text-cyan-300 p-2 hover:bg-white/5 rounded-lg transition-all" title="Rasm qo'yish"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg></button>
          <button onclick="window.app.editService('${s.id}')" class="text-blue-400 p-2 hover:bg-white/5 rounded-lg transition-all" title="Tahrirlash"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button onclick="window.app.deleteService('${s.id}')" class="text-red-400 p-2 hover:bg-white/5 rounded-lg transition-all"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
        </div>
      </div>
    `).join('');
    this.hydrateProjectMediaElements(container);
  }

  private renderAdminLabList() {
    const container = document.getElementById('admin-lab-list');
    if (!container) return;
    container.innerHTML = this.laboratory.map(l => `
      <div class="bg-white/5 backdrop-blur-xl border border-white/5 rounded-2xl p-4 flex justify-between items-center hover:border-white/20 transition-all duration-300 group">
        <div class="flex items-center gap-4">
          <div class="size-12 bg-cover bg-center rounded-xl ring-2 ring-white/5" style="background-image: url(${this.formatImg(l.image, 200)})"></div>
          <div class="text-[11px] font-black uppercase tracking-[2px] text-white/90 group-hover:text-white transition-colors">${l.name}</div>
        </div>
        <div class="flex gap-2">
          <input id="lab-img-${l.id}" type="file" accept="image/*" class="hidden" onchange="window.app.uploadLabImage('${l.id}', this.files); this.value = ''">
          <button onclick="document.getElementById('lab-img-${l.id}').click()" class="text-cyan-300 p-2 hover:bg-white/5 rounded-lg transition-all" title="Rasm qo'yish"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg></button>
          <button onclick="window.app.editLab('${l.id}')" class="text-blue-400 p-2 hover:bg-white/5 rounded-lg transition-all" title="Tahrirlash"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button onclick="window.app.deleteLab('${l.id}')" class="text-red-400 p-2 hover:bg-white/5 rounded-lg transition-all"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
        </div>
      </div>
    `).join('');
  }

  private showContentModal(type: 'product' | 'product-section' | 'product-panel' | 'service' | 'lab', item: Product | ProductSection | ProductPanel | Service | LabItem) {
    this.editingContentType = type;
    this.editingContentId = item.id;
    this.tempContentImage = '';
    const title = type === 'product'
      ? 'Mahsulot ma\'lumoti'
      : type === 'product-section'
        ? 'Mahsulot bo\'limi'
      : type === 'product-panel'
        ? 'Mahsulot panelchasi'
      : type === 'service'
        ? 'Xizmat ma\'lumoti'
        : 'Laboratoriya ma\'lumoti';
    (document.getElementById('content-modal-title') as HTMLElement).textContent = title;
    (document.getElementById('content-name') as HTMLInputElement).value = item.name;
    (document.getElementById('content-desc') as HTMLTextAreaElement).value = item.description;
    (document.getElementById('content-file-input') as HTMLInputElement).value = '';
    const metaWrap = document.getElementById('content-meta-wrap');
    const metaInput = document.getElementById('content-meta') as HTMLInputElement | null;
    if (metaWrap && metaInput) {
      if (type === 'product-panel') {
        metaWrap.classList.remove('hidden');
        metaInput.value = (item as ProductPanel).meta || '';
      } else {
        metaWrap.classList.add('hidden');
        metaInput.value = '';
      }
    }
    const preview = document.getElementById('content-img-preview');
    if (preview) preview.style.backgroundImage = `url(${this.formatImg(item.image, 200)})`;
    this.hydrateProjectMediaElements(document.getElementById('content-modal') || document);
    this.showAnimatedModal('content-modal');
  }

  private hideContentModal() {
    this.hideAnimatedModal('content-modal', () => {
      this.editingContentType = null;
      this.editingContentId = null;
      this.editingPanelId = null;
      this.tempContentImage = '';
      const metaWrap = document.getElementById('content-meta-wrap');
      const metaInput = document.getElementById('content-meta') as HTMLInputElement | null;
      metaWrap?.classList.add('hidden');
      if (metaInput) metaInput.value = '';
    });
  }

  private saveContentData() {
    if (!this.editingContentType || !this.editingContentId) return;
    const name = (document.getElementById('content-name') as HTMLInputElement).value.trim();
    const description = (document.getElementById('content-desc') as HTMLTextAreaElement).value.trim();
    const meta = (document.getElementById('content-meta') as HTMLInputElement | null)?.value.trim() || '';
    if (!name) return this.toast('Nomi kiritilsin', true);

    if (this.editingContentType === 'product') {
      const item = this.products.find(p => p.id === this.editingContentId);
      if (!item) return;
      item.name = name;
      item.description = description;
      if (this.tempContentImage) item.image = this.tempContentImage;
      if (!this.saveLocalJson('oqqush_products', this.products)) return;
      this.renderAdminProductsList();
    } else if (this.editingContentType === 'product-section') {
      const item = this.productSections.find(section => section.id === this.editingContentId);
      if (!item) return;
      item.name = name;
      item.description = description;
      if (this.tempContentImage) item.image = this.tempContentImage;
      if (!this.saveLocalJson('oqqush_product_sections', this.productSections)) return;
      this.renderAdminProductSectionsList();
    } else if (this.editingContentType === 'product-panel') {
      const section = this.productSections.find(item => item.id === this.editingContentId);
      const panel = section?.panels?.find(item => item.id === this.editingPanelId);
      if (!panel) return;
      panel.name = name;
      panel.description = description;
      panel.meta = meta;
      if (this.tempContentImage) panel.image = this.tempContentImage;
      if (!this.saveLocalJson('oqqush_product_sections', this.productSections)) return;
      this.renderAdminProductSectionsList();
    } else if (this.editingContentType === 'service') {
      const item = this.services.find(s => s.id === this.editingContentId);
      if (!item) return;
      item.name = name;
      item.description = description;
      if (this.tempContentImage) item.image = this.tempContentImage;
      if (!this.saveLocalJson('oqqush_services', this.services)) return;
      this.renderAdminServicesList();
    } else {
      const item = this.laboratory.find(l => l.id === this.editingContentId);
      if (!item) return;
      item.name = name;
      item.description = description;
      if (this.tempContentImage) item.image = this.tempContentImage;
      if (!this.saveLocalJson('oqqush_lab', this.laboratory)) return;
      this.renderAdminLabList();
    }

    this.hideContentModal();
    this.render();
    this.toast('Ma\'lumot saqlandi');
  }

  public editService(id: string) {
    const item = this.services.find(s => s.id === id);
    if (item) this.showContentModal('service', item);
  }

  public editLab(id: string) {
    const item = this.laboratory.find(l => l.id === id);
    if (item) this.showContentModal('lab', item);
  }

  // Render Logic
  private render() {
    const compName = this.settings.compName || 'OQQUSH BETON';
    document.title = `${compName} - Professional Beton Ishlari`;
    
    const logo1 = document.getElementById('nav-logo-l1');
    const logo2 = document.getElementById('nav-logo-l2');
    if (logo1) logo1.textContent = compName.split(' ')[0] || 'OQQUSH';
    if (logo2) logo2.textContent = compName.split(' ')[1] || 'BETON';

    const h1 = document.getElementById('hero-title');
    const hSub = document.getElementById('hero-subtitle');
    if (h1) h1.textContent = this.settings.heroTitle;
    if (hSub) hSub.textContent = this.settings.heroSub;

    const s1 = document.getElementById('stat1-val');
    const s2 = document.getElementById('stat2-val');
    const s3 = document.getElementById('stat3-val');
    if (s1) s1.textContent = this.settings.s1;
    if (s2) s2.textContent = this.settings.s2;
    if (s3) s3.textContent = this.settings.s3;

    this.renderProducts();
    this.renderProductSections();
    this.renderServices();
    this.renderProjects();
    this.renderTransport();
    this.renderLaboratory();
    this.renderFooter();
    this.hydrateChatDataAttributes();
    this.hydrateProjectMediaElements();
  }

  private renderServices() {
    const grid = document.getElementById('services-image-grid');
    if (!grid) return;
    const fallback = [
      'photo-1504307651254-35680f356dfd',
      'photo-1541888941259-79ad73220563',
      'photo-1558618047-3c8c76ca7d13',
    ];
    const items = [0, 1, 2].map(index => this.services[index] || {
      id: `fallback-${index}`,
      name: '',
      image: fallback[index],
      description: '',
    });
    grid.innerHTML = items.map(item => `
      <div class="glass-card relative min-h-[460px] overflow-hidden group border border-white/10">
        <div class="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style="background-image: url(${this.formatImg(item.image, 1200)})"></div>
      </div>
    `).join('');
    this.hydrateProjectMediaElements(grid);
  }

  private renderLaboratory() {
    const cards = Array.from(document.querySelectorAll<HTMLElement>('#laboratory .reveal-stagger > .glass'));
    cards.forEach((card, index) => {
      const item = this.laboratory[index];
      if (!item) return;
      const image = card.querySelector<HTMLImageElement>('img');
      const title = card.querySelector<HTMLElement>('h4');
      const description = card.querySelector<HTMLElement>('p');
      if (image) image.src = this.formatImg(item.image, 900);
      if (item.image?.startsWith('idb:') && image) {
        void this.getMediaBlobUrl(item.image).then(url => {
          image.src = url;
        });
      }
      if (title) title.textContent = item.name;
      if (description) description.textContent = item.description;
    });
  }

  private hydrateChatDataAttributes() {
    const sections = [
      {domId: 'home', id: 'home', title: 'Bosh sahifa', route: 'home', keywords: 'asosiy sahifa,bosh sahifa,asosiy,home'},
      {domId: 'about', id: 'about', title: 'Biz haqimizda', route: 'about', keywords: 'biz haqimizda,kompaniya tarixi,kompaniya haqida,haqimizda'},
      {domId: 'services', id: 'services', title: 'Xizmatlar', route: 'services', keywords: 'xizmatlar,xizmat,nima ish qilasizlar,narxlar,narx'},
      {domId: 'transport', id: 'texnika', title: 'Texnika', route: 'transport', keywords: 'texnika,transport,ijara transport,beton nasos,ekskavator,yuk mashinalari,beton mikser,pogruzchik,kran'},
      {domId: 'products-section', id: 'mahsulotlar', title: 'Mahsulotlar', route: 'products-section', keywords: 'mahsulot,maxsulot,shagal,sheben,pesok,qum,inert material'},
      {domId: 'concrete-mix', id: 'beton-qorishma', title: 'Tayyor beton aralashma', route: 'concrete-mix', keywords: 'beton,qorishma,m100,m150,m200,m250'},
      {domId: 'high-performance-concrete', id: 'maxsus-betonlar', title: 'Yuqori mustahkamlikdagi maxsus betonlar', route: 'high-performance-concrete', keywords: 'maxsus beton,yuqori mustahkam,m300,m350,m400,m450,m550'},
      {domId: 'plitalar-section', id: 'plitalar', title: 'Beton plitalar', route: 'plitalar-section', keywords: 'plita,plitalar,armatura'},
      {domId: 'gisht-section', id: 'gisht', title: "G'isht mahsuloti", route: 'gisht-section', keywords: "gisht,g'isht,hom gisht,pishiq gisht"},
      {domId: 'laboratory', id: 'laboratoriya', title: 'Laboratoriya', route: 'laboratory', keywords: 'laboratoriya,labaratoriya,test,sinov,sertifikat'},
      {domId: 'projects', id: 'bajarilgan-ishlar', title: 'Bajarilgan ishlar', route: 'projects', keywords: 'bajarilgan ish,loyiha,loyihalar,project'},
      {domId: 'footer', id: 'contact', title: 'Aloqa', route: 'footer', keywords: 'aloqa,telefon raqam,telefon,manzil,kontakt,boglanish'},
    ];

    sections.forEach(section => {
      const el = document.getElementById(section.domId);
      if (!el) return;
      el.dataset.section = section.id;
      el.dataset.title = section.title;
      el.dataset.route = section.route;
      el.dataset.keywords = section.keywords;
    });

    const productPanels = this.productSections.flatMap(section => section.panels || []);
    productPanels.forEach(panel => {
      const title = document.getElementById(`panel-${panel.id}-title`);
      const desc = document.getElementById(`panel-${panel.id}-desc`);
      const meta = document.getElementById(`panel-${panel.id}-meta`);
      const card = title?.closest<HTMLElement>('.glass');
      if (!card || !title) return;
      card.dataset.panel = panel.id;
      card.dataset.keywords = this.chatKeywords(panel.name, ...this.panelAliases(panel.id));
      title.setAttribute('data-panel-title', '');
      desc?.setAttribute('data-panel-content', '');
      meta?.setAttribute('data-panel-extra', '');
    });

    this.getLaboratoryViewerItems().forEach((item, index) => {
      const card = Array.from(document.querySelectorAll<HTMLElement>('#laboratory .reveal-stagger > .glass'))[index];
      if (!card) return;
      card.dataset.panel = `laboratory-${this.laboratory[index]?.id || index + 1}`;
      card.dataset.keywords = this.chatKeywords(item.title);
      card.querySelector('h4')?.setAttribute('data-panel-title', '');
      card.querySelector('p')?.setAttribute('data-panel-content', '');
    });
  }

  private chatKeywords(...values: string[]) {
    const keywords = new Set<string>();
    values
      .flatMap(value => value.split(/[\n,.;:|/]+/))
      .map(value => value.trim())
      .filter(value => value.length > 1)
      .forEach(value => {
        keywords.add(value);
        const normalized = this.normalizeVoiceCommand(value);
        if (normalized) keywords.add(normalized);
      });
    return Array.from(keywords).join(',');
  }

  private renderProducts() {
    const grid = document.getElementById('products-list-grid');
    if (!grid) return;
    grid.innerHTML = this.products.map((p, index) => `
      <button type="button" data-panel="product-${this.escapeHtml(p.id)}" data-keywords="${this.escapeHtml(this.chatKeywords(p.name))}" onclick="window.app.openPanelCollection('products', ${index})" class="text-center group reveal backdrop-blur-sm bg-white/5 p-8 rounded-3xl border border-white/10 hover:border-white/30 transition-all duration-500 cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-orange-400/50">
        <div class="aspect-[16/10] overflow-hidden rounded-2xl mb-8">
          <div class="size-full bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style="background-image: url(${this.formatImg(p.image)})"></div>
        </div>
        <h3 data-panel-title class="text-2xl font-heading tracking-widest uppercase mb-6 text-white">${p.name}</h3>
        <div data-panel-content class="space-y-3">
          ${p.description.split('\n').map(line => `
            <p class="text-gray-300 font-medium text-[11px] tracking-wide leading-relaxed uppercase">${line}</p>
          `).join('')}
        </div>
      </button>
    `).join('');
    
    this.initAnimations();
  }

  private renderProductSections() {
    const setText = (id: string, text: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    const setHtmlLines = (id: string, text: string, className: string) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = text.split('\n').filter(Boolean).map(line => `<p class="${className}">${line}</p>`).join('');
    };
    const setImage = (id: string, image: string, width = 1200) => {
      const el = document.getElementById(id) as HTMLImageElement | null;
      if (el && image) el.src = this.formatImg(image, width);
    };
    const setPanel = (panel: ProductPanel | undefined) => {
      if (!panel) return;
      setText(`panel-${panel.id}-title`, panel.name);
      setText(`panel-${panel.id}-desc`, panel.description);
      if (panel.meta) setText(`panel-${panel.id}-meta`, panel.meta);
      setImage(`panel-${panel.id}-image`, panel.image, 600);
    };

    const concrete = this.productSections.find(s => s.id === 'concreteMix');
    if (concrete) {
      setText('product-section-concrete-title', concrete.name);
      setText('product-section-concrete-desc', concrete.description);
      concrete.panels?.forEach(setPanel);
    }

    const high = this.productSections.find(s => s.id === 'highPerformance');
    if (high) {
      setText('product-section-high-title', high.name);
      high.panels?.forEach(setPanel);
    }

    const plitalar = this.productSections.find(s => s.id === 'plitalar');
    if (plitalar) {
      setText('product-section-plitalar-title', plitalar.name);
      setHtmlLines('product-section-plitalar-desc', plitalar.description, 'text-gray-300 font-normal leading-relaxed text-base md:text-lg uppercase tracking-wider');
      setImage('product-section-plitalar-image', plitalar.image, 1600);
      plitalar.panels?.forEach(setPanel);
    }

    const gisht = this.productSections.find(s => s.id === 'gisht');
    if (gisht) {
      setText('product-section-gisht-title', gisht.name);
      setHtmlLines('product-section-gisht-desc', gisht.description, 'text-gray-300 font-normal leading-relaxed text-base md:text-lg uppercase tracking-wider');
      setImage('product-section-gisht-image', gisht.image, 1600);
      gisht.panels?.forEach(setPanel);
    }

    this.bindProductSectionPanelCards();
    this.bindLaboratoryPanelCards();
  }

  private renderProjects() {
    const grid = document.getElementById('projects-grid');
    if (!grid) return;
    this.projectVideoObserver?.disconnect();
    this.projectVideoObserver = null;
    grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-7 reveal-stagger';
    grid.innerHTML = this.projects.map((p, index) => `
      <div role="button" tabindex="0" data-panel="project-${this.escapeHtml(p.id)}" data-keywords="${this.escapeHtml(this.chatKeywords(p.name))}" onclick="window.app.openPanelCollection('projects', ${index})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.app.openPanelCollection('projects', ${index})}" class="group relative aspect-[9/16] overflow-hidden rounded-[26px] border border-white/10 bg-white/5 text-left shadow-[0_24px_80px_rgba(0,0,0,0.35)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-400/50 reveal">
        <div class="absolute inset-0 bg-black">${this.renderProjectMedia(p, 'card')}</div>
        <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/10"></div>
        <div class="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 backdrop-blur">
          <span class="size-2 rounded-full ${this.getProjectMediaType(p) === 'video' ? 'bg-red-500' : 'bg-cyan-300'}"></span>
          <span class="text-[9px] font-black uppercase tracking-[2px] text-white/80">${this.getProjectMediaType(p) === 'video' ? 'Reel' : 'Post'}</span>
        </div>
        <button type="button" onclick="event.stopPropagation(); window.app.openPanelCollection('projects', ${index})" class="absolute right-4 top-4 z-20 grid size-10 place-items-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur transition-transform group-hover:scale-110" aria-label="Panelni ochish">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
        </button>
        <div class="absolute inset-x-0 bottom-0 p-5">
          <div class="mb-2 text-[9px] font-black uppercase tracking-[3px] text-white/50">${p.location} / ${p.year}</div>
          <h4 data-panel-title class="font-heading text-2xl font-black uppercase leading-tight tracking-tight text-white">${p.name}</h4>
          <span data-panel-content class="sr-only">${p.location} ${p.year}</span>
        </div>
      </div>
    `).join('');
    this.hydrateProjectMediaElements(grid);
    this.setupProjectCardVideos(grid);
  }

  public async toggleProjectCardVideo(event: Event, projectId: string) {
    event.preventDefault();
    event.stopPropagation();

    const video = document.querySelector<HTMLVideoElement>(`video[data-project-video-id="${this.cssEscape(projectId)}"]`);
    if (!video) return;

    const key = video.dataset.idbMedia;
    if (key && !video.src) {
      video.src = await this.getMediaBlobUrl(key);
    }

    video.muted = true;
    video.volume = 0;

    if (video.paused) {
      await video.play().catch(() => this.toast('Video ijro etilmadi. Brauzer ruxsatini tekshiring.', true));
    } else {
      video.pause();
    }
  }

  private setupProjectCardVideos(root: HTMLElement) {
    const videos = Array.from(root.querySelectorAll<HTMLVideoElement>('video[data-project-video-id]'));
    if (!videos.length) return;

    videos.forEach(video => {
      video.muted = true;
      video.volume = 0;
      video.preload = 'metadata';
      video.playsInline = true;
    });

    this.projectVideoObserver = new IntersectionObserver((entries) => {
      entries.forEach(async entry => {
        const video = entry.target as HTMLVideoElement;
        if (this.panelViewerOpen || entry.intersectionRatio < 0.45) {
          video.pause();
          return;
        }

        const key = video.dataset.idbMedia;
        if (key && !video.src) {
          video.src = await this.getMediaBlobUrl(key);
        }

        video.muted = true;
        video.volume = 0;
        if (video.paused) await video.play().catch(() => undefined);
      });
    }, {threshold: [0, 0.45, 0.75]});

    videos.forEach(video => this.projectVideoObserver?.observe(video));
  }

  private pauseProjectCardVideos() {
    document.querySelectorAll<HTMLVideoElement>('video[data-project-video-id]').forEach(video => {
      video.pause();
      video.muted = true;
      video.volume = 0;
    });
  }

  private renderTransport() {
    const grid = document.getElementById('transport-grid');
    if (!grid) return;
    grid.innerHTML = this.transport.map((t, index) => `
      <div role="button" tabindex="0" data-panel="${this.escapeHtml(t.id)}" data-keywords="${this.escapeHtml(this.chatKeywords(t.name))}" onclick="window.app.openPanelCollection('transport', ${index})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.app.openPanelCollection('transport', ${index})}" class="glass overflow-hidden group hover:bg-white/5 transition-all duration-500 border border-white/5 flex flex-col p-8 reveal text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-400/50">
        <div class="aspect-[16/10] overflow-hidden rounded-2xl mb-8 relative">
          <div class="size-full bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style="background-image: url(${this.formatImg(t.image)})"></div>
          <div class="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0a0a0a] to-transparent"></div>
        </div>
        <div class="flex-1 space-y-6">
          <h4 data-panel-title class="text-2xl font-heading font-black text-white uppercase tracking-tighter">${t.name}</h4>
          <div data-panel-content class="space-y-4">
            ${t.specs.split('\n').filter(s => s.trim()).map(spec => `
              <div class="flex gap-4 items-start">
                <div class="size-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0"></div>
                <p class="text-[11px] text-gray-300 uppercase tracking-widest leading-relaxed font-medium">${spec}</p>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="pt-10">
          <a href="#footer" onclick="event.stopPropagation()" class="btn-outline w-full py-4 text-center block !text-[10px] font-black uppercase tracking-[3px] hover:!bg-white hover:!text-black transition-all">
             BOG'LANISH / IJARA
          </a>
        </div>
      </div>
    `).join('');
  }

  public openPanelCollection(collection: PanelCollection, index: number) {
    const collections = this.getPanelViewerCollections();
    this.openPanelViewer(collections[collection] || [], index, collection);
  }

  private getPanelViewerCollections(): Record<PanelCollection, PanelViewerItem[]> {
    return {
      products: this.products.map(item => ({
        title: item.name,
        image: item.image,
        description: item.description,
        eyebrow: 'Mahsulot',
      })),
      'product-panels': this.getProductPanelViewerItems(),
      transport: this.transport.map(item => ({
        title: item.name,
        image: item.image,
        description: item.specs,
        meta: item.available ? 'Mavjud' : 'Mavjud emas',
        eyebrow: 'Texnika',
      })),
      projects: this.projects.map(item => ({
        title: item.name,
        image: item.image,
        description: `${item.location}\n${item.year}`,
        mediaType: this.getProjectMediaType(item),
        eyebrow: 'Bajarilgan ish',
      })),
      laboratory: this.getLaboratoryViewerItems(),
    };
  }

  private getPanelViewerItem(collection: PanelCollection, index: number) {
    return this.getPanelViewerCollections()[collection]?.[index] || null;
  }

  private getProductPanelViewerItems() {
    return this.productSections.flatMap(section => (section.panels || []).map(panel => ({
      title: panel.name,
      image: panel.image,
      description: panel.description,
      meta: panel.meta,
      eyebrow: section.name,
    })));
  }

  private getLaboratoryViewerItems() {
    return this.laboratory.map((item, index) => ({
      title: item.name || `Laboratoriya ${index + 1}`,
      image: item.image,
      description: item.description,
      eyebrow: 'Laboratoriya',
    }));
  }

  private bindProductSectionPanelCards() {
    const items = this.getProductPanelViewerItems();
    items.forEach((_, index) => {
      const panel = this.productSections.flatMap(section => section.panels || [])[index];
      if (!panel) return;

      const title = document.getElementById(`panel-${panel.id}-title`);
      const card = title?.closest<HTMLElement>('.glass');
      if (!card || card.dataset.viewerBound === 'true') return;

      card.dataset.viewerBound = 'true';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.classList.add('cursor-pointer', 'focus:outline-none', 'focus:ring-2', 'focus:ring-orange-400/50');
      card.addEventListener('click', () => this.openPanelCollection('product-panels', index));
      card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        this.openPanelCollection('product-panels', index);
      });
    });
  }

  private bindLaboratoryPanelCards() {
    const cards = Array.from(document.querySelectorAll<HTMLElement>('#laboratory .reveal-stagger > .glass'));
    cards.forEach((card, index) => {
      if (card.dataset.viewerBound === 'true') return;
      card.dataset.viewerBound = 'true';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.classList.add('cursor-pointer', 'focus:outline-none', 'focus:ring-2', 'focus:ring-orange-400/50');
      card.addEventListener('click', () => this.openPanelCollection('laboratory', index));
      card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        this.openPanelCollection('laboratory', index);
      });
    });
  }

  private openPanelViewer(items: PanelViewerItem[], index: number, collection: PanelCollection | null = null) {
    if (!items.length) return;
    this.pauseProjectCardVideos();
    this.panelViewerItems = items;
    this.panelViewerCollection = collection;
    this.panelViewerIndex = Math.max(0, Math.min(index, items.length - 1));
    if (this.panelViewerOpen) {
      this.renderPanelViewer(true);
      return;
    }
    this.panelViewerOpen = true;
    this.renderPanelViewer();

    const modal = document.getElementById('panel-viewer-modal');
    const backdrop = document.getElementById('panel-viewer-backdrop');
    const card = document.getElementById('panel-viewer-card');
    modal?.classList.remove('hidden');
    modal?.classList.add('flex');
    this.lockBodyScroll();

    window.setTimeout(() => {
      backdrop?.classList.add('opacity-100');
      card?.classList.remove('opacity-0', 'scale-95', 'translate-y-6');
      card?.classList.add('opacity-100', 'scale-100', 'translate-y-0');
    }, 20);
  }

  private closePanelViewer() {
    if (!this.panelViewerOpen) return;
    this.panelViewerOpen = false;

    const modal = document.getElementById('panel-viewer-modal');
    const backdrop = document.getElementById('panel-viewer-backdrop');
    const card = document.getElementById('panel-viewer-card');
    const video = modal?.querySelector<HTMLVideoElement>('video');
    if (video) {
      video.pause();
      video.muted = true;
    }
    backdrop?.classList.remove('opacity-100');
    card?.classList.add('opacity-0', 'scale-95', 'translate-y-6');
    card?.classList.remove('opacity-100', 'scale-100', 'translate-y-0');

    window.setTimeout(() => {
      modal?.classList.add('hidden');
      modal?.classList.remove('flex');
      this.unlockBodyScroll();
      this.resumeProjectCardVideos();
    }, 260);
  }

  private movePanelViewer(direction: -1 | 1) {
    if (!this.panelViewerOpen || !this.panelViewerItems.length) return;
    const total = this.panelViewerItems.length;
    this.panelViewerIndex = (this.panelViewerIndex + direction + total) % total;
    this.renderPanelViewer(true);
  }

  private renderPanelViewer(animate = false) {
    const item = this.panelViewerItems[this.panelViewerIndex];
    if (!item) return;

    const media = document.getElementById('panel-viewer-media');
    const title = document.getElementById('panel-viewer-title');
    const desc = document.getElementById('panel-viewer-desc');
    const meta = document.getElementById('panel-viewer-meta');
    const count = document.getElementById('panel-viewer-count');
    const card = document.getElementById('panel-viewer-card');
    const grid = card?.querySelector<HTMLElement>('.grid');
    card?.classList.remove('max-w-3xl');
    card?.classList.toggle('max-w-6xl', this.panelViewerCollection === 'projects');
    card?.classList.toggle('max-w-5xl', this.panelViewerCollection !== 'projects');
    grid?.classList.toggle('lg:grid-cols-[0.8fr_0.7fr]', this.panelViewerCollection === 'projects');
    grid?.classList.toggle('lg:grid-cols-[1.15fr_0.85fr]', this.panelViewerCollection !== 'projects');

    const image = this.formatImg(item.image, 1400);
    if (media) {
      media.className = this.panelViewerCollection === 'projects'
        ? 'relative min-h-[min(74vh,780px)] bg-black'
        : 'relative min-h-[320px] bg-white/5';
      if (item.mediaType === 'video') {
        media.innerHTML = item.image.startsWith('idb:')
          ? `<video data-idb-media="${item.image}" class="absolute inset-0 size-full object-contain bg-black" controls playsinline preload="auto"></video>`
          : `<video src="${image}" class="absolute inset-0 size-full object-contain bg-black" controls playsinline preload="auto"></video>`;
      } else {
        media.innerHTML = `<img src="${image}" alt="${this.escapeHtml(item.title)}" class="absolute inset-0 size-full object-cover" />`;
      }
      media.innerHTML += '<div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20"></div>';
      this.hydrateProjectMediaElements(media);
      if (item.mediaType === 'video') void this.playPanelViewerVideo();
    }

    if (title) title.textContent = item.title;
    if (count) count.textContent = `${item.eyebrow || 'Panel'} / ${this.panelViewerIndex + 1} - ${this.panelViewerItems.length}`;
    if (desc) {
      desc.innerHTML = item.description
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => `<p>${this.escapeHtml(line)}</p>`)
        .join('');
    }
    if (meta) {
      meta.textContent = item.meta || '';
      meta.classList.toggle('hidden', !item.meta);
    }

    if (!animate) return;
    card?.classList.add('scale-[0.985]');
    window.setTimeout(() => card?.classList.remove('scale-[0.985]'), 120);
  }

  private async playPanelViewerVideo() {
    const media = document.getElementById('panel-viewer-media');
    const video = media?.querySelector<HTMLVideoElement>('video');
    if (!video) return;

    const key = video.dataset.idbMedia;
    if (key && !video.src) {
      video.src = await this.getMediaBlobUrl(key);
    }

    document.querySelectorAll<HTMLVideoElement>('video').forEach(item => {
      if (item === video) return;
      item.pause();
      item.muted = true;
      item.volume = 0;
    });

    video.muted = false;
    video.volume = 1;
    video.currentTime = 0;
    await this.waitForVideoReady(video);

    try {
      await video.play();
    } catch {
      video.muted = true;
      await video.play().catch(() => {
        this.toast('Video ishga tushmadi. Panel ichidagi play tugmasini bosing.', true);
      });
    }
  }

  private waitForVideoReady(video: HTMLVideoElement) {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return Promise.resolve();
    return new Promise<void>(resolve => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        video.removeEventListener('canplay', done);
        video.removeEventListener('loadeddata', done);
        resolve();
      };
      video.addEventListener('canplay', done, {once: true});
      video.addEventListener('loadeddata', done, {once: true});
      window.setTimeout(done, 1200);
      video.load();
    });
  }

  private resumeProjectCardVideos() {
    document.querySelectorAll<HTMLVideoElement>('video[data-project-video-id]').forEach(async video => {
      const rect = video.getBoundingClientRect();
      const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
      const isVisible = rect.height > 0 && visibleHeight / rect.height >= 0.45;
      video.muted = true;
      video.volume = 0;
      if (isVisible && video.paused) await video.play().catch(() => undefined);
    });
  }

  private escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char] || char));
  }

  private cssEscape(value: string) {
    return (window.CSS && typeof window.CSS.escape === 'function')
      ? window.CSS.escape(value)
      : value.replace(/["\\]/g, '\\$&');
  }

  private renderFooter() {
    const f1 = document.getElementById('f-logo-1');
    const f2 = document.getElementById('f-logo-2');
    const compName = this.settings.compName || 'OQQUSH BETON';
    if (f1) f1.textContent = compName.split(' ')[0] || 'OQQUSH';
    if (f2) f2.textContent = compName.split(' ')[1] || 'BETON';

    const list = document.getElementById('social-list-footer');
    if (!list) return;
    const items = [
      { key: 'tg', name: 'Telegram', color: '#0088cc', icon: this.socialIcon('telegram') },
      { key: 'ig', name: 'Instagram', color: '#e4405f', icon: this.socialIcon('instagram') },
      { key: 'yt', name: 'YouTube', color: '#ff0000', icon: this.socialIcon('youtube') },
      { key: 'fb', name: 'Facebook', color: '#4267b2', icon: this.socialIcon('facebook') },
    ];

    let html = items.map(i => {
      const val = (this.social as any)[i.key];
      if (!val) return '';
      const href = this.normalizeSocialLink(String(val), i.key);
      return `
        <a href="${this.escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-4 group">
          <div class="size-10 rounded-xl border border-white/10 flex items-center justify-center transition-all group-hover:scale-110" style="background: ${i.color}15; border-color: ${i.color}30">
             ${i.icon}
          </div>
          <div class="flex flex-col">
            <span class="text-[10px] font-black uppercase tracking-[3px] text-white/40 mb-1">${i.name}</span>
            <span class="text-[12px] font-bold uppercase tracking-[2px] text-white group-hover:text-white/80 transition-colors">${i.name}</span>
          </div>
        </a>
      `;
    }).join('');

    // Handle multiple phones
    if (this.social.ph) {
      const phones = this.social.ph.split('\n').filter(p => p.trim());
      html += phones.map(phone => `
         <a href="tel:${phone}" class="flex items-center gap-4 group">
          <div class="size-10 rounded-xl border border-white/10 flex items-center justify-center transition-all group-hover:scale-110 bg-white/5 border-white/20">
             ${this.socialIcon('phone')}
          </div>
          <div class="flex flex-col">
            <span class="text-[10px] font-black uppercase tracking-[3px] text-white/40 mb-1">Telefon</span>
            <span class="text-[12px] font-bold uppercase tracking-[2px] text-white group-hover:text-white/80 transition-colors">${phone}</span>
          </div>
        </a>
      `).join('');
    }

    list.innerHTML = html;
  }

  private normalizeSocialLink(value: string, key: string) {
    const raw = value.trim();
    if (!raw) return '#';
    if (/^(https?:|tg:|mailto:|tel:)/i.test(raw)) return raw;
    const clean = raw.replace(/^@/, '').replace(/^\/+/, '');
    if (key === 'tg') return `https://t.me/${clean.replace(/^t\.me\//i, '')}`;
    if (key === 'ig') return `https://instagram.com/${clean.replace(/^instagram\.com\//i, '')}`;
    if (key === 'yt') return clean.includes('youtube.com') || clean.includes('youtu.be') ? `https://${clean}` : `https://youtube.com/${clean}`;
    if (key === 'fb') return clean.includes('facebook.com') || clean.includes('fb.com') ? `https://${clean}` : `https://facebook.com/${clean}`;
    return `https://${clean}`;
  }

  private socialIcon(type: 'telegram' | 'instagram' | 'youtube' | 'facebook' | 'phone') {
    const common = 'width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white" aria-hidden="true"';
    const icons = {
      telegram: `<svg ${common}><path d="M21.5 4.5 3 11.7l7.2 2.4 2.4 7.2 8.9-16.8Z"/><path d="m10.2 14.1 4.9-4.9"/></svg>`,
      instagram: `<svg ${common}><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/></svg>`,
      youtube: `<svg ${common}><path d="M22 12s0-3.4-.4-5a2.8 2.8 0 0 0-2-2C17.9 4.5 12 4.5 12 4.5s-5.9 0-7.6.5a2.8 2.8 0 0 0-2 2C2 8.6 2 12 2 12s0 3.4.4 5a2.8 2.8 0 0 0 2 2c1.7.5 7.6.5 7.6.5s5.9 0 7.6-.5a2.8 2.8 0 0 0 2-2c.4-1.6.4-5 .4-5Z"/><path d="m10 15 5-3-5-3v6Z"/></svg>`,
      facebook: `<svg ${common}><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3V2Z"/></svg>`,
      phone: `<svg ${common}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.7.6 2.5a2 2 0 0 1-.5 2.1L8 9.5a16 16 0 0 0 6.5 6.5l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.6.5 2.5.6A2 2 0 0 1 22 16.9Z"/></svg>`,
    };
    return icons[type];
  }

  private toast(msg: string, isError = false) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast translate-y-20 opacity-0 ${isError ? 'border-red-500/50 bg-red-500/10' : ''}`;
    el.innerHTML = `
      <div class="size-2 rounded-full ${isError ? 'bg-red-500' : 'bg-green-500'}"></div>
      <span class="text-[10px] font-bold uppercase tracking-[3px]">${isError ? '!' : '✓'} ${msg}</span>
    `;
    container.appendChild(el);
    setTimeout(() => el.classList.replace('translate-y-20', 'translate-y-0'), 10);
    setTimeout(() => el.classList.replace('opacity-0', 'opacity-100'), 10);
    setTimeout(() => {
      el.classList.replace('translate-y-0', 'translate-y-10');
      el.classList.replace('opacity-100', 'opacity-0');
      setTimeout(() => el.remove(), 300);
    }, 2500);
  }

  private addService() {
    const name = prompt('Xizmat nomi:');
    if (name) {
      this.services.push({ id: Date.now().toString(), name, image: '', description: '' });
      if (!this.saveLocalJson('oqqush_services', this.services)) return;
      this.renderAdminServicesList();
      this.render();
    }
  }

  public deleteService(id: string) {
    if (confirm('O\'chirilsinmi?')) {
      this.services = this.services.filter(s => s.id !== id);
      if (!this.saveLocalJson('oqqush_services', this.services)) return;
      this.renderAdminServicesList();
      this.render();
    }
  }

  private addLab() {
    const name = prompt('Laboratoriya bolimi nomi:');
    if (name) {
      this.laboratory.push({ id: Date.now().toString(), name, image: '', description: '' });
      if (!this.saveLocalJson('oqqush_lab', this.laboratory)) return;
      this.renderAdminLabList();
      this.render();
    }
  }

  public deleteLab(id: string) {
    if (confirm('O\'chirilsinmi?')) {
      this.laboratory = this.laboratory.filter(l => l.id !== id);
      if (!this.saveLocalJson('oqqush_lab', this.laboratory)) return;
      this.renderAdminLabList();
      this.render();
    }
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  (window as any).app = new App();
});

