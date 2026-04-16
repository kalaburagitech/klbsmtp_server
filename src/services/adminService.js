const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const { signJwt } = require("../utils/jwt");

async function loginAdmin({ email, password }) {
  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin) {
    const error = new Error("Invalid credentials");
    error.status = 401;
    throw error;
  }

  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) {
    const error = new Error("Invalid credentials");
    error.status = 401;
    throw error;
  }

  const token = signJwt({ adminId: admin.id, role: admin.role || "admin" });
  return {
    token,
    admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role }
  };
}

module.exports = { loginAdmin };
