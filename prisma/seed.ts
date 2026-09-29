import 'dotenv/config';
import { createClient } from '@libsql/client';
import { randomBytes, scryptSync } from 'crypto';

const INITIAL_PASSWORD = '1234';

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be configured before seeding');
}

const db = createClient({ url, authToken });
const employees = [
  { id: 'EMP001', name: 'เบญจมาศ แก้วภิรมย์ (White)', department: 'Functional', position: 'Senior Functional', email: 'emp001@company.com' },
  { id: 'EMP002', name: 'ณัฐดนัย ศรีทิพากร (Ball)', department: 'Engineering', position: 'Senior Developer', email: 'emp002@company.com' },
  { id: 'EMP003', name: 'กัลยรัตน์ ฉัตรทันใจ (Piano)', department: 'PM&HR', position: 'Manager', email: 'emp003@company.com' },
  { id: 'EMP004', name: 'กนกพล อินทร์หอม (View)', department: 'Engineering', position: 'Software Developer', email: 'emp004@company.com' },
  { id: 'EMP005', name: 'กัญจน์พณิช ชัยชนะ (Gun)', department: 'Engineering', position: 'Software DeveloperDevOps Engineer', email: 'emp005@company.com' },
  { id: 'EMP006', name: 'พรทิพา พันธะวงศ์ (Khae)', department: 'Support', position: 'Customer Support', email: 'emp006@company.com' },
  { id: 'EMP007', name: 'ธีรภัทร เกิดไพบูลย์ (Got)', department: 'Engineering', position: 'DevOps Engineer', email: 'emp007@company.com' },
];

async function main() {
  console.log('Seeding Turso employee accounts...');

  await db.batch(
    employees.map(employee => ({
      sql: `
        INSERT INTO "Employee" ("id", "name", "department", "position", "email", "passwordHash", "role")
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT("id") DO UPDATE SET
          "name" = excluded."name",
          "department" = excluded."department",
          "position" = excluded."position",
          "email" = excluded."email",
          "passwordHash" = excluded."passwordHash",
          "role" = excluded."role"
      `,
      args: [
        employee.id,
        employee.name,
        employee.department,
        employee.position,
        employee.email,
        hashPassword(INITIAL_PASSWORD),
        /terdsak|songsak/i.test(employee.name) ? 'ADMIN' : 'USER',
      ],
    })),
    'write',
  );

  console.log(`Seeded ${employees.length} Turso employee accounts.`);
  console.log(`Initial password for seeded employees: ${INITIAL_PASSWORD}`);
}

main()
  .catch(error => {
    console.error('Turso seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(() => db.close());
