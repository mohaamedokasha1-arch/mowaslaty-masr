/**
 * Framework-agnostic seed dataset for Mowaslaty Egypt.
 *
 * Used by:
 *  - the in-memory database (zero-config development & testing)
 *  - the Prisma seed script (PostgreSQL in production)
 *
 * Coordinates are approximate and intended as realistic demo data for the
 * Zagazig / Ismailia / Cairo network.
 */
import type {
  ConfidenceLevel,
  FareType,
  ReportType,
  RouteStatus,
  StopType,
} from '@mowaslaty/shared';

export interface SeedMode {
  ref: string;
  name: string;
  nameAr: string;
  icon: string;
  color: string;
  description?: string;
}

export interface SeedCity {
  ref: string;
  name: string;
  nameAr: string;
  nameEn?: string;
  latitude: number;
  longitude: number;
  description?: string;
}

export interface SeedArea {
  ref: string;
  name: string;
  nameAr: string;
  cityRef: string;
  latitude?: number;
  longitude?: number;
}

export interface SeedStop {
  ref: string;
  name: string;
  nameAr: string;
  latitude: number;
  longitude: number;
  type: StopType;
  cityRef: string;
  areaRef?: string;
  address?: string;
  verified?: boolean;
}

export interface SeedRoute {
  ref: string;
  name: string;
  nameAr: string;
  description?: string;
  modeRef: string;
  cityRef: string;
  fare: number | null;
  fareType: FareType;
  operatingHours?: string;
  status: RouteStatus;
  confidence: ConfidenceLevel;
  dataSource: string;
  stopRefs: string[];
}

export interface SeedDataUpdate {
  routeRef: string;
  changeType:
    | 'FARE_CHANGED'
    | 'HOURS_CHANGED'
    | 'STOPS_CHANGED'
    | 'ROUTE_CREATED'
    | 'ROUTE_DELETED'
    | 'ROUTE_MODIFIED'
    | 'STATUS_CHANGED';
  description: string;
  daysAgo: number;
}

export interface SeedReport {
  reportType: ReportType;
  routeRef?: string;
  stopRef?: string;
  description: string;
  status: 'PENDING' | 'REVIEWING' | 'APPROVED' | 'REJECTED' | 'RESOLVED';
  daysAgo: number;
}

// ============= Transport modes =============
export const modes: SeedMode[] = [
  { ref: 'bus', name: 'Bus', nameAr: 'أتوبيس', icon: '🚌', color: '#3498db', description: 'Large passenger buses' },
  { ref: 'minibus', name: 'Minibus', nameAr: 'ميكروباص', icon: '🚐', color: '#e74c3c', description: 'Small shared minibuses' },
  { ref: 'metro', name: 'Metro', nameAr: 'مترو الأنفاق', icon: '🚇', color: '#9b59b6', description: 'Underground metro system' },
  { ref: 'train', name: 'Train', nameAr: 'قطار', icon: '🚂', color: '#f39c12', description: 'Regional and intercity trains' },
  { ref: 'tram', name: 'Tram', nameAr: 'ترام', icon: '🚊', color: '#1abc9c', description: 'Tram / light rail' },
  { ref: 'taxi', name: 'Taxi', nameAr: 'تاكسي', icon: '🚕', color: '#2c3e50', description: 'Taxi services' },
  { ref: 'walking', name: 'Walking', nameAr: 'مشي', icon: '🚶', color: '#95a5a6', description: 'On foot' },
];

// ============= Cities =============
export const cities: SeedCity[] = [
  { ref: 'cairo', name: 'Cairo', nameAr: 'القاهرة', nameEn: 'Cairo', latitude: 30.0444, longitude: 31.2357, description: 'العاصمة المصرية' },
  { ref: 'zagazig', name: 'Zagazig', nameAr: 'الزقازيق', nameEn: 'Zagazig', latitude: 30.5826, longitude: 31.9453, description: 'عاصمة محافظة الشرقية' },
  { ref: 'ismailia', name: 'Ismailia', nameAr: 'الإسماعيلية', nameEn: 'Ismailia', latitude: 30.5965, longitude: 32.2721, description: 'مدينة على قناة السويس' },
];

// ============= Areas =============
export const areas: SeedArea[] = [
  { ref: 'zg-downtown', name: 'Downtown', nameAr: 'وسط المدينة', cityRef: 'zagazig' },
  { ref: 'zg-north', name: 'North Zagazig', nameAr: 'شمال الزقازيق', cityRef: 'zagazig' },
  { ref: 'zg-east', name: 'East Zagazig', nameAr: 'شرق الزقازيق', cityRef: 'zagazig' },
  { ref: 'zg-west', name: 'West Zagazig', nameAr: 'غرب الزقازيق', cityRef: 'zagazig' },
  { ref: 'zg-university', name: 'University District', nameAr: 'منطقة الجامعة', cityRef: 'zagazig' },
  { ref: 'ca-downtown', name: 'Downtown Cairo', nameAr: 'وسط البلد', cityRef: 'cairo' },
  { ref: 'is-center', name: 'First District', nameAr: 'حي أول', cityRef: 'ismailia' },
];

// ============= Stops =============
export const stops: SeedStop[] = [
  // ---- Zagazig ----
  { ref: 'ZG-STATION', name: 'Train Station Square', nameAr: 'ميدان المحطة (القطار)', latitude: 30.578, longitude: 31.939, type: 'BUS', cityRef: 'zagazig', areaRef: 'zg-downtown', address: 'ميدان المحطة، الزقازيق', verified: true },
  { ref: 'ZG-MAWQIF', name: 'Zagazig Central Bus Station', nameAr: 'موقف الزقازيق العمومي', latitude: 30.5768, longitude: 31.9412, type: 'BUS', cityRef: 'zagazig', areaRef: 'zg-downtown', address: 'الموقف العمومي، الزقازيق', verified: true },
  { ref: 'ZG-TAHRIR', name: 'Tahrir Square', nameAr: 'ميدان التحرير', latitude: 30.5815, longitude: 31.9455, type: 'MINIBUS', cityRef: 'zagazig', areaRef: 'zg-downtown', verified: true },
  { ref: 'ZG-SAGHA', name: 'El-Sagha', nameAr: 'الصاغة', latitude: 30.5832, longitude: 31.9472, type: 'MINIBUS', cityRef: 'zagazig', areaRef: 'zg-downtown', verified: true },
  { ref: 'ZG-AMN', name: 'Security Directorate', nameAr: 'مديرية الأمن', latitude: 30.5847, longitude: 31.95, type: 'MINIBUS', cityRef: 'zagazig', areaRef: 'zg-east', verified: true },
  { ref: 'ZG-UNIV-ST', name: 'University Street', nameAr: 'شارع الجامعة', latitude: 30.5895, longitude: 31.9525, type: 'MINIBUS', cityRef: 'zagazig', areaRef: 'zg-university', verified: true },
  { ref: 'ZG-UNIV-HOSP', name: 'University Hospital', nameAr: 'مستشفى الجامعة', latitude: 30.592, longitude: 31.955, type: 'MINIBUS', cityRef: 'zagazig', areaRef: 'zg-university', verified: true },
  { ref: 'ZG-UNIV', name: 'Zagazig University', nameAr: 'جامعة الزقازيق', latitude: 30.5945, longitude: 31.9585, type: 'BUS', cityRef: 'zagazig', areaRef: 'zg-university', verified: true },
  { ref: 'ZG-ORABI', name: 'Orabi Square', nameAr: 'ميدان عرابي', latitude: 30.5862, longitude: 31.9418, type: 'BUS', cityRef: 'zagazig', areaRef: 'zg-west', verified: true },
  { ref: 'ZG-QAWMEYA', name: 'El-Qawmya', nameAr: 'القومية', latitude: 30.5885, longitude: 31.9345, type: 'MINIBUS', cityRef: 'zagazig', areaRef: 'zg-west', verified: false },
  { ref: 'ZG-ISM-ROAD', name: 'Ismailia Road', nameAr: 'طريق الإسماعيلية', latitude: 30.5808, longitude: 31.9595, type: 'BUS', cityRef: 'zagazig', areaRef: 'zg-east', verified: true },

  // ---- Ismailia ----
  { ref: 'IS-MAWQIF', name: 'Ismailia Central Station', nameAr: 'موقف الإسماعيلية الرئيسي', latitude: 30.596, longitude: 32.26, type: 'BUS', cityRef: 'ismailia', areaRef: 'is-center', verified: true },
  { ref: 'IS-MAMAR', name: 'El-Mammar Square', nameAr: 'ميدان الممر', latitude: 30.5935, longitude: 32.2685, type: 'MINIBUS', cityRef: 'ismailia', areaRef: 'is-center', verified: true },
  { ref: 'IS-SALAM', name: 'Hay El-Salam', nameAr: 'حي السلام', latitude: 30.612, longitude: 32.248, type: 'MINIBUS', cityRef: 'ismailia', areaRef: 'is-center', verified: false },

  // ---- Cairo ----
  { ref: 'CA-RAMSIS', name: 'Ramses Station', nameAr: 'محطة مصر (رمسيس)', latitude: 30.0626, longitude: 31.2497, type: 'TRAIN', cityRef: 'cairo', areaRef: 'ca-downtown', verified: true },
  { ref: 'CA-TAHRIR', name: 'Tahrir Square (Cairo)', nameAr: 'ميدان التحرير (القاهرة)', latitude: 30.0444, longitude: 31.2357, type: 'BUS', cityRef: 'cairo', areaRef: 'ca-downtown', verified: true },
  { ref: 'CA-GIZA', name: 'Giza Square', nameAr: 'ميدان الجيزة', latitude: 30.0131, longitude: 31.2089, type: 'BUS', cityRef: 'cairo', verified: true },
  { ref: 'CA-M-ZEINAB', name: 'Sayeda Zeinab Metro', nameAr: 'محطة مترو السيدة زينب', latitude: 30.0295, longitude: 31.239, type: 'METRO', cityRef: 'cairo', areaRef: 'ca-downtown', verified: true },
  { ref: 'CA-M-SADAT', name: 'Sadat Metro', nameAr: 'محطة مترو السادات', latitude: 30.0445, longitude: 31.2345, type: 'METRO', cityRef: 'cairo', areaRef: 'ca-downtown', verified: true },
  { ref: 'CA-M-SHUHADA', name: 'El-Shohadaa Metro', nameAr: 'محطة مترو الشهداء', latitude: 30.0635, longitude: 31.2465, type: 'METRO', cityRef: 'cairo', verified: true },
  { ref: 'CA-BANHA', name: 'Banha Station', nameAr: 'محطة بنها', latitude: 30.466, longitude: 31.184, type: 'TRAIN', cityRef: 'cairo', verified: true },
];

// ============= Routes =============
export const routes: SeedRoute[] = [
  {
    ref: 'route-zg-01',
    name: 'Station – University Line',
    nameAr: 'خط المحطة – الجامعة',
    description: 'خط ميكروباص يربط ميدان المحطة بجامعة الزقازيق مرورًا بوسط المدينة',
    modeRef: 'minibus',
    cityRef: 'zagazig',
    fare: 5,
    fareType: 'FIXED',
    operatingHours: '06:00-23:30',
    status: 'ACTIVE',
    confidence: 'HIGH',
    dataSource: 'Manual Entry',
    stopRefs: ['ZG-STATION', 'ZG-TAHRIR', 'ZG-SAGHA', 'ZG-AMN', 'ZG-UNIV-ST', 'ZG-UNIV-HOSP', 'ZG-UNIV'],
  },
  {
    ref: 'route-zg-02',
    name: 'University – El-Qawmya Line',
    nameAr: 'خط الجامعة – القومية',
    description: 'خط ميكروباص من الجامعة إلى منطقة القومية',
    modeRef: 'minibus',
    cityRef: 'zagazig',
    fare: 5,
    fareType: 'FIXED',
    operatingHours: '06:30-23:00',
    status: 'ACTIVE',
    confidence: 'MEDIUM',
    dataSource: 'Community',
    stopRefs: ['ZG-UNIV', 'ZG-UNIV-HOSP', 'ZG-UNIV-ST', 'ZG-SAGHA', 'ZG-TAHRIR', 'ZG-ORABI', 'ZG-QAWMEYA'],
  },
  {
    ref: 'route-zg-03',
    name: 'City Bus: Central Station – University',
    nameAr: 'أتوبيس المدينة: الموقف – الجامعة',
    description: 'أتوبيس عام رخيص يمر بميدان عرابي وطريق الإسماعيلية',
    modeRef: 'bus',
    cityRef: 'zagazig',
    fare: 3,
    fareType: 'FIXED',
    operatingHours: '06:00-22:00',
    status: 'ACTIVE',
    confidence: 'MEDIUM',
    dataSource: 'Manual Entry',
    stopRefs: ['ZG-MAWQIF', 'ZG-STATION', 'ZG-ORABI', 'ZG-ISM-ROAD', 'ZG-UNIV'],
  },
  {
    ref: 'route-zg-04',
    name: 'Central Station – Ismailia Road',
    nameAr: 'خط الموقف – طريق الإسماعيلية',
    modeRef: 'minibus',
    cityRef: 'zagazig',
    fare: 4,
    fareType: 'FIXED',
    operatingHours: '07:00-22:00',
    status: 'ACTIVE',
    confidence: 'LOW',
    dataSource: 'Community',
    stopRefs: ['ZG-MAWQIF', 'ZG-STATION', 'ZG-TAHRIR', 'ZG-ISM-ROAD'],
  },
  {
    ref: 'route-zg-ism',
    name: 'Zagazig – Ismailia Intercity',
    nameAr: 'الزقازيق – الإسماعيلية',
    description: 'خط أتوبيس بين المحافظات عبر طريق الإسماعيلية الصحراوي',
    modeRef: 'bus',
    cityRef: 'zagazig',
    fare: 25,
    fareType: 'FIXED',
    operatingHours: '05:00-23:00',
    status: 'ACTIVE',
    confidence: 'HIGH',
    dataSource: 'Manual Entry',
    stopRefs: ['ZG-MAWQIF', 'ZG-ISM-ROAD', 'IS-MAWQIF'],
  },
  {
    ref: 'route-is-01',
    name: 'Central Station – Hay El-Salam',
    nameAr: 'خط الموقف – حي السلام',
    modeRef: 'minibus',
    cityRef: 'ismailia',
    fare: 4,
    fareType: 'FIXED',
    operatingHours: '06:00-23:00',
    status: 'ACTIVE',
    confidence: 'MEDIUM',
    dataSource: 'Community',
    stopRefs: ['IS-MAWQIF', 'IS-MAMAR', 'IS-SALAM'],
  },
  {
    ref: 'route-ca-metro1',
    name: 'Metro Line 1 (Zeinab – Shohadaa)',
    nameAr: 'مترو الأنفاق: الخط الأول (السيدة زينب – الشهداء)',
    description: 'قطاع من الخط الأول لمترو أنفاق القاهرة',
    modeRef: 'metro',
    cityRef: 'cairo',
    fare: 8,
    fareType: 'DISTANCE_BASED',
    operatingHours: '05:15-01:00',
    status: 'ACTIVE',
    confidence: 'HIGH',
    dataSource: 'Manual Entry',
    stopRefs: ['CA-M-ZEINAB', 'CA-M-SADAT', 'CA-M-SHUHADA'],
  },
  {
    ref: 'route-ca-01',
    name: 'Bus: Ramses – Giza',
    nameAr: 'أتوبيس رمسيس – الجيزة',
    modeRef: 'bus',
    cityRef: 'cairo',
    fare: 6,
    fareType: 'FIXED',
    operatingHours: '05:30-23:30',
    status: 'ACTIVE',
    confidence: 'MEDIUM',
    dataSource: 'Community',
    stopRefs: ['CA-RAMSIS', 'CA-TAHRIR', 'CA-GIZA'],
  },
  {
    ref: 'route-ca-zg',
    name: 'Train: Cairo – Zagazig',
    nameAr: 'قطار القاهرة – الزقازيق',
    description: 'قطار إقليمي من محطة مصر برمسيس إلى الزقازيق مرورًا ببنها',
    modeRef: 'train',
    cityRef: 'cairo',
    fare: 20,
    fareType: 'FIXED',
    operatingHours: '05:00-23:00',
    status: 'ACTIVE',
    confidence: 'HIGH',
    dataSource: 'Manual Entry',
    stopRefs: ['CA-RAMSIS', 'CA-BANHA', 'ZG-STATION'],
  },
];

// ============= Data sources =============
export const dataSources = [
  { name: 'Manual Entry', sourceType: 'MANUAL' as const, description: 'بيانات يدخُلها ويتحقق منها فريق الإدارة' },
  { name: 'OpenStreetMap', sourceType: 'OSM' as const, url: 'https://www.openstreetmap.org', description: 'بيانات خرائط مجتمعية' },
  { name: 'Community', sourceType: 'COMMUNITY' as const, description: 'بلاغات ومساهمات المستخدمين' },
];

// ============= Sample data updates (change log) =============
export const dataUpdates: SeedDataUpdate[] = [
  { routeRef: 'route-zg-01', changeType: 'FARE_CHANGED', description: 'تحديث أجرة خط المحطة – الجامعة من 4 إلى 5 جنيهات', daysAgo: 12 },
  { routeRef: 'route-ca-metro1', changeType: 'FARE_CHANGED', description: 'تحديث تسعيرة مترو الأنفاق حسب عدد المحطات', daysAgo: 30 },
  { routeRef: 'route-zg-ism', changeType: 'HOURS_CHANGED', description: 'تعديل مواعيد تشغيل خط الزقازيق – الإسماعيلية لتبدأ من الخامسة صباحًا', daysAgo: 5 },
  { routeRef: 'route-is-01', changeType: 'ROUTE_CREATED', description: 'إضافة خط الموقف – حي السلام بالإسماعيلية', daysAgo: 45 },
];

// ============= Sample community reports =============
export const sampleReports: SeedReport[] = [
  { reportType: 'FARE_INCORRECT', routeRef: 'route-zg-04', description: 'السائق يطلب 6 جنيهات بدلًا من 4 المسجلة في التطبيق', status: 'PENDING', daysAgo: 1 },
  { reportType: 'STOP_LOCATION_WRONG', stopRef: 'ZG-QAWMEYA', description: 'موقع المحطة على الخريطة بعيد عن مكان الوقوف الفعلي بحوالي 100 متر', status: 'PENDING', daysAgo: 2 },
  { reportType: 'OPERATING_HOURS_WRONG', routeRef: 'route-zg-03', description: 'الأتوبيس يتوقف عن العمل الساعة 10 مساءً وليس 12 كما هو مسجل', status: 'REVIEWING', daysAgo: 4 },
  { reportType: 'ROUTE_CHANGED', routeRef: 'route-zg-02', description: 'الخط لم يعد يمر بشارع الجامعة بعد أعمال الحفر', status: 'RESOLVED', daysAgo: 9 },
];
