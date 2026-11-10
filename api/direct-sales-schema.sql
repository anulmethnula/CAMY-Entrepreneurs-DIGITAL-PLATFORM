CREATE TABLE IF NOT EXISTS direct_sales (
 id VARCHAR(64) PRIMARY KEY,
 idempotency_key VARCHAR(96) NOT NULL UNIQUE,
 entrepreneur_member_id VARCHAR(40) NULL,
 customer_phone VARCHAR(40) NOT NULL,
 sale_date DATE NOT NULL,
 payment_status VARCHAR(40) NOT NULL,
 fulfilment_status VARCHAR(40) NOT NULL,
 version INT UNSIGNED NOT NULL DEFAULT 1,
 record_json LONGTEXT NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX direct_member_date(entrepreneur_member_id,sale_date),
 INDEX direct_payment_date(payment_status,sale_date),
 INDEX direct_customer_phone(customer_phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS direct_sale_stock_movements (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 sale_id VARCHAR(64) NOT NULL,
 product_code VARCHAR(80) NOT NULL,
 movement_type VARCHAR(40) NOT NULL,
 quantity INT UNSIGNED NOT NULL,
 stock_before INT NOT NULL,
 stock_after INT NOT NULL,
 processed_by BIGINT UNSIGNED NOT NULL,
 record_json LONGTEXT NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY direct_movement_once(sale_id,product_code,movement_type),
 FOREIGN KEY(sale_id) REFERENCES direct_sales(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS direct_sale_receipts (
 id VARCHAR(48) PRIMARY KEY,
 sale_id VARCHAR(64) NOT NULL,
 payment_id VARCHAR(48) NOT NULL,
 storage_name VARCHAR(255) NOT NULL,
 record_json TEXT NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX direct_receipt_sale(sale_id),
 FOREIGN KEY(sale_id) REFERENCES direct_sales(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS direct_purchase_inventory (
 entrepreneur_member_id VARCHAR(40) NOT NULL,
 product_code VARCHAR(80) NOT NULL,
 quantity INT UNSIGNED NOT NULL DEFAULT 0,
 PRIMARY KEY(entrepreneur_member_id,product_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
