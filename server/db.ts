import bcrypt from "bcryptjs"
import { Pool } from "pg"

let pool: Pool | null = null

export function getDb(): Pool {
  if (!pool) {
    const connStr = process.env.DATABASE_URL
    if (!connStr) {
      throw new Error("DATABASE_URL environment variable is not defined.")
    }
    const isLocal = connStr.includes("localhost") || connStr.includes("127.0.0.1")
    pool = new Pool({
      connectionString: connStr,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  }
  return pool
}

export async function query<T = any>(
  sql: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number }> {
  const db = getDb()
  const result = await db.query(sql, params)
  return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 }
}

let isInitialized = false
let initPromise: Promise<void> | null = null

export async function initDb(): Promise<void> {
  if (isInitialized) return
  if (initPromise) return initPromise

  initPromise = (async () => {
    const db = getDb()
    const client = await db.connect()

    try {
      await client.query("BEGIN")

      // Advisory lock ensures only one worker/request executes schema setup at a time
      // 742938192 is an application-specific 64-bit integer
      await client.query("SELECT pg_advisory_xact_lock(742938192)")

      // 1. Check existing tables in public schema
      const { rows: tableRows } = await client.query<{ table_name: string }>(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
      )
      const existingTables = new Set(tableRows.map((r) => r.table_name))

      // 2. Safely create sequences and tables if they do not exist
      if (!existingTables.has("users")) {
        await client.query(`
          CREATE SEQUENCE IF NOT EXISTS users_id_seq;
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY DEFAULT nextval('users_id_seq'),
            username VARCHAR(80) UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name VARCHAR(120),
            role VARCHAR(20) NOT NULL DEFAULT 'cashier',
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          ALTER SEQUENCE users_id_seq OWNED BY users.id;
        `)
      }

      if (!existingTables.has("categories")) {
        await client.query(`
          CREATE SEQUENCE IF NOT EXISTS categories_id_seq;
          CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY DEFAULT nextval('categories_id_seq'),
            name VARCHAR(100) UNIQUE NOT NULL,
            description TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          ALTER SEQUENCE categories_id_seq OWNED BY categories.id;
        `)
      }

      if (!existingTables.has("suppliers")) {
        await client.query(`
          CREATE SEQUENCE IF NOT EXISTS suppliers_id_seq;
          CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY DEFAULT nextval('suppliers_id_seq'),
            name VARCHAR(150) UNIQUE NOT NULL,
            contact_info VARCHAR(200),
            address TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          ALTER SEQUENCE suppliers_id_seq OWNED BY suppliers.id;
        `)
      }

      if (!existingTables.has("products")) {
        await client.query(`
          CREATE SEQUENCE IF NOT EXISTS products_id_seq;
          CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY DEFAULT nextval('products_id_seq'),
            sku_code VARCHAR(80) UNIQUE NOT NULL,
            name VARCHAR(200) NOT NULL,
            description TEXT,
            image_url TEXT,
            category_id INTEGER REFERENCES categories(id) ON DELETE RESTRICT,
            supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
            buying_price NUMERIC(12,2) NOT NULL DEFAULT 0,
            selling_price NUMERIC(12,2) NOT NULL DEFAULT 0,
            current_stock INTEGER NOT NULL DEFAULT 0,
            min_stock_alert INTEGER NOT NULL DEFAULT 5,
            is_archived BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          ALTER SEQUENCE products_id_seq OWNED BY products.id;
        `)
      }

      if (!existingTables.has("purchases")) {
        await client.query(`
          CREATE SEQUENCE IF NOT EXISTS purchases_id_seq;
          CREATE TABLE IF NOT EXISTS purchases (
            id INTEGER PRIMARY KEY DEFAULT nextval('purchases_id_seq'),
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
            supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
            quantity INTEGER NOT NULL,
            unit_buying_price NUMERIC(12,2) NOT NULL,
            total_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
            invoice_number VARCHAR(100) NOT NULL,
            purchase_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          ALTER SEQUENCE purchases_id_seq OWNED BY purchases.id;
        `)
      }

      if (!existingTables.has("customers")) {
        await client.query(`
          CREATE SEQUENCE IF NOT EXISTS customers_id_seq;
          CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY DEFAULT nextval('customers_id_seq'),
            name VARCHAR(150) NOT NULL,
            phone VARCHAR(30),
            email VARCHAR(150),
            address TEXT,
            notes TEXT,
            outstanding_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          ALTER SEQUENCE customers_id_seq OWNED BY customers.id;
        `)
      }

      if (!existingTables.has("sales")) {
        await client.query(`
          CREATE SEQUENCE IF NOT EXISTS sales_id_seq;
          CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY DEFAULT nextval('sales_id_seq'),
            transaction_code VARCHAR(100) UNIQUE NOT NULL,
            customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
            customer_name VARCHAR(200),
            cashier_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            sold_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            payment_method VARCHAR(50) NOT NULL DEFAULT 'Cash',
            payment_split TEXT,
            total_revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
            total_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
            total_profit NUMERIC(14,2) NOT NULL DEFAULT 0,
            discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
            status VARCHAR(30) NOT NULL DEFAULT 'completed',
            refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
            refund_reason TEXT,
            refunded_at TIMESTAMPTZ,
            sale_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          ALTER SEQUENCE sales_id_seq OWNED BY sales.id;
        `)
      }

      if (!existingTables.has("sale_items")) {
        await client.query(`
          CREATE SEQUENCE IF NOT EXISTS sale_items_id_seq;
          CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY DEFAULT nextval('sale_items_id_seq'),
            sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
            product_name VARCHAR(200),
            product_sku VARCHAR(80),
            quantity INTEGER NOT NULL,
            unit_selling_price NUMERIC(12,2) NOT NULL,
            unit_buying_price NUMERIC(12,2) NOT NULL DEFAULT 0,
            line_revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
            line_profit NUMERIC(14,2) NOT NULL DEFAULT 0,
            returned_quantity INTEGER NOT NULL DEFAULT 0
          );
          ALTER SEQUENCE sale_items_id_seq OWNED BY sale_items.id;
        `)
      }

      if (!existingTables.has("stock_adjustments")) {
        await client.query(`
          CREATE SEQUENCE IF NOT EXISTS stock_adjustments_id_seq;
          CREATE TABLE IF NOT EXISTS stock_adjustments (
            id INTEGER PRIMARY KEY DEFAULT nextval('stock_adjustments_id_seq'),
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
            product_name VARCHAR(200),
            product_sku VARCHAR(80),
            quantity INTEGER NOT NULL,
            reason VARCHAR(100) NOT NULL,
            notes TEXT,
            unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
            total_loss NUMERIC(12,2) NOT NULL DEFAULT 0,
            cashier_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            cashier_username VARCHAR(80),
            adjusted_by INTEGER,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          ALTER SEQUENCE stock_adjustments_id_seq OWNED BY stock_adjustments.id;
        `)
      }

      if (!existingTables.has("khata_entries")) {
        await client.query(`
          CREATE SEQUENCE IF NOT EXISTS khata_entries_id_seq;
          CREATE TABLE IF NOT EXISTS khata_entries (
            id INTEGER PRIMARY KEY DEFAULT nextval('khata_entries_id_seq'),
            customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
            sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
            entry_type VARCHAR(20) NOT NULL DEFAULT 'credit',
            amount NUMERIC(14,2) NOT NULL DEFAULT 0,
            notes TEXT,
            sale_id INTEGER,
            recorded_by INTEGER,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          ALTER SEQUENCE khata_entries_id_seq OWNED BY khata_entries.id;
        `)
      }

      if (!existingTables.has("token_blocklist")) {
        await client.query(`
          CREATE TABLE IF NOT EXISTS token_blocklist (
            jti VARCHAR(64) PRIMARY KEY,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `)
      }

      // 3. Additive columns and defaults for existing tables (non-destructive)
      await client.query(`
        -- Users
        ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'cashier';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(150);

        -- Products
        ALTER TABLE products ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock_alert INTEGER NOT NULL DEFAULT 5;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;

        -- Sales
        ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_id INTEGER;
        ALTER TABLE sales ADD COLUMN IF NOT EXISTS cashier_id INTEGER;
        ALTER TABLE sales ADD COLUMN IF NOT EXISTS sold_by INTEGER;
        ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) NOT NULL DEFAULT 'Cash';
        ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_split TEXT;
        ALTER TABLE sales ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'completed';
        ALTER TABLE sales ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
        ALTER TABLE sales ADD COLUMN IF NOT EXISTS refund_reason TEXT;
        ALTER TABLE sales ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
        ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
        ALTER TABLE sales ADD COLUMN IF NOT EXISTS total_cost NUMERIC(14,2) NOT NULL DEFAULT 0;
        ALTER TABLE sales ADD COLUMN IF NOT EXISTS total_profit NUMERIC(14,2) NOT NULL DEFAULT 0;

        -- Customers
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT;
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT;
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS email VARCHAR(150);
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS outstanding_balance NUMERIC(14,2) NOT NULL DEFAULT 0;
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

        -- Stock adjustments
        ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS notes TEXT;
        ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS reason VARCHAR(100) NOT NULL DEFAULT 'Other';
        ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0;
        ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS total_loss NUMERIC(12,2) NOT NULL DEFAULT 0;
        ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS cashier_id INTEGER;
        ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS cashier_username VARCHAR(80);
        ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS adjusted_by INTEGER;

        -- Khata entries
        ALTER TABLE khata_entries ADD COLUMN IF NOT EXISTS notes TEXT;
        ALTER TABLE khata_entries ADD COLUMN IF NOT EXISTS entry_type VARCHAR(20) NOT NULL DEFAULT 'credit';
        ALTER TABLE khata_entries ADD COLUMN IF NOT EXISTS amount NUMERIC(14,2) NOT NULL DEFAULT 0;
        ALTER TABLE khata_entries ADD COLUMN IF NOT EXISTS sale_id INTEGER;
        ALTER TABLE khata_entries ADD COLUMN IF NOT EXISTS recorded_by INTEGER;

        -- Sale items
        ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS product_name VARCHAR(200);
        ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS product_sku VARCHAR(80);
        ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS unit_buying_price NUMERIC(12,2) NOT NULL DEFAULT 0;
        ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS line_revenue NUMERIC(14,2) NOT NULL DEFAULT 0;
        ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS line_profit NUMERIC(14,2) NOT NULL DEFAULT 0;
        ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS returned_quantity INTEGER NOT NULL DEFAULT 0;

        -- Purchases
        ALTER TABLE purchases ADD COLUMN IF NOT EXISTS total_cost NUMERIC(14,2) NOT NULL DEFAULT 0;

        -- Token blocklist: make legacy columns nullable if table was created by previous SQLAlchemy schema
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'token_blocklist' AND column_name = 'user_id') THEN
            ALTER TABLE token_blocklist ALTER COLUMN user_id DROP NOT NULL;
          END IF;
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'token_blocklist' AND column_name = 'expires_at') THEN
            ALTER TABLE token_blocklist ALTER COLUMN expires_at DROP NOT NULL;
          END IF;
        END $$;
        ALTER TABLE token_blocklist ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
      `)

      // 4. Seed default admin if no users exist
      const { rows: uRows } = await client.query("SELECT COUNT(*) AS cnt FROM users")
      if (parseInt(uRows[0]?.cnt || "0") === 0) {
        const hasher: any = (bcrypt as any)?.default || bcrypt
        const hash = typeof hasher?.hash === "function"
          ? await hasher.hash("admin1234", 12)
          : hasher.hashSync("admin1234", 12)
        await client.query(
          "INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING",
          ["admin", hash, "Store Admin", "admin"]
        )
      }

      await client.query("COMMIT")
      isInitialized = true
    } catch (err) {
      await client.query("ROLLBACK")
      throw err
    } finally {
      client.release()
    }
  })()

  try {
    await initPromise
  } catch (err) {
    initPromise = null
    isInitialized = false
    throw err
  }
}
