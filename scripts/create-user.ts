import "dotenv/config"
import bcrypt from "bcryptjs"
import { getDb } from "../api/db"

async function main() {
  const args = process.argv.slice(2)
  const username = args[0]?.trim() || "admin"
  const password = args[1]?.trim() || "admin1234"
  const role = args[2]?.trim() || "admin"

  console.log(`\n===========================================`)
  console.log(`  Shop & Inventory — User Setup Utility`)
  console.log(`===========================================\n`)

  const db = getDb()

  // 1. List existing users
  try {
    const { rows: existing } = await db.query(
      "SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY id ASC"
    )
    if (existing.length > 0) {
      console.log("Current users in database:")
      existing.forEach((u: any) => {
        console.log(`  • ID: ${u.id} | Username: "${u.username}" | Role: ${u.role} | Active: ${u.is_active}`)
      })
      console.log("")
    } else {
      console.log("No users found in database.\n")
    }
  } catch (err: any) {
    console.error("Could not query existing users:", err.message)
  }

  // 2. Hash password
  const hasher: any = (bcrypt as any)?.default || bcrypt
  const hash = typeof hasher?.hash === "function"
    ? await hasher.hash(password, 12)
    : hasher.hashSync(password, 12)

  // 3. Upsert user (insert or update password if exists)
  try {
    const { rows: checkUser } = await db.query(
      "SELECT id, username FROM users WHERE username = $1",
      [username]
    )

    if (checkUser.length > 0) {
      await db.query(
        "UPDATE users SET password_hash = $1, role = $2, is_active = TRUE WHERE username = $3",
        [hash, role, username]
      )
      console.log(`✅ User "${username}" already existed — password has been RESET to: "${password}"`)
      console.log(`   Role: ${role} | Active: true\n`)
    } else {
      await db.query(
        "INSERT INTO users (username, password_hash, full_name, role, is_active) VALUES ($1, $2, $3, $4, TRUE)",
        [username, hash, `${username.charAt(0).toUpperCase() + username.slice(1)} Admin`, role]
      )
      console.log(`✅ Created NEW user: "${username}" with password: "${password}"`)
      console.log(`   Role: ${role} | Active: true\n`)
    }

    console.log(`👉 You can now log in at: http://localhost:5173/login`)
    console.log(`   Username: ${username}`)
    console.log(`   Password: ${password}\n`)
  } catch (err: any) {
    console.error("❌ Failed to create/update user:", err.message)
  } finally {
    await db.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
