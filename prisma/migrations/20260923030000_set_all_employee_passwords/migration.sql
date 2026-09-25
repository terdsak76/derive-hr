-- Temporary development password for all employee accounts.
-- Password: 1234
UPDATE "Employee"
SET "passwordHash" = 'temporary-login-salt:3937e642c2f4aa7d922c2030a83397fcbbc440378ae60f446ce496c2988435e398e52362fd9a74eedd0ed9d198d248f1692de8c2abd36af38862e982fada36ed';
