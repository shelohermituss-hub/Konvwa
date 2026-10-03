-- Full address text shown to clients and copied as-is by "Copier l'adresse"
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS copy_text text;

UPDATE warehouses SET copy_text = E'shelo hermitus\n6325 N Orange Blossom Trl Ste 132\nHT06488\nOrlando, Florida, 32810\nUS'
 WHERE code = 'MCO-WH1';

UPDATE warehouses SET copy_text = E'shelo hermitus\nFor delivery instructions: Your supplier must contact us via we chat ID: zhanghui294737 With your Locker ID#\nHT06488\nShenzhen, Guangdong\nCN'
 WHERE code = 'SHZ-WH1';
