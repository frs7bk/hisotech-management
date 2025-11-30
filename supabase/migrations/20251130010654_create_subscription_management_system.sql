/*
  # إنشاء نظام إدارة الاشتراكات

  1. الجداول الجديدة
    - `products` - المنتجات
      - `id` (uuid, primary key)
      - `name` (text) - اسم المنتج
      - `description` (text) - وصف المنتج
      - `standard_price` (decimal) - السعر القياسي
      - `plan_type` (text) - نوع الخطة
      - `status` (enum) - حالة المنتج
      - `created_at` (timestamp)
    
    - `master_accounts` - الحسابات الرئيسية
      - `id` (uuid, primary key)
      - `product_id` (uuid, foreign key)
      - `account_name` (text) - اسم الحساب
      - `max_capacity` (integer) - السعة القصوى
      - `current_usage` (integer) - الاستخدام الحالي
      - `is_active` (boolean) - نشط أم لا
      - `created_at` (timestamp)
    
    - `subscriptions` - الاشتراكات
      - `id` (uuid, primary key)
      - `product_id` (uuid, foreign key)
      - `master_account_id` (uuid, foreign key)
      - `customer_name` (text) - اسم العميل
      - `customer_email` (text) - البريد الإلكتروني
      - `customer_whatsapp` (text) - رقم الواتساب
      - `start_date` (timestamp) - تاريخ البدء
      - `end_date` (timestamp) - تاريخ الانتهاء
      - `status` (enum) - حالة الاشتراك
      - `price` (decimal) - السعر
      - `currency` (text) - العملة
      - `coupon_code` (text) - كود الخصم
      - `referrer` (text) - المحيل
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `revenues` - الإيرادات
      - `id` (uuid, primary key)
      - `product_id` (uuid, foreign key)
      - `subscription_id` (uuid, foreign key)
      - `amount` (decimal) - المبلغ
      - `currency` (text) - العملة
      - `description` (text) - الوصف
      - `type` (text) - النوع
      - `date` (timestamp) - التاريخ
      - `created_at` (timestamp)
    
    - `expenses` - المصروفات
      - `id` (uuid, primary key)
      - `product_id` (uuid, foreign key)
      - `amount` (decimal) - المبلغ
      - `currency` (text) - العملة
      - `category` (text) - الفئة
      - `description` (text) - الوصف
      - `frequency` (enum) - التكرار
      - `due_date` (timestamp) - تاريخ الاستحقاق
      - `is_paid` (boolean) - مدفوع
      - `date` (timestamp) - التاريخ
      - `created_at` (timestamp)
    
    - `invoices` - الفواتير
      - `id` (uuid, primary key)
      - `subscription_id` (uuid, foreign key)
      - `invoice_number` (text) - رقم الفاتورة
      - `amount` (decimal) - المبلغ
      - `currency` (text) - العملة
      - `status` (enum) - حالة الفاتورة
      - `due_date` (timestamp) - تاريخ الاستحقاق
      - `paid_date` (timestamp) - تاريخ الدفع
      - `customer_name` (text) - اسم العميل
      - `customer_email` (text) - البريد الإلكتروني
      - `notes` (text) - ملاحظات
      - `created_at` (timestamp)
    
    - `notifications` - الإشعارات
      - `id` (uuid, primary key)
      - `type` (enum) - نوع الإشعار
      - `title` (text) - العنوان
      - `message` (text) - الرسالة
      - `related_id` (uuid) - المعرف المرتبط
      - `is_read` (boolean) - مقروء
      - `created_at` (timestamp)

  2. الأمان
    - تمكين RLS على جميع الجداول
    - إضافة سياسات للسماح بجميع العمليات (للنظام الداخلي)
*/

-- إنشاء الأنواع المخصصة (Enums)
DO $$ BEGIN
  CREATE TYPE product_status AS ENUM ('active', 'inactive');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('active', 'expiring_soon', 'expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('paid', 'unpaid', 'overdue');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE expense_frequency AS ENUM ('one_time', 'monthly', 'yearly');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('subscription_expiring', 'account_capacity', 'expense_due', 'invoice_unpaid');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- إنشاء جدول المنتجات
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  standard_price decimal(10, 2) NOT NULL,
  plan_type text NOT NULL,
  status product_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- إنشاء جدول الحسابات الرئيسية
CREATE TABLE IF NOT EXISTS master_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  account_name text NOT NULL,
  max_capacity integer NOT NULL,
  current_usage integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- إنشاء جدول الاشتراكات
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  master_account_id uuid NOT NULL REFERENCES master_accounts(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_whatsapp text,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  status subscription_status NOT NULL DEFAULT 'active',
  price decimal(10, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'SAR',
  coupon_code text,
  referrer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- إنشاء جدول الإيرادات
CREATE TABLE IF NOT EXISTS revenues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount decimal(10, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'SAR',
  description text NOT NULL,
  type text NOT NULL,
  date timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- إنشاء جدول المصروفات
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  amount decimal(10, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'SAR',
  category text NOT NULL,
  description text NOT NULL,
  frequency expense_frequency NOT NULL DEFAULT 'one_time',
  due_date timestamptz,
  is_paid boolean NOT NULL DEFAULT false,
  date timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- إنشاء جدول الفواتير
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  invoice_number text NOT NULL UNIQUE,
  amount decimal(10, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'SAR',
  status invoice_status NOT NULL DEFAULT 'unpaid',
  due_date timestamptz NOT NULL,
  paid_date timestamptz,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- إنشاء جدول الإشعارات
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type notification_type NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  related_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- تمكين RLS على جميع الجداول
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenues ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- إضافة سياسات للسماح بجميع العمليات (نظام داخلي)
CREATE POLICY "Allow all operations on products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on master_accounts" ON master_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on subscriptions" ON subscriptions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on revenues" ON revenues FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on invoices" ON invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);