ALTER TABLE departments
ADD CONSTRAINT departments_name_unique
UNIQUE (name);