import Database from 'better-sqlite3';
import { randomBytes, scryptSync } from 'crypto';
import path from 'path';

const INITIAL_PASSWORD = '1234';

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

console.log('🚀 Starting seed script...');

const dbPath = path.resolve(__dirname, 'dev.db');

try {
  // ใส่ timeout 5 วินาที ป้องกันการค้างตลอดไปหากไฟล์โดนล็อก
  const db = new Database(dbPath, { timeout: 5000 });

  console.log('🧹 Clearing old data...');
  db.prepare('DELETE FROM "Attendance"').run();
  db.prepare('DELETE FROM "Leave"').run();
  db.prepare('DELETE FROM "Onsite"').run();
  db.prepare('DELETE FROM "Employee"').run();

  console.log('📝 Inserting 7 employees...');
  const insert = db.prepare(
    'INSERT INTO "Employee" (id, name, department, position, email, passwordHash, role) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  const insertMany = db.transaction((employees) => {
    for (const emp of employees) {
      const role = /terdsak|songsak/i.test(emp.name) ? 'ADMIN' : 'USER';
      insert.run(emp.id, emp.name, emp.department, emp.position, emp.email, hashPassword(INITIAL_PASSWORD), role);
    }
  });

  insertMany([
    { id: 'EMP001', name: 'เบญจมาศ แก้วภิรมย์ (White)', department: 'Functional', position: 'Senior Functional', email: 'emp001@company.com' },
    { id: 'EMP002', name: 'ณัฐดนัย ศรีทิพากร (Ball)', department: 'Engineering', position: 'Senior Developer', email: 'emp002@company.com' },
    { id: 'EMP003', name: 'กัลยรัตน์ ฉัตรทันใจ (Piano)', department: 'PM&HR', position: 'Manager', email: 'emp003@company.com' },
    { id: 'EMP004', name: 'กนกพล อินทร์หอม (View)', department: 'Engineering', position: 'Software Developer', email: 'emp004@company.com' },
    { id: 'EMP005', name: 'กัญจน์พณิช ชัยชนะ (Gun)', department: 'Engineering', position: 'Software DeveloperDevOps Engineer', email: 'emp005@company.com' },
    { id: 'EMP006', name: 'พรทิพา พันธะวงศ์ (Khae)', department: 'Support', position: 'Customer Support', email: 'emp006@company.com' },
    { id: 'EMP007', name: 'ธีรภัทร เกิดไพบูลย์ (Got)', department: 'Engineering', position: 'DevOps Engineer', email: 'emp007@company.com' },
  ]);

  console.log(`✅ Success! 7 employees inserted successfully.`);
  console.log(`ℹ️ Initial password for seeded employees: ${INITIAL_PASSWORD}`);
  db.close();
} catch (error) {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
}