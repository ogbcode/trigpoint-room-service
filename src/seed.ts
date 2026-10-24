import type { Database } from './db.js';
import { Department, KOBO_PER_NAIRA, StayStatus } from './constants.js';
import { chargeCodes, stays } from './schema.js';

const STAYS = [
  { roomNumber: '101', firstName: 'Amaka', surname: 'Okafor', status: StayStatus.IN_HOUSE },
  { roomNumber: '204', firstName: 'Tunde', surname: 'Bakare', status: StayStatus.IN_HOUSE },
  { roomNumber: '305', firstName: 'Zainab', surname: 'Bello', status: StayStatus.IN_HOUSE },
  { roomNumber: '410', firstName: 'Chinedu', surname: 'Eze', status: StayStatus.IN_HOUSE },
  { roomNumber: '512', firstName: 'Funke', surname: 'Adeyemi', status: StayStatus.CHECKED_OUT },
];

const MENU = [
  { id: 'JOLLOF_CHICKEN', name: 'Jollof rice with chicken', department: Department.KITCHEN, naira: 6500, available: true },
  { id: 'FRIED_RICE_TURKEY', name: 'Fried rice with turkey', department: Department.KITCHEN, naira: 7500, available: true },
  { id: 'YAM_EGUSI', name: 'Pounded yam and egusi soup', department: Department.KITCHEN, naira: 8000, available: true },
  { id: 'GOAT_PEPPER_SOUP', name: 'Goat meat pepper soup', department: Department.KITCHEN, naira: 5000, available: false },
  { id: 'CLUB_SANDWICH', name: 'Club sandwich with chips', department: Department.KITCHEN, naira: 5500, available: true },
  { id: 'SUYA_PLATTER', name: 'Beef suya platter', department: Department.KITCHEN, naira: 4500, available: true },
  { id: 'WATER', name: 'Bottled water (75cl)', department: Department.BAR, naira: 800, available: true },
  { id: 'COKE', name: 'Coca-Cola (35cl)', department: Department.BAR, naira: 1000, available: true },
  { id: 'CHAPMAN', name: 'Chapman', department: Department.BAR, naira: 2500, available: true },
  { id: 'ORANGE_JUICE', name: 'Chivita orange juice', department: Department.BAR, naira: 2000, available: true },
  { id: 'HEINEKEN', name: 'Heineken (60cl)', department: Department.BAR, naira: 1800, available: true },
];

export async function seed(db: Database) {
  const [existing] = await db.select({ id: chargeCodes.id }).from(chargeCodes).limit(1);
  if (existing) return;

  await db.transaction(async (tx) => {
    await tx.insert(stays).values(
      STAYS.map((stay) => ({ ...stay, email: `${stay.firstName}.${stay.surname}@example.com`.toLowerCase() })),
    );
    await tx.insert(chargeCodes).values(
      MENU.map(({ naira, ...item }) => ({ ...item, priceKobo: naira * KOBO_PER_NAIRA })),
    );
  });
}
