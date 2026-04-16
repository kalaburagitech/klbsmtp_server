const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const email = "admin@gmail.com";
  const passwordHash = await bcrypt.hash("admin123", 10);

  await prisma.admin.upsert({
    where: { email },
    update: { passwordHash },
    create: {
      email,
      passwordHash,
      role: "admin",
      name: "System Admin"
    }
  });

  console.log("Default admin seeded: admin@gmail.com / admin123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
