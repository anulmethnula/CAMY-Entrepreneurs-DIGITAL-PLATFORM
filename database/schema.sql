CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  member_id VARCHAR(30) NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  session_version INT UNSIGNED NOT NULL DEFAULT 1,
  access_role VARCHAR(40) NULL,
  permissions_json TEXT NULL,
  role ENUM('admin','manager','staff','entrepreneur') NOT NULL DEFAULT 'entrepreneur',
  status ENUM('active','suspended','inactive') NOT NULL DEFAULT 'active',
  last_login_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS entrepreneurs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  member_id VARCHAR(30) NOT NULL UNIQUE,
  nic VARCHAR(30) NULL UNIQUE,
  nic_image_path VARCHAR(255) NULL,
  phone VARCHAR(30) NULL,
  address TEXT NULL,
  city VARCHAR(100) NULL,
  joined_date DATE NOT NULL,
  profile_image LONGTEXT NULL,
  bank_name VARCHAR(120) NULL,
  bank_branch VARCHAR(120) NULL,
  account_holder VARCHAR(150) NULL,
  account_number VARCHAR(80) NULL,
  credit_limit DECIMAL(14,2) NOT NULL DEFAULT 0,
  outstanding DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_sales DECIMAL(14,2) NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(60) NOT NULL UNIQUE,
  name VARCHAR(190) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT NULL,
  price DECIMAL(14,2) NOT NULL,
  stock INT UNSIGNED NOT NULL DEFAULT 0,
  image LONGTEXT NULL,
  record_json LONGTEXT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(40) NOT NULL UNIQUE,
  entrepreneur_id BIGINT UNSIGNED NOT NULL,
  customer_name VARCHAR(150) NOT NULL,
  customer_phone VARCHAR(30) NOT NULL,
  delivery_address TEXT NOT NULL,
  source ENUM('portal','phone','admin') NOT NULL DEFAULT 'portal',
  status ENUM('Processing','Dispatched','Delivered','Returned','Cancelled') NOT NULL DEFAULT 'Processing',
  subtotal DECIMAL(14,2) NOT NULL,
  discount DECIMAL(14,2) NOT NULL DEFAULT 0,
  total DECIMAL(14,2) NOT NULL,
  notes TEXT NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (entrepreneur_id) REFERENCES entrepreneurs(id),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_price DECIMAL(14,2) NOT NULL,
  line_total DECIMAL(14,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS marketplace_state (
  id TINYINT UNSIGNED PRIMARY KEY,
  state_json LONGTEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  action VARCHAR(12) NOT NULL,
  resource VARCHAR(255) NOT NULL,
  status_code SMALLINT UNSIGNED NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX audit_user_time(user_id,created_at)
) ENGINE=InnoDB;

-- Shop-flow records for reporting and future migration away from the JSON snapshot.
CREATE TABLE IF NOT EXISTS stock_supply_requests (
  id VARCHAR(32) PRIMARY KEY,
  entrepreneur_member_id VARCHAR(30) NOT NULL,
  payment_reference VARCHAR(120) NOT NULL,
  receipt_path VARCHAR(255) NOT NULL,
  total DECIMAL(14,2) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  record_json LONGTEXT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stock_supply_request_items (
  request_id VARCHAR(32) NOT NULL,
  product_code VARCHAR(60) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  purchase_price DECIMAL(14,2) NOT NULL,
  PRIMARY KEY (request_id, product_code),
  FOREIGN KEY (request_id) REFERENCES stock_supply_requests(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS entrepreneur_shop_items (
  entrepreneur_member_id VARCHAR(30) NOT NULL,
  product_code VARCHAR(60) NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 0,
  sell_price DECIMAL(14,2) NOT NULL,
  visible TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (entrepreneur_member_id, product_code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS customer_order_groups (
  id VARCHAR(32) PRIMARY KEY,
  customer_name VARCHAR(150) NOT NULL,
  customer_phone VARCHAR(30) NOT NULL,
  district VARCHAR(100) NOT NULL,
  delivery_address TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS shop_orders (
  id VARCHAR(32) PRIMARY KEY,
  group_id VARCHAR(32) NOT NULL,
  entrepreneur_member_id VARCHAR(30) NOT NULL,
  total DECIMAL(14,2) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'Pending',
  record_json LONGTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES customer_order_groups(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS shop_order_items (
  order_id VARCHAR(32) NOT NULL,
  product_code VARCHAR(60) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  sell_price DECIMAL(14,2) NOT NULL,
  PRIMARY KEY (order_id, product_code),
  FOREIGN KEY (order_id) REFERENCES shop_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS credit_tiers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  sales_required DECIMAL(14,2) NOT NULL,
  credit_limit DECIMAL(14,2) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  record_json LONGTEXT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS platform_settings (
  setting_key VARCHAR(80) PRIMARY KEY,
  value_json LONGTEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS entrepreneur_directory (
  member_id VARCHAR(30) PRIMARY KEY,
  record_json LONGTEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS credit_settlement_requests (
  id VARCHAR(32) PRIMARY KEY,
  entrepreneur_member_id VARCHAR(30) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  reference VARCHAR(100) NOT NULL,
  status VARCHAR(40) NOT NULL,
  record_json LONGTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX settlement_member_status(entrepreneur_member_id,status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS settlements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entrepreneur_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  reference VARCHAR(100) NULL,
  recorded_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entrepreneur_id) REFERENCES entrepreneurs(id),
  FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS exit_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entrepreneur_id BIGINT UNSIGNED NOT NULL,
  reason TEXT NOT NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  admin_note TEXT NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  FOREIGN KEY (entrepreneur_id) REFERENCES entrepreneurs(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS registration_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  nic VARCHAR(30) NOT NULL,
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  occupation VARCHAR(150) NOT NULL,
  has_online_business ENUM('yes','no') NOT NULL DEFAULT 'no',
  online_business_products VARCHAR(255) NULL,
  online_business_duration VARCHAR(120) NULL,
  monthly_income VARCHAR(120) NULL,
  social_media_url VARCHAR(500) NULL,
  followers_count INT UNSIGNED NULL,
  facebook_marketing ENUM('yes','a_little','no') NOT NULL DEFAULT 'no',
  join_reason TEXT NOT NULL,
  agreement_accepted TINYINT(1) NOT NULL DEFAULT 0,
  nic_image_path VARCHAR(255) NULL,
  nic_front_path VARCHAR(255) NULL,
  nic_back_path VARCHAR(255) NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  admin_note TEXT NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  INDEX registration_email_status (email, status),
  INDEX registration_nic_status (nic, status),
  INDEX registration_status_created (status, created_at),
  INDEX registration_city (city),
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  succeeded TINYINT(1) NOT NULL DEFAULT 0,
  attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX login_limit (email, ip_address, attempted_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS customers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  session_version INT UNSIGNED NOT NULL DEFAULT 1,
  phone VARCHAR(30) NOT NULL,
  district VARCHAR(80) NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS customer_checkout_requests (
  customer_id INT UNSIGNED NOT NULL,
  request_key VARCHAR(64) NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  response_json LONGTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (customer_id,request_key),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS customer_favourites (
  customer_id INT UNSIGNED NOT NULL,
  shop_id VARCHAR(30) NOT NULL,
  product_id VARCHAR(80) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (customer_id,shop_id,product_id),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS customer_reviews (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id INT UNSIGNED NOT NULL,
  order_id VARCHAR(30) NOT NULL,
  shop_id VARCHAR(30) NOT NULL,
  product_id VARCHAR(80) NOT NULL,
  product_name VARCHAR(150) NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  comment TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  admin_reply TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY customer_product_review (customer_id,shop_id,product_id),
  INDEX review_moderation (status,created_at),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS customer_addresses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id INT UNSIGNED NOT NULL,
  label VARCHAR(60) NOT NULL,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  district VARCHAR(80) NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB;
